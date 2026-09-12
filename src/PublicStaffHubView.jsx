import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const BLUE = '#3B5BDB';

const CARD_RADIUS = 16;
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -8px rgba(15,23,42,0.10)';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// A single landing link for staff -- no data of its own, just a launcher
// pointing at the other read-only public pages (R-Prod, Transfer Hub).
// See supabase/functions/public-staff-hub. Each tile keeps the destination
// page's own accent colour, so it reads as a preview of what's behind it --
// the same colour greets you again once you tap through.

const LINKS = [
  {
    key: 'production',
    label: 'R-Prod',
    description: "Today's plan",
    icon: '🧑‍🍳',
    color: '#15803D',
    tint: '#F0FDF4',
    path: '/prod/',
  },
  {
    key: 'transfer',
    label: 'Transfer Hub',
    description: 'Stock between sites',
    icon: '🔄',
    color: '#0F766E',
    tint: '#F0FDFA',
    path: '/transfers/',
  },
  {
    key: 'prep',
    label: 'Prep List',
    description: "What needs prepping",
    icon: '🚩',
    color: '#B45309',
    tint: '#FFFBEB',
    path: '/prep/',
  },
  {
    key: 'checklists',
    label: 'Checklists',
    description: 'Opening & closing',
    icon: '📋',
    color: '#4F46E5',
    tint: '#EEF2FF',
    path: '/checklists/',
  },
  {
    key: 'catering',
    label: 'Catering',
    description: "Today's jobs",
    icon: '🥪',
    color: '#BE185D',
    tint: '#FDF2F8',
    path: '/cater/',
  },
  {
    key: 'builds',
    label: 'Build Guides',
    description: 'How to assemble each item',
    icon: '🧱',
    color: '#0891B2',
    tint: '#ECFEFF',
    path: '/builds/',
  },
  {
    key: 'barista',
    label: 'Drinks Guide',
    description: 'How to make each drink',
    icon: '☕',
    color: '#92400E',
    tint: '#FDF8F3',
    path: '/barista/',
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

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
      <div style={{ minHeight: '100vh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: BLUE,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: FONT }}>Loading…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: '32px 24px', maxWidth: 360, textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#1E293B', fontWeight: 700, marginBottom: 6, fontFamily: FONT }}>Couldn't load this page</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: FONT }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F8', padding: '16px 12px 32px', fontFamily: FONT }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 440, margin: '0 auto' }}>

        {/* Header -- a warm, time-of-day greeting instead of a plain
            "Staff links" label. This page has one job: get someone to
            the right place in one tap, so it should feel like opening
            an app, not reading a menu. Kept compact (vs. the original,
            roomier version) so the tile grid below has enough headroom
            to show 8 tiles on one screen without scrolling. */}
        <div style={{
          background: `linear-gradient(135deg, ${BLUE}, #4C6EF5)`, borderRadius: CARD_RADIUS,
          padding: '16px 18px 14px', boxShadow: '0 10px 24px -10px rgba(59,91,219,0.5)', marginBottom: 12,
          textAlign: 'center',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {data.businessName}
          </div>
          <div style={{ color: 'white', fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
            {greeting()} 👋 <span style={{ fontWeight: 500, opacity: 0.85 }}>Where are you headed?</span>
          </div>
        </div>

        {/* App tiles -- a compact 4-up grid (icon + label only, no
            description or "Open" pill) so 8 tiles fit in two rows
            instead of four. Each tile keeps its destination's own
            accent colour so it previews what's behind it. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {LINKS.map(link => {
            const href = `${link.path}${token}`;
            return (
              <a
                key={link.key}
                href={href}
                title={link.description}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6,
                  background: 'white', borderRadius: 12, boxShadow: CARD_SHADOW,
                  padding: '12px 4px 10px', textDecoration: 'none',
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 10, background: link.tint,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {link.icon}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1E293B', lineHeight: 1.2 }}>{link.label}</div>
              </a>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', color: '#B5BEC9', fontSize: 11, fontWeight: 500 }}>
          No login required · Powered by Recess Roster
        </div>
      </div>
    </div>
  );
}
