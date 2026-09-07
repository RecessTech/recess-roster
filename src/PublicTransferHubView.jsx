import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const TEAL = '#0F766E';
const TEAL_DK = '#0B5A54';
const PINK = '#BE185D';
const NAME_STORAGE_KEY = 'transferHub_yourName';
const UNIT_OPTIONS = ['Sleeve', 'Units', 'Cans', 'Tins', 'Bunch(s)', 'Dozen', 'kg', 'g'];

const CARD_RADIUS = 16;
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -8px rgba(15,23,42,0.10)';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

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
// under 16px, then snaps back on blur -- that jarring zoom-in/out is the
// "janky" behaviour, not an actual bug in the zoom itself. 16px avoids it
// without disabling pinch-zoom (which the viewport meta tag could do, but
// that's an accessibility regression -- fixing the font size is the correct
// fix, not a workaround).
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

// Staff-facing, no login: check what's needed, request something, flag a
// SKU as low, or mark a request fulfilled. See
// supabase/functions/public-transfer-hub -- writes carry no real identity,
// just whatever name someone types in below.

export default function PublicTransferHubView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState(loadStoredName);

  const [activePanel, setActivePanel] = useState(null); // null | 'request' | 'flag'
  const [formLocationId, setFormLocationId] = useState(null);
  const [formSubject, setFormSubject] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formUnit, setFormUnit] = useState(UNIT_OPTIONS[1]);
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [flagLocationId, setFlagLocationId] = useState(null);
  const [flagSubject, setFlagSubject] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagError, setFlagError] = useState(null);
  const [flagSuccess, setFlagSuccess] = useState(null);

  const load = useCallback(async (extra) => {
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-transfer-hub', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token, ...extra },
      });
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
      return result;
    } catch (e) {
      setError(e.message || 'Unable to load Transfer Hub.');
      throw e;
    }
  }, [token]);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);

  useEffect(() => {
    if (!formLocationId && data?.locations?.[0]) setFormLocationId(data.locations[0].id);
  }, [data, formLocationId]);

  useEffect(() => {
    if (!flagLocationId && data?.locations?.[0]) setFlagLocationId(data.locations[0].id);
  }, [data, flagLocationId]);

  function handleNameChange(v) {
    setName(v);
    storeName(v);
  }

  const grouped = useMemo(() => {
    if (!data) return [];
    const itemById = new Map(data.items.map(i => [i.id, i]));
    const componentById = new Map((data.components || []).map(c => [c.id, c]));
    const locationById = new Map(data.locations.map(l => [l.id, l]));
    const groups = new Map();
    for (const r of data.requests) {
      const loc = locationById.get(r.requesting_location_id);
      const subject = r.stock_item_id
        ? itemById.get(r.stock_item_id)
        : (componentById.get(r.component_id) ? { ...componentById.get(r.component_id), sku: null } : null);
      if (!loc || !subject) continue;
      if (!groups.has(loc.name)) groups.set(loc.name, []);
      groups.get(loc.name).push({ ...r, item: subject });
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const totalCount = data?.requests?.length || 0;
  const activeItems = useMemo(() => (data?.items || []).filter(i => i.active !== false), [data]);
  const activeComponents = useMemo(() => (data?.components || []).filter(c => c.active !== false), [data]);

  // Only a SKU actually carried at the chosen site can be flagged -- that's
  // the stock_item_sites row the flag lives on, and only that row shows up
  // in the admin's Stocktake for the site in question.
  const flaggableItems = useMemo(() => {
    if (!flagLocationId) return [];
    const carriedIds = new Set((data?.carries || []).filter(c => c.location_id === flagLocationId).map(c => c.item_id));
    return activeItems.filter(i => carriedIds.has(i.id));
  }, [activeItems, data, flagLocationId]);

  function openPanel(panel) {
    setActivePanel(prev => (prev === panel ? null : panel));
    setFormError(null);
    setFlagError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!formLocationId || !formSubject || !formQuantity || Number(formQuantity) <= 0) {
      setFormError('Pick a site, a SKU or component, and a quantity greater than 0.');
      return;
    }
    const [kind, id] = formSubject.split(':');
    setSubmitting(true);
    try {
      await load({
        action: 'create',
        locationId: formLocationId,
        itemId: kind === 'item' ? id : null,
        componentId: kind === 'component' ? id : null,
        quantity: Number(formQuantity),
        quantityUnit: formUnit,
        note: formNote,
        name,
      });
      setFormSubject('');
      setFormQuantity('');
      setFormUnit(UNIT_OPTIONS[1]);
      setFormNote('');
      setActivePanel(null);
    } catch (e) {
      setFormError(e.message || 'Could not send that request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFulfill(requestId, sourceLocationId) {
    return load({ action: 'fulfill', requestId, sourceLocationId, name });
  }

  async function handleFlagSubmit(e) {
    e.preventDefault();
    setFlagError(null);
    if (!flagLocationId || !flagSubject) {
      setFlagError('Pick a site and a SKU.');
      return;
    }
    const [, id] = flagSubject.split(':');
    const item = flaggableItems.find(i => i.id === id);
    setFlagSubmitting(true);
    try {
      await load({ action: 'flag_low', itemId: id, locationId: flagLocationId, name });
      setFlagSubject('');
      setActivePanel(null);
      setFlagSuccess(`Flagged ${item?.name || 'that SKU'} as low — an admin will review it.`);
      setTimeout(() => setFlagSuccess(null), 5000);
    } catch (e) {
      setFlagError(e.message || 'Could not flag that SKU.');
    } finally {
      setFlagSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: TEAL,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: FONT }}>Loading Transfer Hub…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: 16, padding: '32px 24px', maxWidth: 360, textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#1E293B', fontWeight: 700, marginBottom: 6, fontFamily: FONT }}>Couldn't load Transfer Hub</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: FONT }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F8', padding: '16px 12px 32px', fontFamily: FONT, touchAction: 'manipulation' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${TEAL}, #0D9488)`, borderRadius: CARD_RADIUS,
          padding: '20px 20px 18px', boxShadow: '0 10px 24px -10px rgba(15,118,110,0.5)', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                {data.businessName}
              </div>
              <div style={{ color: 'white', fontSize: 23, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                Transfer Hub
              </div>
            </div>
            {data.staffHubToken && (
              <a
                href={`/hub/${data.staffHubToken}`}
                title="Back to Staff Hub"
                style={{
                  width: 36, height: 36, borderRadius: 999, background: 'rgba(255,255,255,0.16)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
                  fontSize: 16, flexShrink: 0,
                }}
              >
                🏠
              </a>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <span style={{
              background: totalCount === 0 ? 'rgba(255,255,255,0.16)' : 'white', color: totalCount === 0 ? 'white' : TEAL_DK,
              fontSize: 12.5, fontWeight: 800, padding: '5px 12px', borderRadius: 999,
            }}>
              {totalCount === 0 ? 'All clear' : `${totalCount} item${totalCount !== 1 ? 's' : ''} needed`}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, fontWeight: 500 }}>No login required</span>
          </div>
        </div>

        {flagSuccess && (
          <div style={{
            background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: '11px 14px',
            marginBottom: 12, fontSize: 12.5, color: '#065F46', fontWeight: 600, display: 'flex', gap: 7,
          }}>
            <span>✓</span> {flagSuccess}
          </div>
        )}

        {/* Actions -- New Request and Flag Low Stock share one card as a
            compact two-up toolbar; tapping either expands its form in
            place, closing the other so only one is open at a time. */}
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, marginBottom: 12, overflow: 'hidden' }}>
          {activePanel === null && (
            <div style={{ display: 'flex', gap: 1, background: '#EEF1F4' }}>
              <button
                onClick={() => openPanel('request')}
                style={{
                  flex: 1, padding: '16px 10px', background: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{ fontSize: 19, color: TEAL, lineHeight: 1 }}>＋</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B' }}>New Request</span>
              </button>
              <button
                onClick={() => openPanel('flag')}
                style={{
                  flex: 1, padding: '16px 10px', background: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>🚩</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B' }}>Flag Low Stock</span>
              </button>
            </div>
          )}

          {activePanel === 'request' && (
            <form onSubmit={handleSubmit} style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#1E293B' }}>＋ What do you need?</span>
                <button type="button" onClick={() => setActivePanel(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Which site needs it</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {data.locations.map(loc => (
                    <button type="button" key={loc.id} onClick={() => setFormLocationId(loc.id)} style={pillButtonStyle(formLocationId === loc.id, TEAL)}>
                      {loc.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>SKU or component</label>
                <SubjectPicker items={activeItems} components={activeComponents} value={formSubject} onChange={setFormSubject} />
              </div>

              <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Quantity</label>
                  <input type="number" min="0" step="any" value={formQuantity} onChange={e => setFormQuantity(e.target.value)} placeholder="e.g. 4" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Unit</label>
                  <select value={formUnit} onChange={e => setFormUnit(e.target.value)} style={inputStyle}>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Note (optional)</label>
                <input value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="e.g. Need by tomorrow AM" style={inputStyle} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Your name</label>
                <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="So the other site knows who asked" style={inputStyle} />
              </div>

              {formError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 10, fontWeight: 500 }}>{formError}</div>}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%', padding: '14px', borderRadius: 11, border: 'none', cursor: submitting ? 'default' : 'pointer',
                  background: TEAL, color: 'white', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', opacity: submitting ? 0.6 : 1,
                  boxShadow: submitting ? 'none' : '0 4px 12px -4px rgba(15,118,110,0.5)',
                }}
              >
                {submitting ? 'Sending…' : 'Send Request'}
              </button>
            </form>
          )}

          {activePanel === 'flag' && (
            <form onSubmit={handleFlagSubmit} style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#1E293B' }}>🚩 What's running low?</span>
                <button type="button" onClick={() => setActivePanel(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>

              <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 14px', lineHeight: 1.4 }}>
                This just flags it for review — it doesn't change anything in R-Stock, an admin makes the final call.
              </p>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Which site</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {data.locations.map(loc => (
                    <button
                      type="button"
                      key={loc.id}
                      onClick={() => { setFlagLocationId(loc.id); setFlagSubject(''); }}
                      style={pillButtonStyle(flagLocationId === loc.id, PINK)}
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>SKU</label>
                <SubjectPicker items={flaggableItems} components={[]} value={flagSubject} onChange={setFlagSubject} placeholder="Search SKUs carried at this site…" accent={PINK} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Your name</label>
                <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="So the review makes sense later" style={inputStyle} />
              </div>

              {flagError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 10, fontWeight: 500 }}>{flagError}</div>}

              <button
                type="submit"
                disabled={flagSubmitting}
                style={{
                  width: '100%', padding: '14px', borderRadius: 11, border: 'none', cursor: flagSubmitting ? 'default' : 'pointer',
                  background: PINK, color: 'white', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', opacity: flagSubmitting ? 0.6 : 1,
                  boxShadow: flagSubmitting ? 'none' : '0 4px 12px -4px rgba(190,24,93,0.45)',
                }}
              >
                {flagSubmitting ? 'Flagging…' : 'Flag as Low'}
              </button>
            </form>
          )}
        </div>

        {/* Needs list -- one card per site so each stays visually distinct
            rather than one long undifferentiated list. */}
        {grouped.length === 0 ? (
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '44px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>All caught up</div>
            <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 3 }}>No open transfer requests right now.</div>
          </div>
        ) : (
          grouped.map(([locationName, rows], gi) => (
            <div key={locationName} style={{ marginBottom: gi < grouped.length - 1 ? 12 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingLeft: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: TEAL, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{locationName}</span>
                <span style={{ fontSize: 11.5, color: '#94A3B8' }}>· {rows.length} needed</span>
              </div>
              <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
                {rows.map((r, ri) => (
                  <FulfilRow key={r.id} row={r} locations={data.locations} onFulfill={handleFulfill} isLast={ri === rows.length - 1} />
                ))}
              </div>
            </div>
          ))
        )}

        <p style={{ textAlign: 'center', color: '#B5BEC9', fontSize: 11, marginTop: 22, marginBottom: 0 }}>
          Powered by Recess Roster
        </p>
      </div>
    </div>
  );
}

// Catalogs can run into the hundreds of SKUs, and a native <select> is
// painful to hunt through on mobile (long scroll, no filtering on most
// mobile browsers). This is a small type-to-filter list instead.

function SubjectPicker({ items, components, value, onChange, placeholder = 'Search SKUs & components…', accent = TEAL }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const options = useMemo(() => [
    ...items.map(i => ({ kind: 'item', id: i.id, name: i.name, sku: i.sku, uom: i.uom })),
    ...components.map(c => ({ kind: 'component', id: c.id, name: c.name, sku: null, uom: c.uom })),
  ], [items, components]);

  const selected = value ? options.find(o => `${o.kind}:${o.id}` === value) || null : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? options.filter(o => o.name.toLowerCase().includes(q) || (o.sku || '').toLowerCase().includes(q))
      : options;
    return pool.slice(0, 50);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open]);

  return (
    <div style={{ position: 'relative' }} ref={wrapRef}>
      <input
        style={{ ...inputStyle, ...(open ? { borderColor: accent, background: 'white' } : {}) }}
        placeholder={placeholder}
        value={open ? query : (selected ? `${selected.name}${selected.sku ? ' (' + selected.sku + ')' : ' (Component)'}` : '')}
        onChange={e => { setQuery(e.target.value); onChange(''); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
      />
      {open && (
        <div style={{
          position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 6,
          maxHeight: 240, overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: 'white', border: '1px solid #E5E9EF',
          borderRadius: 12, boxShadow: '0 8px 24px -6px rgba(15,23,42,0.16)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 12.5, color: '#94A3B8' }}>No matches</div>
          ) : filtered.map((o, i) => (
            <button
              type="button"
              key={`${o.kind}:${o.id}`}
              onClick={() => { onChange(`${o.kind}:${o.id}`); setOpen(false); setQuery(''); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid #F1F5F9', background: 'white', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1E293B' }}>{o.name}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{o.kind === 'component' ? `Component · ${o.uom}` : `${o.sku} · ${o.uom}`}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FulfilRow({ row, locations, onFulfill, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const fallbackSource = locations.find(l => l.id !== row.requesting_location_id)?.id || locations[0]?.id || '';
  const [sourceLocationId, setSourceLocationId] = useState(fallbackSource);
  const [submitting, setSubmitting] = useState(false);
  const [rowError, setRowError] = useState(null);

  async function confirmFulfil() {
    setSubmitting(true);
    setRowError(null);
    try {
      await onFulfill(row.id, sourceLocationId);
    } catch (e) {
      setRowError(e.message || 'Could not update that request.');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: '13px 16px', borderBottom: isLast ? 'none' : '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{row.item.name}</div>
          <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
            {row.item.sku || 'Component'} · {timeAgo(row.requested_at)}{row.requested_by_name ? ` · ${row.requested_by_name}` : ''}
          </div>
          {row.note && <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, fontStyle: 'italic' }}>&ldquo;{row.note}&rdquo;</div>}
        </div>
        <div style={{
          flexShrink: 0, background: '#F0FDFA', color: TEAL_DK, fontWeight: 800, fontSize: 12.5,
          padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap',
        }}>
          {row.quantity} {row.quantity_unit || row.item.uom}
        </div>
      </div>

      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          style={{
            marginTop: 10, padding: '7px 14px', borderRadius: 8, border: 'none', background: TEAL,
            color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          <span>✓</span> Mark Fulfilled
        </button>
      ) : (
        <div style={{ marginTop: 10, padding: 12, background: '#F8FAFC', borderRadius: 12 }}>
          <label style={labelStyle}>Which site is sending it</label>
          <select
            value={sourceLocationId}
            onChange={e => setSourceLocationId(e.target.value)}
            style={{ ...inputStyle, marginBottom: 10, background: 'white' }}
          >
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={confirmFulfil}
              disabled={submitting}
              style={{
                flex: 1, padding: '11px 12px', borderRadius: 9, border: 'none', cursor: submitting ? 'default' : 'pointer',
                background: TEAL, color: 'white', fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit', opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Saving…' : '✓ Confirm Fulfilled'}
            </button>
            <button
              onClick={() => setExpanded(false)}
              style={{ padding: '11px 14px', borderRadius: 9, border: '1px solid #E5E9EF', background: 'white', color: '#64748B', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
          </div>
          {rowError && <div style={{ marginTop: 8, fontSize: 11.5, color: '#DC2626', fontWeight: 500 }}>{rowError}</div>}
        </div>
      )}
    </div>
  );
}
