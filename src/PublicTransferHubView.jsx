import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const TEAL = '#0F766E';
const NAME_STORAGE_KEY = 'transferHub_yourName';

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

const inputStyle = {
  width: '100%', fontSize: 13.5, padding: '9px 11px', borderRadius: 8,
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
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

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
        note: formNote,
        name,
      });
      setFormSubject('');
      setFormQuantity('');
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
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '14px 4px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header card */}
        <div style={{ background: TEAL, borderRadius: '12px 12px 0 0', padding: '22px 24px' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            {data.businessName}
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

        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none', overflow: 'hidden' }}>
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

        {/* Request form */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              style={{
                width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13.5, fontWeight: 700, color: TEAL, fontFamily: 'inherit',
              }}
            >
              + Request something
            </button>
          ) : (
            <form onSubmit={handleSubmit} style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1E293B' }}>What do you need?</span>
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
                <select value={formSubject} onChange={e => setFormSubject(e.target.value)} style={{ ...inputStyle, background: 'white' }}>
                  <option value="">Select one…</option>
                  {activeItems.length > 0 && (
                    <optgroup label="SKUs">
                      {activeItems.map(i => <option key={i.id} value={`item:${i.id}`}>{i.name} ({i.sku})</option>)}
                    </optgroup>
                  )}
                  {activeComponents.length > 0 && (
                    <optgroup label="Components">
                      {activeComponents.map(c => <option key={c.id} value={`component:${c.id}`}>{c.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Quantity</label>
                <input type="number" min="0" step="any" value={formQuantity} onChange={e => setFormQuantity(e.target.value)} placeholder="e.g. 4" style={inputStyle} />
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
                  width: '100%', padding: '11px', borderRadius: 8, border: 'none', cursor: submitting ? 'default' : 'pointer',
                  background: TEAL, color: 'white', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? 'Sending…' : 'Send Request'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 20, marginBottom: 0 }}>
          Powered by Recess Roster
        </p>
      </div>
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
          {row.quantity} {row.item.uom}
        </div>
      </div>

      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          style={{
            marginTop: 8, padding: '6px 12px', borderRadius: 7, border: '1px solid #D1FAE5', background: 'white',
            color: TEAL, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Mark fulfilled
        </button>
      ) : (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <select
            value={sourceLocationId}
            onChange={e => setSourceLocationId(e.target.value)}
            style={{ ...inputStyle, width: 'auto', padding: '6px 8px', fontSize: 12 }}
          >
            {locations.map(l => <option key={l.id} value={l.id}>From {l.name}</option>)}
          </select>
          <button
            onClick={confirmFulfil}
            disabled={submitting}
            style={{
              padding: '6px 12px', borderRadius: 7, border: 'none', cursor: submitting ? 'default' : 'pointer',
              background: TEAL, color: 'white', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Saving…' : 'Confirm'}
          </button>
          <button
            onClick={() => setExpanded(false)}
            style={{ padding: '6px 10px', borderRadius: 7, border: 'none', background: 'none', color: '#94A3B8', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
          {rowError && <div style={{ width: '100%', fontSize: 11.5, color: '#DC2626' }}>{rowError}</div>}
        </div>
      )}
    </div>
  );
}
