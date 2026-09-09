import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Search, Layers } from 'lucide-react';
import { db } from './supabaseClient';
import toast from 'react-hot-toast';

// ── Build guide data ─────────────────────────────────────────────────────────
// Baseline transcribed from the sandwich build guide doc, TOP of stack first
// down to BASE -- matches the doc's own reading order exactly so staff can
// cross-reference. Two corrections folded in per the recipe audit: Chicken
// Avo's garnish chives (present in R-Recipe, missing from the original doc)
// and two ingredient names homogenised to their system SKU (Tomato Chutney,
// Sundried Tomato Strips). Item names match production_items exactly.

function topLayer(name, qty, type) { return { name, qty, type, edge: 'top' }; }
function baseLayer(name, qty, type) { return { name, qty, type, edge: 'base' }; }
function layer(name, qty, type) { return { name, qty, type }; }

const BUILD_GUIDES = {
  'Chicken Avo': {
    category: 'Sandwiches',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Light Spread', 'sauce'),
      layer('Chives', 'Pinch (chopped)', 'garnish'),
      layer('Cos Lettuce', '3 Leaves', 'veg'),
      layer('Avocado', '1/4 Avo (Sliced)', 'avocado'),
      layer('Seasoning', 'Salt & Pepper', 'garnish'),
      layer('Chicken Avo Mix', '1 Scoop (120g)', 'mix'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'BLT': {
    category: 'Sandwiches',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Light Spread', 'sauce'),
      layer('Cos Lettuce', '3 Leaves', 'veg'),
      layer('Seasoning', 'Salt & Pepper', 'garnish'),
      layer('Tomato', '3 Slices', 'tomato'),
      layer('Bacon', '120g — full coverage', 'meat'),
      layer('Mayo', '1 Tbsp', 'sauce'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'Chilli Turk': {
    category: 'Sandwiches',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Light Spread', 'sauce'),
      layer('Rocket', 'Large handful', 'veg'),
      layer('Caramelised Onion', '1 Tbsp', 'pickle'),
      layer('Turkey', '4–5 slices, folded', 'meat'),
      layer('Chilli Mayo', '1 Tbsp', 'sauce'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'Ham, Cheese & Pickle': {
    category: 'Sandwiches',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Light Spread', 'sauce'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Seasoning', 'Salt & Pepper', 'garnish'),
      layer('Pickles', '4 Slices', 'pickle'),
      layer('Ham', '100g (Folded)', 'meat'),
      layer('Tomato Chutney', '1 Tbsp', 'sauce'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Butter', 'Light Spread', 'sauce'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'Pastrami': {
    category: 'Sandwiches',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Light Spread', 'sauce'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Seasoning', 'Salt & Pepper', 'garnish'),
      layer('Pickles', '4 Slices', 'pickle'),
      layer('Sauerkraut', '1 Tbsp (Drained)', 'pickle'),
      layer('Pastrami', '100g (Folded)', 'meat'),
      layer('Mustard Mayo', '1 Tbsp (spread on lid)', 'sauce'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Butter', 'Light Spread', 'sauce'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'The Big Tuna': {
    category: 'Sandwiches',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Light Spread', 'sauce'),
      layer('Cos Lettuce', '3 Leaves', 'veg'),
      layer('Seasoning', 'Salt & Pepper', 'garnish'),
      layer('Zucchini Pickles', '4 Slices', 'pickle'),
      layer('Tuna Mix', '1 Scoop (120g)', 'mix'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'Curried Egg': {
    category: 'Sandwiches',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Light Spread', 'sauce'),
      layer('Cos Lettuce', '3 Leaves', 'veg'),
      layer('Seasoning', 'Salt & Pepper', 'garnish'),
      layer('Curried Egg Mix', '1 Scoop (120g)', 'mix'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'Recess Club': {
    category: 'Sandwiches',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Light Spread', 'sauce'),
      layer('Cos Lettuce', '3 Leaves', 'veg'),
      layer('Seasoning', 'Salt & Pepper', 'garnish'),
      layer('Bacon', '60g (2–3 rashers)', 'meat'),
      layer('Pickles', '4 Slices', 'pickle'),
      layer('Club Mix', '1 Scoop (120g)', 'mix'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'Super Green': {
    category: 'Sandwiches',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Dill', 'Sprinkle (chopped)', 'garnish'),
      layer('Vegan Chilli Mayo', '1 Tbsp', 'sauce'),
      layer('Rocket', 'Solid handful', 'veg'),
      layer('Pickled Onion', '1 Tbsp', 'pickle'),
      layer('Sundried Tomato Strips', '5–6 pieces', 'tomato'),
      layer('Cucumber', '3 batons', 'veg'),
      layer('Kale', 'Steamed — one layer', 'veg'),
      layer('Seasoning', 'Recess seasoning + pepper', 'garnish'),
      layer('Avocado', '3–4 slices', 'avocado'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'Chickpea Smash': {
    category: 'Sandwiches',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Vegan Mayo', '1 Tbsp', 'sauce'),
      layer('Rocket', 'Large handful', 'veg'),
      layer('Seasoning', 'Salt & Pepper', 'garnish'),
      layer('Crispy Shallots', 'Pinch / sprinkle', 'garnish'),
      layer('Sundried Tomato Strips', '5–6 pieces', 'tomato'),
      layer('Chickpea Mix', '1 Scoop (120g)', 'mix'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'Cheese Toastie': {
    category: 'Toasties',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Outside & inside', 'sauce'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Parmesan', 'Pinch', 'garnish'),
      layer('Chives', 'Pinch', 'garnish'),
      layer('Seasoning', 'Recess seasoning', 'garnish'),
      layer('American Cheese', '1 Slice', 'cheese'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Butter', 'Outside & inside', 'sauce'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'Tomato & Cheese': {
    category: 'Toasties',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Outside & inside', 'sauce'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Parmesan', 'Pinch', 'garnish'),
      layer('Chives', 'Pinch', 'garnish'),
      layer('Seasoning', 'Recess seasoning', 'garnish'),
      layer('Tomato', '3 Slices', 'tomato'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Butter', 'Outside & inside', 'sauce'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'El Diablo': {
    category: 'Toasties',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Outside & inside', 'sauce'),
      layer('Chilli Crisp', '1 Tbsp (spread on swiss)', 'sauce'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Pastrami', '2–3 slices (folded)', 'meat'),
      layer('Seasoning', 'Salt & Pepper', 'garnish'),
      layer('Honey', 'Drizzle', 'sauce'),
      layer('Jalapeños', '4–5 slices', 'pickle'),
      layer('Ham', 'Small layer (50–60g)', 'meat'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Butter', 'Outside & inside', 'sauce'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'Pesto Chook': {
    category: 'Toasties',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Outside & inside', 'sauce'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Seasoning', 'Salt & Pepper', 'garnish'),
      layer('Sundried Tomato Strips', '4–5 pieces', 'tomato'),
      layer('Zucchini Pickles', '4 pieces', 'pickle'),
      layer('Pesto Chicken', '120g', 'mix'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Butter', 'Outside & inside', 'sauce'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'Roast Beef & Onion': {
    category: 'Toasties',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Outside & inside', 'sauce'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Seasoning', 'Salt & Pepper', 'garnish'),
      layer('Caramelised Onion', '1 Tbsp — solid layer', 'pickle'),
      layer('Roast Beef', '4–5 slices (folded)', 'meat'),
      layer('Horseradish Mayo', '1 Tbsp', 'sauce'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Butter', 'Outside & inside', 'sauce'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
  'Tuna Melt': {
    category: 'Toasties',
    layers: [
      topLayer('Bread Slice', '', 'bread'),
      layer('Butter', 'Outside & inside', 'sauce'),
      layer('American Cheese', '1 Slice', 'cheese'),
      layer('American Mustard', 'Drizzle', 'sauce'),
      layer('Seasoning', 'Recess seasoning + pepper', 'garnish'),
      layer('Parmesan', 'Pinch', 'garnish'),
      layer('Pickles', '4 pieces', 'pickle'),
      layer('Tuna Mix', '120g', 'mix'),
      layer('Swiss Cheese', '1 Slice', 'cheese'),
      layer('Butter', 'Outside & inside', 'sauce'),
      baseLayer('Bread Slice', '', 'bread'),
    ],
  },
};

// Per-mix hue variety, so the chunky "mix" layers don't all read identical.
const MIX_HUES = {
  'Chicken Avo Mix': '#B7C77A',
  'Tuna Mix': '#E3A9A0',
  'Curried Egg Mix': '#E8B44D',
  'Club Mix': '#D9B27C',
  'Chickpea Mix': '#D8CDA6',
  'Pesto Chicken': '#8FAE6E',
};

const TYPE_STYLE = {
  bread:   { kind: 'slab',    height: 30, w: 200, h: 130, from: '#F3D08A', to: '#D9A64E', label: '#5C4419' },
  cheese:  { kind: 'slab',    height: 12, w: 168, h: 108, from: '#FFE58A', to: '#F6C744', label: '#6B5416' },
  meat:    { kind: 'slab',    height: 18, w: 172, h: 100, from: '#E8A79A', to: '#C97363', label: '#5C2B22' },
  veg:     { kind: 'scallop', height: 14, w: 182, h: 104, from: '#9BCB6E', to: '#6FA847', label: '#2E4A1C' },
  sauce:   { kind: 'ellipse', height: 8,  w: 150, h: 66,  from: 'rgba(255,250,235,0.92)', to: 'rgba(255,231,168,0.85)', label: '#7A5A1E' },
  pickle:  { kind: 'cluster', height: 12, w: 150, h: 60,  from: '#CDE29A', to: '#A9C96C', label: '#425A20' },
  tomato:  { kind: 'cluster', height: 12, w: 150, h: 60,  from: '#E8776A', to: '#C6473A', label: '#6B1F17' },
  avocado: { kind: 'moon',    height: 14, w: 150, h: 90,  from: '#CBE0A0', to: '#9CC46B', label: '#2E4A1C' },
  mix:     { kind: 'blob',    height: 22, w: 178, h: 108, from: '#D8CDA6', to: '#B7A15E', label: '#4A3E20' },
  garnish: { kind: 'fleck',   height: 5,  w: 130, h: 40,  from: '#EAF7F4', to: '#C9EDE4', label: '#2C5C50' },
};

function styleFor(l) {
  const base = TYPE_STYLE[l.type] || TYPE_STYLE.garnish;
  if (l.type === 'mix' && MIX_HUES[l.name]) {
    return { ...base, from: MIX_HUES[l.name], to: MIX_HUES[l.name] };
  }
  return base;
}

// ── Holographic exploded-stack visual ────────────────────────────────────────

function HoloShape({ visual, tint }) {
  const grad = `linear-gradient(155deg, ${visual.from}, ${visual.to})`;
  const common = {
    width: visual.w, height: visual.h, background: grad,
    boxShadow: `0 0 18px ${tint}55, 0 10px 0 -2px rgba(0,0,0,0.18), 0 3px 6px rgba(0,0,0,0.25)`,
    border: `1px solid ${tint}77`,
  };
  if (visual.kind === 'scallop') {
    return <div style={{ ...common, borderRadius: '50%', clipPath: 'polygon(0% 20%,10% 5%,20% 22%,30% 4%,40% 20%,50% 3%,60% 20%,70% 4%,80% 22%,90% 5%,100% 20%,100% 100%,0% 100%)' }} />;
  }
  if (visual.kind === 'moon') {
    return <div style={{ ...common, borderRadius: '50% 50% 50% 8%' }} />;
  }
  if (visual.kind === 'blob') {
    return <div style={{ ...common, borderRadius: '61% 39% 47% 53% / 44% 51% 49% 56%' }} />;
  }
  if (visual.kind === 'ellipse') {
    return (
      <div style={{ ...common, borderRadius: '50%', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(255,255,255,0.6), transparent 55%)' }} />
      </div>
    );
  }
  if (visual.kind === 'cluster' || visual.kind === 'fleck') {
    const n = visual.kind === 'fleck' ? 6 : 5;
    return (
      <div style={{ width: visual.w, height: visual.h, position: 'relative' }}>
        {Array.from({ length: n }, (_, i) => {
          const size = visual.kind === 'fleck' ? 6 + (i % 3) * 2 : 22 + (i % 3) * 6;
          const left = (i / n) * (visual.w - size) + (i % 2 ? 6 : -4);
          const top = (visual.h - size) / 2 + (i % 2 === 0 ? -6 : 8);
          return (
            <div key={i} style={{
              position: 'absolute', left, top, width: size, height: size, borderRadius: '50%',
              background: grad, boxShadow: `0 0 10px ${tint}55, 0 3px 4px rgba(0,0,0,0.25)`,
              border: `1px solid ${tint}66`,
            }} />
          );
        })}
      </div>
    );
  }
  // slab (default)
  return <div style={{ ...common, borderRadius: 26 }} />;
}

// Vertical spacing between layers is deliberately larger than any shape's
// own rendered thickness -- this is an exploded view, not a literal
// cross-section, so garnish/sauce layers need room to read as their own
// distinct, clearly-labelled slice rather than disappearing behind bread.
function gapFor(l) {
  return l.type === 'bread' ? 50 : 34;
}

function HoloStack({ guide, activeIndex, onHover, tint }) {
  const ordered = useMemo(() => [...guide.layers].reverse(), [guide.layers]); // base first (bottom) -> top last
  let cumulative = 0;
  const positioned = ordered.map((l, i) => {
    const visual = styleFor(l);
    const y = cumulative;
    cumulative += gapFor(l);
    return { ...l, visual, y, renderIndex: i, sourceIndex: guide.layers.length - 1 - i };
  });
  const totalHeight = cumulative;

  return (
    <div className="holo-stage" style={{ '--tint': tint }}>
      <div className="holo-spinner">
        {positioned.map((l) => {
          const isActive = activeIndex === l.sourceIndex;
          return (
            <div
              key={l.sourceIndex}
              className={`holo-layer${isActive ? ' is-active' : ''}`}
              style={{ transform: `translate(-50%, calc(-1 * ${l.y - totalHeight / 2}px))` }}
              onMouseEnter={() => onHover(l.sourceIndex)}
              onMouseLeave={() => onHover(null)}
            >
              <HoloShape visual={l.visual} tint={tint} />
              <div className="holo-label">
                <span className="holo-label-name">{l.name}</span>
                {l.qty && <span className="holo-label-qty">{l.qty}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="holo-base-glow" />
    </div>
  );
}

const HOLO_STYLES = `
@property --holo-spin { syntax: '<angle>'; inherits: true; initial-value: 0deg; }

.holo-stage {
  position: relative;
  height: 480px;
  perspective: 1100px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.holo-spinner {
  position: relative;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
  transform: rotateX(50deg) rotateZ(var(--holo-spin));
  animation: holo-spin 22s linear infinite;
}
.holo-stage:hover .holo-spinner { animation-play-state: paused; }
@keyframes holo-spin { from { --holo-spin: 0deg; } to { --holo-spin: 360deg; } }
@media (prefers-reduced-motion: reduce) {
  .holo-spinner { animation: none; transform: rotateX(50deg) rotateZ(-28deg); }
}

.holo-layer {
  position: absolute;
  left: 0; top: 0;
  transform-style: preserve-3d;
  transition: filter 0.15s ease;
}
.holo-label {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%) rotateZ(calc(-1 * var(--holo-spin))) rotateX(-50deg);
  white-space: nowrap;
  text-align: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  font-size: 11px;
  line-height: 1.3;
}
.holo-layer.is-active .holo-label,
.holo-layer:hover .holo-label { opacity: 1; }
.holo-label-name {
  display: block;
  font-weight: 700;
  color: var(--tint);
  text-shadow: 0 0 6px color-mix(in srgb, var(--tint) 70%, white), 0 1px 2px rgba(0,0,0,0.5);
}
.holo-label-qty {
  display: block;
  font-size: 9.5px;
  color: #E0FBFF;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
}
.holo-layer.is-active > div:first-child {
  filter: drop-shadow(0 0 14px var(--tint));
}
.holo-base-glow {
  position: absolute;
  bottom: 18%;
  left: 50%;
  transform: translateX(-50%);
  width: 220px;
  height: 40px;
  background: radial-gradient(ellipse, var(--tint) 0%, transparent 72%);
  opacity: 0.25;
  filter: blur(4px);
  pointer-events: none;
}
`;

// ── Item list & shell ────────────────────────────────────────────────────────

function normaliseItemName(name) {
  return (name || '').trim().toLowerCase();
}

export default function BuildsApp({ org }) {
  const orgId = org?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const all = await db.getProductionItems(orgId);
      const relevant = all.filter(i => i.active !== false && (i.category === 'Sandwiches' || i.category === 'Toasties'));
      setItems(relevant);
      setSelectedId(prev => (prev && relevant.some(i => i.id === prev)) ? prev : (relevant[0]?.id ?? null));
    } catch (err) {
      toast.error('Failed to load menu items: ' + (err.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const grouped = useMemo(() => {
    const groups = new Map();
    filtered.forEach(i => {
      const cat = i.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(i);
    });
    return [...groups.entries()];
  }, [filtered]);

  const selectedItem = items.find(i => i.id === selectedId);
  const guide = selectedItem ? BUILD_GUIDES[selectedItem.name] || Object.entries(BUILD_GUIDES).find(([k]) => normaliseItemName(k) === normaliseItemName(selectedItem.name))?.[1] : null;

  useEffect(() => { setActiveIndex(null); }, [selectedId]);

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--app-bg)' }}>
      <style>{HOLO_STYLES}</style>

      <div className="shrink-0 border-b px-4 py-2.5 flex items-center gap-3 bg-white" style={{ borderColor: 'var(--top-border)' }}>
        <Layers size={16} style={{ color: 'var(--primary)' }} />
        <span className="text-sm font-semibold text-gray-700">Sandwich &amp; Toastie Build Guides</span>
        <span className="text-xs text-gray-400">— assembly reference for the line</span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r bg-white overflow-y-auto" style={{ borderColor: 'var(--top-border)' }}>
          <div className="p-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                className="w-full border border-gray-200 rounded-lg pl-8 pr-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="px-2 pb-3">
              {grouped.map(([cat, its]) => (
                <div key={cat} className="mb-2">
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">{cat}</p>
                  {its.map(it => {
                    const hasGuide = !!(BUILD_GUIDES[it.name] || Object.keys(BUILD_GUIDES).some(k => normaliseItemName(k) === normaliseItemName(it.name)));
                    const isSelected = selectedId === it.id;
                    return (
                      <button
                        key={it.id}
                        onClick={() => setSelectedId(it.id)}
                        className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${isSelected ? 'text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                        style={isSelected ? { background: 'var(--primary)' } : {}}
                      >
                        <span className="flex-1 truncate">{it.name}</span>
                        {!hasGuide && (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-white/60' : 'bg-gray-300'}`} title="No build guide yet" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
              {!loading && filtered.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">No items match.</p>
              )}
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto">
          {!selectedItem ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">Select an item to view its build guide.</div>
          ) : !guide ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <Layers size={28} className="text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-600 mb-1">No build guide yet for {selectedItem.name}</p>
              <p className="text-xs text-gray-400 max-w-xs">This item hasn't been added to the build guide baseline. It's likely a special or limited-time item.</p>
            </div>
          ) : (
            <div className="p-4 sm:p-6 max-w-4xl mx-auto">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900">{selectedItem.name}</h1>
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--primary) 12%, white)', color: 'var(--primary-dk)' }}>
                  {guide.category}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-2">Hover a layer, or a step below, to spotlight it. Hover the hologram to pause the spin.</p>

              <HoloStack guide={guide} activeIndex={activeIndex} onHover={setActiveIndex} tint="var(--primary)" />

              <div className="mt-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 bg-gray-50 border-b border-gray-100">
                  Stack Order — Top to Base
                </div>
                <div className="divide-y divide-gray-50">
                  {guide.layers.map((l, i) => (
                    <div
                      key={i}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(null)}
                      className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${activeIndex === i ? 'bg-gray-50' : ''}`}
                    >
                      <span className="w-11 shrink-0 text-[10px] font-bold uppercase tracking-wide" style={{ color: l.edge === 'top' ? 'var(--primary-dk)' : l.edge === 'base' ? 'var(--primary-dk)' : '#D1D5DB' }}>
                        {l.edge === 'top' ? 'TOP' : l.edge === 'base' ? 'BASE' : '↑'}
                      </span>
                      <span className="flex-1 font-medium text-gray-800">{l.name}</span>
                      <span className="text-gray-400 text-xs">{l.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
