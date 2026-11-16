import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

// A distinct palette from status (red/amber) so the two badges never
// look like the same kind of thing. 1 = darkest/most prominent.
const PRIORITY_META = {
  1: { label: '1', sub: 'Highest', color: '#ffffff', bg: BLUE, border: BLUE },
  2: { label: '2', sub: 'Medium', color: BLUE, bg: '#EEF2FF', border: BLUE },
  3: { label: '3', sub: 'Lowest', color: MUTED, bg: '#F1F5F9', border: '#CBD5E1' },
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

function sortTasks(list) {
  return [...list].sort((a, b) => (Number(a.done) - Number(b.done)) || (a.priority - b.priority) || (a.flag_order - b.flag_order));
}

// Drag-and-drop reorder for one group of task ids (one priority tier).
// Plain touch/mouse listeners rather than Pointer Events + setPointerCapture
// -- the latter is known to be unreliable on mobile Safari for exactly this
// kind of custom drag list. Listeners are attached once and stay attached;
// they no-op via draggingRef when nothing is being dragged, so there's no
// per-drag add/remove-listener cycle to get wrong.
function useDragReorder(ids, onCommit) {
  const [dragId, setDragId] = useState(null);
  const [order, setOrder] = useState(ids);
  const orderRef = useRef(ids);
  const rowRefs = useRef(new Map());
  const draggingRef = useRef(null);

  useEffect(() => {
    if (!dragId) { setOrder(ids); orderRef.current = ids; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  function registerRow(id, el) {
    if (el) rowRefs.current.set(id, el); else rowRefs.current.delete(id);
  }

  function reorderTo(y) {
    const dragged = draggingRef.current;
    if (!dragged) return;
    const rest = orderRef.current.filter(id => id !== dragged);
    let newIdx = 0;
    for (const id of rest) {
      const el = rowRefs.current.get(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y > rect.top + rect.height / 2) newIdx++;
    }
    const next = [...rest];
    next.splice(newIdx, 0, dragged);
    if (next.join(',') !== orderRef.current.join(',')) {
      orderRef.current = next;
      setOrder(next);
    }
  }

  function endDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = null;
    setDragId(null);
    onCommit(orderRef.current);
  }

  function handleStart(id, e) {
    e.preventDefault();
    draggingRef.current = id;
    orderRef.current = ids;
    setOrder(ids);
    setDragId(id);
  }

  useEffect(() => {
    function onTouchMove(e) {
      if (!draggingRef.current) return;
      e.preventDefault();
      if (e.touches[0]) reorderTo(e.touches[0].clientY);
    }
    function onMouseMove(e) {
      if (draggingRef.current) reorderTo(e.clientY);
    }
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', endDrag);
    window.addEventListener('touchcancel', endDrag);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', endDrag);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', endDrag);
      window.removeEventListener('touchcancel', endDrag);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCommit]);

  return { order: dragId ? order : ids, dragId, registerRow, handleStart };
}

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
  const [editingPlanId, setEditingPlanId] = useState(null);

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

  // Every admin mutation's response already carries a fresh, authoritative
  // planItems (and catalog, since these are all PIN-gated) -- syncing from
  // that after the call, rather than hand-patching local state, is what
  // keeps Plan and Set Plan from drifting regardless of which tab an edit
  // came from (editing from Plan doesn't need Set Plan's catalog loaded
  // at all, just a valid pin).
  function syncFromResult(result) {
    if (result.catalog) setCatalog(result.catalog);
    if (result.planItems) setData(prev => prev && { ...prev, planItems: result.planItems });
  }

  // Optimistic patch applied right away for instant feedback, covering
  // both "editing an already-flagged task" and "flagging a task for the
  // first time" (which has no existing planItems row to update).
  function optimisticPatch(task, status, payload) {
    setCatalog(prev => prev && prev.map(t => t.id === task.id ? {
      ...t, status, flag_qty: payload.qty, flag_uom: payload.uom, assigned_to: payload.assignedTo,
      note: payload.note, catering: payload.catering, priority: status === 'ok' ? 2 : payload.priority,
    } : t));
    setData(prev => {
      if (!prev) return prev;
      if (status === 'ok') return { ...prev, planItems: prev.planItems.filter(i => i.id !== task.id) };
      const patch = { status, qty: payload.qty, uom: payload.uom, assignedTo: payload.assignedTo, note: payload.note, catering: payload.catering, priority: payload.priority };
      const exists = prev.planItems.some(i => i.id === task.id);
      return {
        ...prev,
        planItems: exists
          ? prev.planItems.map(i => i.id === task.id ? { ...i, ...patch } : i)
          : [...prev.planItems, { id: task.id, name: task.name, done: false, carryForward: false, flaggedAt: new Date().toISOString(), ...patch }],
      };
    });
  }

  async function setFlag(task, status, fields) {
    const payload = {
      qty: fields.qty ?? task.flag_qty ?? task.default_qty ?? '',
      uom: fields.uom ?? task.flag_uom ?? task.default_uom ?? '',
      assignedTo: fields.assignedTo ?? task.assigned_to ?? '',
      note: fields.note ?? task.note ?? '',
      catering: fields.catering ?? task.catering ?? false,
      priority: fields.priority ?? task.priority ?? 2,
    };
    optimisticPatch(task, status, payload);
    setSaveError(null);
    try {
      const result = await call({ action: 'setFlag', pin, taskId: task.id, status, ...payload });
      syncFromResult(result);
    } catch (e) {
      setSaveError(e.message || 'Could not save that change.');
    }
  }

  async function setCarryForward(task, carryForward) {
    setCatalog(prev => prev && prev.map(t => t.id === task.id ? { ...t, carry_forward: carryForward } : t));
    setData(prev => prev && { ...prev, planItems: prev.planItems.map(i => i.id === task.id ? { ...i, carryForward } : i) });
    try {
      const result = await call({ action: 'setCarryForward', pin, taskId: task.id, carryForward });
      syncFromResult(result);
    } catch (e) {
      setSaveError(e.message || 'Could not save that change.');
    }
  }

  async function reorderFlags(order) {
    try {
      const result = await call({ action: 'reorderFlags', pin, order });
      syncFromResult(result);
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

  function requestEdit(itemId) {
    if (!pin) { setTab('setPlan'); return; }
    setEditingPlanId(prev => prev === itemId ? null : itemId);
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

  const doneCount = planItems.filter(i => i.done).length;
  const remainingCount = planItems.length - doneCount;

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
              ? (planItems.length === 0 ? 'All good -- nothing flagged' : `${remainingCount} to prep${doneCount > 0 ? ` · ${doneCount} done` : ''}`)
              : 'Flag tasks for today'}
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
            <PlanTab
              items={planItems}
              onToggle={toggleComplete}
              error={error}
              canEdit={!!pin}
              editingId={editingPlanId}
              onRequestEdit={requestEdit}
              staffOptions={data.staffOptions || []}
              onSetFlag={setFlag}
              onSetCarryForward={setCarryForward}
              saveError={saveError}
            />
          ) : (
            <SetPlanTab
              catalog={catalog}
              staffOptions={data.staffOptions || []}
              onSetFlag={setFlag}
              onSetCarryForward={setCarryForward}
              onReorder={reorderFlags}
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

// Shared editor for one task's flag -- used both inline on Plan (via the
// Edit button) and expanded on Set Plan, so the two never drift apart.
function FlagEditor({ task, staffOptions, onSetFlag, onSetCarryForward }) {
  const [qty, setQty] = useState(task.flag_qty ?? task.default_qty ?? '');
  const [uom, setUom] = useState(task.flag_uom ?? task.default_uom ?? '');
  const [note, setNote] = useState(task.note || '');

  return (
    <div style={{ padding: '2px 0 4px' }}>
      <div style={{ marginBottom: 10 }}>
        <span style={miniLabelStyle}>Status</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['ok', 'low', 'urgent'].map(s => {
            const active = task.status === s;
            const m = STATUS_META[s];
            return (
              <button
                key={s}
                onClick={() => onSetFlag(task, s, { qty, uom, note })}
                style={{
                  flex: 1, minHeight: 36, borderRadius: 7, border: `1.5px solid ${active ? m.color : '#E2E8F0'}`,
                  background: active ? m.bg : 'white', color: active ? m.color : MUTED, fontSize: 11.5, fontWeight: 700,
                  fontFamily: FONT, cursor: 'pointer', padding: '0 4px',
                }}
              >{m.label}</button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <span style={miniLabelStyle}>Priority (1 = highest)</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map(p => {
            const active = task.priority === p;
            const m = PRIORITY_META[p];
            return (
              <button
                key={p}
                onClick={() => onSetFlag(task, task.status, { qty, uom, note, priority: p })}
                style={{
                  flex: 1, minHeight: 36, borderRadius: 7, border: `1.5px solid ${active ? m.border : '#E2E8F0'}`,
                  background: active ? m.bg : 'white', color: active ? m.color : MUTED, fontSize: 12.5, fontWeight: 800,
                  fontFamily: FONT, cursor: 'pointer', padding: '0 4px',
                }}
              >{m.label}<span style={{ fontWeight: 600, fontSize: 10 }}> · {m.sub}</span></button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div>
          <span style={miniLabelStyle}>Qty</span>
          <div style={{ position: 'relative' }}>
            <input
              value={qty} onChange={e => setQty(e.target.value)}
              onBlur={() => onSetFlag(task, task.status, { qty, uom, note })}
              placeholder="No qty" inputMode="decimal" style={{ ...inputStyle, padding: '9px 30px 9px 10px' }}
            />
            {qty !== '' && (
              <button
                onClick={() => { setQty(''); onSetFlag(task, task.status, { qty: '', uom, note }); }}
                aria-label="Clear quantity"
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: 999, border: 'none', background: '#F1F5F9', color: FAINT, cursor: 'pointer', fontSize: 12 }}
              >✕</button>
            )}
          </div>
        </div>
        <div>
          <span style={miniLabelStyle}>Unit</span>
          <input
            value={uom} onChange={e => setUom(e.target.value)}
            onBlur={() => onSetFlag(task, task.status, { qty, uom, note })}
            placeholder="e.g. kg" style={{ ...inputStyle, padding: '9px 10px' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={miniLabelStyle}>Assigned to</span>
        <select
          value={task.assigned_to || ''}
          onChange={e => onSetFlag(task, task.status, { qty, uom, note, assignedTo: e.target.value })}
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
          value={note} onChange={e => setNote(e.target.value)}
          onBlur={() => onSetFlag(task, task.status, { qty, uom, note })}
          placeholder="Optional" style={{ ...inputStyle, padding: '9px 10px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: MUTED, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!task.catering} onChange={e => onSetFlag(task, task.status, { qty, uom, note, catering: e.target.checked })} />
          Catering
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: MUTED, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!task.carry_forward} onChange={e => onSetCarryForward(task, e.target.checked)} />
          Carry to tomorrow if not done
        </label>
      </div>
    </div>
  );
}

// Status (Urgent/Running Low) was just the mechanism for getting a task
// onto this list in the first place -- it carries no meaning once it's
// here, so Plan never shows it. Priority is what actually orders and
// matters, so Plan groups by priority the same way Set Plan does.
function PlanTab({ items, onToggle, error, canEdit, editingId, onRequestEdit, staffOptions, onSetFlag, onSetCarryForward, saveError }) {
  const groups = useMemo(() => {
    const byP = { 1: [], 2: [], 3: [] };
    items.forEach(i => (byP[i.priority] || byP[2]).push(i));
    return byP;
  }, [items]);

  return (
    <>
      {error && <div style={{ fontSize: 12.5, color: RED, fontWeight: 500, marginBottom: 10 }}>{error}</div>}
      {saveError && <div style={{ fontSize: 12.5, color: RED, fontWeight: 500, marginBottom: 10 }}>{saveError}</div>}

      {items.length === 0 ? (
        <div style={{ padding: '28px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🌤️</div>
          <div style={{ fontSize: 13.5, color: MUTED }}>All good -- nothing flagged right now.</div>
        </div>
      ) : (
        [1, 2, 3].map(p => groups[p].length > 0 && (
          <PlanPriorityGroup
            key={p}
            priority={p}
            items={groups[p]}
            onToggle={onToggle}
            canEdit={canEdit}
            editingId={editingId}
            onRequestEdit={onRequestEdit}
            staffOptions={staffOptions}
            onSetFlag={onSetFlag}
            onSetCarryForward={onSetCarryForward}
          />
        ))
      )}
    </>
  );
}

function PlanPriorityGroup({ priority, items, onToggle, canEdit, editingId, onRequestEdit, staffOptions, onSetFlag, onSetCarryForward }) {
  const meta = PRIORITY_META[priority];
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, paddingLeft: 2 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: meta.color, background: meta.bg, borderRadius: 999, padding: '2px 8px' }}>Priority {priority}</span>
        <span style={{ fontSize: 10.5, color: FAINT, fontWeight: 600 }}>{meta.sub}</span>
      </div>
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
        {items.map((item, idx) => {
          const qtyLabel = fmtQty(item.qty) ? `${fmtQty(item.qty)}${item.uom ? ' ' + item.uom : ''}` : '';
          const done = item.done;
          const isEditing = editingId === item.id;
          return (
            <div key={item.id} style={{ borderTop: idx === 0 ? 'none' : `1px solid ${HAIRLINE}`, background: done ? '#FAFBFC' : 'white' }}>
              <div style={{ padding: '12px 10px 12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => onToggle(item)}
                  title={done ? 'Mark not done' : 'Mark done'}
                  style={{
                    width: 26, height: 26, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
                    border: done ? 'none' : '2px solid #E2E8F0', background: done ? '#0f9d4e' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: done ? 'white' : '#CBD5E1', fontSize: 14,
                  }}
                >✓</button>
                <button
                  onClick={() => onRequestEdit(item.id)}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, fontFamily: FONT }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: done ? FAINT : INK, textDecoration: done ? 'line-through' : 'none' }}>{item.name}</span>
                      {qtyLabel && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: done ? FAINT : INK, textDecoration: done ? 'line-through' : 'none', whiteSpace: 'nowrap' }}>· {qtyLabel}</span>
                      )}
                    </div>
                    {(item.catering || item.assignedTo) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                        {item.catering && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: done ? FAINT : '#7C3AED', background: done ? '#F1F5F9' : '#F3E8FF', borderRadius: 999, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Catering</span>
                        )}
                        {item.assignedTo && (
                          <span style={{ fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap', borderRadius: 999, padding: '2px 8px', color: done ? FAINT : assigneeColor(item.assignedTo).text, background: done ? '#F1F5F9' : assigneeColor(item.assignedTo).bg }}>{item.assignedTo}</span>
                        )}
                      </div>
                    )}
                    {item.note && (
                      <div style={{ fontSize: 12.5, color: done ? FAINT : '#334155', fontStyle: 'italic', marginTop: 3, textDecoration: done ? 'line-through' : 'none' }}>
                        {item.note}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: FAINT, flexShrink: 0 }}>{isEditing ? '▲' : '▼'}</span>
                </button>
              </div>
              {isEditing && canEdit && (
                <div style={{ padding: '0 14px 14px 14px', borderTop: `1px solid ${HAIRLINE}`, marginTop: -1, paddingTop: 12 }}>
                  <FlagEditor task={{
                    id: item.id, status: item.status, flag_qty: item.qty, flag_uom: item.uom, assigned_to: item.assignedTo,
                    note: item.note, catering: item.catering, carry_forward: item.carryForward, priority: item.priority,
                  }} staffOptions={staffOptions} onSetFlag={onSetFlag} onSetCarryForward={onSetCarryForward} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One priority tier's flagged tasks, draggable to reorder within the tier.
function PriorityGroup({ priority, tasks, staffOptions, onSetFlag, onSetCarryForward, onReorder, expanded, onToggleExpanded }) {
  const ids = useMemo(() => sortTasks(tasks).map(t => t.id), [tasks]);
  const byId = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const { order, dragId, registerRow, handleStart } = useDragReorder(ids, onReorder);
  const meta = PRIORITY_META[priority];

  if (tasks.length === 0) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, paddingLeft: 2 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: meta.color, background: meta.bg, borderRadius: 999, padding: '2px 8px' }}>Priority {priority}</span>
        <span style={{ fontSize: 10.5, color: FAINT, fontWeight: 600 }}>{meta.sub}</span>
      </div>
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
        {order.map((id, idx) => {
          const task = byId.get(id);
          if (!task) return null;
          const meta2 = STATUS_META[task.status] || STATUS_META.ok;
          const isOpen = expanded.has(task.id);
          return (
            <div key={task.id} ref={el => registerRow(task.id, el)} style={{
              borderTop: idx === 0 ? 'none' : `1px solid ${HAIRLINE}`, borderLeft: `3px solid ${meta2.color}`,
              background: dragId === task.id ? '#F8FAFC' : 'white', boxShadow: dragId === task.id ? '0 4px 12px -4px rgba(15,23,42,0.25)' : 'none',
              position: 'relative', zIndex: dragId === task.id ? 1 : 0,
            }}>
              <div style={{ padding: '11px 8px 11px 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  onTouchStart={e => handleStart(task.id, e)}
                  onMouseDown={e => handleStart(task.id, e)}
                  style={{ touchAction: 'none', WebkitTouchCallout: 'none', cursor: 'grab', color: '#CBD5E1', fontSize: 20, padding: '6px 8px', flexShrink: 0, userSelect: 'none' }}
                >⠿</span>
                <button
                  onClick={() => onToggleExpanded(task.id)}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, fontFamily: FONT }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: INK, flex: 1, minWidth: 0 }}>{task.name}</span>
                  {fmtQty(task.flag_qty) && (
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: INK, whiteSpace: 'nowrap' }}>{fmtQty(task.flag_qty)}{task.flag_uom ? ' ' + task.flag_uom : ''}</span>
                  )}
                  {task.catering && (
                    <span style={{ fontSize: 9.5, fontWeight: 800, whiteSpace: 'nowrap', borderRadius: 999, padding: '2px 6px', color: '#7C3AED', background: '#F3E8FF' }}>Catering</span>
                  )}
                  {task.assigned_to && (
                    <span style={{ fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', borderRadius: 999, padding: '2px 7px', color: assigneeColor(task.assigned_to).text, background: assigneeColor(task.assigned_to).bg }}>{task.assigned_to}</span>
                  )}
                  <span style={{ fontSize: 12, color: FAINT, flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                </button>
              </div>
              {isOpen && (
                <div style={{ padding: '0 12px 14px' }}>
                  <FlagEditor task={task} staffOptions={staffOptions} onSetFlag={onSetFlag} onSetCarryForward={onSetCarryForward} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SetPlanTab({ catalog, staffOptions, onSetFlag, onSetCarryForward, onReorder, onCreate, saveError, onSignOut }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  function toggleExpanded(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const flagged = useMemo(() => catalog.filter(t => t.status !== 'ok'), [catalog]);
  const byPriority = useMemo(() => ({
    1: flagged.filter(t => t.priority === 1),
    2: flagged.filter(t => t.priority === 2),
    3: flagged.filter(t => t.priority === 3),
  }), [flagged]);

  const q = search.trim().toLowerCase();
  const unflagged = useMemo(() => catalog.filter(t => t.status === 'ok'), [catalog]);
  const visible = q
    ? catalog.filter(t => t.name.toLowerCase().includes(q))
    : unflagged;
  const exactMatch = catalog.some(t => t.name.toLowerCase() === q);

  async function commitOrder(priority, order) {
    await onReorder(order);
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button onClick={onSignOut} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Lock</button>
      </div>

      {saveError && <div style={{ fontSize: 12.5, color: RED, fontWeight: 500, marginBottom: 10 }}>{saveError}</div>}

      {!q && (
        <>
          {flagged.length === 0 && <div style={{ fontSize: 13, color: FAINT, marginBottom: 14 }}>Nothing flagged yet -- pick a task below.</div>}
          {[1, 2, 3].map(p => (
            <PriorityGroup
              key={p}
              priority={p}
              tasks={byPriority[p]}
              staffOptions={staffOptions}
              onSetFlag={onSetFlag}
              onSetCarryForward={onSetCarryForward}
              onReorder={order => commitOrder(p, order)}
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
            />
          ))}
        </>
      )}

      <label style={miniLabelStyle}>{q ? 'Search results' : 'Add a task'}</label>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search or type a new task" style={{ ...inputStyle, marginBottom: 8 }} />

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
          const isFlagged = task.status !== 'ok';
          const meta = STATUS_META[task.status] || STATUS_META.ok;
          const isOpen = isFlagged && expanded.has(task.id);
          return (
            <div key={task.id} style={{ borderTop: idx === 0 ? 'none' : `1px solid ${HAIRLINE}`, borderLeft: isFlagged ? `3px solid ${meta.color}` : 'none' }}>
              <div style={{ padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => isFlagged && toggleExpanded(task.id)}
                  disabled={!isFlagged}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', textAlign: 'left', cursor: isFlagged ? 'pointer' : 'default', padding: 0, fontFamily: FONT }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: INK, flex: 1, minWidth: 0 }}>{task.name}</span>
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
                  <FlagEditor task={task} staffOptions={staffOptions} onSetFlag={onSetFlag} onSetCarryForward={onSetCarryForward} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
