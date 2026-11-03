import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const NAME_STORAGE_KEY = 'stockCheck_yourName';

// Tactile Clipboard: a literal paper-checklist metaphor (kraft paper, ruled
// lines, square checkboxes, a stamped submit button) instead of the
// gradient-header/pill-badge template the rest of the staff pages use --
// this is the pilot for a broader design-language rethink, scoped to just
// this one feature for now.
const PAPER = '#F2EADA';
const PAPER_LIGHT = '#FBF6EC';
const INK = '#2A2A28';
const INK_MUTED = '#6B6456';
const INK_FAINT = '#A89F8C';
const RED = '#C1442D';
const AMBER = '#D9A441';
const BORDER_LIGHT = '#C9C0AC';
const DASH = '#BDB3A0';

const DISPLAY_FONT = "'Archivo Black', sans-serif";
const BODY_FONT = "'DM Sans', sans-serif";

const LEVELS = [
  { key: 'ok',         label: 'Stocked',     fill: INK },
  { key: 'low',        label: 'Running Low', fill: AMBER },
  { key: 'order_soon', label: 'Urgent',      fill: RED },
];
const LEVEL_LABEL = Object.fromEntries(LEVELS.map(l => [l.key, l.label]));
// Amber reads better with dark text on it than light -- the other two fills
// are dark/saturated enough that paper-colored text is the contrast winner.
const LEVEL_TEXT_ON_FILL = { ok: PAPER, low: INK, order_soon: PAPER };

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
  width: '100%', fontSize: 16, padding: '12px 14px', fontFamily: BODY_FONT,
  border: `2px solid ${INK}`, color: INK, background: PAPER_LIGHT, boxSizing: 'border-box',
};
const labelStyle = {
  fontSize: 11, fontWeight: 700, color: INK_MUTED, textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 8, display: 'block', fontFamily: BODY_FONT,
};

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function CheckIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.6" aria-hidden="true">
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}
function WarningIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="1.8" aria-hidden="true">
      <path d="M12 4l9 16H3L12 4z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// A stamped, offset-shadow button -- the house style for every primary
// action on this page (Start Check, Submit Check, Run Another Check).
function StampButton({ children, onClick, disabled, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', fontFamily: DISPLAY_FONT, fontSize: 14, letterSpacing: '0.02em',
        textTransform: 'uppercase', color: INK, background: PAPER_LIGHT,
        border: `2.5px solid ${INK}`, boxShadow: disabled ? 'none' : `4px 4px 0 ${INK}`,
        padding: '14px 20px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
        transform: disabled ? 'translate(4px, 4px)' : 'none',
      }}
    >
      {children}
    </button>
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

  const fontImport = "@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:wght@400;500;700&display=swap');";

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`${fontImport} @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, border: `3px solid ${BORDER_LIGHT}`, borderTopColor: RED,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: INK_MUTED, fontSize: 14, fontFamily: BODY_FONT }}>Loading Stock Check…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <style>{fontImport}</style>
        <div style={{ background: PAPER_LIGHT, border: `2px solid ${INK}`, padding: '32px 24px', maxWidth: 340, textAlign: 'center' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><WarningIcon /></div>
          <p style={{ color: INK, fontFamily: DISPLAY_FONT, fontSize: 14, marginBottom: 8, textTransform: 'uppercase' }}>Couldn't load Stock Check</p>
          <p style={{ color: INK_MUTED, fontSize: 13, fontFamily: BODY_FONT }}>{error}</p>
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

  const statusText = step === 'checklist'
    ? `${checkedCount}/${checklistItems.length} CHECKED`
    : step === 'done'
    ? 'SUBMITTED'
    : `${data.groups.length} LIST${data.groups.length !== 1 ? 'S' : ''}`;

  return (
    <div style={{ minHeight: '100vh', ...{ background: PAPER, backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 34px, rgba(42,42,40,0.07) 35px)' }, fontFamily: BODY_FONT, touchAction: 'manipulation' }}>
      <style>{`${fontImport} @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 460, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '26px 20px 16px', borderBottom: `3px double ${INK}`, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK_MUTED }}>{data.businessName}</div>
            <a href={`/hub/${token}`} aria-label="Back to Staff Hub" style={{ color: INK, textDecoration: 'none', display: 'flex' }}>
              <HomeIcon />
            </a>
          </div>
          <h1 style={{ margin: 0, fontFamily: DISPLAY_FONT, fontSize: 24, textTransform: 'uppercase', letterSpacing: '0.01em', color: INK }}>
            Stock Check
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: INK_MUTED, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: RED, whiteSpace: 'nowrap' }}>{statusText}</span>
          </div>
        </div>

        <div style={{ padding: '18px 20px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>

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

        <p style={{ textAlign: 'center', color: INK_FAINT, fontSize: 11, padding: '0 20px 24px', marginTop: 'auto' }}>
          Powered by Recess Roster
        </p>
      </div>
    </div>
  );
}

function SetupStep({ data, selectedGroupId, onSelectGroup, selectedLocationId, onSelectLocation, name, onNameChange, onStart }) {
  if (data.groups.length === 0) {
    return (
      <div style={{ border: `2px solid ${INK}`, background: PAPER_LIGHT, padding: '36px 20px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><BoxIcon /></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>No checklists set up yet</div>
        <div style={{ fontSize: 12.5, color: INK_MUTED, marginTop: 4 }}>Ask an admin to create one in R-Stock &rarr; Groups.</div>
      </div>
    );
  }

  return (
    <div>
      <label style={labelStyle}>Which checklist?</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {data.groups.map(g => {
          const active = selectedGroupId === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGroup(g.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                border: `2px solid ${INK}`, background: active ? PAPER_LIGHT : 'transparent',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: INK }}>{g.name}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: INK_MUTED, marginTop: 2 }}>{g.items.length} SKU{g.items.length !== 1 ? 's' : ''}</span>
              </span>
              <span style={{
                width: 26, height: 26, flexShrink: 0, border: `2px solid ${INK}`,
                background: active ? INK : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {active && <CheckIcon size={14} color={PAPER} />}
              </span>
            </button>
          );
        })}
      </div>

      {selectedGroupId && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Which site</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {data.locations.map(loc => {
                const active = selectedLocationId === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => onSelectLocation(loc.id)}
                    style={{
                      flex: '1 0 auto', padding: '11px 14px', minHeight: 44, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                      border: `2px solid ${INK}`, background: active ? INK : 'transparent', color: active ? PAPER : INK, cursor: 'pointer',
                    }}
                  >
                    {loc.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Your name</label>
            <input value={name} onChange={e => onNameChange(e.target.value)} placeholder="So this check has a name on it" style={inputStyle} />
          </div>

          <StampButton onClick={onStart} disabled={!selectedLocationId}>Start Check</StampButton>
        </>
      )}
    </div>
  );
}

function ChecklistStep({ items, levels, onSetLevel, existingFlagByItem, checkedCount, onChangeChecklist, onSubmit, submitting, submitError, confirmIncomplete }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          type="button"
          onClick={onChangeChecklist}
          style={{ background: 'none', border: 'none', color: INK_MUTED, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}
        >
          &larr; Change checklist
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{ border: `2px solid ${INK}`, background: PAPER_LIGHT, padding: '36px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13.5, color: INK_MUTED }}>None of this checklist's SKUs are carried at this site.</div>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {items.map((item, idx) => {
            const existing = !levels[item.id] ? existingFlagByItem.get(item.id) : null;
            return (
              <div key={item.id} style={{ borderTop: idx === 0 ? 'none' : `1px dashed ${DASH}`, padding: '14px 0' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: INK_FAINT, width: 20, flexShrink: 0 }}>{String(idx + 1).padStart(2, '0')}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{item.name}</div>
                    <div style={{ fontSize: 11.5, color: INK_MUTED, marginTop: 1 }}>
                      {item.sku} &middot; {item.uom}
                      {existing && ` · previously ${LEVEL_LABEL[existing.staff_flag_level].toLowerCase()} (${timeAgo(existing.staff_flagged_at)})`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, paddingLeft: 30 }}>
                  {LEVELS.map(l => {
                    const active = levels[item.id] === l.key;
                    const textColor = active ? LEVEL_TEXT_ON_FILL[l.key] : INK;
                    return (
                      <button
                        key={l.key}
                        type="button"
                        onClick={() => onSetLevel(item.id, l.key)}
                        style={{
                          flex: 1, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          border: `2px solid ${INK}`, background: active ? l.fill : 'transparent',
                          color: textColor, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
                          fontFamily: BODY_FONT, cursor: 'pointer', padding: '0 4px',
                        }}
                      >
                        {active && <CheckIcon size={11} color={textColor} />}
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

      {confirmIncomplete && (
        <div style={{ fontSize: 12.5, color: RED, fontWeight: 700, marginBottom: 10, textAlign: 'center' }}>
          {items.length - checkedCount} item{items.length - checkedCount !== 1 ? 's' : ''} not checked &mdash; tap Submit again to send anyway.
        </div>
      )}
      {submitError && <div style={{ fontSize: 12.5, color: RED, fontWeight: 500, marginBottom: 10, textAlign: 'center' }}>{submitError}</div>}

      {items.length > 0 && (
        <StampButton onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : `Submit Check (${checkedCount}/${items.length})`}
        </StampButton>
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
    <div style={{ border: `2px solid ${INK}`, background: PAPER_LIGHT, padding: '40px 24px', textAlign: 'center' }}>
      <div style={{
        width: 64, height: 64, border: `3px solid ${INK}`, margin: '0 auto 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CheckIcon size={28} color={INK} />
      </div>
      <div style={{ fontFamily: DISPLAY_FONT, fontSize: 17, color: INK, marginBottom: 8, textTransform: 'uppercase' }}>Check Submitted</div>
      <div style={{ fontSize: 13.5, color: INK_MUTED, marginBottom: 24 }}>
        {parts.length > 0 ? parts.join(' · ') : 'All good — nothing flagged'}
      </div>
      <StampButton onClick={onRunAnother}>Run Another Check</StampButton>
    </div>
  );
}
