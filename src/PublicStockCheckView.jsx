import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const NAME_STORAGE_KEY = 'stockCheck_yourName';

// R-Shift's own brand system -- the same tokens used across every R-Shift
// email (send-schedule-email, send-order-status-email): blue gradient
// header with the app logo, a white card with a closing tinted accent
// strip, and the same status palette the order-status email already uses
// for good/warn/bad. Rooted in that real source rather than inventing a
// new look, so this reads as one consistent product instead of each
// screen (or each staff page) picking its own aesthetic.
const BRAND = '#3B5BDB';
const BRAND_DARK = '#2D4EC9';
const BODY_BG = '#F1F5F9';
const CARD_BORDER = '#E2E8F0';
const ROW_BORDER = '#F1F5F9';
const TEXT_PRIMARY = '#1E293B';
const TEXT_SECONDARY = '#334155';
const TEXT_MUTED = '#64748B';
const TEXT_FAINT = '#94A3B8';
const LABEL_BG = '#F8FAFC';
const ACCENT_BG = '#EEF2FF';
const ACCENT_BORDER = '#C7D2FE';
const ACCENT_TEXT = '#3730A3';
const GOOD = '#0f9d4e';
const GOOD_BG = '#EAF7EF';
const WARN = '#B45309';
const WARN_BG = '#FFFBEB';
const BAD = '#d0393b';
const BAD_BG = '#FDECEC';
const LOGO_URL = '/logo192.png';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const LEVELS = [
  { key: 'ok',         label: 'Stocked',     color: GOOD, bg: GOOD_BG },
  { key: 'low',        label: 'Running Low', color: WARN, bg: WARN_BG },
  { key: 'order_soon', label: 'Urgent',      color: BAD,  bg: BAD_BG },
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
  width: '100%', fontSize: 16, padding: '11px 14px', fontFamily: FONT,
  borderRadius: 10, border: `1px solid ${CARD_BORDER}`, color: TEXT_PRIMARY, background: LABEL_BG, boxSizing: 'border-box',
};
const eyebrowStyle = {
  fontSize: 10, fontWeight: 700, color: TEXT_FAINT, textTransform: 'uppercase',
  letterSpacing: '0.07em', marginBottom: 8, display: 'block',
};
const primaryButtonStyle = (disabled) => ({
  width: '100%', padding: '13px 20px', borderRadius: 11, border: 'none', cursor: disabled ? 'default' : 'pointer',
  background: BRAND, color: '#ffffff', fontSize: 15, fontWeight: 700, fontFamily: FONT,
  opacity: disabled ? 0.55 : 1, boxShadow: disabled ? 'none' : '0 4px 12px -4px rgba(59,91,219,0.45)',
});

function HomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function CheckIcon({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="1.6" aria-hidden="true">
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

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
      <div style={{ minHeight: '100vh', background: BODY_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, border: `3px solid ${CARD_BORDER}`, borderTopColor: BRAND,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: TEXT_MUTED, fontSize: 14 }}>Loading Stock Check…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ minHeight: '100vh', background: BODY_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT }}>
        <div style={{ background: '#ffffff', border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: '32px 24px', maxWidth: 340, textAlign: 'center' }}>
          <p style={{ color: TEXT_PRIMARY, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Couldn't load Stock Check</p>
          <p style={{ color: TEXT_MUTED, fontSize: 13 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const subtitle = step === 'checklist'
    ? `${selectedGroup?.name || ''} · ${data.locations.find(l => l.id === selectedLocationId)?.name || ''}`
    : step === 'done'
    ? 'Checklist complete'
    : 'No login required';

  const headerPill = step === 'checklist'
    ? `${checkedCount}/${checklistItems.length}`
    : step === 'done'
    ? 'Done'
    : `${data.groups.length} list${data.groups.length !== 1 ? 's' : ''}`;

  return (
    <div style={{ minHeight: '100vh', background: BODY_BG, padding: '20px 14px 32px', fontFamily: FONT, touchAction: 'manipulation' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>

        {/* Brand header -- same gradient, logo badge and eyebrow label as
            the R-Shift emails, so this reads as the same product. */}
        <div style={{
          background: BRAND, backgroundImage: `linear-gradient(160deg, ${BRAND}, ${BRAND_DARK})`,
          borderRadius: '14px 14px 0 0', padding: '20px 22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <img src={LOGO_URL} alt="" width={36} height={36} style={{ display: 'block', borderRadius: 10, flexShrink: 0, objectFit: 'cover' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.75)' }}>R-Shift &middot; Stock Check</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#ffffff', marginTop: 1 }}>Stock Check</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{
                fontSize: 11.5, fontWeight: 700, color: '#ffffff', background: 'rgba(255,255,255,0.2)',
                padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
              }}>
                {headerPill}
              </span>
              <a
                href={`/hub/${token}`}
                aria-label="Back to Staff Hub"
                style={{
                  width: 28, height: 28, borderRadius: 999, background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', textDecoration: 'none', flexShrink: 0,
                }}
              >
                <HomeIcon />
              </a>
            </div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 10 }}>{subtitle}</div>
        </div>

        {/* Body card */}
        <div style={{ background: '#ffffff', borderLeft: `1px solid ${CARD_BORDER}`, borderRight: `1px solid ${CARD_BORDER}`, borderBottom: `1px solid ${CARD_BORDER}`, borderRadius: '0 0 14px 14px', padding: '18px 18px 20px' }}>

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

        </div>

        <div style={{ textAlign: 'center', padding: '16px 4px 0' }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: BRAND, marginRight: 6, verticalAlign: 'middle' }} />
          <span style={{ fontSize: 11, color: TEXT_FAINT, verticalAlign: 'middle' }}>R-Shift</span>
        </div>
      </div>
    </div>
  );
}

function SetupStep({ data, selectedGroupId, onSelectGroup, selectedLocationId, onSelectLocation, name, onNameChange, onStart }) {
  if (data.groups.length === 0) {
    return (
      <div style={{ padding: '28px 10px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><BoxIcon /></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>No checklists set up yet</div>
        <div style={{ fontSize: 12.5, color: TEXT_FAINT, marginTop: 4 }}>Ask an admin to create one in R-Stock &rarr; Groups.</div>
      </div>
    );
  }

  return (
    <div>
      <label style={eyebrowStyle}>Which checklist?</label>
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 18, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
        {data.groups.map((g, idx) => {
          const active = selectedGroupId === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGroup(g.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '13px 14px', cursor: 'pointer', fontFamily: FONT, textAlign: 'left', border: 'none',
                borderTop: idx === 0 ? 'none' : `1px solid ${ROW_BORDER}`,
                background: active ? ACCENT_BG : '#ffffff',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: TEXT_PRIMARY }}>{g.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: TEXT_FAINT, marginTop: 2 }}>{g.items.length} SKU{g.items.length !== 1 ? 's' : ''}</span>
              </span>
              <span style={{
                width: 24, height: 24, flexShrink: 0, borderRadius: 999,
                background: active ? BRAND : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {active && <CheckIcon size={12} color="#ffffff" />}
              </span>
            </button>
          );
        })}
      </div>

      {selectedGroupId && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={eyebrowStyle}>Which site</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {data.locations.map(loc => {
                const active = selectedLocationId === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => onSelectLocation(loc.id)}
                    style={{
                      flex: '1 0 auto', padding: '10px 14px', minHeight: 44, fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
                      borderRadius: 10, border: `1px solid ${active ? BRAND : CARD_BORDER}`,
                      background: active ? BRAND : '#ffffff', color: active ? '#ffffff' : TEXT_SECONDARY, cursor: 'pointer',
                    }}
                  >
                    {loc.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={eyebrowStyle}>Your name</label>
            <input value={name} onChange={e => onNameChange(e.target.value)} placeholder="So this check has a name on it" style={inputStyle} />
          </div>

          <button type="button" onClick={onStart} disabled={!selectedLocationId} style={primaryButtonStyle(!selectedLocationId)}>
            Start Check
          </button>
        </>
      )}
    </div>
  );
}

function ChecklistStep({ items, levels, onSetLevel, existingFlagByItem, checkedCount, onChangeChecklist, onSubmit, submitting, submitError, confirmIncomplete }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button
          type="button"
          onClick={onChangeChecklist}
          style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, padding: '4px 0' }}
        >
          &larr; Change checklist
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '28px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 13.5, color: TEXT_MUTED }}>None of this checklist's SKUs are carried at this site.</div>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          {items.map((item, idx) => {
            const existing = !levels[item.id] ? existingFlagByItem.get(item.id) : null;
            return (
              <div key={item.id} style={{ borderTop: idx === 0 ? 'none' : `1px solid ${ROW_BORDER}`, padding: '13px 0' }}>
                <div style={{ marginBottom: 9 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: TEXT_PRIMARY }}>{item.name}</div>
                  <div style={{ fontSize: 11.5, color: TEXT_FAINT, marginTop: 1 }}>
                    {item.sku} &middot; {item.uom}
                    {existing && ` · previously ${LEVEL_LABEL[existing.staff_flag_level].toLowerCase()} (${timeAgo(existing.staff_flagged_at)})`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {LEVELS.map(l => {
                    const active = levels[item.id] === l.key;
                    return (
                      <button
                        key={l.key}
                        type="button"
                        onClick={() => onSetLevel(item.id, l.key)}
                        style={{
                          flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          borderRadius: 7, border: 'none', borderLeft: active ? `4px solid ${l.color}` : `1px solid ${CARD_BORDER}`,
                          background: active ? l.bg : '#ffffff',
                          color: active ? l.color : TEXT_SECONDARY, fontSize: 11.5, fontWeight: 700,
                          fontFamily: FONT, cursor: 'pointer', padding: '0 4px',
                        }}
                      >
                        {active && <CheckIcon size={11} color={l.color} />}
                        {l.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 10, padding: '11px 16px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT_TEXT }}>Checked</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: BRAND }}>{checkedCount}/{items.length}</span>
        </div>
      )}

      {confirmIncomplete && (
        <div style={{ fontSize: 12.5, color: WARN, fontWeight: 600, marginBottom: 10, textAlign: 'center' }}>
          {items.length - checkedCount} item{items.length - checkedCount !== 1 ? 's' : ''} not checked &mdash; tap Submit again to send anyway.
        </div>
      )}
      {submitError && <div style={{ fontSize: 12.5, color: BAD, fontWeight: 500, marginBottom: 10, textAlign: 'center' }}>{submitError}</div>}

      {items.length > 0 && (
        <button type="button" onClick={onSubmit} disabled={submitting} style={primaryButtonStyle(submitting)}>
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
    <div style={{ padding: '22px 6px 6px', textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 999, background: GOOD, margin: '0 auto 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CheckIcon size={22} color="#ffffff" />
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: GOOD, marginBottom: 6 }}>Check submitted</div>
      <div style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 22 }}>
        {parts.length > 0 ? parts.join(' · ') : 'All good — nothing flagged'}
      </div>
      <button type="button" onClick={onRunAnother} style={primaryButtonStyle(false)}>
        Run Another Check
      </button>
    </div>
  );
}
