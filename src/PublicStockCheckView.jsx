import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const ORANGE = '#C2410C';
const ORANGE_DK = '#9A3412';
const NAME_STORAGE_KEY = 'stockCheck_yourName';

const CARD_RADIUS = 16;
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -8px rgba(15,23,42,0.10)';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const LEVELS = [
  { key: 'ok',         label: 'Stocked',     color: '#15803D', tint: '#F0FDF4' },
  { key: 'low',        label: 'Running Low', color: '#BE185D', tint: '#FDF2F8' },
  { key: 'order_soon', label: 'Urgent',      color: '#DC2626', tint: '#FEF2F2' },
];
const LEVEL_LABEL = Object.fromEntries(LEVELS.map(l => [l.key, l.label]));

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function loadStoredName() {
  try { return localStorage.getItem(NAME_STORAGE_KEY) || ''; } catch { return ''; }
}
function storeName(name) {
  try { localStorage.setItem(NAME_STORAGE_KEY, name); } catch { /* private browsing etc. -- fine to skip */ }
}

// iOS Safari auto-zooms the whole page on focus for any text input/select
// under 16px -- 16px avoids it without disabling pinch-zoom.
const inputStyle = {
  width: '100%', fontSize: 16, padding: '11px 12px', borderRadius: 10,
  border: '1px solid #E5E9EF', color: '#1E293B', fontFamily: 'inherit', boxSizing: 'border-box',
  background: '#FAFBFC',
};
const labelStyle = { fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' };
const pillButtonStyle = (active, tint) => ({
  padding: '8px 15px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  border: active ? 'none' : '1px solid #E5E9EF',
  background: active ? tint : 'white',
  color: active ? 'white' : '#475569',
  transition: 'background 0.15s, color 0.15s',
});

// Staff-facing, no login: a quick EOD walk through an admin-curated SKU
// group (see R-Stock -> Groups), tapping each item Stocked/Running Low/Urgent, then
// one batch Submit. Writes to the same staff_flag_level signal Transfer
// Hub's old Flag Low Stock used to -- see supabase/functions/public-stock-check.

export default function PublicStockCheckView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState(loadStoredName);

  const [step, setStep] = useState('setup'); // 'setup' | 'checklist' | 'done'
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [levels, setLevels] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmIncomplete, setConfirmIncomplete] = useState(false);
  const [doneSummary, setDoneSummary] = useState(null);

  const load = useCallback(async (extra) => {
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-stock-check', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token, ...extra },
      });
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
      return result;
    } catch (e) {
      setError(e.message || 'Unable to load Stock Check.');
      throw e;
    }
  }, [token]);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);

  useEffect(() => {
    if (!selectedLocationId && data?.locations?.[0]) setSelectedLocationId(data.locations[0].id);
  }, [data, selectedLocationId]);

  function handleNameChange(v) {
    setName(v);
    storeName(v);
  }

  const selectedGroup = useMemo(
    () => data?.groups.find(g => g.id === selectedGroupId) || null,
    [data, selectedGroupId]
  );

  // A group's SKUs might not all be carried at every site -- only show
  // ones that actually have a stock_item_sites row at the chosen site.
  const carriedIds = useMemo(() => {
    if (!data || !selectedLocationId) return new Set();
    return new Set(data.siteRows.filter(r => r.location_id === selectedLocationId).map(r => r.item_id));
  }, [data, selectedLocationId]);

  const checklistItems = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.items.filter(i => carriedIds.has(i.id));
  }, [selectedGroup, carriedIds]);

  // Last-known flag per item at this site, for context only -- staff still
  // has to make an explicit tap, this doesn't pre-fill anything.
  const existingFlagByItem = useMemo(() => {
    const map = new Map();
    if (!data || !selectedLocationId) return map;
    for (const r of data.siteRows) {
      if (r.location_id === selectedLocationId && r.staff_flag_level) map.set(r.item_id, r);
    }
    return map;
  }, [data, selectedLocationId]);

  const checkedCount = useMemo(
    () => checklistItems.filter(i => levels[i.id]).length,
    [checklistItems, levels]
  );

  function startCheck() {
    if (!selectedGroupId || !selectedLocationId) return;
    setLevels({});
    setSubmitError(null);
    setConfirmIncomplete(false);
    setStep('checklist');
  }

  function setLevel(itemId, level) {
    setLevels(prev => ({ ...prev, [itemId]: level }));
    setConfirmIncomplete(false);
  }

  function changeChecklist() {
    setStep('setup');
    setSelectedGroupId(null);
    setLevels({});
    setSubmitError(null);
    setConfirmIncomplete(false);
  }

  async function handleSubmit() {
    const entries = checklistItems
      .filter(i => levels[i.id])
      .map(i => ({ itemId: i.id, level: levels[i.id] }));

    if (entries.length === 0) {
      setSubmitError('Tap at least one item before submitting.');
      return;
    }
    if (entries.length < checklistItems.length && !confirmIncomplete) {
      setConfirmIncomplete(true);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await load({ action: 'submit', locationId: selectedLocationId, name, entries });
      setDoneSummary({
        low: entries.filter(e => e.level === 'low').length,
        orderSoon: entries.filter(e => e.level === 'order_soon').length,
        ok: entries.filter(e => e.level === 'ok').length,
      });
      setStep('done');
    } catch (e) {
      setSubmitError(e.message || 'Could not submit the check.');
    } finally {
      setSubmitting(false);
      setConfirmIncomplete(false);
    }
  }

  function runAnother() {
    setStep('setup');
    setSelectedGroupId(null);
    setLevels({});
    setDoneSummary(null);
    setSubmitError(null);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: ORANGE,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: FONT }}>Loading Stock Check…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 16, padding: '32px 24px', maxWidth: 360, textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#1E293B', fontWeight: 700, marginBottom: 6, fontFamily: FONT }}>Couldn't load Stock Check</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: FONT }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const statusPill = step === 'checklist'
    ? `${checkedCount}/${checklistItems.length} checked`
    : step === 'done'
    ? 'Submitted'
    : `${data.groups.length} checklist${data.groups.length !== 1 ? 's' : ''} available`;

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F8', padding: '16px 12px 32px', fontFamily: FONT, touchAction: 'manipulation' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${ORANGE}, #EA580C)`, borderRadius: CARD_RADIUS,
          padding: '20px 20px 18px', boxShadow: '0 10px 24px -10px rgba(194,65,12,0.5)', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                {data.businessName}
              </div>
              <div style={{ color: 'white', fontSize: 23, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                Stock Check
              </div>
            </div>
            <a
              href={`/hub/${token}`}
              title="Back to Staff Hub"
              style={{
                width: 36, height: 36, borderRadius: 999, background: 'rgba(255,255,255,0.16)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
                fontSize: 16, flexShrink: 0,
              }}
            >
              🏠
            </a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <span style={{
              background: 'white', color: ORANGE_DK,
              fontSize: 12.5, fontWeight: 800, padding: '5px 12px', borderRadius: 999,
            }}>
              {statusPill}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, fontWeight: 500 }}>No login required</span>
          </div>
        </div>

        {step === 'setup' && (
          <SetupStep
            data={data}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
            selectedLocationId={selectedLocationId}
            onSelectLocation={setSelectedLocationId}
            name={name}
            onNameChange={handleNameChange}
            onStart={startCheck}
          />
        )}

        {step === 'checklist' && (
          <ChecklistStep
            group={selectedGroup}
            items={checklistItems}
            levels={levels}
            onSetLevel={setLevel}
            existingFlagByItem={existingFlagByItem}
            checkedCount={checkedCount}
            onChangeChecklist={changeChecklist}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitError={submitError}
            confirmIncomplete={confirmIncomplete}
          />
        )}

        {step === 'done' && (
          <DoneStep summary={doneSummary} onRunAnother={runAnother} />
        )}

        <p style={{ textAlign: 'center', color: '#B5BEC9', fontSize: 11, marginTop: 22, marginBottom: 0 }}>
          Powered by Recess Roster
        </p>
      </div>
    </div>
  );
}

function SetupStep({ data, selectedGroupId, onSelectGroup, selectedLocationId, onSelectLocation, name, onNameChange, onStart }) {
  if (data.groups.length === 0) {
    return (
      <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '36px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>📦</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>No checklists set up yet</div>
        <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 3 }}>Ask an admin to create one in R-Stock → Groups.</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Which checklist?</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.groups.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGroup(g.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '13px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                border: selectedGroupId === g.id ? `1.5px solid ${ORANGE}` : '1px solid #E5E9EF',
                background: selectedGroupId === g.id ? '#FFF7ED' : 'white',
              }}
            >
              <span style={{ fontSize: 14.5, fontWeight: 700, color: '#1E293B' }}>{g.name}</span>
              <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0 }}>{g.items.length} SKU{g.items.length !== 1 ? 's' : ''}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedGroupId && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Which site</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {data.locations.map(loc => (
                <button type="button" key={loc.id} onClick={() => onSelectLocation(loc.id)} style={pillButtonStyle(selectedLocationId === loc.id, ORANGE)}>
                  {loc.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Your name</label>
            <input value={name} onChange={e => onNameChange(e.target.value)} placeholder="So this check has a name on it" style={inputStyle} />
          </div>

          <button
            type="button"
            onClick={onStart}
            disabled={!selectedLocationId}
            style={{
              width: '100%', padding: '14px', borderRadius: 11, border: 'none', cursor: 'pointer',
              background: ORANGE, color: 'white', fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
              opacity: selectedLocationId ? 1 : 0.5,
              boxShadow: '0 4px 12px -4px rgba(194,65,12,0.5)',
            }}
          >
            Start Check
          </button>
        </>
      )}
    </div>
  );
}

function ChecklistStep({ group, items, levels, onSetLevel, existingFlagByItem, checkedCount, onChangeChecklist, onSubmit, submitting, submitError, confirmIncomplete }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>{group?.name}</span>
        <button type="button" onClick={onChangeChecklist} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Change checklist
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '36px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13.5, color: '#64748B' }}>None of this checklist's SKUs are carried at this site.</div>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden', marginBottom: 12 }}>
          {items.map((item, idx) => {
            const existing = !levels[item.id] ? existingFlagByItem.get(item.id) : null;
            return (
              <div key={item.id} style={{ padding: '13px 16px', borderBottom: idx === items.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{item.name}</div>
                    <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 1 }}>
                      {item.sku} · {item.uom}
                      {existing && ` · previously ${LEVEL_LABEL[existing.staff_flag_level].toLowerCase()} (${timeAgo(existing.staff_flagged_at)})`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {LEVELS.map(l => (
                    <button
                      key={l.key}
                      type="button"
                      onClick={() => onSetLevel(item.id, l.key)}
                      style={{ ...pillButtonStyle(levels[item.id] === l.key, l.color), flex: 1, padding: '8px 6px', textAlign: 'center' }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmIncomplete && (
        <div style={{ fontSize: 12, color: '#B45309', fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>
          {items.length - checkedCount} item{items.length - checkedCount !== 1 ? 's' : ''} not checked — tap Submit again to send anyway.
        </div>
      )}
      {submitError && <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 500, marginBottom: 8, textAlign: 'center' }}>{submitError}</div>}

      {items.length > 0 && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          style={{
            width: '100%', padding: '14px', borderRadius: 11, border: 'none', cursor: submitting ? 'default' : 'pointer',
            background: ORANGE, color: 'white', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', opacity: submitting ? 0.6 : 1,
            boxShadow: submitting ? 'none' : '0 4px 12px -4px rgba(194,65,12,0.5)',
          }}
        >
          {submitting ? 'Submitting…' : `Submit Check (${checkedCount}/${items.length})`}
        </button>
      )}
    </>
  );
}

function DoneStep({ summary, onRunAnother }) {
  const parts = [];
  if (summary?.orderSoon > 0) parts.push(`${summary.orderSoon} Urgent`);
  if (summary?.low > 0) parts.push(`${summary.low} Running Low`);
  if (summary?.ok > 0) parts.push(`${summary.ok} Stocked`);

  return (
    <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '36px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>✅</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', marginBottom: 6 }}>Check submitted</div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
        {parts.length > 0 ? parts.join(' · ') : 'All good — nothing flagged'}
      </div>
      <button
        type="button"
        onClick={onRunAnother}
        style={{
          width: '100%', padding: '13px', borderRadius: 11, border: 'none', cursor: 'pointer',
          background: ORANGE, color: 'white', fontSize: 14.5, fontWeight: 800, fontFamily: 'inherit',
        }}
      >
        Run Another Check
      </button>
    </div>
  );
}
