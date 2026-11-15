import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { PinPad, BLUE, RED, INK, MUTED, FAINT, HAIRLINE, FONT } from './PublicMyRosterView';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const BRAND_DARK = '#2D4EC9';
const BODY_BG = '#F1F5F9';
const NAME_STORAGE_KEY = 'prepList_yourName';
const PIN_STORAGE_KEY = (token) => `rr_preplist_pin_${token}`;

function readStoredName() {
  try { return localStorage.getItem(NAME_STORAGE_KEY) || ''; } catch { return ''; }
}
function storeName(name) {
  try { localStorage.setItem(NAME_STORAGE_KEY, name); } catch { /* private browsing etc. -- fine to skip */ }
}
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

// iOS Safari auto-zooms the whole page on focus for any text input/select
// under 16px -- 16px avoids it without disabling pinch-zoom.
const inputStyle = {
  width: '100%', fontSize: 16, padding: '11px 12px', borderRadius: 10,
  border: '1px solid #E2E8F0', color: INK, fontFamily: FONT, boxSizing: 'border-box',
  background: '#FAFBFC',
};
const labelStyle = { fontSize: 10.5, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' };
const primaryButtonStyle = (disabled) => ({
  width: '100%', padding: '13px 20px', borderRadius: 11, border: 'none', cursor: disabled ? 'default' : 'pointer',
  background: BLUE, color: '#ffffff', fontSize: 15, fontWeight: 700, fontFamily: FONT,
  opacity: disabled ? 0.55 : 1, boxShadow: disabled ? 'none' : '0 4px 12px -4px rgba(59,91,219,0.45)',
});

// Two tabs, one tile: "Plan" is the staff-facing ordered list (no login,
// anyone ticks things off through the day); "Set Plan" is Clark/Paddy
// building that list (PIN-gated, same shared roster PIN as Day Roster).
// Both read/write supabase/functions/public-prep-list.

export default function PublicPrepListView({ token }) {
  const [tab, setTab] = useState('plan'); // 'plan' | 'setPlan'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState(readStoredName);

  const [pin, setPin] = useState(() => readStoredPin(token));
  const [adminData, setAdminData] = useState(null); // { catalog } once unlocked
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState('');
  const [locked, setLocked] = useState(false);

  const [draft, setDraft] = useState(null); // working copy of today's plan while editing
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [completingId, setCompletingId] = useState(null);

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

  function handleNameChange(v) {
    setName(v);
    storeName(v);
  }

  function buildDraftFromPlan(planItems) {
    return planItems.map(i => ({
      taskId: i.taskId, name: i.name, qty: i.qty ?? '', uom: i.uom ?? '', assignedTo: i.assignedTo ?? '',
    }));
  }

  const unlock = useCallback(async (enteredPin) => {
    setPinError(''); setPinBusy(true);
    try {
      const result = await call({ action: 'unlock', pin: enteredPin });
      storePin(token, enteredPin);
      setPin(enteredPin);
      setAdminData({ catalog: result.catalog || [] });
      setDraft(buildDraftFromPlan(result.planItems || []));
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
    if (tab === 'setPlan' && pin && !adminData && !pinBusy) {
      unlock(pin);
    }
  }, [tab, pin, adminData, pinBusy, unlock]);

  function signOutAdmin() {
    clearStoredPin(token);
    setPin(''); setAdminData(null); setDraft(null); setPinError(''); setLocked(false);
  }

  async function toggleComplete(item) {
    setCompletingId(item.id);
    try {
      const result = await call({ action: 'toggleComplete', itemId: item.id, name, done: item.status !== 'done' });
      setData(result);
    } catch (e) {
      setError(e.message || 'Could not update that task.');
    } finally {
      setCompletingId(null);
    }
  }

  // ── Draft editing (Set Plan) ────────────────────────────────────────────
  function addTaskToDraft(task) {
    setDraft(prev => {
      if (prev.some(d => d.taskId === task.id)) return prev;
      return [...prev, { taskId: task.id, name: task.name, qty: task.default_qty ?? '', uom: task.default_uom ?? '', assignedTo: '' }];
    });
  }
  function removeFromDraft(taskId) {
    setDraft(prev => prev.filter(d => d.taskId !== taskId));
  }
  function updateDraftField(taskId, field, value) {
    setDraft(prev => prev.map(d => d.taskId === taskId ? { ...d, [field]: value } : d));
  }
  function moveDraft(idx, dir) {
    setDraft(prev => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function createAndAddTask(taskName) {
    const trimmed = taskName.trim();
    if (!trimmed) return;
    try {
      const result = await call({ action: 'createTask', pin, name: trimmed });
      setAdminData(prev => ({ catalog: [...(prev?.catalog || []), result.task] }));
      addTaskToDraft(result.task);
    } catch (e) {
      setSaveError(e.message || 'Could not add that task.');
    }
  }

  async function savePlan() {
    setSaving(true); setSaveError(null);
    try {
      const items = draft.map(d => ({ taskId: d.taskId, qty: d.qty, uom: d.uom, assignedTo: d.assignedTo }));
      const result = await call({ action: 'savePlan', pin, items });
      setAdminData({ catalog: result.catalog || [] });
      setDraft(buildDraftFromPlan(result.planItems || []));
      setData(result);
    } catch (e) {
      setSaveError(e.message || 'Could not save the plan.');
    } finally {
      setSaving(false);
    }
  }

  const sortedPlanItems = useMemo(() => {
    if (!data) return [];
    return [...data.planItems].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data]);

  const doneCount = sortedPlanItems.filter(i => i.status === 'done').length;

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
  if (tab === 'setPlan' && (!pin || !adminData)) {
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
            {tab === 'plan' ? (doneCount === sortedPlanItems.length && sortedPlanItems.length > 0 ? 'All done' : `${doneCount}/${sortedPlanItems.length} done today`) : 'Build today\'s plan'}
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
              items={sortedPlanItems}
              name={name}
              onNameChange={handleNameChange}
              onToggle={toggleComplete}
              completingId={completingId}
              error={error}
            />
          ) : (
            <SetPlanTab
              draft={draft}
              catalog={adminData.catalog}
              staffOptions={data.staffOptions || []}
              onAdd={addTaskToDraft}
              onCreate={createAndAddTask}
              onRemove={removeFromDraft}
              onUpdateField={updateDraftField}
              onMove={moveDraft}
              onSave={savePlan}
              saving={saving}
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

function PlanTab({ items, name, onNameChange, onToggle, completingId, error }) {
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Your name (so ticks have a name on them)</label>
        <input value={name} onChange={e => onNameChange(e.target.value)} placeholder="Optional" style={inputStyle} />
      </div>

      {error && <div style={{ fontSize: 12.5, color: RED, fontWeight: 500, marginBottom: 10 }}>{error}</div>}

      {items.length === 0 ? (
        <div style={{ padding: '28px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🌤️</div>
          <div style={{ fontSize: 13.5, color: MUTED }}>Nothing on today's plan yet.</div>
        </div>
      ) : (
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          {items.map((item, idx) => {
            const done = item.status === 'done';
            return (
              <div key={item.id} style={{
                padding: '13px 14px', borderBottom: idx === items.length - 1 ? 'none' : `1px solid ${HAIRLINE}`,
                display: 'flex', alignItems: 'center', gap: 12, background: done ? '#FAFBFC' : 'white',
              }}>
                <button
                  onClick={() => onToggle(item)}
                  disabled={completingId === item.id}
                  title={done ? 'Mark not done' : 'Mark done'}
                  style={{
                    width: 26, height: 26, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
                    border: done ? 'none' : '2px solid #E2E8F0', background: done ? '#0f9d4e' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: done ? 'white' : '#CBD5E1', fontSize: 14,
                    opacity: completingId === item.id ? 0.5 : 1,
                  }}
                >{completingId === item.id ? '…' : '✓'}</button>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: done ? FAINT : INK, textDecoration: done ? 'line-through' : 'none' }}>{item.name}</div>
                  <div style={{ fontSize: 11.5, color: FAINT, marginTop: 2 }}>
                    {[fmtQty(item.qty) && `${fmtQty(item.qty)}${item.uom ? ' ' + item.uom : ''}`, item.assignedTo].filter(Boolean).join(' · ')}
                    {done && item.completedBy ? ` · ${item.completedBy}${item.completedAt ? ' · ' + timeAgo(item.completedAt) : ''}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function SetPlanTab({ draft, catalog, staffOptions, onAdd, onCreate, onRemove, onUpdateField, onMove, onSave, saving, saveError, onSignOut }) {
  const [search, setSearch] = useState('');

  const draftTaskIds = useMemo(() => new Set(draft.map(d => d.taskId)), [draft]);
  const available = useMemo(() => catalog.filter(t => !draftTaskIds.has(t.id)), [catalog, draftTaskIds]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter(t => t.name.toLowerCase().includes(q));
  }, [available, search]);
  const exactMatch = useMemo(() => catalog.some(t => t.name.toLowerCase() === search.trim().toLowerCase()), [catalog, search]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button onClick={onSignOut} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Lock</button>
      </div>

      <label style={labelStyle}>Today's tasks, in priority order</label>
      {draft.length === 0 ? (
        <div style={{ fontSize: 13, color: FAINT, padding: '10px 2px 16px' }}>Nothing added yet -- pick from the list below.</div>
      ) : (
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          {draft.map((d, idx) => (
            <div key={d.taskId} style={{ padding: '12px 12px', borderBottom: idx === draft.length - 1 ? 'none' : `1px solid ${HAIRLINE}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: FAINT, width: 16, flexShrink: 0 }}>{idx + 1}.</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: INK, flex: 1, minWidth: 0 }}>{d.name}</span>
                <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                  <button onClick={() => onMove(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? '#E2E8F0' : MUTED, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1 }}>▲</button>
                  <button onClick={() => onMove(idx, 1)} disabled={idx === draft.length - 1} style={{ background: 'none', border: 'none', color: idx === draft.length - 1 ? '#E2E8F0' : MUTED, cursor: idx === draft.length - 1 ? 'default' : 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1 }}>▼</button>
                </div>
                <button onClick={() => onRemove(d.taskId)} aria-label={`Remove ${d.name}`} style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 999, border: 'none', background: '#F1F5F9', color: FAINT, cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: 6 }}>
                <input value={d.qty} onChange={e => onUpdateField(d.taskId, 'qty', e.target.value)} placeholder="Qty" inputMode="decimal" style={{ ...inputStyle, padding: '9px 10px', fontSize: 14 }} />
                <input value={d.uom} onChange={e => onUpdateField(d.taskId, 'uom', e.target.value)} placeholder="Unit" style={{ ...inputStyle, padding: '9px 10px', fontSize: 14 }} />
                <select value={d.assignedTo} onChange={e => onUpdateField(d.taskId, 'assignedTo', e.target.value)} style={{ ...inputStyle, padding: '9px 10px', fontSize: 14, color: d.assignedTo ? INK : FAINT }}>
                  <option value="">Unassigned</option>
                  {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {saveError && <div style={{ fontSize: 12.5, color: RED, fontWeight: 500, marginBottom: 10, textAlign: 'center' }}>{saveError}</div>}

      <button onClick={onSave} disabled={saving} style={{ ...primaryButtonStyle(saving), marginBottom: 20 }}>
        {saving ? 'Saving…' : 'Save Plan'}
      </button>

      <label style={labelStyle}>Add a task</label>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search or type a new task" style={{ ...inputStyle, marginBottom: 8 }} />

      {filtered.length > 0 && (
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
          {filtered.map((t, idx) => (
            <button key={t.id} onClick={() => { onAdd(t); setSearch(''); }} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              padding: '11px 13px', border: 'none', borderTop: idx === 0 ? 'none' : `1px solid ${HAIRLINE}`,
              background: '#ffffff', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
            }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{t.name}</span>
              <span style={{ fontSize: 11, color: FAINT }}>{[fmtQty(t.default_qty), t.default_uom].filter(Boolean).join(' ') || 'Add'}</span>
            </button>
          ))}
        </div>
      )}

      {search.trim() && !exactMatch && (
        <button onClick={() => onCreate(search)} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginTop: 8, padding: '11px 13px',
          border: `1px dashed #C7D2FE`, borderRadius: 10, background: '#EEF2FF', color: BLUE, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
        }}>
          + Add “{search.trim()}” as a new task
        </button>
      )}
    </>
  );
}
