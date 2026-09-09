import { useState } from 'react';

// ── Build guide data + illustrated exploded-diagram visual ──────────────────
// Shared between the admin R-Builds app (BuildsApp.jsx) and the staff-facing
// public view (PublicBuildsView.jsx) so both render the exact same guide
// content and artwork instead of two copies drifting apart.
//
// Baseline transcribed from the sandwich build guide doc, TOP of stack first
// down to BASE -- matches the doc's own reading order exactly so staff can
// cross-reference. Two corrections folded in per the recipe audit: Chicken
// Avo's garnish chives (present in R-Recipe, missing from the original doc)
// and two ingredient names homogenised to their system SKU (Tomato Chutney,
// Sundried Tomato Strips). Item names match production_items exactly.

function topLayer(name, qty, type) { return { name, qty, type, edge: 'top' }; }
function baseLayer(name, qty, type) { return { name, qty, type, edge: 'base' }; }
function layer(name, qty, type) { return { name, qty, type }; }

export const BUILD_GUIDES = {
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

export function normaliseItemName(name) {
  return (name || '').trim().toLowerCase();
}

export function findGuide(itemName) {
  return BUILD_GUIDES[itemName] || Object.entries(BUILD_GUIDES).find(([k]) => normaliseItemName(k) === normaliseItemName(itemName))?.[1] || null;
}

export function seededRand(seed) {
  const x = Math.sin(seed * 999.7) * 10000;
  return x - Math.floor(x);
}

const MIX_COLORS = {
  'Chicken Avo Mix': '#C9A854',
  'Tuna Mix': '#D9A08C',
  'Curried Egg Mix': '#DDA83E',
  'Club Mix': '#C99A5E',
  'Chickpea Mix': '#CBB27E',
  'Pesto Chicken': '#8A9D5E',
};
const SAUCE_COLORS = {
  'Mayo': '#EDE4C8', 'Vegan Mayo': '#EDE4C8', 'Vegan Chilli Mayo': '#E1663D',
  'Chilli Mayo': '#E1663D', 'Mustard Mayo': '#DDAA2A', 'Horseradish Mayo': '#EDE4C8',
  'Tomato Chutney': '#9E3226', 'Honey': '#DB9A16', 'Chilli Crisp': '#B92A1B',
  'American Mustard': '#DDAA2A',
};
const GARNISH_COLORS = {
  'Chives': '#3E7A4A', 'Dill': '#2E5C3A', 'Seasoning': '#5C4A2E',
  'Parmesan': '#DFC96A', 'Crispy Shallots': '#B5842E',
};

// Flat, clean icon set -- one consistent stroke weight, minimal texture,
// no hand-drawn wobble. Drawn to sit inside a roughly -50..50 box so each
// reads clearly at the small "medallion" size the compact list uses.

function Bread({ seed, toasted }) {
  return (
    <g>
      <path d="M -44 16 Q -48 -14 -22 -20 Q 0 -24 22 -20 Q 48 -14 44 16 Q 40 26 0 27 Q -40 26 -44 16 Z"
        fill="#EFC077" stroke="#7A5222" strokeWidth="3" strokeLinejoin="round" />
      {toasted ? (
        <>
          <path d="M -22 -12 L -10 18" stroke="#8A5A24" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />
          <path d="M 0 -14 L 6 18" stroke="#8A5A24" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />
          <path d="M 22 -12 L 20 18" stroke="#8A5A24" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />
        </>
      ) : (
        <path d="M -32 -6 Q 0 -14 32 -6" fill="none" stroke="#FBE3AE" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
      )}
    </g>
  );
}

function Cheese({ seed }) {
  const holes = [
    { x: -12, y: -6, r: 4.5 + seededRand(seed) * 2 },
    { x: 10, y: 6, r: 4 + seededRand(seed + 1) * 2 },
    { x: -2, y: 12, r: 3 + seededRand(seed + 2) * 1.5 },
  ];
  return (
    <g>
      <path d="M -34 20 L -18 -22 L 36 -14 L 20 24 Z" fill="#FFD966" stroke="#A9821E" strokeWidth="3" strokeLinejoin="round" />
      {holes.map((h, i) => <circle key={i} cx={h.x} cy={h.y} r={h.r} fill="#FFF3CC" stroke="#C9A227" strokeWidth="1.5" />)}
    </g>
  );
}

function Meat() {
  return (
    <g>
      <path d="M -40 -6 Q -20 -18 0 -6 Q 20 -18 40 -6 Q 40 8 20 14 Q 0 20 -20 14 Q -40 8 -40 -6 Z"
        fill="#DD9385" stroke="#8A4234" strokeWidth="3" strokeLinejoin="round" />
      <path d="M -26 -2 Q 0 -10 26 -2" stroke="#F6D2C8" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
    </g>
  );
}

// The one this feedback round is fixing: a scoop of chunky filling (chicken
// avo, tuna, curried egg, chickpea...), not a scatter of confetti dashes --
// a mounded dome with a scalloped top edge and a couple of solid chunks so
// it reads as protein/salad, not sprinkles.
function Mix({ color }) {
  const dark = 'color-mix(in srgb, ' + color + ' 55%, #3A2F1C)';
  return (
    <g>
      <path d="M -38 18 Q -44 -8 -20 -18 Q 0 -26 20 -18 Q 44 -8 38 18 Q 20 26 0 26 Q -20 26 -38 18 Z"
        fill={color} stroke={dark} strokeWidth="3" strokeLinejoin="round" />
      <path d="M -30 -8 Q -22 -16 -12 -9 Q -2 -17 8 -9 Q 18 -17 28 -8"
        fill="none" stroke={dark} strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <ellipse cx="-10" cy="4" rx="7" ry="4.5" fill={dark} opacity="0.4" />
      <ellipse cx="13" cy="9" rx="6" ry="4" fill={dark} opacity="0.35" />
    </g>
  );
}

function Pickle({ seed, isOnion }) {
  if (isOnion) {
    return (
      <g fill="none" strokeWidth="5">
        <circle r="26" stroke="#E4B8E4" />
        <circle r="15" stroke="#C97BC9" />
      </g>
    );
  }
  return (
    <g>
      {[-14, 14].map((x, i) => (
        <g key={i} transform={`translate(${x},${(seededRand(seed + i) - 0.5) * 6})`}>
          <ellipse rx="20" ry="13" fill="#CFE29C" stroke="#5C7A28" strokeWidth="2.5" />
          <ellipse rx="13" ry="7" fill="none" stroke="#8FAE4A" strokeWidth="1.5" />
        </g>
      ))}
    </g>
  );
}

function Tomato({ seed, dried }) {
  if (dried) {
    return (
      <g>
        {[-14, 14].map((x, i) => (
          <path key={i} d="M -20 -7 Q 0 -12 20 -7 Q 23 0 20 7 Q 0 12 -20 7 Q -23 0 -20 -7 Z"
            fill="#A6392E" stroke="#5C1F19" strokeWidth="2.5"
            transform={`translate(${x},${(seededRand(seed + i) - 0.5) * 8}) rotate(${(seededRand(seed + i * 3) - 0.5) * 24})`} />
        ))}
      </g>
    );
  }
  return (
    <g>
      <circle r="30" fill="#E8776A" stroke="#8A2B20" strokeWidth="3" />
      <circle r="22" fill="none" stroke="#F4A99B" strokeWidth="2" />
      {[0, 72, 144, 216, 288].map((deg, i) => (
        <ellipse key={i} cx="0" cy="-12" rx="3.2" ry="6.5" fill="#FBDCD3" transform={`rotate(${deg})`} />
      ))}
    </g>
  );
}

function Veg({ cucumber }) {
  if (cucumber) {
    return (
      <g>
        {[-14, 14].map((x, i) => (
          <g key={i} transform={`translate(${x},0)`}>
            <circle r="19" fill="#CDE29A" stroke="#5C7A28" strokeWidth="2.5" />
            <circle r="13" fill="none" stroke="#9BC24A" strokeWidth="1.5" />
            <circle r="6" fill="#EAF4C8" />
          </g>
        ))}
      </g>
    );
  }
  return (
    <g>
      <path d="M -38 8 Q -18 -18 6 -4 Q 26 -20 40 4 Q 22 16 4 8 Q -18 18 -38 8 Z"
        fill="#8FCB6B" stroke="#3E6B22" strokeWidth="3" strokeLinejoin="round" />
      <path d="M -22 4 Q 0 -4 22 2" stroke="#4E7A2C" strokeWidth="2" fill="none" opacity="0.6" />
    </g>
  );
}

function Avocado() {
  return (
    <g>
      <path d="M -30 22 Q -40 -6 -14 -20 Q 20 -24 32 0 Q 30 20 0 24 Q -18 26 -30 22 Z"
        fill="#7FA84A" stroke="#3E5A20" strokeWidth="3" strokeLinejoin="round" />
      <path d="M -22 16 Q -30 -4 -10 -14 Q 16 -18 24 2 Q 22 14 -2 17 Q -14 18 -22 16 Z" fill="#C7DE8E" />
      <circle cx="14" cy="2" r="8" fill="#B8935A" stroke="#7A5A2E" strokeWidth="1.5" />
    </g>
  );
}

function Squiggle({ color }) {
  return <path d="M -34 4 Q -20 -12 -6 4 T 22 4 T 36 -6" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />;
}

function Butter() {
  return (
    <g>
      <rect x="-26" y="-9" width="52" height="18" rx="5" fill="#FCE79A" stroke="#B8901E" strokeWidth="2.5" />
      <path d="M -18 -3 L 18 -3" stroke="#FFF6D5" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
    </g>
  );
}

function Garnish({ seed, color, kind }) {
  const n = 7;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = -22 + (i / (n - 1)) * 44 + (seededRand(seed + i) - 0.5) * 8;
        const y = (seededRand(seed + i * 2) - 0.5) * 20;
        if (kind === 'dash') {
          return <path key={i} d="M -4 0 L 4 0" stroke={color} strokeWidth="3" strokeLinecap="round"
            transform={`translate(${x},${y}) rotate(${seededRand(seed + i * 3) * 180})`} />;
        }
        return <circle key={i} cx={x} cy={y} r={1.6 + seededRand(seed + i * 4) * 1.6} fill={color} />;
      })}
    </g>
  );
}

function ingredientArt(l, seed) {
  const n = l.name.toLowerCase();
  switch (l.type) {
    case 'bread': return <Bread seed={seed} toasted={l.toasted} />;
    case 'cheese': return <Cheese seed={seed} />;
    case 'meat': return <Meat />;
    case 'mix': return <Mix color={MIX_COLORS[l.name] || '#B08A52'} />;
    case 'pickle': return <Pickle seed={seed} isOnion={n.includes('onion')} />;
    case 'tomato': return <Tomato seed={seed} dried={n.includes('dried')} />;
    case 'veg': return <Veg cucumber={n.includes('cucumber')} />;
    case 'avocado': return <Avocado />;
    case 'garnish': return (
      <Garnish seed={seed} color={GARNISH_COLORS[l.name] || '#4A7A5A'}
        kind={n.includes('season') || n.includes('pepper') ? 'dot' : 'dash'} />
    );
    case 'sauce':
      if (n === 'butter') return <Butter />;
      return <Squiggle color={SAUCE_COLORS[l.name] || '#DDAA2A'} />;
    default: return <circle r="24" fill="#D8D2C4" stroke="#8C8175" strokeWidth="2.5" />;
  }
}

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// A tight vertical build-order list, not a spread-out illustration: each
// layer is one compact row -- an icon medallion, the name in large type,
// and its quantity underneath -- strung along a single connector line.
// Earlier rounds spent a whole band's height on a wide alternating-side
// layout with long curved call-out arrows, which read as decorative and
// left a lot of dead space between layers; this keeps every layer's own
// height close to the icon's, so even a 12-layer sandwich stays condensed
// and every label can afford to be large and legible.
export function ExplodedDiagram({ guide, tint, maxWidth = 420 }) {
  const [hovered, setHovered] = useState(null);
  const isToastie = guide.category === 'Toasties';

  return (
    <div style={{ width: '100%', maxWidth, margin: '0 auto', fontFamily: FONT }}>
      {guide.layers.map((l, i) => {
        const isActive = hovered === i;
        const isLast = i === guide.layers.length - 1;
        return (
          <div
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 4px', cursor: 'default' }}
          >
            <div style={{ position: 'relative', width: 12, alignSelf: 'stretch', flexShrink: 0 }}>
              {!isLast && (
                <div style={{ position: 'absolute', left: 5, top: 30, bottom: -5, width: 2, background: '#E7E2D8' }} />
              )}
              <div style={{
                position: 'absolute', left: 0, top: 14, width: 12, height: 12, borderRadius: '50%',
                background: l.edge ? tint : '#D8D2C4', boxShadow: '0 0 0 3px white',
              }} />
            </div>

            <div style={{
              width: 46, height: 46, borderRadius: 12, flexShrink: 0,
              background: isActive ? `color-mix(in srgb, ${tint} 10%, #F7F5F0)` : '#F7F5F0',
              border: `1px solid ${isActive ? tint : '#EDE9E1'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.12s ease, border-color 0.12s ease',
            }}>
              <svg width="36" height="36" viewBox="-50 -50 100 100">
                {ingredientArt({ ...l, toasted: isToastie && l.type === 'bread' }, i)}
              </svg>
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                {l.edge && (
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', color: tint, flexShrink: 0 }}>
                    {l.edge === 'top' ? 'TOP' : 'BASE'}
                  </span>
                )}
                <span style={{ fontSize: 16.5, fontWeight: 700, color: '#221C14', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {l.name}
                </span>
              </div>
              {l.qty && (
                <span style={{ fontSize: 12, color: '#948C7C', flexShrink: 0, whiteSpace: 'nowrap' }}>{l.qty}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
