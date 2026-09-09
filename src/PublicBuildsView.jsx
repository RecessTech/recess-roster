import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { findGuide, ExplodedDiagram } from './buildGuides';

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const CYAN = '#0891B2';
const CYAN_DK = '#0E7490';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const CARD_RADIUS = 16;
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -8px rgba(15,23,42,0.10)';

// Item picker -- shown until something is selected, so the first thing
// someone sees on their phone is a short tappable list, not a diagram
// for whichever item happened to be first.
export function BuildPickerScreen({ businessName, token, grouped, onSelect }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '14px 4px', fontFamily: FONT }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ background: CYAN, borderRadius: 16, padding: '20px 20px' }}>
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
            Build Guides
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            Tap an item to see how it's built
          </div>
        </div>

        <div style={{ padding: '14px 12px 4px' }}>
          {grouped.length === 0 ? (
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '32px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              No sandwich or toastie items found.
            </div>
          ) : (
            grouped.map(([cat, its]) => (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 6px 6px' }}>
                  {cat}
                </div>
                <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
                  {its.map((it, i) => {
                    const hasGuide = !!findGuide(it.name);
                    return (
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
                        {!hasGuide && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#CBD5E1' }}>No guide</span>
                        )}
                        <span style={{ fontSize: 15, color: '#CBD5E1' }}>›</span>
                      </button>
                    );
                  })}
                </div>
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

// Detail view -- the exploded diagram sized to the phone's own width, not a
// fixed desktop max-width, so it stays compact on the phone it's opened on.
export function BuildDetailScreen({ token, item, guide, onBack }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: FONT }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 24 }}>
        <div style={{ background: CYAN, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255,255,255,0.18)', border: 'none', color: 'white', fontSize: 13, fontWeight: 700,
              padding: '6px 10px', borderRadius: 999, cursor: 'pointer', flexShrink: 0, fontFamily: FONT,
            }}
          >
            ← Items
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
          {!guide ? (
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: '#475569', marginBottom: 4 }}>No build guide yet</p>
              <p style={{ fontSize: 12, color: '#94A3B8' }}>This item hasn't been added to the build guide baseline. It's likely a special or limited-time item.</p>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, padding: '14px 10px' }}>
              <ExplodedDiagram guide={guide} tint={CYAN_DK} maxWidth={360} />
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

export default function PublicBuildsView({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('public-builds', {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
        body: { token },
      });
      if (err) throw new Error(err.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setError(e.message || 'Unable to load build guides.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => data?.items || [], [data]);
  const grouped = useMemo(() => {
    const groups = new Map();
    items.forEach(i => {
      const cat = i.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(i);
    });
    return [...groups.entries()];
  }, [items]);

  const selectedItem = items.find(i => i.id === selectedId);
  const guide = selectedItem ? findGuide(selectedItem.name) : null;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: CYAN,
            borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ color: '#64748B', fontSize: 14, fontFamily: FONT }}>Loading build guides…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'white', borderRadius: CARD_RADIUS, padding: '32px 24px', maxWidth: 360, textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: '#1E293B', fontWeight: 700, marginBottom: 6, fontFamily: FONT }}>Couldn't load build guides</p>
          <p style={{ color: '#64748B', fontSize: 13, fontFamily: FONT }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (!selectedItem) {
    return (
      <BuildPickerScreen
        businessName={data.businessName}
        token={token}
        grouped={grouped}
        onSelect={setSelectedId}
      />
    );
  }

  return (
    <BuildDetailScreen
      token={token}
      item={selectedItem}
      guide={guide}
      onBack={() => setSelectedId(null)}
    />
  );
}
