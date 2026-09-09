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

// ── Illustrated exploded-diagram visual ──────────────────────────────────────
// A flat, hand-drawn-style illustration per ingredient (ink outline + flat
// colour + a highlight stroke), laid out top-to-base with curved arrow
// callouts alternating left/right -- modelled on the team's own reference
// diagram rather than any generic 3D effect.

function seededRand(seed) {
  const x = Math.sin(seed * 999.7) * 10000;
  return x - Math.floor(x);
}

const MIX_COLORS = {
  'Chicken Avo Mix': '#AEBD63',
  'Tuna Mix': '#D98A82',
  'Curried Egg Mix': '#E0A83E',
  'Club Mix': '#C99A5E',
  'Chickpea Mix': '#CDBE8A',
  'Pesto Chicken': '#7E9A5A',
};
const SAUCE_COLORS = {
  'Mayo': '#F2ECD9', 'Vegan Mayo': '#F2ECD9', 'Vegan Chilli Mayo': '#E8734A',
  'Chilli Mayo': '#E8734A', 'Mustard Mayo': '#E0B62E', 'Horseradish Mayo': '#EFE6D2',
  'Tomato Chutney': '#A6392E', 'Honey': '#DFA320', 'Chilli Crisp': '#C0301E',
  'American Mustard': '#E0B620',
};
const GARNISH_COLORS = {
  'Chives': '#3E7A4A', 'Dill': '#2E5C3A', 'Seasoning': '#4A4438',
  'Parmesan': '#E9D98A', 'Crispy Shallots': '#C99A3E',
};

function Bread({ seed, toasted }) {
  const marks = [-58, -18, 22, 62];
  return (
    <g>
      <path d="M -104 12 Q -108 -30 -58 -35 Q 0 -42 58 -35 Q 108 -30 104 12 Q 100 36 55 38 Q 0 42 -55 38 Q -100 36 -104 12 Z"
        fill="#EFC077" stroke="#5C3A18" strokeWidth="4" strokeLinejoin="round" />
      <path d="M -82 -16 Q 0 -28 82 -16" fill="none" stroke="#FBE3AE" strokeWidth="6" strokeLinecap="round" opacity="0.7" />
      {toasted && marks.map((x, i) => (
        <path key={i} d={`M ${x - 13 + (seededRand(seed + i) - 0.5) * 6} -20 L ${x + 13 + (seededRand(seed + i + 9) - 0.5) * 6} 24`}
          stroke="#6B3B14" strokeWidth="7" strokeLinecap="round" opacity="0.55" />
      ))}
    </g>
  );
}

function Cheese({ seed }) {
  const holes = Array.from({ length: 5 }, (_, i) => ({
    r: 5 + seededRand(seed + i) * 6,
    x: -66 + seededRand(seed + i * 2) * 132,
    y: -16 + seededRand(seed + i * 3) * 32,
  }));
  return (
    <g>
      <path d="M -94 22 L -58 -26 L 96 -18 L 60 28 Z" fill="#FFDE6E" stroke="#8A6A16" strokeWidth="3.5" strokeLinejoin="round" />
      {holes.map((h, i) => <circle key={i} cx={h.x} cy={h.y} r={h.r} fill="#FFF6D9" stroke="#C9A227" strokeWidth="1.5" />)}
    </g>
  );
}

function Meat() {
  return (
    <g>
      <path d="M -100 6 Q -70 -22 -30 -4 Q 10 -24 50 -2 Q 85 -20 102 4 Q 85 30 40 20 Q 0 32 -40 18 Q -80 30 -100 6 Z"
        fill="#E8998D" stroke="#9C4A3C" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M -70 0 Q -40 -10 -10 2" stroke="#FBD9D2" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.75" />
      <path d="M 20 4 Q 50 -6 80 6" stroke="#FBD9D2" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.75" />
    </g>
  );
}

function Shredded({ seed, color }) {
  const strokes = Array.from({ length: 16 }, (_, i) => ({
    x: -92 + (i / 16) * 184 + (seededRand(seed + i) - 0.5) * 14,
    y: (seededRand(seed + i * 2) - 0.5) * 44,
    rot: seededRand(seed + i * 3) * 70 - 35,
    len: 14 + seededRand(seed + i * 4) * 12,
  }));
  return (
    <g>
      {strokes.map((s, i) => (
        <path key={i} d={`M 0 0 q ${s.len / 2} -4 ${s.len} 2`} stroke={color} strokeWidth="5" fill="none" strokeLinecap="round"
          transform={`translate(${s.x},${s.y}) rotate(${s.rot})`} />
      ))}
    </g>
  );
}

function Pickle({ seed, isOnion }) {
  if (isOnion) {
    return (
      <g>
        {[36, 25, 14].map((r, i) => (
          <circle key={i} cx="0" cy="0" r={r} fill="none" stroke={i % 2 ? '#C97BC9' : '#EBB3EB'} strokeWidth="7" />
        ))}
      </g>
    );
  }
  return (
    <g>
      {[-46, 8, 58].map((x, i) => (
        <g key={i} transform={`translate(${x},${(seededRand(seed + i) - 0.5) * 14}) rotate(${(seededRand(seed + i * 2) - 0.5) * 20})`}>
          <ellipse rx="26" ry="15" fill="#C9DE8A" stroke="#5C7A28" strokeWidth="3" />
          <ellipse rx="18" ry="9" fill="none" stroke="#8FAE4A" strokeWidth="2" />
          <circle cx="-6" cy="-2" r="1.6" fill="#4A5C1C" />
          <circle cx="4" cy="3" r="1.6" fill="#4A5C1C" />
        </g>
      ))}
    </g>
  );
}

function Tomato({ seed, dried }) {
  if (dried) {
    return (
      <g>
        {[-50, 0, 50].map((x, i) => (
          <path key={i} d="M -22 -8 Q 0 -14 22 -8 Q 26 0 22 8 Q 0 14 -22 8 Q -26 0 -22 -8 Z"
            fill="#A6392E" stroke="#5C1F19" strokeWidth="2.5"
            transform={`translate(${x},${(seededRand(seed + i) - 0.5) * 16}) rotate(${(seededRand(seed + i * 3) - 0.5) * 40})`} />
        ))}
      </g>
    );
  }
  return (
    <g>
      <circle r="38" fill="#E8776A" stroke="#8A2B20" strokeWidth="3.5" />
      <circle r="30" fill="none" stroke="#F4A99B" strokeWidth="2" />
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <ellipse key={i} cx="0" cy="-16" rx="4" ry="9" fill="#FBDCD3" transform={`rotate(${deg})`} />
      ))}
    </g>
  );
}

function Veg({ seed, cucumber }) {
  if (cucumber) {
    return (
      <g>
        {[-40, 24].map((x, i) => (
          <g key={i} transform={`translate(${x},0)`}>
            <circle r="24" fill="#CDE29A" stroke="#5C7A28" strokeWidth="3" />
            <circle r="17" fill="none" stroke="#9BC24A" strokeWidth="2" />
            <circle r="9" fill="#EAF4C8" />
          </g>
        ))}
      </g>
    );
  }
  return (
    <g>
      <path d="M -100 10 Q -60 -30 0 -8 Q 60 -34 100 6 Q 60 26 0 14 Q -60 30 -100 10 Z"
        fill="#8FCB6B" stroke="#3E6B22" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M -70 6 Q 0 -6 70 4" stroke="#4E7A2C" strokeWidth="3" fill="none" opacity="0.6" />
    </g>
  );
}

function Avocado() {
  return (
    <g>
      <path d="M -60 40 Q -80 -10 -30 -38 Q 40 -46 65 0 Q 60 34 0 42 Q -35 46 -60 40 Z"
        fill="#7FA84A" stroke="#3E5A20" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M -45 30 Q -60 -6 -22 -28 Q 32 -34 52 4 Q 46 26 -4 32 Q -28 34 -45 30 Z" fill="#C7DE8E" />
      <circle cx="30" cy="6" r="14" fill="#B8935A" stroke="#7A5A2E" strokeWidth="2" />
    </g>
  );
}

function Squiggle({ color }) {
  return <path d="M -90 6 Q -60 -22 -30 6 T 30 6 T 90 -6" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />;
}

function Butter() {
  return (
    <g>
      <rect x="-55" y="-18" width="110" height="36" rx="10" fill="#FCE79A" stroke="#B8901E" strokeWidth="3" />
      <path d="M -40 -8 L 40 -8" stroke="#FFF6D5" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
    </g>
  );
}

function Garnish({ seed, color, kind }) {
  const n = 10;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = -80 + (i / n) * 160 + (seededRand(seed + i) - 0.5) * 10;
        const y = (seededRand(seed + i * 2) - 0.5) * 20;
        if (kind === 'dash') {
          return <path key={i} d="M -6 0 L 6 0" stroke={color} strokeWidth="3" strokeLinecap="round"
            transform={`translate(${x},${y}) rotate(${seededRand(seed + i * 3) * 180})`} />;
        }
        return <circle key={i} cx={x} cy={y} r={2 + seededRand(seed + i * 4) * 2} fill={color} />;
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
    case 'mix': return <Shredded seed={seed} color={MIX_COLORS[l.name] || '#B08A52'} />;
    case 'pickle': return <Pickle seed={seed} isOnion={n.includes('onion')} />;
    case 'tomato': return <Tomato seed={seed} dried={n.includes('dried')} />;
    case 'veg': return <Veg seed={seed} cucumber={n.includes('cucumber')} />;
    case 'avocado': return <Avocado />;
    case 'garnish': return (
      <Garnish seed={seed} color={GARNISH_COLORS[l.name] || '#4A7A5A'}
        kind={n.includes('season') || n.includes('pepper') ? 'dot' : 'dash'} />
    );
    case 'sauce':
      if (n === 'butter') return <Butter />;
      return <Squiggle color={SAUCE_COLORS[l.name] || '#E8C24A'} />;
    default: return <circle r="30" fill="#D8D2C4" stroke="#8C8175" strokeWidth="3" />;
  }
}

function ExplodedDiagram({ guide, activeIndex, onHover, tint }) {
  const BAND = 116;
  const WIDTH = 820;
  const PAD = 54;
  const height = guide.layers.length * BAND + PAD * 2;
  const isToastie = guide.category === 'Toasties';

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} style={{ width: '100%', maxWidth: 620, display: 'block', margin: '0 auto' }}>
      <defs>
        <marker id="builds-arrowhead" markerWidth="9" markerHeight="9" refX="6" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 Z" fill="#2B2420" />
        </marker>
      </defs>
      {guide.layers.map((l, i) => {
        const cy = PAD + i * BAND + BAND / 2;
        const cx = WIDTH / 2;
        const side = i % 2 === 0 ? 'left' : 'right';
        const jitter = (seededRand(i * 7 + 3) - 0.5) * 16;
        const labelX = side === 'left' ? 26 : WIDTH - 26;
        const arrowStartX = side === 'left' ? 158 : WIDTH - 158;
        const arrowEndX = side === 'left' ? cx - 100 : cx + 100;
        const isActive = activeIndex === i;
        const arcH = 30 + seededRand(i * 13 + 1) * 14;
        const path = `M ${arrowStartX} ${cy + jitter} Q ${(arrowStartX + arrowEndX) / 2} ${cy - arcH} ${arrowEndX} ${cy}`;
        return (
          <g key={i} onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
            <path d={path} fill="none" stroke={isActive ? tint : '#B8AE9F'} strokeWidth={isActive ? 3 : 2}
              markerEnd="url(#builds-arrowhead)" opacity={isActive ? 1 : 0.6} />
            <g transform={`translate(${cx},${cy}) scale(${isActive ? 1.1 : 1})`} style={{ transition: 'transform 0.15s ease' }}>
              {ingredientArt({ ...l, toasted: isToastie && l.type === 'bread' }, i)}
            </g>
            <text x={labelX} y={cy - 6} textAnchor={side === 'left' ? 'start' : 'end'}
              fontFamily="'Kalam', cursive" fontWeight="700" fontSize="21"
              fill={isActive ? tint : '#2B2420'}>
              {l.name}
            </text>
            {l.qty && (
              <text x={labelX} y={cy + 15} textAnchor={side === 'left' ? 'start' : 'end'}
                fontFamily="'Work Sans', sans-serif" fontSize="12.5" fill="#8C8175">
                {l.qty}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const DIAGRAM_STYLES = `@import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap');`;

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
      <style>{DIAGRAM_STYLES}</style>

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
              <p className="text-xs text-gray-400 mb-2">Hover a layer, or a step below, to spotlight it.</p>

              <div className="bg-white rounded-2xl border border-gray-100 py-6 px-3">
                <ExplodedDiagram guide={guide} activeIndex={activeIndex} onHover={setActiveIndex} tint="var(--primary-dk)" />
              </div>

              <div className="mt-3 bg-white rounded-2xl border border-gray-100 overflow-hidden">
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
