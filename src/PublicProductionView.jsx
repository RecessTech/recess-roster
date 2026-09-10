import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const GREEN = '#15803D';
const NAME_STORAGE_KEY = 'productionPlan_yourName';

function loadStoredName() {
  try { return localStorage.getItem(NAME_STORAGE_KEY) || ''; } catch { return ''; }
}
function storeName(name) {
  try { localStorage.setItem(NAME_STORAGE_KEY, name); } catch { /* private browsing etc. -- fine to skip */ }
}

function fmtISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr() { return fmtISO(new Date()); }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return fmtISO(d);
}
function dayLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long' }).toUpperCase();
}
function fmtDateShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function timeAgo(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
function entryKey(itemId, channelId) { return `${itemId}:${channelId}`; }

// supabase-js's `.functions` is a getter that hands back a brand new
// FunctionsClient on every access, so it can't be swapped out for a test
// double by reassignment. These two calls are isolated behind fetchPlan/
// savePlan props (defaulting to the real edge function) purely so a
// preview harness can inject an in-memory stand-in instead.
async function defaultFetchPlan(token, date) {
  const { data, error } = await supabase.functions.invoke('public-production', {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
    body: { token, date },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}
async function defaultSavePlan({ token, date, siteId, entries, editedByName }) {
  const { data, error } = await supabase.functions.invoke('public-production', {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
    body: { token, date, action: 'updatePlan', siteId, entries, editedByName },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

function QtyBadge({ qty }) {
  if (qty > 0) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 18, padding: '1px 4px', borderRadius: 999,
        background: '#DCFCE7', color: GREEN, fontWeight: 800, fontSize: 12,
      }}>
        {qty}
      </span>
    );
  }
  return <span style={{ color: '#D1D5DB', fontWeight: 600, fontSize: 11 }}>0</span>;
}

function QtyInput({ qty, onChange }) {
  const [draft, setDraft] = useState(String(qty));
  useEffect(() => { setDraft(String(qty)); }, [qty]);

  function commit() {
    const n = parseInt(draft, 10);
    onChange(isNaN(n) || n < 0 ? 0 : n);
  }

  return (
    <input
      className="qty-input"
      type="number"
      inputMode="numeric"
      min="0"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
      style={{
        // 16px is the line iOS Safari uses to decide whether to
        // auto-zoom the page on focus -- anything smaller (this used to
        // be 12px) makes it zoom in aggressively on every tap and stay
        // zoomed until the user manually pinches back out. Chrome's
        // native spin-button arrows are hidden via the .qty-input rule
        // below -- otherwise they eat enough width to clip a 3-digit
        // quantity like "100".
        width: 44, boxSizing: 'border-box', textAlign: 'center', fontSize: 16, fontWeight: 700,
        border: '1.5px solid #BBF7D0', borderRadius: 8, padding: '3px 2px',
        background: '#F0FDF4', color: '#166534', MozAppearance: 'textfield',
      }}
    />
  );
}

export default function PublicProductionView({ token, fetchPlan = defaultFetchPlan, savePlan = defaultSavePlan }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [date, setDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('d') || todayStr();
  });
  const [activeSiteId, setActiveSiteId] = useState(null);

  // Edit-mode state -- entirely local until a re-lock actually saves it.
  // Unlocking never touches the server; only "Save & Lock" does.
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({}); // `${itemId}:${channelId}` -> qty
  const [showConfirm, setShowConfirm] = useState(false);
  const [nameInput, setNameInput] = useState(loadStoredName);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedNotice, setSavedNotice] = useState(null);

  const load = useCallback(async (d) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchPlan(token, d));
    } catch (e) {
      setError(e.message || 'Unable to load production plan.');
    } finally {
      setLoading(false);
    }
  }, [token, fetchPlan]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('d', date);
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
    load(date);
  }, [date, load]);

  useEffect(() => {
    if (!data) return;
    setActiveSiteId(prev => (prev && data.sites.some(s => s.id === prev)) ? prev : (data.sites[0]?.id ?? null));
  }, [data]);

  // Switching date or site always starts back at locked/read-only --
  // never carry a half-edited draft from one view into another.
  useEffect(() => {
    setEditMode(false);
    setDraft({});
    setShowConfirm(false);
    setSaveError(null);
  }, [date, activeSiteId]);

  const channelsForSite = useMemo(() => {
    if (!data) return [];
    return data.channels.filter(c => c.site_id === activeSiteId);
  }, [data, activeSiteId]);

  const getQty = useCallback((itemId, channelId) => {
    if (!data) return 0;
    const row = data.entries.find(e => e.item_id === itemId && e.channel_id === channelId);
    return row ? (Number(row.qty) || 0) : 0;
  }, [data]);

  // The qty actually shown/totalled -- the in-progress draft while
  // editing, otherwise whatever's saved.
  const effectiveQty = useCallback((itemId, channelId) => {
    const key = entryKey(itemId, channelId);
    if (editMode && key in draft) return draft[key];
    return getQty(itemId, channelId);
  }, [editMode, draft, getQty]);

  const totalForChannel = useCallback(ch => {
    if (!data) return 0;
    return data.items.reduce((sum, it) => sum + effectiveQty(it.id, ch.id), 0);
  }, [data, effectiveQty]);

  const siteTotal = useMemo(() => channelsForSite.reduce((sum, ch) => sum + totalForChannel(ch), 0), [channelsForSite, totalForChannel]);

  const totalsByItemForSite = useMemo(() => {
    const m = new Map();
    if (!data) return m;
    data.items.forEach(it => {
      const total = channelsForSite.reduce((sum, ch) => sum + effectiveQty(it.id, ch.id), 0);
      m.set(it.id, total);
    });
    return m;
  }, [data, channelsForSite, effectiveQty]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const groups = new Map();
    data.items.forEach(it => {
      const cat = it.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(it);
    });
    return [...groups.entries()];
  }, [data]);

  const activeLock = data ? (data.locks || []).find(l => l.site_id === activeSiteId) : null;
  const lastEdit = data ? (data.editLog || []).find(l => l.site_id === activeSiteId) : null;

  const pendingChanges = useMemo(() => {
    if (!data) return [];
    return Object.entries(draft)
      .map(([key, qty]) => {
        const [itemId, channelId] = key.split(':');
        return { itemId, channelId, qty, oldQty: getQty(itemId, channelId) };
      })
      .filter(c => c.qty !== c.oldQty);
  }, [draft, data, getQty]);

  function startEditing() {
    if (!data) return;
    const next = {};
    data.items.forEach(it => {
      channelsForSite.forEach(ch => {
        next[entryKey(it.id, ch.id)] = getQty(it.id, ch.id);
      });
    });
    setDraft(next);
    setEditMode(true);
    setSavedNotice(null);
  }

  function handleCellChange(itemId, channelId, qty) {
    setDraft(prev => ({ ...prev, [entryKey(itemId, channelId)]: qty }));
  }

  function requestLock() {
    if (pendingChanges.length === 0) {
      setEditMode(false);
      setDraft({});
      return;
    }
    setSaveError(null);
    setShowConfirm(true);
  }

  function cancelEditing() {
    setEditMode(false);
    setDraft({});
    setShowConfirm(false);
    setSaveError(null);
  }

  async function confirmSave() {
    const name = nameInput.trim();
    if (!name) { setSaveError("Please enter your name."); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await savePlan({
        token, date,
        siteId: activeSiteId,
        entries: pendingChanges.map(c => ({ itemId: c.itemId, channelId: c.channelId, qty: c.qty })),
        editedByName: name,
      });
      storeName(name);
      setData(result);
      setEditMode(false);
      setDraft({});
      setShowConfirm(false);
      setSavedNotice(`Saved by ${name}`);
      setTimeout(() => setSavedNotice(null), 4000);
    } catch (e) {
      setSaveError(e.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #E2E8F0', borderTopColor: GREEN,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>Loading production plan…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: '32px 24px', maxWidth: 360, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#1E293B', fontWeight: 600, marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>Couldn't load production plan</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const activeSite = data.sites.find(s => s.id === activeSiteId);
  const noSetup = data.sites.length === 0 || data.items.length === 0;

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '14px 4px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .qty-input::-webkit-outer-spin-button, .qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Header card */}
        <div style={{ background: GREEN, borderRadius: '12px 12px 0 0', padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {data.businessName}
            </div>
            <a
              href={`/hub/${token}`}
              style={{
                color: 'white', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
                background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 999, flexShrink: 0,
              }}
            >
              🏠 Home
            </a>
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>
            Production Plan
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            {dayLabel(date)} · {fmtDateShort(date)}
          </div>
        </div>

        {/* Date navigation */}
        <div style={{ background: '#F0FDF4', borderLeft: '1px solid #BBF7D0', borderRight: '1px solid #BBF7D0', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={() => setDate(d => addDays(d, -1))} disabled={editMode} style={{ background: 'none', border: 'none', cursor: editMode ? 'default' : 'pointer', opacity: editMode ? 0.3 : 1, color: GREEN, fontSize: 18, padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}>←</button>

          {activeLock ? (
            <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>read-only</span>
          ) : editMode ? (
            <button
              onClick={requestLock}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
                padding: '5px 12px', borderRadius: 999, background: GREEN, color: 'white', border: 'none', cursor: 'pointer',
              }}
            >
              🔓 Editing — tap to save &amp; lock
            </button>
          ) : (
            <button
              onClick={startEditing}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
                padding: '5px 12px', borderRadius: 999, background: 'white', color: '#166534', border: '1px solid #BBF7D0', cursor: 'pointer',
              }}
            >
              🔒 Locked — tap to unlock &amp; edit
            </button>
          )}

          <button onClick={() => setDate(d => addDays(d, 1))} disabled={editMode} style={{ background: 'none', border: 'none', cursor: editMode ? 'default' : 'pointer', opacity: editMode ? 0.3 : 1, color: GREEN, fontSize: 18, padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}>→</button>
        </div>

        {editMode && (
          <div style={{ background: '#FFFBEB', borderLeft: '1px solid #FDE68A', borderRight: '1px solid #FDE68A', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: '#92400E' }}>Numbers unlocked — tap any quantity to change it.</span>
            <button onClick={cancelEditing} style={{ background: 'none', border: 'none', color: '#92400E', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}>Discard</button>
          </div>
        )}

        {savedNotice && (
          <div style={{ background: '#DCFCE7', padding: '8px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: GREEN }}>
            ✓ {savedNotice}
          </div>
        )}

        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: noSetup ? '0 0 12px 12px' : 0, overflow: 'hidden' }}>
          {noSetup ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              Nothing set up yet.
            </div>
          ) : (
            <>
              {/* Site tabs */}
              {data.sites.length > 1 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '12px 16px 0' }}>
                  {data.sites.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSiteId(s.id)}
                      disabled={editMode}
                      style={{
                        padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                        cursor: editMode ? 'default' : 'pointer', opacity: editMode && activeSiteId !== s.id ? 0.4 : 1,
                        border: activeSiteId === s.id ? 'none' : '1px solid #E2E8F0',
                        background: activeSiteId === s.id ? GREEN : 'white',
                        color: activeSiteId === s.id ? 'white' : '#475569',
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              {activeLock && (
                <div style={{ padding: '10px 16px 0' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700,
                    padding: '4px 10px', borderRadius: 999, background: '#DCFCE7', color: GREEN,
                  }}>
                    ✓ Finalized
                  </span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8' }}>Ask an admin to unlock on desktop to make changes.</span>
                </div>
              )}

              {!activeLock && lastEdit && !editMode && (
                <div style={{ padding: '10px 16px 0', fontSize: 11, color: '#94A3B8' }}>
                  Last edited by <span style={{ fontWeight: 700, color: '#64748B' }}>{lastEdit.edited_by_name}</span> · {timeAgo(lastEdit.edited_at)}
                </div>
              )}

              {channelsForSite.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  No channels set up for {activeSite?.name ?? 'this site'} yet.
                </div>
              ) : (
                <div style={{ borderTop: '1px solid #F1F5F9', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '5px 4px', fontSize: 8.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#FAFBFC', whiteSpace: 'nowrap' }}>Item</th>
                        {channelsForSite.map(ch => (
                          <th key={ch.id} style={{ textAlign: 'center', padding: '5px 2px', fontSize: 8.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#FAFBFC', whiteSpace: 'nowrap' }}>
                            {ch.name}
                          </th>
                        ))}
                        <th style={{ textAlign: 'center', padding: '5px 3px', fontSize: 8.5, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F0FDF4', whiteSpace: 'nowrap' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped.map(([cat, its]) => (
                        <React.Fragment key={cat}>
                          <tr>
                            <td colSpan={channelsForSite.length + 2} style={{ padding: '6px 4px 2px', fontSize: 8.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {cat}
                            </td>
                          </tr>
                          {its.map(item => {
                            const total = totalsByItemForSite.get(item.id) || 0;
                            const rowBg = total > 0 ? '#F8FDF9' : 'white';
                            return (
                              <tr key={item.id} style={{ background: rowBg, borderBottom: '1px solid #F8FAFC' }}>
                                <td style={{ padding: '5px 4px', whiteSpace: 'nowrap' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 11, fontWeight: total > 0 ? 600 : 500, color: total > 0 ? '#1E293B' : '#94A3B8', maxWidth: 92, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                  </div>
                                </td>
                                {channelsForSite.map(ch => (
                                  <td key={ch.id} style={{ padding: '3px 1px', textAlign: 'center' }}>
                                    {editMode ? (
                                      <QtyInput qty={effectiveQty(item.id, ch.id)} onChange={q => handleCellChange(item.id, ch.id, q)} />
                                    ) : (
                                      <QtyBadge qty={effectiveQty(item.id, ch.id)} />
                                    )}
                                  </td>
                                ))}
                                <td style={{ padding: '3px 2px', textAlign: 'center' }}>
                                  <QtyBadge qty={total} />
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ padding: '6px 4px', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '2px solid #F1F5F9', whiteSpace: 'nowrap' }}>Total</td>
                        {channelsForSite.map(ch => (
                          <td key={ch.id} style={{ padding: '6px 2px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#334155', borderTop: '2px solid #F1F5F9', whiteSpace: 'nowrap' }}>
                            {totalForChannel(ch)}
                          </td>
                        ))}
                        <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 12, fontWeight: 800, color: GREEN, background: '#F0FDF4', borderTop: '2px solid #F1F5F9', whiteSpace: 'nowrap' }}>
                          {siteTotal}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 20, marginBottom: 0 }}>
          Powered by Recess Roster
        </p>
      </div>

      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', width: '100%', maxWidth: 560 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>Save {pendingChanges.length} change{pendingChanges.length === 1 ? '' : 's'}?</p>
            <p style={{ fontSize: 12.5, color: '#64748B', marginBottom: 14 }}>Enter your name so it's clear who updated the numbers.</p>
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Your name"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', fontSize: 16, marginBottom: 10 }}
            />
            {saveError && <p style={{ color: '#DC2626', fontSize: 12.5, marginBottom: 10 }}>{saveError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={saving}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', color: '#475569', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Back
              </button>
              <button
                onClick={confirmSave}
                disabled={saving}
                style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: GREEN, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving…' : '🔒 Confirm & Lock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
