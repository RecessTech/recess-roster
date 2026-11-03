import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// R-Shift's own brand system -- the same tokens as PublicStockCheckView and
// every R-Shift email (send-schedule-email, send-order-status-email): blue
// gradient header with the app logo, flat bordered cards (no shadow), and
// line icons instead of emoji. This is the front door to every staff page,
// so it sets the tone the rest should match as they get the same treatment.
const BRAND = '#3B5BDB';
const BRAND_DARK = '#2D4EC9';
const BODY_BG = '#F1F5F9';
const CARD_BORDER = '#E2E8F0';
const TEXT_PRIMARY = '#1E293B';
const TEXT_MUTED = '#64748B';
const TEXT_FAINT = '#94A3B8';
const BAD = '#d0393b';
const LOGO_URL = '/logo192.png';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const CARD_RADIUS = 14;

function Icon({ children, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
function CalendarIcon() {
  return <Icon><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Icon>;
}
function ClipboardIcon() {
  return <Icon><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></Icon>;
}
function RepeatIcon() {
  return <Icon><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></Icon>;
}
function BoxIcon() {
  return <Icon><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></Icon>;
}
function FlagIcon() {
  return <Icon><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></Icon>;
}
function CheckSquareIcon() {
  return <Icon><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></Icon>;
}
function UsersIcon() {
  return <Icon><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;
}
function LayersIcon() {
  return <Icon><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></Icon>;
}
function CoffeeIcon() {
  return <Icon><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></Icon>;
}
function AlertTriangleIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

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
    Icon: CalendarIcon,
    color: '#3B5BDB',
    tint: '#EEF2FF',
    path: '/roster/',
  },
  {
    key: 'production',
    label: 'R-Prod',
    description: "Today's plan",
    Icon: ClipboardIcon,
    color: '#15803D',
    tint: '#F0FDF4',
    path: '/prod/',
  },
  {
    key: 'transfer',
    label: 'Transfer Hub',
    description: 'Stock between sites',
    Icon: RepeatIcon,
    color: '#0F766E',
    tint: '#F0FDFA',
    path: '/transfers/',
  },
  {
    key: 'stock-check',
    label: 'Stock Check',
    description: 'EOD stock levels',
    Icon: BoxIcon,
    color: BRAND,
    tint: '#EEF2FF',
    path: '/stock-check/',
  },
  {
    key: 'prep',
    label: 'Prep List',
    description: "What needs prepping",
    Icon: FlagIcon,
    color: '#B45309',
    tint: '#FFFBEB',
    path: '/prep/',
  },
  {
    key: 'checklists',
    label: 'Checklists',
    description: 'Opening & closing',
    Icon: CheckSquareIcon,
    color: '#4F46E5',
    tint: '#EEF2FF',
    path: '/checklists/',
  },
  {
    key: 'catering',
    label: 'Catering',
    description: "Today's jobs",
    Icon: UsersIcon,
    color: '#BE185D',
    tint: '#FDF2F8',
    path: '/cater/',
  },
  {
    key: 'builds',
    label: 'Build Guides',
    description: 'How to assemble each item',
    Icon: LayersIcon,
    color: '#0891B2',
    tint: '#ECFEFF',
    path: '/builds/',
  },
  {
    key: 'barista',
    label: 'Drinks Guide',
    description: 'How to make each drink',
    Icon: CoffeeIcon,
    color: '#92400E',
    tint: '#FDF8F3',
    path: '/barista/',
  },
  {
    key: 'allergens',
    label: 'Allergens',
    description: 'What\'s in each item',
    Icon: AlertTriangleIcon,
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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><AlertTriangleIcon color={BAD} /></div>
          <p style={{ color: TEXT_PRIMARY, fontWeight: 700, marginBottom: 6 }}>Couldn't load this page</p>
          <p style={{ color: TEXT_MUTED, fontSize: 13 }}>{error}</p>
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
    <div style={{ height: '100dvh', background: BODY_BG, display: 'flex', flexDirection: 'column', padding: '14px 14px', fontFamily: FONT, boxSizing: 'border-box' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } html, body { overscroll-behavior-y: none; }`}</style>
      <div style={{ maxWidth: 480, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        {/* Brand header -- same gradient, logo badge and eyebrow label as
            the R-Shift emails and Stock Check, so this reads as the same
            product. Fixed height (flexShrink: 0): the tile grid below is
            what should dominate the screen, not this. */}
        <div style={{
          background: BRAND, backgroundImage: `linear-gradient(160deg, ${BRAND}, ${BRAND_DARK})`,
          borderRadius: CARD_RADIUS, padding: '16px 18px 14px',
          marginBottom: 10, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <img src={LOGO_URL} alt="" width={36} height={36} style={{ display: 'block', borderRadius: 10, flexShrink: 0, objectFit: 'cover' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.75)' }}>R-Shift &middot; Staff Hub</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#ffffff', marginTop: 1 }}>{data.businessName}</div>
            </div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 10 }}>
            {greeting()} <span style={{ opacity: 0.85 }}>&mdash; where are you headed?</span>
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
            const TileIcon = link.Icon;
            return (
              <a
                key={link.key}
                href={href}
                style={{
                  display: 'flex', flexDirection: isDangling ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: isDangling ? 12 : 8,
                  background: 'white', border: `1px solid ${CARD_BORDER}`, borderRadius: CARD_RADIUS,
                  textDecoration: 'none', minHeight: 0, padding: '8px',
                  gridColumn: isDangling ? '1 / -1' : undefined,
                }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 13, background: link.tint, flexShrink: 0, color: link.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <TileIcon />
                </div>
                <div style={{ textAlign: isDangling ? 'left' : 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY, lineHeight: 1.2 }}>{link.label}</div>
                  <div style={{ fontSize: 11, color: TEXT_FAINT, marginTop: 2 }}>{link.description}</div>
                </div>
              </a>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', padding: '14px 4px 0', flexShrink: 0 }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: BRAND, marginRight: 6, verticalAlign: 'middle' }} />
          <span style={{ fontSize: 11, color: TEXT_FAINT, verticalAlign: 'middle' }}>R-Shift</span>
          <div style={{ fontSize: 10, color: TEXT_FAINT, marginTop: 3 }}>No login required</div>
        </div>
      </div>
    </div>
  );
}
