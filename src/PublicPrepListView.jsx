import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const AMBER = '#B45309';
const AMBER_DK = '#92400E';
const NAME_STORAGE_KEY = 'prepList_yourName';

const CARD_RADIUS = 16;
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -8px rgba(15,23,42,0.10)';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// Local calendar date, not UTC -- toISOString() would roll back to the
// previous day for anyone west of UTC at certain hours, which is exactly
// wrong for a "today vs tomorrow" toggle.
function localISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO() {
  return localISODate(new Date());
}
function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localISODate(d);
}

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

// Staff-facing, no login: flag a prep component as running low for a site,
// for today or tomorrow, and tick things off once they're prepped. See
// supabase/functions/public-prep-list -- writes carry no real identity,
// just whatever name someone types in below. Deliberately separate from
// R-Stock/Stocktake: flagging here never touches stock data at all.

export default function PublicPrepListView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState(loadStoredName);

  const [panelOpen, setPanelOpen] = useState(false);
  const [formLocationId, setFormLocationId] = useState(null);
  const [formComponentId, setFormComponentId] = useState('');
  const [formWhen, setFormWhen] = useState('today');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [flagSuccess, setFlagSuccess] = useState(null);

  const [completingId, setCompletingId] = useState(null);

  const load = useCallback(async (extra) => {
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-prep-list', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token, ...extra },
      });
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
      return result;
    } catch (e) {
      setError(e.message || 'Unable to load the Prep List.');
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

  function openPanel() {
    setPanelOpen(true);
    setFormError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!formLocationId || !formComponentId) {
      setFormError('Pick a site and a prep item.');
      return;
    }
    const component = data.components.find(c => c.id === formComponentId);
    setSubmitting(true);
    try {
      await load({
        action: 'flag',
        componentId: formComponentId,
        locationId: formLocationId,
        neededDate: formWhen === 'today' ? todayISO() : tomorrowISO(),
        name,
      });
      setFormComponentId('');
      setFormWhen('today');
      setPanelOpen(false);
      setFlagSuccess(`${component?.name || 'That'} is on the Prep List.`);
      setTimeout(() => setFlagSuccess(null), 5000);
    } catch (e) {
      setFormError(e.message || 'Could not flag that item.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete(flagId) {
    setCompletingId(flagId);
    try {
      await load({ action: 'complete', flagId, name });
    } catch (e) {
      setError(e.message || 'Could not update that item.');
    } finally {
      setCompletingId(null);
    }
  }

  // Today's bucket also catches anything overdue (needed_date in the past
  // and still open) -- that's more urgent, not less, so it belongs there
  // rather than vanishing off the bottom of a date-sorted list.
  const { todayRows, tomorrowRows } = useMemo(() => {
    if (!data) return { todayRows: [], tomorrowRows: [] };
    const componentById = new Map(data.components.map(c => [c.id, c]));
    const locationById = new Map(data.locations.map(l => [l.id, l]));
    const today = todayISO();
    const tomorrow = tomorrowISO();
    const rows = data.flags
      .map(f => ({ ...f, component: componentById.get(f.component_id), location: locationById.get(f.location_id) }))
      .filter(r => r.component && r.location);
    return {
      todayRows: rows.filter(r => r.needed_date <= today),
      tomorrowRows: rows.filter(r => r.needed_date > today && r.needed_date <= tomorrow),
    };
  }, [data]);

  const totalCount = todayRows.length + tomorrowRows.length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: AMBER,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: FONT }}>Loading Prep List…</p>
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
          <p style={{ color: '#1E293B', fontWeight: 700, marginBottom: 6, fontFamily: FONT }}>Couldn't load Prep List</p>
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
          background: `linear-gradient(135deg, ${AMBER}, #D97706)`, borderRadius: CARD_RADIUS,
          padding: '20px 20px 18px', boxShadow: '0 10px 24px -10px rgba(180,83,9,0.5)', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                {data.businessName}
              </div>
              <div style={{ color: 'white', fontSize: 23, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                Prep List
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
              background: totalCount === 0 ? 'rgba(255,255,255,0.16)' : 'white', color: totalCount === 0 ? 'white' : AMBER_DK,
              fontSize: 12.5, fontWeight: 800, padding: '5px 12px', borderRadius: 999,
            }}>
              {totalCount === 0 ? 'All clear' : `${totalCount} item${totalCount !== 1 ? 's' : ''} to prep`}
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
        {error && data && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '11px 14px',
            marginBottom: 12, fontSize: 12.5, color: '#B91C1C', fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        {/* Flag panel */}
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, marginBottom: 12, overflow: 'hidden' }}>
          {!panelOpen ? (
            <button
              onClick={openPanel}
              style={{
                width: '100%', padding: '16px 10px', background: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 17, lineHeight: 1 }}>🚩</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1E293B' }}>Flag something as running low</span>
            </button>
          ) : (
            <form onSubmit={handleSubmit} style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#1E293B' }}>🚩 What needs prepping?</span>
                <button type="button" onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>

              <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 14px', lineHeight: 1.4 }}>
                This only shows up here — it doesn't touch R-Stock or Stocktake.
              </p>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Which site</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {data.locations.map(loc => (
                    <button
                      type="button"
                      key={loc.id}
                      onClick={() => setFormLocationId(loc.id)}
                      style={pillButtonStyle(formLocationId === loc.id, AMBER)}
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Prep item</label>
                <select value={formComponentId} onChange={e => setFormComponentId(e.target.value)} style={inputStyle}>
                  <option value="">Select…</option>
                  {data.components.filter(c => c.active !== false).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Needed by</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setFormWhen('today')} style={{ ...pillButtonStyle(formWhen === 'today', AMBER), flex: 1 }}>Today</button>
                  <button type="button" onClick={() => setFormWhen('tomorrow')} style={{ ...pillButtonStyle(formWhen === 'tomorrow', AMBER), flex: 1 }}>Tomorrow</button>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Your name</label>
                <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="So it's clear who flagged it" style={inputStyle} />
              </div>

              {formError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 10, fontWeight: 500 }}>{formError}</div>}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%', padding: '14px', borderRadius: 11, border: 'none', cursor: submitting ? 'default' : 'pointer',
                  background: AMBER, color: 'white', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', opacity: submitting ? 0.6 : 1,
                  boxShadow: submitting ? 'none' : '0 4px 12px -4px rgba(180,83,9,0.5)',
                }}
              >
                {submitting ? 'Adding…' : 'Add to Prep List'}
              </button>
            </form>
          )}
        </div>

        <PrepSection title="Today" rows={todayRows} onComplete={handleComplete} completingId={completingId} />
        <PrepSection title="Tomorrow" rows={tomorrowRows} onComplete={handleComplete} completingId={completingId} last />

        <p style={{ textAlign: 'center', color: '#B5BEC9', fontSize: 11, marginTop: 22, marginBottom: 0 }}>
          Powered by Recess Roster
        </p>
      </div>
    </div>
  );
}

function PrepSection({ title, rows, onComplete, completingId, last }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: last ? 0 : 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingLeft: 2 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: AMBER, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        <span style={{ fontSize: 11.5, color: '#94A3B8' }}>· {rows.length} needed</span>
      </div>
      <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
        {rows.map((r, ri) => (
          <PrepRow key={r.id} row={r} onComplete={onComplete} completing={completingId === r.id} isLast={ri === rows.length - 1} />
        ))}
      </div>
    </div>
  );
}

function PrepRow({ row, onComplete, completing, isLast }) {
  return (
    <div style={{ padding: '13px 16px', borderBottom: isLast ? 'none' : '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={() => onComplete(row.id)}
        disabled={completing}
        title="Mark prepped"
        style={{
          width: 26, height: 26, borderRadius: 999, border: '2px solid #E5E9EF', background: 'white',
          flexShrink: 0, cursor: completing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#CBD5E1', fontSize: 14, opacity: completing ? 0.5 : 1,
        }}
      >
        {completing ? '…' : '✓'}
      </button>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{row.component.name}</div>
        <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
          {row.location.name} · {timeAgo(row.flagged_at)}{row.flagged_by_name ? ` · ${row.flagged_by_name}` : ''}
        </div>
      </div>
    </div>
  );
}
