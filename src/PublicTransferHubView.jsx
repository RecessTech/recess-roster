import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const TEAL = '#0F766E';
const NAME_STORAGE_KEY = 'transferHub_yourName';
const UNIT_OPTIONS = ['Sleeve', 'Units', 'Cans', 'Tins', 'Bunch(s)', 'Dozen', 'kg', 'g'];

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
  width: '100%', fontSize: 16, padding: '10px 11px', borderRadius: 8,
  border: '1px solid #E2E8F0', color: '#1E293B', fontFamily: 'inherit', boxSizing: 'border-box',
};
const labelStyle = { fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, display: 'block' };

// Staff-facing, no login: check what's needed, request something, or mark a
// request fulfilled. See supabase/functions/public-transfer-hub -- writes
// carry no real identity, just whatever name someone types in below.

export default function PublicTransferHubView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState(loadStoredName);

  const [showForm, setShowForm] = useState(false);
  const [formLocationId, setFormLocationId] = useState(null);
  const [formSubject, setFormSubject] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formUnit, setFormUnit] = useState(UNIT_OPTIONS[1]);
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [showFlagForm, setShowFlagForm] = useState(false);
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
      setShowForm(false);
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
      setShowFlagForm(false);
      setFlagSuccess(`Flagged ${item?.name || 'that SKU'} as low -- an admin will review it.`);
      setTimeout(() => setFlagSuccess(null), 5000);
    } catch (e) {
      setFlagError(e.message || 'Could not flag that SKU.');
    } finally {
      setFlagSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #E2E8F0', borderTopColor: TEAL,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>Loading Transfer Hub…</p>
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
          <p style={{ color: '#1E293B', fontWeight: 600, marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>Couldn't load Transfer Hub</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '14px 4px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', touchAction: 'manipulation' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header card */}
        <div style={{ background: TEAL, borderRadius: '12px 12px 0 0', padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {data.businessName}
            </div>
            {data.staffHubToken && (
              <a
                href={`/hub/${data.staffHubToken}`}
                style={{
                  color: 'white', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
                  background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 999, flexShrink: 0,
                }}
              >
                🏠 Home
              </a>
            )}
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>
            Transfer Hub
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            {totalCount === 0 ? 'Nothing needed right now' : `${totalCount} item${totalCount !== 1 ? 's' : ''} needed`}
          </div>
        </div>

        <div style={{ background: '#F0FDFA', borderLeft: '1px solid #99F6E4', borderRight: '1px solid #99F6E4', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: '#115E59', fontWeight: 600 }}>no login required · check, request, or mark fulfilled</span>
        </div>

        {flagSuccess && (
          <div style={{ background: '#ECFDF5', borderLeft: '1px solid #A7F3D0', borderRight: '1px solid #A7F3D0', padding: '10px 16px', fontSize: 12.5, color: '#065F46', fontWeight: 600 }}>
            ✓ {flagSuccess}
          </div>
        )}

        {/* New Request -- kept at the top since it's the most common thing
            someone opens this link to do, not buried below the list */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none', overflow: 'hidden' }}>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              style={{
                width: '100%', padding: '16px', background: TEAL, border: 'none', cursor: 'pointer',
                fontSize: 16, fontWeight: 800, color: 'white', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>＋</span> New Request
            </button>
          ) : (
            <form onSubmit={handleSubmit} style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: '#1E293B' }}>What do you need?</span>
                <button type="button" onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Which site needs it</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {data.locations.map(loc => (
                    <button
                      type="button"
                      key={loc.id}
                      onClick={() => setFormLocationId(loc.id)}
                      style={{
                        padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        border: formLocationId === loc.id ? 'none' : '1px solid #E2E8F0',
                        background: formLocationId === loc.id ? TEAL : 'white',
                        color: formLocationId === loc.id ? 'white' : '#475569',
                      }}
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>SKU or component</label>
                <SubjectPicker items={activeItems} components={activeComponents} value={formSubject} onChange={setFormSubject} />
              </div>

              <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Quantity</label>
                  <input type="number" min="0" step="any" value={formQuantity} onChange={e => setFormQuantity(e.target.value)} placeholder="e.g. 4" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Unit</label>
                  <select value={formUnit} onChange={e => setFormUnit(e.target.value)} style={{ ...inputStyle, background: 'white' }}>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Note (optional)</label>
                <input value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="e.g. Need by tomorrow AM" style={inputStyle} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Your name</label>
                <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="So the other site knows who asked" style={inputStyle} />
              </div>

              {formError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 10 }}>{formError}</div>}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%', padding: '13px', borderRadius: 8, border: 'none', cursor: submitting ? 'default' : 'pointer',
                  background: TEAL, color: 'white', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? 'Sending…' : 'Send Request'}
              </button>
            </form>
          )}
        </div>

        {/* Flag Low Stock -- a separate, lighter-weight signal from a full
            transfer request: "someone should look at this", not "send me
            X units". Never writes to the admin's own stock status -- it's
            reviewed and cleared in R-Stock's Stocktake tab. */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none', overflow: 'hidden' }}>
          {!showFlagForm ? (
            <button
              onClick={() => setShowFlagForm(true)}
              style={{
                width: '100%', padding: '14px', background: 'white', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 700, color: '#BE185D', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              🚩 Flag a SKU as Running Low
            </button>
          ) : (
            <form onSubmit={handleFlagSubmit} style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: '#1E293B' }}>What's running low?</span>
                <button type="button" onClick={() => setShowFlagForm(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>

              <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 0, marginBottom: 12 }}>
                This just flags it for review -- it doesn't change anything in R-Stock itself, an admin makes the final call.
              </p>

              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Which site</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {data.locations.map(loc => (
                    <button
                      type="button"
                      key={loc.id}
                      onClick={() => { setFlagLocationId(loc.id); setFlagSubject(''); }}
                      style={{
                        padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        border: flagLocationId === loc.id ? 'none' : '1px solid #E2E8F0',
                        background: flagLocationId === loc.id ? '#BE185D' : 'white',
                        color: flagLocationId === loc.id ? 'white' : '#475569',
                      }}
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>SKU</label>
                <SubjectPicker items={flaggableItems} components={[]} value={flagSubject} onChange={setFlagSubject} placeholder="Search SKUs carried at this site…" />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Your name</label>
                <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="So the review makes sense later" style={inputStyle} />
              </div>

              {flagError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 10 }}>{flagError}</div>}

              <button
                type="submit"
                disabled={flagSubmitting}
                style={{
                  width: '100%', padding: '13px', borderRadius: 8, border: 'none', cursor: flagSubmitting ? 'default' : 'pointer',
                  background: '#BE185D', color: 'white', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', opacity: flagSubmitting ? 0.6 : 1,
                }}
              >
                {flagSubmitting ? 'Flagging…' : '🚩 Flag as Low'}
              </button>
            </form>
          )}
        </div>

        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          {grouped.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              No open transfer requests. All good to go.
            </div>
          ) : (
            grouped.map(([locationName, rows]) => (
              <div key={locationName}>
                <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: '#0F766E', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F8FAFC' }}>
                  {locationName} needs
                </div>
                {rows.map(r => (
                  <FulfilRow key={r.id} row={r} locations={data.locations} onFulfill={handleFulfill} />
                ))}
              </div>
            ))
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 20, marginBottom: 0 }}>
          Powered by Recess Roster
        </p>
      </div>
    </div>
  );
}

// Catalogs can run into the hundreds of SKUs, and a native <select> is
// painful to hunt through on mobile (long scroll, no filtering on most
// mobile browsers). This is a small type-to-filter list instead.

function SubjectPicker({ items, components, value, onChange, placeholder = 'Search SKUs & components…' }) {
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
        style={inputStyle}
        placeholder={placeholder}
        value={open ? query : (selected ? `${selected.name}${selected.sku ? ' (' + selected.sku + ')' : ' (Component)'}` : '')}
        onChange={e => { setQuery(e.target.value); onChange(''); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
      />
      {open && (
        <div style={{
          position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4,
          maxHeight: 240, overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: 'white', border: '1px solid #E2E8F0',
          borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: '#94A3B8' }}>No matching SKUs or components</div>
          ) : filtered.map(o => (
            <button
              type="button"
              key={`${o.kind}:${o.id}`}
              onClick={() => { onChange(`${o.kind}:${o.id}`); setOpen(false); setQuery(''); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none',
                borderBottom: '1px solid #F1F5F9', background: 'white', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{o.name}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{o.kind === 'component' ? `Component · ${o.uom}` : `${o.sku} · ${o.uom}`}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FulfilRow({ row, locations, onFulfill }) {
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
    <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1E293B' }}>{row.item.name}</div>
          <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 1 }}>
            {row.item.sku || 'Component'} · {timeAgo(row.requested_at)}{row.requested_by_name ? ` · ${row.requested_by_name}` : ''}
          </div>
          {row.note && <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 3, fontStyle: 'italic' }}>&ldquo;{row.note}&rdquo;</div>}
        </div>
        <div style={{
          flexShrink: 0, background: '#F0FDFA', color: TEAL, fontWeight: 800, fontSize: 13,
          padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
        }}>
          {row.quantity} {row.quantity_unit || row.item.uom}
        </div>
      </div>

      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          style={{
            marginTop: 8, padding: '7px 14px', borderRadius: 7, border: 'none', background: TEAL,
            color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          <span style={{ fontSize: 13 }}>✓</span> Mark Fulfilled
        </button>
      ) : (
        <div style={{ marginTop: 10, padding: '10px', background: '#F8FAFC', borderRadius: 8 }}>
          <label style={labelStyle}>Which site is sending it</label>
          <select
            value={sourceLocationId}
            onChange={e => setSourceLocationId(e.target.value)}
            style={{ ...inputStyle, marginBottom: 8 }}
          >
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={confirmFulfil}
              disabled={submitting}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8, border: 'none', cursor: submitting ? 'default' : 'pointer',
                background: TEAL, color: 'white', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Saving…' : '✓ Confirm Fulfilled'}
            </button>
            <button
              onClick={() => setExpanded(false)}
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#64748B', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
          </div>
          {rowError && <div style={{ marginTop: 8, fontSize: 11.5, color: '#DC2626' }}>{rowError}</div>}
        </div>
      )}
    </div>
  );
}
