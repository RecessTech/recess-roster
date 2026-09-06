import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const BLUE = '#3B5BDB';

// A single landing link for staff -- no data of its own, just a menu
// pointing at the other read-only public pages (R-Prod, Transfer Hub).
// See supabase/functions/public-staff-hub.

const LINKS = [
  {
    key: 'production',
    label: 'R-Prod',
    description: "Today's production plan",
    color: '#15803D',
    bg: '#F0FDF4',
    path: '/prod/',
  },
  {
    key: 'transfer',
    label: 'Transfer Hub',
    description: "What's needed before you head to the other site",
    color: '#0F766E',
    bg: '#F0FDFA',
    path: '/transfers/',
  },
];

export default function PublicStaffHubView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-staff-hub', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token },
      });
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(e.message || 'Unable to load this page.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #E2E8F0', borderTopColor: BLUE,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>Loading…</p>
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
          <p style={{ color: '#1E293B', fontWeight: 600, marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>Couldn't load this page</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tokenByKey = { production: data.productionToken, transfer: data.transferToken };

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '14px 4px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>

        {/* Header card */}
        <div style={{ background: BLUE, borderRadius: '12px 12px 0 0', padding: '22px 24px' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            {data.businessName}
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>
            R-Shift
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            Staff links
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden', padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {LINKS.map(link => {
              const linkToken = tokenByKey[link.key];
              const href = linkToken ? `${link.path}${linkToken}` : null;
              return (
                <a
                  key={link.key}
                  href={href || '#'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '16px 18px', borderRadius: 12, background: link.bg,
                    textDecoration: 'none', pointerEvents: href ? 'auto' : 'none', opacity: href ? 1 : 0.5,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: link.color }}>{link.label}</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{link.description}</div>
                  </div>
                  <div style={{ color: link.color, fontSize: 18 }}>→</div>
                </a>
              );
            })}
          </div>
          <p style={{ fontSize: 11.5, color: '#94A3B8', textAlign: 'center', marginTop: 14, marginBottom: 0 }}>
            Both links are read-only — no login required.
          </p>
        </div>

        <p style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 20, marginBottom: 0 }}>
          Powered by Recess Roster
        </p>
      </div>
    </div>
  );
}
