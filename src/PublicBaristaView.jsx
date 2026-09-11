import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const BROWN = '#92400E';
const BROWN_DK = '#78350F';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const CARD_RADIUS = 16;
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -8px rgba(15,23,42,0.10)';

function fmtQty(n) {
  const num = Number(n) || 0;
  return num % 1 === 0 ? String(num) : num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// Item picker -- a short tappable list of drinks, matching the pattern
// the other staff-facing public pages (Build Guides, Prep List) use.
export function BaristaPickerScreen({ businessName, token, items, onSelect }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FDF8F3', padding: '14px 4px', fontFamily: FONT }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ background: BROWN, borderRadius: 16, padding: '20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {businessName}
            </div>
            <a
              href={`/hub/${token}`}
              style={{
                color: 'white', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
                background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 999, flexShrink: 0,
              }}
            >
              🏠 Home
            </a>
          </div>
          <div style={{ color: '#fff', fontSize: 21, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 }}>
            Drinks Guide
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            Tap a drink to see how it's made
          </div>
        </div>

        <div style={{ padding: '14px 12px 4px' }}>
          {items.length === 0 ? (
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '32px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              No coffee or tea items found.
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
              {items.map((it, i) => (
                <button
                  key={it.id}
                  onClick={() => onSelect(it.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '13px 14px',
                    background: 'none', border: 'none', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none',
                    textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1E293B' }}>{it.name}</span>
                  {!it.hasGuide && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#CBD5E1' }}>No guide</span>
                  )}
                  <span style={{ fontSize: 15, color: '#CBD5E1' }}>›</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 20, marginBottom: 0 }}>
          Powered by Recess Roster
        </p>
      </div>
    </div>
  );
}

// Detail view -- ingredients (read from R-Recipe) at the top, then the
// numbered method underneath.
export function BaristaDetailScreen({ token, item, guide, ingredients, onBack }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FDF8F3', fontFamily: FONT }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 24 }}>
        <div style={{ background: BROWN, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', fontSize: 13, fontWeight: 700,
              padding: '6px 10px', borderRadius: 999, cursor: 'pointer', flexShrink: 0, fontFamily: FONT,
            }}
          >
            ← Drinks
          </button>
          <div style={{ flex: 1, minWidth: 0, color: 'white', fontSize: 15.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.name}
          </div>
          <a
            href={`/hub/${token}`}
            style={{
              color: 'white', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
              background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 999, flexShrink: 0,
            }}
          >
            🏠
          </a>
        </div>

        <div style={{ padding: '12px 10px 0' }}>
          {ingredients.length > 0 && (
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '14px 16px', marginBottom: 10 }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Ingredients
              </p>
              {ingredients.map((ing, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13.5 }}>
                  <span style={{ color: '#334155', fontWeight: 600 }}>{ing.name}</span>
                  <span style={{ color: '#94A3B8' }}>{fmtQty(ing.qty)} {ing.uom}</span>
                </div>
              ))}
            </div>
          )}

          {!guide || guide.steps.length === 0 ? (
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>No guide yet</p>
              <p style={{ fontSize: 12, color: '#94A3B8' }}>This drink hasn't been added to the Drinks Guide yet.</p>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '16px' }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Method
              </p>
              {guide.steps.map(s => (
                <div key={s.step_number} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: BROWN_DK, flexShrink: 0 }}>{s.step_number}.</span>
                  <span style={{ fontSize: 14, color: '#334155', lineHeight: 1.4 }}>{s.instruction_text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 20, marginBottom: 0 }}>
          Powered by Recess Roster
        </p>
      </div>
    </div>
  );
}

export default function PublicBaristaView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-barista', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token },
      });
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(e.message || 'Unable to load the drinks guide.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => {
    const raw = data?.items || [];
    const guides = data?.guides || {};
    return raw.map(i => ({ ...i, hasGuide: !!guides[i.id] }));
  }, [data]);

  const selectedItem = items.find(i => i.id === selectedId);
  const guide = selectedItem ? (data?.guides || {})[selectedItem.id] : null;
  const ingredients = selectedItem ? ((data?.ingredients || {})[selectedItem.id] || []) : [];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #E7DFD3', borderTopColor: BROWN,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: FONT }}>Loading drinks guide…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDF8F3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: '32px 24px', maxWidth: 360, textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#1E293B', fontWeight: 700, marginBottom: 6, fontFamily: FONT }}>Couldn't load the drinks guide</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: FONT }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (!selectedItem) {
    return (
      <BaristaPickerScreen
        businessName={data.businessName}
        token={token}
        items={items}
        onSelect={setSelectedId}
      />
    );
  }

  return (
    <BaristaDetailScreen
      token={token}
      item={selectedItem}
      guide={guide}
      ingredients={ingredients}
      onBack={() => setSelectedId(null)}
    />
  );
}
