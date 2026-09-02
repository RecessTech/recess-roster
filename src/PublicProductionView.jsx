import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const GREEN = '#15803D';

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

export default function PublicProductionView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [date, setDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('d') || todayStr();
  });
  const [activeSiteId, setActiveSiteId] = useState(null);

  const load = useCallback(async (d) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-production', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token, date: d },
      });
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(e.message || 'Unable to load production plan.');
    } finally {
      setLoading(false);
    }
  }, [token]);

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

  const channelsForSite = useMemo(() => {
    if (!data) return [];
    return data.channels.filter(c => c.site_id === activeSiteId);
  }, [data, activeSiteId]);

  const getQty = useCallback((itemId, channelId) => {
    if (!data) return 0;
    const row = data.entries.find(e => e.item_id === itemId && e.channel_id === channelId);
    return row ? (Number(row.qty) || 0) : 0;
  }, [data]);

  const totalForChannel = useCallback(ch => {
    if (!data) return 0;
    return data.items.reduce((sum, it) => sum + getQty(it.id, ch.id), 0);
  }, [data, getQty]);

  const siteTotal = useMemo(() => channelsForSite.reduce((sum, ch) => sum + totalForChannel(ch), 0), [channelsForSite, totalForChannel]);

  const totalsByItemForSite = useMemo(() => {
    const m = new Map();
    if (!data) return m;
    data.items.forEach(it => m.set(it.id, 0));
    const siteChannelIds = new Set(channelsForSite.map(c => c.id));
    data.entries.forEach(e => {
      if (!siteChannelIds.has(e.channel_id)) return;
      m.set(e.item_id, (m.get(e.item_id) || 0) + (Number(e.qty) || 0));
    });
    return m;
  }, [data, channelsForSite]);

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
  const activeLock = (data.locks || []).find(l => l.site_id === activeSiteId);

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '14px 4px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Header card */}
        <div style={{ background: GREEN, borderRadius: '12px 12px 0 0', padding: '22px 24px' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            {data.businessName}
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>
            Production Plan
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            {dayLabel(date)} · {fmtDateShort(date)}
          </div>
        </div>

        {/* Date navigation */}
        <div style={{ background: '#F0FDF4', borderLeft: '1px solid #BBF7D0', borderRight: '1px solid #BBF7D0', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setDate(d => addDays(d, -1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN, fontSize: 18, padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}>←</button>
          <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>read-only</span>
          <button onClick={() => setDate(d => addDays(d, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN, fontSize: 18, padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}>→</button>
        </div>

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
                      style={{
                        padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
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
                                    <QtyBadge qty={getQty(item.id, ch.id)} />
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
    </div>
  );
}
