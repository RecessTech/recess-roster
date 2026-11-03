import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// R-Shift's own brand system -- the same blue tokens as PublicStockCheckView
// and every R-Shift email (send-schedule-email, send-order-status-email):
// blue gradient header with the app logo and soft-shadow cards. Tile icons
// stay emoji (plain, legible at this size, and what the rest of the app's
// internal screens already use) rather than line icons.
const BRAND = '#3B5BDB';
const BRAND_DARK = '#2D4EC9';
const BODY_BG = '#F1F5F9';
const CARD_BORDER = '#E2E8F0';
const TEXT_PRIMARY = '#1E293B';
const TEXT_MUTED = '#64748B';
const TEXT_FAINT = '#94A3B8';
const LOGO_URL = '/logo192.png';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const CARD_RADIUS = 18;
const TILE_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 10px 24px -14px rgba(15,23,42,0.18)';

// A single landing link for staff -- no data of its own, just a launcher
// pointing at the other public pages (R-Prod, Transfer Hub, and Roster --
// the one tile behind a personal PIN rather than open to anyone with the link).
// See supabase/functions/public-staff-hub. Each tile keeps the destination
// page's own accent colour, so it reads as a preview of what's behind it --
// the same colour greets you again once you tap through.

const LINKS = [
  {
    key: 'roster',
    label: 'Roster',
    description: 'My shifts & time off',
    icon: '🗓️',
    color: '#3B5BDB',
    tint: '#EEF2FF',
    path: '/roster/',
  },
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
    key: 'stock-check',
    label: 'Stock Check',
    description: 'EOD stock levels',
    icon: '📦',
    color: BRAND,
    tint: '#EEF2FF',
    path: '/stock-check/',
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
  {
    key: 'allergens',
    label: 'Allergens',
    description: 'What\'s in each item',
    icon: '⚠️',
    color: '#DC2626',
    tint: '#FEF2F2',
    path: '/allergens/',
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
      <div style={{ height: '100dvh', background: BODY_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32, border: `3px solid ${CARD_BORDER}`, borderTopColor: BRAND,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: TEXT_MUTED, fontSize: 14 }}>Loading…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100dvh', background: BODY_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONT }}>
        <div style={{ background: '#ffffff', border: `1px solid ${CARD_BORDER}`, borderRadius: CARD_RADIUS, padding: '32px 24px', maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: TEXT_PRIMARY, fontWeight: 700, marginBottom: 6 }}>Couldn't load this page</p>
          <p style={{ color: TEXT_MUTED, fontSize: 13 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ minHeight: '100dvh', background: BODY_BG, padding: '20px 14px 28px', fontFamily: FONT, boxSizing: 'border-box' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } html, body { overscroll-behavior-y: none; }`}</style>
      <div style={{ maxWidth: 480, width: '100%', margin: '0 auto' }}>

        {/* Brand header -- same gradient, logo badge and eyebrow label as
            the R-Shift emails and Stock Check, so this reads as the same
            product. */}
        <div style={{
          background: BRAND, backgroundImage: `linear-gradient(160deg, ${BRAND}, ${BRAND_DARK})`,
          borderRadius: CARD_RADIUS, padding: '20px 22px 18px',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 14px 28px -14px rgba(59,91,219,0.5)',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <img src={LOGO_URL} alt="" width={38} height={38} style={{ display: 'block', borderRadius: 11, flexShrink: 0, objectFit: 'cover' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.72)' }}>R-Shift &middot; Staff Hub</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', marginTop: 2, letterSpacing: '-0.01em' }}>{data.businessName}</div>
            </div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13.5, marginTop: 12, fontWeight: 400 }}>
            {greeting()} <span style={{ opacity: 0.85 }}>&mdash; where are you headed?</span>
          </div>
        </div>

        {/* App tiles -- sized to their own content (icon + label +
            description + padding), not stretched to fill the viewport.
            Forcing every row to 1fr left a lot of dead air inside each
            card on a tall phone; a natural-height grid with a gap reads
            tighter and more deliberate, and the page simply scrolls if
            it runs past the fold. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                  display: 'flex', flexDirection: isDangling ? 'row' : 'column', alignItems: 'center', justifyContent: isDangling ? 'flex-start' : 'center', gap: isDangling ? 14 : 10,
                  background: 'white', borderRadius: CARD_RADIUS, boxShadow: TILE_SHADOW,
                  textDecoration: 'none', padding: isDangling ? '16px 18px' : '20px 10px',
                  gridColumn: isDangling ? '1 / -1' : undefined,
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 15, background: link.tint, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, lineHeight: 1,
                }}>
                  {link.icon}
                </div>
                <div style={{ textAlign: isDangling ? 'left' : 'center' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.25, letterSpacing: '-0.01em' }}>{link.label}</div>
                  <div style={{ fontSize: 11.5, color: TEXT_FAINT, marginTop: 3 }}>{link.description}</div>
                </div>
              </a>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', padding: '20px 4px 0' }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: BRAND, marginRight: 6, verticalAlign: 'middle' }} />
          <span style={{ fontSize: 11, color: TEXT_FAINT, verticalAlign: 'middle' }}>R-Shift</span>
          <div style={{ fontSize: 10, color: TEXT_FAINT, marginTop: 3 }}>No login required</div>
        </div>
      </div>
    </div>
  );
}
