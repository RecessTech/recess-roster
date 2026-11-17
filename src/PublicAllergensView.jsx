import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const RED = '#DC2626';
const RED_DK = '#B91C1C';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const CARD_RADIUS = 16;
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -8px rgba(15,23,42,0.10)';

// Filter chips. `match` is every stored token that counts as this allergen
// (wheat and gluten are separate in the data but one decision for a customer).
const ALLERGENS = [
  { key: 'gluten', label: 'Gluten', match: ['gluten', 'wheat', 'rye', 'barley', 'oats'] },
  { key: 'egg', label: 'Egg', match: ['egg'] },
  { key: 'milk', label: 'Milk', match: ['milk'] },
  { key: 'fish', label: 'Fish', match: ['fish'] },
  { key: 'soy', label: 'Soy', match: ['soy'] },
  { key: 'sesame', label: 'Sesame', match: ['sesame'] },
  { key: 'peanut', label: 'Peanut', match: ['peanut'] },
  { key: 'treenuts', label: 'Tree nuts', match: ['almond', 'brazil nut', 'cashew', 'hazelnut', 'macadamia', 'pecan', 'pine nut', 'pistachio', 'walnut'] },
  { key: 'sulphites', label: 'Sulphites', match: ['sulphites'] },
  { key: 'shellfish', label: 'Shellfish', match: ['crustacean', 'mollusc'] },
  { key: 'lupin', label: 'Lupin', match: ['lupin'] },
];

const STATUS = {
  confirmed: { label: 'Confirmed', bg: '#DCFCE7', fg: '#166534' },
  to_check: { label: 'Being checked', bg: '#FEF3C7', fg: '#92400E' },
  draft: { label: 'Draft - unverified', bg: '#FEF3C7', fg: '#92400E' },
  missing: { label: 'Not recorded', bg: '#F1F5F9', fg: '#64748B' },
};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The names the Food Standards Code (Standard 1.2.3, Schedule 9) requires, in
// the order we always show them, so every item reads the same way. Tree nuts
// are named individually; barley/oats/rye appear only when they contain gluten.
const REQUIRED_ORDER = ['wheat', 'barley', 'oats', 'rye', 'gluten', 'fish', 'crustacean', 'mollusc', 'egg', 'milk', 'lupin', 'peanut', 'soy', 'sesame', 'almond', 'brazil nut', 'cashew', 'hazelnut', 'macadamia', 'pecan', 'pistachio', 'pine nut', 'walnut', 'sulphites'];
const ordered = (tokens) => {
  const rank = (t) => { const i = REQUIRED_ORDER.indexOf(t); return i === -1 ? 999 : i; };
  return [...tokens].sort((a, b) => rank(a) - rank(b));
};
const hits = (tokens, a) => tokens.some((t) => a.match.includes(t));

function Tag({ children, bg, fg }) {
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: bg, color: fg, margin: '0 4px 4px 0' }}>
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.missing;
  return <Tag bg={s.bg} fg={s.fg}>{s.label}</Tag>;
}

function Header({ businessName, token, title, sub }) {
  return (
    <div style={{ background: RED, borderRadius: 16, padding: '20px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{businessName}</div>
        <a href={`/hub/${token}`} style={{ color: 'white', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 999 }}>
          🏠 Home
        </a>
      </div>
      <div style={{ color: '#fff', fontSize: 21, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>{title}</div>
      <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{sub}</div>
    </div>
  );
}

function ItemDetail({ item, onBack, businessName, token }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: FONT }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 4px 24px' }}>
        <div style={{ background: RED, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, padding: '6px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT }}>← Items</button>
          <div style={{ flex: 1, minWidth: 0, color: 'white', fontSize: 15.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          <a href={`/hub/${token}`} style={{ color: 'white', fontSize: 11, textDecoration: 'none', background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 999 }}>🏠</a>
        </div>
        <div style={{ padding: '12px 10px 0' }}>
          <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '16px' }}>
            <div style={{ marginBottom: 12 }}><StatusBadge status={item.status} /></div>
            {item.status === 'missing' ? (
              <p style={{ fontSize: 13.5, color: '#475569', margin: 0 }}>
                Allergens for this item haven't been recorded yet. <b>Don't assume it's allergen-free</b> - check the packaging or ask a manager.
              </p>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Contains</div>
                <p style={{ fontSize: 14, color: '#1E293B', margin: '0 0 8px' }}>
                  <b>{item.contains.length ? `Contains ${ordered(item.contains).map((t, i) => (i ? t : cap(t))).join(', ')}` : 'No allergens listed'}</b>
                </p>
                <div style={{ marginBottom: 12 }}>
                  {item.contains.length ? ordered(item.contains).map((t) => <Tag key={t} bg="#FEE2E2" fg={RED_DK}>{cap(t)}</Tag>) : <span style={{ fontSize: 13, color: '#64748B' }}>None listed</span>}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>May be present</div>
                <div style={{ marginBottom: 12 }}>
                  {item.mayContain.length ? ordered(item.mayContain).map((t) => <Tag key={t} bg="#FEF3C7" fg="#92400E">{cap(t)}</Tag>) : <span style={{ fontSize: 13, color: '#64748B' }}>None listed</span>}
                </div>
                {item.status !== 'confirmed' && (
                  <p style={{ fontSize: 12.5, color: '#92400E', background: '#FFFBEB', borderRadius: 10, padding: '8px 10px', margin: '0 0 12px' }}>
                    Still being verified - treat as a guide only and check with a manager for anyone with a serious allergy.
                  </p>
                )}
                {item.ingredients && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Ingredients</div>
                    <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5 }}>{item.ingredients}</p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <p style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 20 }}>{businessName} · Powered by Recess Roster</p>
      </div>
    </div>
  );
}

export default function PublicAllergensView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [avoid, setAvoid] = useState([]); // allergen keys to avoid
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-allergens', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token },
      });
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(e.message || 'Unable to load allergens.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggle = (k) => setAvoid((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));

  // Classify each item against the allergens being avoided. Items with no
  // recorded data can never be called "safe" -- they land in their own group.
  const groups = useMemo(() => {
    const items = data?.items || [];
    const active = ALLERGENS.filter((a) => avoid.includes(a.key));
    const res = { safe: [], may: [], contains: [], unknown: [] };
    items.forEach((it) => {
      if (it.status === 'missing') { res.unknown.push(it); return; }
      const c = active.filter((a) => hits(it.contains, a));
      const m = active.filter((a) => hits(it.mayContain, a));
      if (c.length) res.contains.push({ ...it, why: c.map((a) => a.label) });
      else if (m.length) res.may.push({ ...it, why: m.map((a) => a.label) });
      else res.safe.push(it);
    });
    return res;
  }, [data, avoid]);

  // Search: every typed word must appear in the item name (so "pesto chook",
  // "chook pesto" and "pest" all find Pesto Chook). Punctuation is ignored.
  const results = useMemo(() => {
    const words = norm(query).split(' ').filter(Boolean);
    if (!words.length) return null;
    return (data?.items || []).filter((it) => {
      const n = norm(it.name);
      return words.every((w) => n.includes(w));
    });
  }, [data, query]);

  const selected = data?.items.find((i) => i.id === selectedId);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748B', fontSize: 14, fontFamily: FONT }}>Loading allergens…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: '32px 24px', maxWidth: 360, textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#1E293B', fontWeight: 700, marginBottom: 6, fontFamily: FONT }}>Couldn't load allergens</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: FONT }}>{error}</p>
        </div>
      </div>
    );
  }
  if (!data) return null;
  if (selected) return <ItemDetail item={selected} businessName={data.businessName} token={token} onBack={() => setSelectedId(null)} />;

  const filtering = avoid.length > 0;
  const Section = ({ title, hint, items, tone }) => {
    if (!items.length) return null;
    const byCat = new Map();
    items.forEach((i) => { if (!byCat.has(i.category)) byCat.set(i.category, []); byCat.get(i.category).push(i); });
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: tone, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 6px 2px' }}>{title} ({items.length})</div>
        {hint && <div style={{ fontSize: 11.5, color: '#94A3B8', padding: '0 6px 6px' }}>{hint}</div>}
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
          {items.map((it, i) => (
            <button key={it.id} onClick={() => setSelectedId(it.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none', textAlign: 'left', cursor: 'pointer', fontFamily: FONT }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#1E293B' }}>{it.name}</span>
                <span style={{ display: 'block', fontSize: 11, color: '#94A3B8' }}>
                  {it.category}{it.why ? ` · ${it.why.join(', ')}` : ''}
                </span>
              </span>
              {it.status !== 'confirmed' && it.status !== 'missing' && <StatusBadge status={it.status} />}
              <span style={{ fontSize: 15, color: '#CBD5E1' }}>›</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const active = ALLERGENS.filter((a) => avoid.includes(a.key));
  const verdict = (it, a) => {
    if (it.status === 'missing') return { text: 'not recorded', bg: '#F1F5F9', fg: '#64748B' };
    if (hits(it.contains, a)) return { text: 'CONTAINS', bg: '#FEE2E2', fg: RED_DK };
    if (hits(it.mayContain, a)) return { text: 'may be present', bg: '#FEF3C7', fg: '#92400E' };
    return { text: it.status === 'confirmed' ? 'not listed' : 'not listed (unverified)', bg: '#DCFCE7', fg: '#166534' };
  };

  const all = data.items.slice().sort((a, b) => a.category.localeCompare(b.category) || 0);

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: FONT }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 4px 24px' }}>
        <Header businessName={data.businessName} token={token} title="Allergens" sub="Tap allergens to avoid, or tap an item for details" />
        <div style={{ padding: '14px 12px 0' }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a menu item…"
            aria-label="Search menu items"
            autoComplete="off"
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: FONT, fontSize: 16, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #CBD5E1', background: 'white', marginBottom: 10, outline: 'none' }}
          />
          <div style={{ fontSize: 11.5, color: '#94A3B8', margin: '0 2px 6px' }}>
            {results ? 'Tap an allergen to check it against these items' : 'Or tap allergens to avoid'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {ALLERGENS.map((a) => {
              const on = avoid.includes(a.key);
              return (
                <button key={a.key} onClick={() => toggle(a.key)} style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, padding: '7px 12px', borderRadius: 999, cursor: 'pointer', border: `1.5px solid ${on ? RED : '#CBD5E1'}`, background: on ? RED : 'white', color: on ? 'white' : '#475569' }}>
                  {on ? '✕ ' : ''}{a.label}
                </button>
              );
            })}
          </div>

          {results ? (
            results.length === 0 ? (
              <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '28px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                No menu item matches "{query}".
              </div>
            ) : results.map((it) => (
              <button key={it.id} onClick={() => setSelectedId(it.id)} style={{ width: '100%', display: 'block', textAlign: 'left', background: 'white', border: 'none', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '14px', marginBottom: 10, cursor: 'pointer', fontFamily: FONT }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{it.name}</span>
                  <StatusBadge status={it.status} />
                </div>
                {active.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    {active.map((a) => { const v = verdict(it, a); return (
                      <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: v.bg, color: v.fg, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                        <span>{a.label}</span><span>{v.text}</span>
                      </div>); })}
                  </div>
                )}
                {it.status === 'missing' ? (
                  <div style={{ fontSize: 12.5, color: '#64748B' }}>Allergens not recorded yet - check packaging or ask a manager.</div>
                ) : (
                  <>
                    <div>{ordered(it.contains).map((t) => <Tag key={t} bg="#FEE2E2" fg={RED_DK}>{cap(t)}</Tag>)}</div>
                    {it.mayContain.length > 0 && <div style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>May be present: {ordered(it.mayContain).map(cap).join(', ')}</div>}
                  </>
                )}
              </button>
            ))
          ) : filtering ? (
            <>
              <Section title="No listed match" hint="Not listed as containing or possibly containing what you picked. Cross-contact is still possible in a shared kitchen." items={groups.safe} tone="#166534" />
              <Section title="May be present" items={groups.may} tone="#92400E" />
              <Section title="Contains" items={groups.contains} tone={RED_DK} />
              <Section title="Not recorded" hint="No allergen info yet - can't say either way." items={groups.unknown} tone="#64748B" />
            </>
          ) : (
            <Section title="All items" items={all} tone="#475569" />
          )}
        </div>
        <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 11, margin: '14px 16px 0' }}>
          Allergen information is provided on request under the Food Standards Code. "May be present" is a voluntary precautionary statement: our kitchen handles gluten, egg, milk, fish, sesame and tree nuts, so cross-contact is possible. For severe allergies, always check with a manager.
        </p>
        <p style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 8 }}>Powered by Recess Roster</p>
      </div>
    </div>
  );
}
