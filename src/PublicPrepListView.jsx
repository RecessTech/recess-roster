import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { PinPad, BLUE, RED, INK, MUTED, FAINT, HAIRLINE, FONT } from './PublicMyRosterView';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const BRAND_DARK = '#2D4EC9';
const BODY_BG = '#F1F5F9';
const PIN_STORAGE_KEY = (token) => `rr_preplist_pin_${token}`;

const URGENT = '#DC2626';
const URGENT_BG = '#FEF2F2';
const LOW = '#B45309';
const LOW_BG = '#FFFBEB';
const STATUS_META = {
  urgent: { label: 'Urgent', color: URGENT, bg: URGENT_BG },
  low: { label: 'Running Low', color: LOW, bg: LOW_BG },
  ok: { label: 'All good', color: FAINT, bg: '#F1F5F9' },
};

function readStoredPin(token) {
  try { return sessionStorage.getItem(PIN_STORAGE_KEY(token)) || ''; } catch { return ''; }
}
function storePin(token, pin) {
  try { sessionStorage.setItem(PIN_STORAGE_KEY(token), pin); } catch { /* private mode */ }
}
function clearStoredPin(token) {
  try { sessionStorage.removeItem(PIN_STORAGE_KEY(token)); } catch { /* ignore */ }
}

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function fmtQty(n) {
  if (n == null || n === '') return '';
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  return num % 1 === 0 ? String(num) : num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// One colour per assignee, so a glance at the list tells you whose task is
// whose without reading every name. Cycles by a hash of the name rather
// than a fixed name->colour map, so it still works if the staff list grows
// beyond today's four.
const ASSIGNEE_PALETTE = [
  { text: '#3B5BDB', bg: '#EEF2FF' }, // blue
  { text: '#9333EA', bg: '#F3E8FF' }, // purple
  { text: '#0D9488', bg: '#CCFBF1' }, // teal
  { text: '#DB2777', bg: '#FCE7F3' }, // pink
  { text: '#B45309', bg: '#FEF3C7' }, // amber
  { text: '#059669', bg: '#D1FAE5' }, // green
];
function assigneeColor(name) {
  if (!name) return ASSIGNEE_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return ASSIGNEE_PALETTE[Math.abs(hash) % ASSIGNEE_PALETTE.length];
}

// iOS Safari auto-zooms the whole page on focus for any text input/select
// under 16px -- 16px avoids it without disabling pinch-zoom.
const inputStyle = {
  width: '100%', fontSize: 16, padding: '11px 12px', borderRadius: 10,
  border: '1px solid #E2E8F0', color: INK, fontFamily: FONT, boxSizing: 'border-box',
  background: '#FAFBFC',
};
const miniLabelStyle = { fontSize: 9.5, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 3 };

// Two tabs, one tile: "Plan" is the staff-facing ordered list (no login,
// anyone ticks things off through the day); "Set Plan" is Clark/Paddy
// flagging tasks Urgent/Running Low -- same shape as R-Stock's Stock
// Check, no date/day granularity. A task flagged and never finished
// clears itself back to "all good" at the next local-midnight reset,
// unless carry_forward was switched on for it first.
// Both read/write supabase/functions/public-prep-list.

export default function PublicPrepListView({ token }) {
  const [tab, setTab] = useState('plan'); // 'plan' | 'setPlan'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [pin, setPin] = useState(() => readStoredPin(token));
  const [catalog, setCatalog] = useState(null); // full task list, only once unlocked
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState('');
  const [locked, setLocked] = useState(false);

  const [saveError, setSaveError] = useState(null);

  const call = useCallback(async (extra) => {
    const { data: result, error: err } = await supabase.functions.invoke('public-prep-list', {
      headers: { Authorization: `Bearer ${ANON_KEY}` },
      body: { token, ...extra },
    });
    if (err) throw new Error(err.message);
    if (result?.error) throw new Error(result.error);
    return result;
  }, [token]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await call({});
      setData(result);
    } catch (e) {
      setError(e.message || 'Unable to load the Prep List.');
    }
  }, [call]);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);

  const unlock = useCallback(async (enteredPin) => {
    setPinError(''); setPinBusy(true);
    try {
      const result = await call({ action: 'unlock', pin: enteredPin });
      storePin(token, enteredPin);
      setPin(enteredPin);
      setCatalog(result.catalog || []);
      setData(result);
      setPinError(''); setLocked(false);
    } catch (e) {
      clearStoredPin(token);
      setPin('');
      setPinError(e.message || 'Incorrect PIN.');
      setLocked(/too many/i.test(e.message || ''));
    } finally {
      setPinBusy(false);
    }
  }, [call, token]);

  // Once a stored PIN exists, silently re-unlock on arriving at Set Plan
  // rather than asking again every visit this session.
  useEffect(() => {
    if (tab === 'setPlan' && pin && !catalog && !pinBusy) {
      unlock(pin);
    }
  }, [tab, pin, catalog, pinBusy, unlock]);

  function signOutAdmin() {
    clearStoredPin(token);
    setPin(''); setCatalog(null); setPinError(''); setLocked(false);
  }

  async function toggleComplete(item) {
    const done = !item.done;
    // Flip it on screen immediately rather than waiting on the round trip.
    // The task stays on the list either way -- done just strikes it through.
    setData(prev => prev && { ...prev, planItems: prev.planItems.map(i => i.id === item.id ? { ...i, done } : i) });
    try {
      await call({ action: 'toggleComplete', itemId: item.id, done });
    } catch (e) {
      setData(prev => prev && { ...prev, planItems: prev.planItems.map(i => i.id === item.id ? { ...i, done: item.done } : i) });
      setError(e.message || 'Could not update that task.');
    }
  }

  function patchCatalogRow(taskId, patch) {
    setCatalog(prev => prev && prev.map(t => t.id === taskId ? { ...t, ...patch } : t));
  }

  async function setFlag(task, status, fields) {
    const payload = {
      qty: fields.qty ?? task.flag_qty ?? task.default_qty ?? '',
      uom: fields.uom ?? task.flag_uom ?? task.default_uom ?? '',
      assignedTo: fields.assignedTo ?? task.assigned_to ?? '',
      note: fields.note ?? task.note ?? '',
      catering: fields.catering ?? task.catering ?? false,
    };
    patchCatalogRow(task.id, {
      status, flag_qty: payload.qty, flag_uom: payload.uom, assigned_to: payload.assignedTo, note: payload.note, catering: payload.catering,
    });
    setSaveError(null);
    try {
      await call({ action: 'setFlag', pin, taskId: task.id, status, ...payload });
    } catch (e) {
      setSaveError(e.message || 'Could not save that change.');
    }
  }

  async function setCarryForward(task, carryForward) {
    patchCatalogRow(task.id, { carry_forward: carryForward });
    try {
      await call({ action: 'setCarryForward', pin, taskId: task.id, carryForward });
    } catch (e) {
      setSaveError(e.message || 'Could not save that change.');
    }
  }

  async function moveFlag(task, direction) {
    try {
      const result = await call({ action: 'setOrder', pin, taskId: task.id, direction });
      setCatalog(result.catalog || []);
    } catch (e) {
      setSaveError(e.message || 'Could not reorder that task.');
    }
  }

  async function createTask(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const result = await call({ action: 'createTask', pin, name: trimmed });
      setCatalog(prev => [...(prev || []), { ...result.task, status: 'ok' }]);
    } catch (e) {
      setSaveError(e.message || 'Could not add that task.');
    }
  }

  const planItems = data?.planItems || [];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BODY_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: BLUE, borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: MUTED, fontSize: 14 }}>Loading Prep List…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ minHeight: '100vh', background: BODY_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT }}>
        <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '32px 24px', maxWidth: 340, textAlign: 'center' }}>
          <p style={{ color: INK, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Couldn't load Prep List</p>
          <p style={{ color: MUTED, fontSize: 13 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // The PIN screen is its own full page (same as Day Roster) -- it isn't
  // nested inside the tab chrome below, which assumes it's already unlocked.
  if (tab === 'setPlan' && (!pin || !catalog)) {
    return (
      <PinPad
        token={token}
        busy={pinBusy}
        error={pinError}
        locked={locked}
        onSubmit={unlock}
        title="Set Plan"
        subtitle="Enter the roster PIN"
        icon="📋"
        hint="Ask your manager for the PIN."
      />
    );
  }

  const urgentCount = planItems.filter(i => i.status === 'urgent').length;
  const lowCount = planItems.filter(i => i.status === 'low').length;

  return (
    <div style={{ minHeight: '100vh', background: BODY_BG, padding: '20px 14px 32px', fontFamily: FONT, touchAction: 'manipulation' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>

        {/* Brand header -- same gradient/logo as every other R-Shift mobile page */}
        <div style={{ background: BLUE, backgroundImage: `linear-gradient(160deg, ${BLUE}, ${BRAND_DARK})`, borderRadius: '14px 14px 0 0', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <img src="/logo192.png" alt="" width={36} height={36} style={{ display: 'block', borderRadius: 10, flexShrink: 0, objectFit: 'cover' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.75)' }}>R-Shift &middot; Prep List</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#ffffff', marginTop: 1 }}>Prep List</div>
              </div>
            </div>
            <a href={`/hub/${token}`} aria-label="Back to Staff Hub" style={{ width: 28, height: 28, borderRadius: 999, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', textDecoration: 'none', flexShrink: 0, fontSize: 14 }}>🏠</a>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 10 }}>
            {tab === 'plan'
              ? (planItems.length === 0 ? 'All good -- nothing flagged' : `${urgentCount} urgent · ${lowCount} running low`)
              : 'Flag tasks Urgent / Running Low'}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#ffffff', borderLeft: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }}>
          {[{ key: 'plan', label: 'Plan' }, { key: 'setPlan', label: 'Set Plan' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '12px 0', border: 'none', background: 'none', cursor: 'pointer', fontFamily: FONT,
              fontSize: 13.5, fontWeight: 700, color: tab === t.key ? BLUE : MUTED,
              borderBottom: tab === t.key ? `2.5px solid ${BLUE}` : '2.5px solid transparent',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Body card */}
        <div style={{ background: '#ffffff', borderLeft: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', borderRadius: '0 0 14px 14px', padding: '18px 18px 20px' }}>
          {tab === 'plan' ? (
            <PlanTab items={planItems} onToggle={toggleComplete} error={error} />
          ) : (
            <SetPlanTab
              catalog={catalog}
              staffOptions={data.staffOptions || []}
              onSetFlag={setFlag}
              onSetCarryForward={setCarryForward}
              onMove={moveFlag}
              onCreate={createTask}
              saveError={saveError}
              onSignOut={signOutAdmin}
            />
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#B5BEC9', fontSize: 11, marginTop: 14, marginBottom: 0 }}>Powered by Recess Roster</p>
      </div>
    </div>
  );
}

function PlanTab({ items, onToggle, error }) {
  return (
    <>
      {error && <div style={{ fontSize: 12.5, color: RED, fontWeight: 500, marginBottom: 10 }}>{error}</div>}

      {items.length === 0 ? (
        <div style={{ padding: '28px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🌤️</div>
          <div style={{ fontSize: 13.5, color: MUTED }}>All good -- nothing flagged right now.</div>
        </div>
      ) : (
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          {items.map((item, idx) => {
            const meta = STATUS_META[item.status] || STATUS_META.ok;
            const qtyLabel = fmtQty(item.qty) ? `${fmtQty(item.qty)}${item.uom ? ' ' + item.uom : ''}` : '';
            const done = item.done;
            return (
              <div key={item.id} style={{
                padding: '13px 14px', borderBottom: idx === items.length - 1 ? 'none' : `1px solid ${HAIRLINE}`,
                display: 'flex', alignItems: 'flex-start', gap: 12, borderLeft: `3px solid ${meta.color}`,
                background: done ? '#FAFBFC' : 'white',
              }}>
                <button
                  onClick={() => onToggle(item)}
                  title={done ? 'Mark not done' : 'Mark done'}
                  style={{
                    width: 26, height: 26, borderRadius: 999, flexShrink: 0, cursor: 'pointer', marginTop: 1,
                    border: done ? 'none' : '2px solid #E2E8F0', background: done ? '#0f9d4e' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: done ? 'white' : '#CBD5E1', fontSize: 14,
                  }}
                >✓</button>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: done ? FAINT : meta.color, background: done ? '#F1F5F9' : meta.bg, borderRadius: 999, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{meta.label}</span>
                    {item.catering && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: done ? FAINT : '#7C3AED', background: done ? '#F1F5F9' : '#F3E8FF', borderRadius: 999, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Catering</span>
                    )}
                    {item.assignedTo && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap', borderRadius: 999, padding: '2px 8px', color: done ? FAINT : assigneeColor(item.assignedTo).text, background: done ? '#F1F5F9' : assigneeColor(item.assignedTo).bg }}>{item.assignedTo}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: done ? FAINT : INK, textDecoration: done ? 'line-through' : 'none' }}>{item.name}</div>
                  {(qtyLabel || item.note || item.flaggedAt) && (
                    <div style={{ fontSize: 11.5, color: FAINT, marginTop: 2, textDecoration: done ? 'line-through' : 'none' }}>
                      {[qtyLabel, item.note, item.flaggedAt ? `flagged ${timeAgo(item.flaggedAt)}` : ''].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function SetPlanTab({ catalog, staffOptions, onSetFlag, onSetCarryForward, onMove, onCreate, saveError, onSignOut }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  // Flagged tasks first (urgent, then low, in flag_order), unflagged
  // tasks after in catalog order -- same ordering the Plan tab gets.
  const ordered = useMemo(() => {
    const severity = { urgent: 0, low: 1, ok: 2 };
    return [...catalog].sort((a, b) => (severity[a.status] - severity[b.status]) || (a.flag_order - b.flag_order));
  }, [catalog]);

  const flaggedIds = useMemo(() => new Set(catalog.filter(t => t.status !== 'ok').map(t => t.id)), [catalog]);
  const flaggedOrdered = useMemo(() => ordered.filter(t => flaggedIds.has(t.id)), [ordered, flaggedIds]);

  const q = search.trim().toLowerCase();
  const visible = q ? ordered.filter(t => t.name.toLowerCase().includes(q)) : ordered;
  const exactMatch = catalog.some(t => t.name.toLowerCase() === q);

  function toggleExpanded(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button onClick={onSignOut} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Lock</button>
      </div>

      {saveError && <div style={{ fontSize: 12.5, color: RED, fontWeight: 500, marginBottom: 10 }}>{saveError}</div>}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search or type a new task" style={{ ...inputStyle, marginBottom: 12 }} />

      {search.trim() && !exactMatch && (
        <button onClick={() => { onCreate(search); setSearch(''); }} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginBottom: 14, padding: '11px 13px',
          border: '1px dashed #C7D2FE', borderRadius: 10, background: '#EEF2FF', color: BLUE, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
        }}>
          + Add “{search.trim()}” as a new task
        </button>
      )}

      <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '18px', textAlign: 'center', fontSize: 13, color: FAINT }}>No tasks match.</div>
        ) : visible.map((task, idx) => {
          const meta = STATUS_META[task.status] || STATUS_META.ok;
          const isFlagged = task.status !== 'ok';
          const isOpen = isFlagged && expanded.has(task.id);
          const flagIdx = flaggedOrdered.findIndex(t => t.id === task.id);

          return (
            <div key={task.id} style={{ borderTop: idx === 0 ? 'none' : `1px solid ${HAIRLINE}`, borderLeft: isFlagged ? `3px solid ${meta.color}` : 'none' }}>
              <div style={{ padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => isFlagged && toggleExpanded(task.id)}
                  disabled={!isFlagged}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', textAlign: 'left', cursor: isFlagged ? 'pointer' : 'default', padding: 0, fontFamily: FONT }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: INK, flex: 1, minWidth: 0 }}>{task.name}</span>
                  {task.catering && (
                    <span style={{ fontSize: 9.5, fontWeight: 800, whiteSpace: 'nowrap', borderRadius: 999, padding: '2px 6px', color: '#7C3AED', background: '#F3E8FF' }}>Catering</span>
                  )}
                  {task.assigned_to && (
                    <span style={{ fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', borderRadius: 999, padding: '2px 7px', color: assigneeColor(task.assigned_to).text, background: assigneeColor(task.assigned_to).bg }}>{task.assigned_to}</span>
                  )}
                  {isFlagged && <span style={{ fontSize: 12, color: FAINT, flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 6, padding: '0 12px 11px' }}>
                {['ok', 'low', 'urgent'].map(s => {
                  const active = task.status === s;
                  const m = STATUS_META[s];
                  return (
                    <button
                      key={s}
                      onClick={() => { onSetFlag(task, s, {}); if (s !== 'ok') setExpanded(prev => new Set(prev).add(task.id)); }}
                      style={{
                        flex: 1, minHeight: 36, borderRadius: 7, border: `1.5px solid ${active ? m.color : '#E2E8F0'}`,
                        background: active ? m.bg : 'white', color: active ? m.color : MUTED, fontSize: 11.5, fontWeight: 700,
                        fontFamily: FONT, cursor: 'pointer', padding: '0 4px',
                      }}
                    >{m.label}</button>
                  );
                })}
              </div>

              {isOpen && (
                <div style={{ padding: '0 12px 14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                    <div>
                      <span style={miniLabelStyle}>Qty</span>
                      <input
                        defaultValue={task.flag_qty ?? task.default_qty ?? ''}
                        onBlur={e => onSetFlag(task, task.status, { qty: e.target.value })}
                        placeholder="e.g. 2" inputMode="decimal" style={{ ...inputStyle, padding: '9px 10px' }}
                      />
                    </div>
                    <div>
                      <span style={miniLabelStyle}>Unit</span>
                      <input
                        defaultValue={task.flag_uom ?? task.default_uom ?? ''}
                        onBlur={e => onSetFlag(task, task.status, { uom: e.target.value })}
                        placeholder="e.g. kg" style={{ ...inputStyle, padding: '9px 10px' }}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={miniLabelStyle}>Assigned to</span>
                    <select
                      value={task.assigned_to || ''}
                      onChange={e => onSetFlag(task, task.status, { assignedTo: e.target.value })}
                      style={{
                        ...inputStyle, padding: '9px 10px', fontWeight: task.assigned_to ? 700 : 400,
                        color: task.assigned_to ? assigneeColor(task.assigned_to).text : FAINT,
                        background: task.assigned_to ? assigneeColor(task.assigned_to).bg : inputStyle.background,
                        borderColor: task.assigned_to ? assigneeColor(task.assigned_to).text : '#E2E8F0',
                      }}
                    >
                      <option value="">Unassigned</option>
                      {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <span style={miniLabelStyle}>Note</span>
                    <input
                      defaultValue={task.note || ''}
                      onBlur={e => onSetFlag(task, task.status, { note: e.target.value })}
                      placeholder="Optional" style={{ ...inputStyle, padding: '9px 10px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: MUTED, fontWeight: 600, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!task.catering} onChange={e => onSetFlag(task, task.status, { catering: e.target.checked })} />
                      Catering
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: MUTED, fontWeight: 600, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!task.carry_forward} onChange={e => onSetCarryForward(task, e.target.checked)} />
                      Carry to tomorrow if not done
                    </label>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => onMove(task, -1)} disabled={flagIdx <= 0} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 6, width: 26, height: 26, color: flagIdx <= 0 ? '#E2E8F0' : MUTED, cursor: flagIdx <= 0 ? 'default' : 'pointer' }}>▲</button>
                      <button onClick={() => onMove(task, 1)} disabled={flagIdx === -1 || flagIdx >= flaggedOrdered.length - 1} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 6, width: 26, height: 26, color: (flagIdx === -1 || flagIdx >= flaggedOrdered.length - 1) ? '#E2E8F0' : MUTED, cursor: 'pointer' }}>▼</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
