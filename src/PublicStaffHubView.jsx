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
      <div style={{ height: '100dvh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
      <div style={{ height: '100dvh', background: '#F4F6F8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: '32px 24px', maxWidth: 360, textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#1E293B', fontWeight: 700, marginBottom: 6, fontFamily: FONT }}>Couldn't load this page</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: FONT }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Rows needed for a 2-column grid -- computed from however many tiles
  // there actually are, so the grid keeps filling the screen edge-to-edge
  // (via 1fr rows, not a fixed tile height) as tiles get added later,
  // rather than needing another manual resize pass each time.
  const rows = Math.ceil(LINKS.length / 2);

  return (
    <div style={{ height: '100dvh', background: '#F4F6F8', display: 'flex', flexDirection: 'column', padding: '14px 14px', fontFamily: FONT, boxSizing: 'border-box' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } html, body { overscroll-behavior-y: none; }`}</style>
      <div style={{ maxWidth: 480, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        {/* Header -- a warm, time-of-day greeting instead of a plain
            "Staff links" label. Fixed height (flexShrink: 0): the tile
            grid below is what should dominate the screen, not this. */}
        <div style={{
          background: `linear-gradient(135deg, ${BLUE}, #4C6EF5)`, borderRadius: CARD_RADIUS,
          padding: '16px 18px 14px', boxShadow: '0 10px 24px -10px rgba(59,91,219,0.5)', marginBottom: 10,
          textAlign: 'center', flexShrink: 0,
        }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {data.businessName}
          </div>
          <div style={{ color: 'white', fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
            {greeting()} 👋 <span style={{ fontWeight: 500, opacity: 0.85 }}>Where are you headed?</span>
          </div>
        </div>

        {/* App tiles -- a 2-column grid whose rows are all 1fr, so the
            grid as a whole stretches to fill exactly whatever vertical
            space is left (flex: 1) instead of sizing itself off a fixed
            tile height. That's what makes this fill the screen on any
            device -- tiles grow on a tall/wide screen, shrink on a short
            one, but the grid always occupies the full remaining page,
            never leaving dead space below it or needing a scroll. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 10, flex: 1, minHeight: 0 }}>
          {LINKS.map((link, idx) => {
            const href = `${link.path}${token}`;
            // An odd tile count leaves the last one alone in its row --
            // span it across both columns instead of leaving a dead gap.
            const isDangling = LINKS.length % 2 === 1 && idx === LINKS.length - 1;
            return (
              <a
                key={link.key}
                href={href}
                style={{
                  display: 'flex', flexDirection: isDangling ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: isDangling ? 12 : 8,
                  background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW,
                  textDecoration: 'none', minHeight: 0, padding: '8px',
                  gridColumn: isDangling ? '1 / -1' : undefined,
                }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 14, background: link.tint, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>
                  {link.icon}
                </div>
                <div style={{ textAlign: isDangling ? 'left' : 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1E293B', lineHeight: 1.2 }}>{link.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{link.description}</div>
                </div>
              </a>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', color: '#B5BEC9', fontSize: 11, fontWeight: 500, marginTop: 10, flexShrink: 0 }}>
          No login required · Powered by Recess Roster
        </div>
      </div>
    </div>
  );
}
