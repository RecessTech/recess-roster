import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const TEAL = '#0F766E';

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

// Read-only "what's needed before I head to the other site" dashboard —
// no login, no actioning. See supabase/functions/public-transfer-hub.

export default function PublicTransferHubView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-transfer-hub', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token },
      });
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(e.message || 'Unable to load Transfer Hub.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

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
          <span style={{ fontSize: 12, color: '#115E59', fontWeight: 600 }}>read-only · check before you head over</span>
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
                  <div key={r.id} style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1E293B' }}>{r.item.name}</div>
                      <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 1 }}>{r.item.sku || 'Component'} · {timeAgo(r.requested_at)}</div>
                      {r.note && <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 3, fontStyle: 'italic' }}>&ldquo;{r.note}&rdquo;</div>}
                    </div>
                    <div style={{
                      flexShrink: 0, background: '#F0FDFA', color: TEAL, fontWeight: 800, fontSize: 13,
                      padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
                    }}>
                      {r.quantity} {r.item.uom}
                    </div>
                  </div>
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
