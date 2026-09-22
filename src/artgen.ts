/* ART ENGINE — items are drawn from a spec, not hand-authored one by one.
 *
 *   { shape: 'jar', mat: 'berry', tier: 4, accent: 'gold', deco: ['sparkle'] }
 *
 * A spec picks a PRIMITIVE (the silhouette), a MATERIAL (a five-stop colour ramp
 * derived from one hex), and a TIER (how precious it looks). The renderer then
 * stacks the same lighting model on everything, which is what makes a few dozen
 * primitives read as one toy box rather than a pile of clip art:
 *
 *   contact shadow → body gradient → ambient occlusion → rim light →
 *   specular highlight → cartoon outline → tier decoration
 *
 * Adding an item is a line of JSON. Adding a whole chain is six.
 */

/* ------------------------------------------------------------- colour ramp */

type Ramp = { hi: string; base: string; lo: string; deep: string; rim: string; line: string };

function hex2hsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h *= 60; if (h < 0) h += 360;
  const l = (mx + mn) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [h, s, l];
}
function hsl(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const f = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}
/** one hex in, a full lighting ramp out — warm on the lit side, cool in shadow */
/* The ramp is what makes an item look moulded rather than drawn. Casual-merge
   art (Travel Town and friends) is high-contrast and *saturated in the shadows*
   — a dark tint of the colour, never grey and never black — with a near-white
   key light on the top shoulder. Push both ends and the shape reads as a solid
   object the moment you glance at it. */
function ramp(hex: string): Ramp {
  const [h, s, l] = hex2hsl(hex);
  return {
    hi: hsl(h + 10, Math.min(1, s * 0.78), Math.min(0.96, l + 0.3)),
    base: hsl(h, Math.min(1, s * 1.06), l),
    lo: hsl(h - 8, Math.min(1, s * 1.14), Math.max(0.11, l - 0.2)),
    deep: hsl(h - 14, Math.min(1, s * 1.2), Math.max(0.07, l - 0.34)),
    rim: hsl(h + 26, Math.min(1, s * 0.45), Math.min(0.99, l + 0.44)),
    line: hsl(h - 12, Math.min(1, s * 1.28), Math.max(0.09, l - 0.42)),
  };
}

/* The palette. Every material is one colour; the ramp does the rest. */
const MATS: Record<string, string> = {
  wood: '#c2833f', bark: '#8d5a2b', straw: '#e0b75a', leaf: '#4fae3c',
  moss: '#6fbf4a', vine: '#3f9a52', grass: '#7cc93f', fern: '#2f9a6a',
  stone: '#9aa2b4', slate: '#6d7689', sand: '#e0c383', clay: '#c9764a',
  iron: '#8894a8', steel: '#b6c2d4', gold: '#f0a91e', copper: '#d8763a',
  silver: '#cdd6e4', obsidian: '#3b3550', crystal: '#63c8e8', amethyst: '#a77bff',
  ruby: '#e8405c', emerald: '#2fbf76', sapphire: '#3f7fe0', topaz: '#f2b227',
  berry: '#d8365e', cherry: '#e0485a', plum: '#8c4fc4', peach: '#ffa46b',
  honey: '#e8a318', cream: '#f6e2b8', dough: '#e8c894', choco: '#8a5230',
  water: '#3fa8d8', ice: '#9fe0f5', frost: '#cfeeff', deepsea: '#1f6fa8',
  flame: '#f2702a', ember: '#e04a12', magma: '#d12a0c', smoke: '#6b6f7a',
  moon: '#cfc8e8', dusk: '#7a6fb0', star: '#ffd45e', aurora: '#59e0c0',
  glow: '#8ce0ff', spore: '#b47fe0', fungus: '#e08a6b', shell: '#f0d8c0',
  coral: '#ff7f93', pearl: '#f7f0ff', kelp: '#3f8a5a', bone: '#ece2cc',
  cloth: '#e07b6b', rope: '#c9a06a', glass: '#bfe6f2', rust: '#a35a2a',
  coal: '#3f3c46', cloud: '#dce9ff', jade: '#4fc4a0', lilac: '#c49ae8', mint: '#7fe0b8', rose: '#ff9ec4',
};
const R = (k: string) => ramp(MATS[k] || MATS.stone || '#9aa2b4');

/* ------------------------------------------------------------ svg plumbing */

let uid = 0;
type Ctx = { id: string; defs: string[]; m: Ramp; a: Ramp; tier: number };

function lg(c: Ctx, stops: [number, string][], vertical = true) {
  const id = `${c.id}l${c.defs.length}`;
  c.defs.push(`<linearGradient id="${id}" x1="${vertical ? 0.2 : 0}" y1="${vertical ? 0 : 0.2}" x2="${vertical ? 0.3 : 1}" y2="${vertical ? 1 : 0.8}">`
    + stops.map(([o, col]) => `<stop offset="${o}" stop-color="${col}"/>`).join('') + '</linearGradient>');
  return `url(#${id})`;
}
function rg(c: Ctx, stops: [number, string][], cx = 0.32, cy = 0.26, r = 0.86) {
  const id = `${c.id}r${c.defs.length}`;
  c.defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">`
    + stops.map(([o, col]) => `<stop offset="${o}" stop-color="${col}"/>`).join('') + '</radialGradient>');
  return `url(#${id})`;
}
/** the soft dark edge that stops a shape looking like flat paper */
function occl(c: Ctx) {
  return rg(c, [[0.45, c.m.deep + '00'], [0.82, c.m.deep + '55'], [1, c.m.deep + '99']], 0.38, 0.3, 0.78);
}

/* A tight double shadow: a soft wide one for the ground, a darker tight one
   right under the object, which is what actually sells the weight. */
const SH = (y = 88, rx = 26, ry = 6, o = 0.18) =>
  `<ellipse cx="50" cy="${y + 1}" rx="${rx * 1.18}" ry="${ry * 1.25}" fill="#2a1b0c" opacity="${o * 0.55}"/>`
  + `<ellipse cx="50" cy="${y}" rx="${rx * 0.78}" ry="${ry * 0.85}" fill="#241608" opacity="${o * 1.7}"/>`;

/** specular highlight — a soft rotated blob on the lit shoulder */
const spec = (x: number, y: number, r: number, o = 0.6, rot = -26) =>
  `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.5}" fill="#fff" opacity="${o * 0.9}" transform="rotate(${rot} ${x} ${y})"/>`
  + `<ellipse cx="${x + r * 0.9}" cy="${y + r * 0.5}" rx="${r * 0.3}" ry="${r * 0.18}" fill="#fff" opacity="${o * 0.6}" transform="rotate(${rot} ${x} ${y})"/>`;

const twinkle = (x: number, y: number, s: number, col = '#fffbe0', o = 1) =>
  `<path d="M${x} ${y - s} Q${x + s * 0.2} ${y - s * 0.2} ${x + s} ${y} Q${x + s * 0.2} ${y + s * 0.2} ${x} ${y + s} `
  + `Q${x - s * 0.2} ${y + s * 0.2} ${x - s} ${y} Q${x - s * 0.2} ${y - s * 0.2} ${x} ${y - s}Z" fill="${col}" opacity="${o}"/>`;

/** Draw a closed path with the full lighting stack. This is the workhorse.
 *  Five passes, in the order a painter would lay them down: body gradient,
 *  occlusion at the bottom, a glossy sheet over the top half, a bounce light
 *  coming back up off the ground, and a saturated contour to hold it together. */
function solid(c: Ctx, d: string, o: { m?: Ramp; flat?: boolean; line?: number; shine?: boolean } = {}) {
  const m = o.m || c.m;
  const g = lg(c, [[0, m.hi], [0.38, m.base], [0.86, m.lo], [1, m.deep]]);
  const ao = rg(c, [[0.42, m.deep + '00'], [0.78, m.deep + '59'], [1, m.deep + 'b3']], 0.36, 0.28, 0.8);
  const gloss = lg(c, [[0, '#ffffff6b'], [0.3, '#ffffff1c'], [0.5, '#ffffff00']]);
  const bounce = lg(c, [[0.74, m.rim + '00'], [1, m.rim + '59']]);
  return `<path d="${d}" fill="${g}"/>`
    + (o.flat ? '' : `<path d="${d}" fill="${ao}"/>`)
    + `<path d="${d}" fill="${bounce}"/>`
    + (o.shine === false ? '' : `<path d="${d}" fill="${gloss}"/>`)
    + `<path d="${d}" fill="none" stroke="${m.line}" stroke-width="${o.line ?? 2.6}" stroke-linejoin="round" stroke-linecap="round" opacity=".92"/>`;
}
function circleSolid(c: Ctx, cx: number, cy: number, r: number, m?: Ramp) {
  const mm = m || c.m;
  const g = rg(c, [[0, mm.hi], [0.46, mm.base], [0.88, mm.lo], [1, mm.deep]], 0.33, 0.26, 0.92);
  const gloss = rg(c, [[0, '#ffffffa6'], [0.55, '#ffffff26'], [1, '#ffffff00']], 0.34, 0.2, 0.55);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${g}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${rg(c, [[0.78, mm.rim + '00'], [1, mm.rim + '66']], 0.5, 0.86, 0.5)}"/>`
    + `<ellipse cx="${cx}" cy="${cy - r * 0.34}" rx="${r * 0.82}" ry="${r * 0.6}" fill="${gloss}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${mm.line}" stroke-width="2.6" opacity=".92"/>`;
}

/* ---------------------------------------------------------------- shapes */
/* Each returns the body of the drawing; the wrapper adds shadow and deco. */

type Draw = (c: Ctx) => string;

const SHAPES: Record<string, Draw> = {
  /* ---- seeds, sprouts, leaves ---- */
  seed: c => solid(c, 'M50 24 q17 12 17 30 q0 20 -17 26 q-17 -6 -17 -26 q0 -18 17 -30Z') + spec(43, 42, 6),
  sprout: c => `<path d="M50 86 q-3 -22 0 -34" stroke="${R('vine').base}" stroke-width="8" fill="none" stroke-linecap="round"/>`
    + `<path d="M50 86 q-3 -22 0 -34" stroke="${R('vine').rim}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".5"/>`
    + solid(c, 'M50 54 q-22 -2 -26 -18 q20 -4 26 18Z') + solid(c, 'M50 50 q22 -4 26 -20 q-20 -2 -26 20Z')
    + spec(36, 44, 5, 0.45),
  leaf: c => solid(c, 'M50 16 q30 18 26 42 q-4 24 -26 26 q-22 -2 -26 -26 q-4 -24 26 -42Z')
    + `<path d="M50 22 v58" stroke="${c.m.deep}" stroke-width="2.6" opacity=".45"/>`
    + `<path d="M50 38 l-13 -6 M50 50 l13 -6 M50 62 l-13 -6" stroke="${c.m.deep}" stroke-width="2" opacity=".3"/>`
    + spec(38, 34, 7),
  clover: c => [0, 90, 180, 270].map(a =>
    solid(c, 'M50 46 q-13 -14 0 -26 q13 12 0 26Z').replace(/<path /g, `<path transform="rotate(${a} 50 50)" `)).join('')
    + `<circle cx="50" cy="48" r="5" fill="${c.m.lo}"/>` + spec(42, 30, 5),
  bud: c => solid(c, 'M50 20 q16 16 14 34 q-2 18 -14 22 q-12 -4 -14 -22 q-2 -18 14 -34Z')
    + `<path d="M50 26 q6 22 0 46 M50 26 q-6 22 0 46" stroke="${c.m.deep}" stroke-width="2.2" opacity=".4" fill="none"/>`
    + spec(42, 40, 6),
  flower: c => [0, 72, 144, 216, 288].map(a =>
    `<ellipse cx="50" cy="28" rx="13" ry="18" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="2.6" transform="rotate(${a} 50 48)"/>`).join('')
    + circleSolid(c, 50, 48, 12, c.a) + spec(46, 43, 5, 0.7),
  blossom: c => `<circle cx="50" cy="48" r="34" fill="${c.m.hi}" opacity=".2"/>`
    + [0, 60, 120, 180, 240, 300].map(a =>
      `<path d="M50 12 q14 20 0 36 q-14 -16 0 -36Z" fill="${lg(c, [[0, c.m.rim], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="2.4" transform="rotate(${a} 50 48)"/>`).join('')
    + circleSolid(c, 50, 48, 13, c.a) + twinkle(80, 20, 8),
  vine: c => `<path d="M22 82 q6 -28 28 -30 q22 -2 28 -30" stroke="${c.m.base}" stroke-width="9" fill="none" stroke-linecap="round"/>`
    + `<path d="M22 82 q6 -28 28 -30 q22 -2 28 -30" stroke="${c.m.rim}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/>`
    + solid(c, 'M36 62 q-14 -4 -16 -14 q14 -2 16 14Z', { m: c.a })
    + solid(c, 'M64 44 q14 -6 16 -16 q-14 -2 -16 16Z', { m: c.a }),
  fern: c => [(-1), 1].map(s => `<path d="M50 84 q${s * 4} -30 ${s * 2} -50" stroke="${c.m.base}" stroke-width="6" fill="none" stroke-linecap="round"/>`).join('')
    + [0, 1, 2, 3].map(i => `<path d="M50 ${68 - i * 14} q-${16 - i * 2} -4 -${20 - i * 3} -12 M50 ${64 - i * 14} q${16 - i * 2} -4 ${20 - i * 3} -12"
        stroke="${c.m.lo}" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('')
    + spec(40, 40, 5, 0.3),

  /* ---- wood ---- */
  twig: c => `<path d="M32 82 L66 30" stroke="${c.m.line}" stroke-width="15" stroke-linecap="round"/>`
    + `<path d="M32 82 L66 30" stroke="${lg(c, [[0, c.m.hi], [1, c.m.lo]])}" stroke-width="11" stroke-linecap="round"/>`
    + `<path d="M50 56 L30 44" stroke="${c.m.line}" stroke-width="12" stroke-linecap="round"/>`
    + `<path d="M50 56 L30 44" stroke="${c.m.base}" stroke-width="8" stroke-linecap="round"/>`
    + `<path d="M40 68 L60 40" stroke="${c.m.rim}" stroke-width="2.6" stroke-linecap="round" opacity=".5"/>`
    + `<path d="M44 62 l-7 5 M56 46 l7 -5" stroke="${c.m.deep}" stroke-width="2" opacity=".4"/>`
    + solid(c, 'M66 30 q18 -6 20 -20 q-18 -2 -20 20Z', { m: R('leaf'), line: 2.4 })
    + solid(c, 'M30 44 q-14 -10 -12 -22 q14 6 12 22Z', { m: R('leaf'), line: 2.4 }),
  log: c => `<rect x="14" y="36" width="72" height="38" rx="19" fill="${lg(c, [[0, c.m.hi], [0.5, c.m.base], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<ellipse cx="22" cy="55" rx="9" ry="19" fill="${rg(c, [[0, c.a.hi], [1, c.a.base]])}" stroke="${c.m.line}" stroke-width="2.6"/>`
    + `<ellipse cx="22" cy="55" rx="5" ry="11" fill="none" stroke="${c.a.lo}" stroke-width="2.2"/>`
    + `<path d="M40 44 q14 4 30 0 M42 66 q16 4 30 -1" stroke="${c.m.deep}" stroke-width="2.4" opacity=".4" fill="none"/>`
    + `<rect x="30" y="40" width="48" height="6" rx="3" fill="#fff" opacity=".24"/>`,
  plank: c => [0, 1].map(i => `<rect x="${10 + i * 4}" y="${34 + i * 22}" width="${80 - i * 8}" height="24" rx="7"
      fill="${lg(c, [[0, c.m.hi], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<path d="M${18 + i * 4} ${44 + i * 22} h${58 - i * 8} M${20 + i * 4} ${52 + i * 22} h${48 - i * 8}" stroke="${c.m.deep}" stroke-width="2" opacity=".35"/>`
    + `<rect x="${14 + i * 4}" y="${37 + i * 22}" width="${70 - i * 8}" height="5" rx="2.5" fill="#fff" opacity=".25"/>`).join('')
    + `<rect x="44" y="30" width="12" height="52" rx="5" fill="${c.a.base}" stroke="${c.a.line}" stroke-width="2.4"/>`,
  stump: c => `<path d="M24 80 q-4 -34 26 -34 q30 0 26 34Z" fill="${lg(c, [[0, c.m.base], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + [0, 1, 2, 3].map(i => `<path d="M${30 + i * 13} 50 q-2 16 0 30" stroke="${c.m.deep}" stroke-width="2.6" opacity=".35" fill="none"/>`).join('')
    + `<path d="M24 62 q26 6 52 0" stroke="${c.m.deep}" stroke-width="2.2" opacity=".3" fill="none"/>`
    + `<ellipse cx="50" cy="46" rx="27" ry="10" fill="${rg(c, [[0, c.a.hi], [1, c.a.base]])}" stroke="${c.m.line}" stroke-width="2.8"/>`
    + `<ellipse cx="50" cy="46" rx="18" ry="6.5" fill="none" stroke="${c.a.lo}" stroke-width="2.2"/>`
    + `<ellipse cx="50" cy="46" rx="9" ry="3" fill="none" stroke="${c.a.lo}" stroke-width="2"/>`
    + `<ellipse cx="50" cy="46" rx="3" ry="1.4" fill="${c.a.lo}" opacity=".8"/>` + spec(36, 42, 6, 0.35),
  tree: c => `<rect x="43" y="52" width="14" height="30" rx="6" fill="${lg(c, [[0, c.a.hi], [1, c.a.lo]])}" stroke="${c.a.line}" stroke-width="2.6"/>`
    + circleSolid(c, 33, 42, 19) + circleSolid(c, 67, 42, 19) + circleSolid(c, 50, 28, 22)
    + spec(41, 22, 7, 0.4),
  bush: c => circleSolid(c, 30, 58, 19) + circleSolid(c, 70, 58, 19) + circleSolid(c, 50, 44, 23)
    + spec(40, 38, 7, 0.35),

  /* ---- stone & metal ---- */
  pebble: c => solid(c, 'M28 66 q-7 -20 14 -27 q21 -7 29 8 q8 15 -6 23 q-21 11 -37 -4Z') + spec(40, 48, 7),
  rock: c => solid(c, 'M18 72 q-5 -27 18 -35 q27 -10 39 6 q13 19 -4 31 q-27 15 -53 -2Z')
    + `<path d="M50 38 L70 50 L58 74 L36 70Z" fill="${c.m.lo}" opacity=".45"/>` + spec(38, 46, 9),
  boulder: c => solid(c, 'M12 76 q-4 -32 22 -42 q32 -12 46 6 q16 22 -4 36 q-32 18 -64 0Z')
    + `<path d="M34 46 L56 40 L64 62 L40 70Z" fill="${c.m.lo}" opacity=".4"/>`
    + `<circle cx="70" cy="50" r="5" fill="${c.m.deep}" opacity=".3"/>` + spec(34, 44, 10),
  crystal: c => `<polygon points="34,76 30,38 46,16 56,42 48,76" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="2.8"/>`
    + `<polygon points="52,76 54,32 68,20 76,50 68,76" fill="${lg(c, [[0, c.m.rim], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="2.8"/>`
    + `<polygon points="34,76 30,38 46,16 40,44" fill="#fff" opacity=".35"/>` + twinkle(80, 24, 7),
  gem: c => `<polygon points="50,12 78,36 64,80 36,80 22,36" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<polygon points="50,12 64,36 50,54 36,36" fill="${c.m.rim}" opacity=".85"/>`
    + `<polygon points="36,36 50,54 38,80 22,36" fill="#fff" opacity=".22"/>`
    + `<polygon points="64,36 78,36 64,80 50,54" fill="${c.m.deep}" opacity=".35"/>`
    + `<path d="M22 36 h56" stroke="#fff" stroke-width="2.4" opacity=".45"/>` + twinkle(80, 20, 8),
  geode: c => solid(c, 'M14 62 q0 -25 23 -31 q23 -6 31 8 q10 19 -6 29 q-25 13 -48 -6Z')
    + `<ellipse cx="52" cy="54" rx="24" ry="20" fill="${c.a.deep}"/>`
    + [0, 1, 2].map(i => `<polygon points="${40 + i * 11},${60 - i} ${46 + i * 11},${36 + i * 2} ${52 + i * 11},${60 - i}" fill="${i % 2 ? c.a.hi : c.a.base}"/>`).join('')
    + `<ellipse cx="52" cy="62" rx="22" ry="7" fill="${c.a.deep}" opacity=".5"/>` + twinkle(74, 28, 8),
  ingot: c => `<path d="M26 40 h48 l8 12 h-64Z" fill="${lg(c, [[0, c.m.rim], [1, c.m.hi]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<path d="M18 52 h64 l6 22 h-76Z" fill="${lg(c, [[0, c.m.base], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<path d="M18 52 h64" stroke="${c.m.rim}" stroke-width="2.4" opacity=".7"/>`
    + `<path d="M30 56 h40" stroke="#fff" stroke-width="3.4" opacity=".28" stroke-linecap="round"/>`
    + spec(38, 45, 6, 0.5) + twinkle(80, 32, 7),
  ore: c => solid(c, 'M18 72 q-6 -26 18 -34 q28 -8 40 8 q12 20 -8 30 q-28 14 -50 -4Z', { m: R('slate') })
    + [[36, 52, 8], [56, 44, 7], [62, 64, 6], [42, 66, 5]].map(([x, y, r]) =>
      `<path d="M${x} ${y - r} l${r} ${r * 0.7} l-${r * 0.4} ${r} h-${r * 1.2} l-${r * 0.4} -${r}Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="2"/>`).join('')
    + spec(32, 48, 7, 0.4) + twinkle(76, 34, 6),
  prism: c => [0, 1, 2, 3].map(i => `<path d="M56 46 L${92} ${28 + i * 13}" stroke="${['#ff8ac0', '#ffd45e', '#8ce0ff', '#9fe0a8'][i]}" stroke-width="5" stroke-linecap="round" opacity=".8"/>`).join('')
    + `<path d="M10 40 L44 46" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`
    + `<polygon points="50,12 78,66 22,66" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<polygon points="50,12 64,66 36,66" fill="#fff" opacity=".35"/>`
    + `<path d="M22 66 h56" stroke="${c.m.rim}" stroke-width="3" opacity=".6"/>` + twinkle(84, 20, 7),

  /* ---- liquid & vessels ---- */
  droplet: c => solid(c, 'M50 16 q18 26 18 38 a18 18 0 0 1 -36 0 q0 -12 18 -38Z') + spec(43, 48, 7, 0.7),
  bubble: c => `<circle cx="50" cy="52" r="30" fill="${rg(c, [[0, c.m.hi + 'cc'], [0.7, c.m.base + '77'], [1, c.m.lo + 'aa']], 0.34, 0.3, 0.9)}" stroke="${c.m.rim}" stroke-width="2.6"/>`
    + spec(40, 40, 9, 0.8) + spec(62, 64, 4, 0.5),
  jar: c => `<path d="M32 34 h36 l5 40 a12 12 0 0 1 -12 13 h-22 a12 12 0 0 1 -12 -13Z" fill="${lg(c, [[0, R('glass').hi], [1, R('glass').base]])}" stroke="${R('glass').line}" stroke-width="2.6"/>`
    + `<path d="M31 50 h38 l3 24 a12 12 0 0 1 -12 13 h-22 a12 12 0 0 1 -12 -13Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="2.4"/>`
    + `<rect x="28" y="22" width="44" height="14" rx="7" fill="${lg(c, [[0, c.a.hi], [1, c.a.lo]])}" stroke="${c.a.line}" stroke-width="2.6"/>`
    + `<rect x="34" y="40" width="7" height="40" rx="3.5" fill="#fff" opacity=".4"/>`,
  bottle: c => `<path d="M42 16 h16 v14 q14 10 14 26 v24 a10 10 0 0 1 -10 10 h-24 a10 10 0 0 1 -10 -10 v-24 q0 -16 14 -26Z" fill="${lg(c, [[0, R('glass').hi], [1, R('glass').base]])}" stroke="${R('glass').line}" stroke-width="2.6"/>`
    + `<path d="M34 58 h32 v22 a10 10 0 0 1 -10 10 h-12 a10 10 0 0 1 -10 -10Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.lo]])}"/>`
    + `<rect x="40" y="10" width="20" height="10" rx="5" fill="${c.a.base}" stroke="${c.a.line}" stroke-width="2.4"/>`
    + `<rect x="38" y="30" width="6" height="46" rx="3" fill="#fff" opacity=".4"/>`,
  flask: c => `<path d="M40 14 h20 v24 l18 32 a12 12 0 0 1 -11 18 h-34 a12 12 0 0 1 -11 -18Z" fill="${lg(c, [[0, R('glass').hi], [1, R('glass').base]])}" stroke="${R('glass').line}" stroke-width="2.6"/>`
    + `<path d="M33 60 h34 l10 16 a10 10 0 0 1 -9 12 h-36 a10 10 0 0 1 -9 -12Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.lo]])}"/>`
    + `<rect x="36" y="8" width="28" height="10" rx="5" fill="${c.a.base}" stroke="${c.a.line}" stroke-width="2.4"/>`
    + `<circle cx="44" cy="76" r="4" fill="#fff" opacity=".55"/><circle cx="58" cy="70" r="3" fill="#fff" opacity=".45"/>`,
  barrel: c => `<rect x="18" y="28" width="64" height="56" rx="18" fill="${lg(c, [[0, c.m.hi], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<rect x="16" y="40" width="68" height="8" rx="4" fill="${c.a.base}" stroke="${c.a.line}" stroke-width="2"/>`
    + `<rect x="16" y="64" width="68" height="8" rx="4" fill="${c.a.base}" stroke="${c.a.line}" stroke-width="2"/>`
    + `<path d="M34 28 v56 M66 28 v56" stroke="${c.m.deep}" stroke-width="2" opacity=".3"/>`
    + `<ellipse cx="50" cy="30" rx="32" ry="9" fill="${c.m.hi}" stroke="${c.m.line}" stroke-width="2.6"/>`,
  wave: c => solid(c, 'M10 56 q12 -22 28 -10 q14 10 22 -6 q10 -18 30 -2 v42 q-40 12 -80 0Z')
    + `<path d="M14 66 q16 -10 30 0 q14 10 28 -2" stroke="#fff" stroke-width="3.4" fill="none" opacity=".55" stroke-linecap="round"/>`
    + `<path d="M18 78 q16 -8 30 0 q14 8 26 -2" stroke="#fff" stroke-width="2.6" fill="none" opacity=".35" stroke-linecap="round"/>`
    + `<circle cx="34" cy="50" r="4" fill="#fff" opacity=".6"/><circle cx="66" cy="44" r="3" fill="#fff" opacity=".5"/>`
    + spec(30, 48, 7, 0.45),
  ice: c => `<polygon points="50,10 72,30 66,66 34,66 28,30" fill="${lg(c, [[0, '#ffffff'], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="2.8"/>`
    + `<polygon points="50,10 60,30 50,46 40,30" fill="#fff" opacity=".7"/>`
    + `<path d="M28 30 h44" stroke="#fff" stroke-width="2.4" opacity=".6"/>` + twinkle(78, 22, 8, '#eafcff'),
  snowflake: c => [0, 60, 120].map(a =>
    `<g transform="rotate(${a} 50 50)"><path d="M50 12 v76" stroke="${c.m.base}" stroke-width="6" stroke-linecap="round"/>
      <path d="M50 26 l-12 -10 M50 26 l12 -10 M50 74 l-12 10 M50 74 l12 10" stroke="${c.m.base}" stroke-width="5" stroke-linecap="round" fill="none"/></g>`).join('')
    + `<circle cx="50" cy="50" r="8" fill="${c.m.hi}" stroke="${c.m.line}" stroke-width="2.4"/>` + twinkle(80, 22, 7, '#eafcff'),

  /* ---- fire ---- */
  ember: c => solid(c, 'M50 18 q18 22 14 38 q-3 16 -14 22 q-11 -6 -14 -22 q-4 -16 14 -38Z')
    + `<path d="M50 38 q8 12 6 22 q-2 9 -6 12 q-4 -3 -6 -12 q-2 -10 6 -22Z" fill="#fff8d0" opacity=".85"/>` + twinkle(76, 28, 7),
  flame: c => solid(c, 'M50 10 q22 24 20 44 q-2 22 -20 28 q-18 -6 -20 -28 q-2 -20 20 -44Z')
    + solid(c, 'M50 32 q12 16 11 28 q-1 12 -11 16 q-10 -4 -11 -16 q-1 -12 11 -28Z', { m: R('star'), line: 0 })
    + twinkle(78, 24, 8) + twinkle(22, 40, 5),
  coal: c => solid(c, 'M22 70 q-8 -24 16 -30 q26 -6 36 10 q10 18 -10 26 q-26 12 -42 -6Z', { m: R('obsidian') })
    + `<path d="M36 58 q6 -10 16 -8 q10 2 10 10 q-2 8 -14 8 q-12 0 -12 -10Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}"/>`
    + `<circle cx="66" cy="50" r="4" fill="${c.m.hi}" opacity=".8"/>` + twinkle(78, 30, 6),
  lantern: c => `<path d="M40 16 h20 v8 h-20Z" fill="${R('iron').base}" stroke="${R('iron').line}" stroke-width="2.4"/>`
    + `<path d="M34 24 h32 l6 46 h-44Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${R('iron').line}" stroke-width="3"/>`
    + `<ellipse cx="50" cy="50" rx="12" ry="16" fill="${R('star').hi}" opacity=".9"/>`
    + `<rect x="26" y="68" width="48" height="10" rx="5" fill="${R('iron').base}" stroke="${R('iron').line}" stroke-width="2.4"/>`
    + `<path d="M50 6 q-14 4 -14 12" stroke="${R('iron').base}" stroke-width="3.4" fill="none"/>` + twinkle(78, 40, 7),

  /* ---- food ---- */
  berry: c => circleSolid(c, 38, 62, 17) + circleSolid(c, 62, 58, 20)
    + spec(56, 48, 7, 0.7) + spec(33, 55, 5, 0.6)
    + `<path d="M62 36 q-2 -14 8 -20" stroke="${R('vine').base}" stroke-width="5" fill="none" stroke-linecap="round"/>`
    + solid(c, 'M80 24 q-12 0 -16 -8 q14 -4 16 8Z', { m: R('leaf'), line: 2 }),
  berrycluster: c => [[32, 64, 14], [58, 70, 15], [46, 48, 15], [72, 50, 14], [60, 30, 12]].map(
    ([x, y, r]) => circleSolid(c, x, y, r)).join('')
    + spec(42, 41, 5, 0.7) + spec(68, 44, 4.5, 0.6)
    + solid(c, 'M30 26 q-12 0 -14 -8 q12 -4 14 8Z', { m: R('leaf'), line: 2 }),
  fruit: c => circleSolid(c, 50, 56, 28)
    + `<path d="M50 30 q-3 -14 6 -20" stroke="${R('bark').base}" stroke-width="5" fill="none" stroke-linecap="round"/>`
    + solid(c, 'M72 18 q-14 2 -18 -8 q16 -6 18 8Z', { m: R('leaf'), line: 2 }) + spec(40, 44, 9),
  grain: c => `<path d="M50 88 q-2 -34 0 -50" stroke="${R('straw').lo}" stroke-width="6" fill="none" stroke-linecap="round"/>`
    + [0, 1, 2, 3].map(i => {
      const g = lg(c, [[0, c.m.hi], [1, c.m.base]]);
      const yl = 56 - i * 12, yr = 50 - i * 12;
      return `<ellipse cx="42" cy="${yl}" rx="8" ry="6" fill="${g}" stroke="${c.m.line}" stroke-width="2" transform="rotate(-28 42 ${yl})"/>`
        + `<ellipse cx="58" cy="${yr}" rx="8" ry="6" fill="${g}" stroke="${c.m.line}" stroke-width="2" transform="rotate(28 58 ${yr})"/>`;
    }).join(''),
  bread: c => solid(c, 'M16 68 q0 -30 34 -30 q34 0 34 30 q0 12 -34 12 q-34 0 -34 -12Z')
    + `<path d="M30 46 q8 10 0 20 M50 42 q8 12 0 24 M70 46 q8 10 0 20" stroke="${c.m.deep}" stroke-width="3" fill="none" opacity=".45"/>`
    + spec(34, 48, 8, 0.45),
  pie: c => `<ellipse cx="50" cy="66" rx="40" ry="18" fill="${lg(c, [[0, c.a.hi], [1, c.a.lo]])}" stroke="${c.a.line}" stroke-width="3"/>`
    + `<ellipse cx="50" cy="58" rx="34" ry="15" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="2.6"/>`
    + `<path d="M24 56 q26 -12 52 0 M30 66 q20 -10 40 0 M40 46 q6 20 6 24 M58 46 q-4 20 -4 24" stroke="${c.a.hi}" stroke-width="6" fill="none" stroke-linecap="round"/>`
    + spec(34, 54, 7, 0.4),
  cake: c => `<rect x="20" y="56" width="60" height="24" rx="10" fill="${lg(c, [[0, c.a.hi], [1, c.a.base]])}" stroke="${c.a.line}" stroke-width="2.6"/>`
    + `<rect x="27" y="36" width="46" height="24" rx="10" fill="${lg(c, [[0, c.a.hi], [1, c.a.base]])}" stroke="${c.a.line}" stroke-width="2.6"/>`
    + `<path d="M20 58 q8 10 16 0 q8 10 16 0 q8 10 16 0 q6 8 12 0 v6 a8 8 0 0 1 -8 8 h-44 a8 8 0 0 1 -8 -8Z" fill="${c.m.base}"/>`
    + `<path d="M27 38 q7 9 14 0 q7 9 14 0 q7 9 14 0 v5 a8 8 0 0 1 -8 8 h-26 a8 8 0 0 1 -8 -8Z" fill="${c.m.base}"/>`
    + `<circle cx="38" cy="34" r="6" fill="${c.m.lo}"/><circle cx="50" cy="30" r="7" fill="${c.m.lo}"/><circle cx="62" cy="34" r="6" fill="${c.m.lo}"/>`
    + spec(34, 62, 6, 0.4),
  honey: c => `<path d="M50 14 l26 15 v30 l-26 15 -26 -15 v-30Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + [[42, 40], [58, 40], [50, 54], [42, 68], [58, 68]].map(([x, y]) =>
      `<path d="M${x} ${y - 7} l6 3.5 v7 l-6 3.5 -6 -3.5 v-7Z" fill="${c.m.lo}" opacity=".55"/>`).join('')
    + spec(38, 32, 7, 0.5),
  cheese: c => `<path d="M14 74 l26 -34 h46 v22 l-12 12Z" fill="${lg(c, [[0, c.m.base], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<path d="M14 74 l26 -34 h46 l-12 12 -14 22Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + [[34, 64, 5], [52, 58, 6.5], [66, 68, 4]].map(([x, y, r]) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.m.deep}" opacity=".45"/><circle cx="${x}" cy="${y - 1}" r="${r - 1.5}" fill="${c.m.lo}" opacity=".8"/>`).join('')
    + spec(38, 50, 7, 0.4),
  candy: c => `<circle cx="50" cy="50" r="24" fill="${rg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + [0, 60, 120].map(a => `<path d="M50 26 q10 24 0 48" stroke="${c.a.base}" stroke-width="7" fill="none" transform="rotate(${a} 50 50)" opacity=".85"/>`).join('')
    + `<path d="M26 50 q-16 -12 -18 2 q16 12 18 -2Z M74 50 q16 -12 18 2 q-16 12 -18 -2Z" fill="${c.a.base}" stroke="${c.a.line}" stroke-width="2.4"/>`
    + spec(42, 40, 7),
  soup: c => `<path d="M38 26 q6 -10 0 -18 M50 22 q7 -11 0 -20 M62 26 q6 -10 0 -18" stroke="${c.m.hi}" stroke-width="4" fill="none" opacity=".8" stroke-linecap="round"/>`
    + solid(c, 'M16 48 q0 36 34 36 q34 0 34 -36Z', { m: c.a })          // the bowl
    + `<ellipse cx="50" cy="48" rx="34" ry="11" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="2.8"/>`
    + `<ellipse cx="44" cy="46" rx="7" ry="3" fill="${c.m.hi}" opacity=".7"/>`
    + `<path d="M12 52 q-6 8 4 12" stroke="${c.a.line}" stroke-width="5" fill="none" stroke-linecap="round"/>`
    + `<path d="M88 52 q6 8 -4 12" stroke="${c.a.line}" stroke-width="5" fill="none" stroke-linecap="round"/>`
    + spec(34, 60, 7, 0.32),

  /* ---- craft & tools ---- */
  rope: c => [0, 1, 2].map(i => {
    const y = 36 + i * 16;
    return `<path d="M14 ${y} q18 -14 36 0 q18 14 36 0" stroke="${c.m.line}" stroke-width="15" fill="none" stroke-linecap="round"/>`
      + `<path d="M14 ${y} q18 -14 36 0 q18 14 36 0" stroke="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke-width="11" fill="none" stroke-linecap="round"/>`
      + [0, 1, 2, 3, 4, 5].map(k => `<path d="M${18 + k * 13} ${y - 6} l6 12" stroke="${c.m.deep}" stroke-width="2.4" opacity=".45" stroke-linecap="round"/>`).join('');
  }).join('') + spec(28, 32, 6, 0.35),
  cloth: c => solid(c, 'M16 24 q18 -8 34 0 q18 8 34 0 v44 q-14 14 -34 4 q-20 -10 -34 4Z')
    + `<path d="M30 26 q4 24 -2 46 M50 28 q4 24 0 46 M70 26 q-4 24 2 44" stroke="${c.m.deep}" stroke-width="2.6" opacity=".35" fill="none"/>`
    + `<path d="M16 24 q18 -8 34 0 q18 8 34 0" stroke="${c.m.rim}" stroke-width="4" fill="none" opacity=".55"/>`
    + spec(32, 36, 8, 0.35),
  sack: c => solid(c, 'M28 36 q22 -10 44 0 q10 26 4 44 a10 10 0 0 1 -10 6 h-32 a10 10 0 0 1 -10 -6 q-6 -18 4 -44Z')
    + `<path d="M30 34 q20 -12 40 0" stroke="${c.a.base}" stroke-width="7" fill="none" stroke-linecap="round"/>`
    + `<circle cx="50" cy="60" r="10" fill="${c.a.base}" opacity=".7"/>` + spec(38, 48, 7, 0.4),
  basket: c => `<path d="M20 44 h60 l-7 34 a10 10 0 0 1 -10 8 h-26 a10 10 0 0 1 -10 -8Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<path d="M28 52 h44 M30 64 h40" stroke="${c.m.deep}" stroke-width="2.4" opacity=".4"/>`
    + `<path d="M32 44 q18 -26 36 0" stroke="${c.m.base}" stroke-width="6" fill="none"/>`
    + `<ellipse cx="50" cy="44" rx="30" ry="7" fill="${c.m.hi}" stroke="${c.m.line}" stroke-width="2.6"/>`,
  crate: c => `<rect x="16" y="30" width="68" height="54" rx="9" fill="${lg(c, [[0, c.m.hi], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<path d="M16 46 h68 M16 66 h68 M40 30 v54 M62 30 v54" stroke="${c.m.deep}" stroke-width="3" opacity=".45"/>`
    + `<rect x="20" y="33" width="60" height="6" rx="3" fill="#fff" opacity=".25"/>`,
  chest: c => `<rect x="16" y="46" width="68" height="36" rx="8" fill="${lg(c, [[0, c.m.hi], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<path d="M16 46 q0 -22 34 -22 q34 0 34 22Z" fill="${lg(c, [[0, c.m.base], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<rect x="14" y="42" width="72" height="9" rx="4" fill="${c.a.base}" stroke="${c.a.line}" stroke-width="2.4"/>`
    + `<rect x="42" y="50" width="16" height="18" rx="5" fill="${c.a.hi}" stroke="${c.a.line}" stroke-width="2.4"/>`
    + `<circle cx="50" cy="58" r="3.4" fill="${c.a.line}"/>` + twinkle(80, 30, 7),
  pot: c => `<path d="M20 48 q-12 10 0 20 M80 48 q12 10 0 20" stroke="${c.m.line}" stroke-width="9" fill="none" stroke-linecap="round"/>`
    + `<path d="M22 40 h56 l-6 34 a13 13 0 0 1 -13 11 h-18 a13 13 0 0 1 -13 -11Z" fill="${lg(c, [[0, c.m.hi], [0.5, c.m.base], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<path d="M26 58 q24 8 48 0" stroke="${c.m.deep}" stroke-width="3" fill="none" opacity=".35"/>`
    + `<ellipse cx="50" cy="40" rx="29" ry="9" fill="${c.a.hi}" stroke="${c.m.line}" stroke-width="2.8"/>`
    + `<ellipse cx="50" cy="40" rx="20" ry="5" fill="${c.a.base}" opacity=".7"/>`
    + spec(34, 52, 7, 0.45),
  key: c => `<circle cx="32" cy="38" r="16" fill="none" stroke="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke-width="9"/>`
    + `<circle cx="32" cy="38" r="16" fill="none" stroke="${c.m.rim}" stroke-width="2.4" opacity=".5"/>`
    + `<path d="M43 49 L76 82" stroke="${c.m.base}" stroke-width="9" stroke-linecap="round"/>`
    + `<path d="M64 70 l10 -10 M72 78 l10 -10" stroke="${c.m.base}" stroke-width="8" stroke-linecap="round"/>` + twinkle(24, 24, 6),
  cog: c => [0, 45, 90, 135].map(a => `<rect x="43" y="8" width="14" height="84" rx="5" fill="${c.m.base}" stroke="${c.m.line}" stroke-width="2.4" transform="rotate(${a} 50 50)"/>`).join('')
    + circleSolid(c, 50, 50, 26) + `<circle cx="50" cy="50" r="10" fill="${c.m.deep}"/>` + spec(42, 42, 7),
  bell: c => `<path d="M26 70 q0 -44 24 -46 q24 2 24 46Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<rect x="20" y="68" width="60" height="9" rx="4.5" fill="${c.m.base}" stroke="${c.m.line}" stroke-width="2.4"/>`
    + `<circle cx="50" cy="82" r="7" fill="${c.m.lo}" stroke="${c.m.line}" stroke-width="2.4"/>`
    + `<circle cx="50" cy="20" r="5" fill="${c.a.base}" stroke="${c.m.line}" stroke-width="2.4"/>` + spec(38, 42, 7),
  scroll: c => `<rect x="24" y="22" width="52" height="56" rx="6" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="2.6"/>`
    + `<path d="M34 36 h32 M34 48 h32 M34 60 h22" stroke="${c.m.deep}" stroke-width="3" opacity=".5" stroke-linecap="round"/>`
    + `<rect x="18" y="16" width="64" height="12" rx="6" fill="${c.a.base}" stroke="${c.a.line}" stroke-width="2.6"/>`
    + `<rect x="18" y="72" width="64" height="12" rx="6" fill="${c.a.base}" stroke="${c.a.line}" stroke-width="2.6"/>`,
  compass: c => circleSolid(c, 50, 50, 32, c.a)
    + `<circle cx="50" cy="50" r="24" fill="${c.m.hi}" stroke="${c.m.line}" stroke-width="2.4"/>`
    + `<polygon points="50,28 57,50 50,72 43,50" fill="${R('ruby').base}" stroke="${c.m.line}" stroke-width="2"/>`
    + `<polygon points="50,50 57,50 50,72 43,50" fill="${R('silver').hi}"/>`
    + `<circle cx="50" cy="50" r="4" fill="${c.m.line}"/>` + twinkle(78, 24, 7),

  /* ---- sky, sea, creatures ---- */
  star: c => `<circle cx="50" cy="50" r="34" fill="${c.m.hi}" opacity=".22"/>`
    + `<polygon points="50,8 61,38 92,42 68,62 76,92 50,74 24,92 32,62 8,42 39,38" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<polygon points="50,24 57,43 74,45 60,56 65,74 50,63 35,74 40,56 26,45 43,43" fill="#fff" opacity=".55"/>`
    + twinkle(86, 18, 8),
  moon: c => circleSolid(c, 50, 50, 32)
    + [[38, 40, 7], [62, 60, 5], [60, 34, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.m.lo}" opacity=".6"/>`).join('')
    + spec(38, 34, 9),
  /* A plain glowing sphere. The ringed version is `planet` — a ring round a
     ball of yarn or a pot of royal jelly looked ridiculous. */
  orb: c => `<circle cx="50" cy="50" r="40" fill="${c.m.hi}" opacity=".22"/>` + circleSolid(c, 50, 50, 30)
    + `<circle cx="50" cy="50" r="30" fill="${rg(c, [[0.55, c.a.hi + '00'], [1, c.a.hi + '66']], 0.5, 0.5, 0.5)}"/>`
    + spec(40, 38, 9) + twinkle(84, 20, 7),
  planet: c => `<circle cx="50" cy="50" r="38" fill="${c.m.hi}" opacity=".2"/>` + circleSolid(c, 50, 50, 28)
    + `<ellipse cx="50" cy="52" rx="42" ry="12" fill="none" stroke="${c.a.base}" stroke-width="5" transform="rotate(-18 50 52)"/>`
    + `<ellipse cx="50" cy="52" rx="42" ry="12" fill="none" stroke="${c.a.rim}" stroke-width="1.8" opacity=".7" transform="rotate(-18 50 52)"/>`
    + spec(40, 38, 8) + twinkle(84, 20, 8),
  comet: c => `<path d="M72 30 L20 74" stroke="${c.a.base}" stroke-width="14" stroke-linecap="round" opacity=".55"/>`
    + `<path d="M76 26 L34 66" stroke="${c.a.hi}" stroke-width="7" stroke-linecap="round" opacity=".7"/>`
    + circleSolid(c, 70, 32, 18) + spec(63, 26, 6) + twinkle(26, 70, 6),
  cloud: c => circleSolid(c, 32, 58, 18) + circleSolid(c, 68, 58, 18) + circleSolid(c, 50, 46, 24)
    + spec(40, 38, 8, 0.6),
  shell: c => `<path d="M50 82 q-34 -6 -34 -34 q0 -28 34 -28 q34 0 34 28 q0 28 -34 34Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + [(-30), -15, 0, 15, 30].map(a => `<path d="M50 82 q-2 -40 0 -62" stroke="${c.m.lo}" stroke-width="3" fill="none" opacity=".5" transform="rotate(${a} 50 82)"/>`).join('')
    + spec(40, 34, 7),
  spiral: c => `<path d="M50 84 q-34 -4 -34 -34 q0 -28 32 -28 q26 0 26 24 q0 19 -19 19 q-15 0 -15 -13 q0 -10 10 -10"
      fill="none" stroke="${c.m.line}" stroke-width="16" stroke-linecap="round"/>`
    + `<path d="M50 84 q-34 -4 -34 -34 q0 -28 32 -28 q26 0 26 24 q0 19 -19 19 q-15 0 -15 -13 q0 -10 10 -10"
      fill="none" stroke="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke-width="11" stroke-linecap="round"/>`
    + `<path d="M50 84 q-34 -4 -34 -34 q0 -28 32 -28" fill="none" stroke="${c.m.rim}" stroke-width="3" opacity=".6" stroke-linecap="round"/>`
    + spec(30, 40, 5, 0.4),
  pearl: c => `<circle cx="50" cy="50" r="34" fill="${c.a.hi}" opacity=".25"/>` + circleSolid(c, 50, 50, 26)
    + spec(41, 40, 10, 0.85) + spec(60, 60, 4, 0.5) + twinkle(80, 24, 7),
  coral: c => {
    // a trunk that forks twice — outlined, so it reads as coral and not cutlery
    const limb = 'M50 86 q-2 -18 -1 -26 q-8 -8 -13 -16 M49 60 q9 -8 13 -17 M50 86 q2 -14 1 -22';
    return `<path d="${limb}" stroke="${c.m.line}" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<path d="${limb}" stroke="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      + [[36, 42], [62, 41], [50, 58]].map(([x, y], i) =>
        `<circle cx="${x}" cy="${y}" r="${i === 2 ? 6.5 : 8.5}" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="3"/>`
        + `<circle cx="${x - 2}" cy="${y - 2.5}" r="2.4" fill="#fff" opacity=".5"/>`).join('')
      + [[42, 70], [58, 72]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${c.a.base}" stroke="${c.m.line}" stroke-width="2"/>`).join('');
  },
  fish: c => `<path d="M70 50 q-20 -24 -42 -6 q-12 10 0 20 q22 18 42 -14Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<path d="M70 50 q14 -16 20 -4 q-6 16 -20 4Z" fill="${c.a.base}" stroke="${c.m.line}" stroke-width="2.6"/>`
    + `<circle cx="38" cy="44" r="4.5" fill="#fff"/><circle cx="37" cy="44" r="2.4" fill="#25324a"/>`
    + `<path d="M46 56 q10 8 20 0" stroke="${c.m.lo}" stroke-width="2.6" fill="none" opacity=".6"/>`,
  egg: c => solid(c, 'M50 16 q22 16 22 38 q0 24 -22 28 q-22 -4 -22 -28 q0 -22 22 -38Z')
    + [[40, 48, 5], [58, 56, 4], [50, 66, 4.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.a.base}" opacity=".7"/>`).join('')
    + spec(42, 38, 8),
  cocoon: c => solid(c, 'M50 14 q20 18 20 40 q0 24 -20 30 q-20 -6 -20 -30 q0 -22 20 -40Z')
    + [0, 1, 2, 3].map(i => `<path d="M31 ${36 + i * 12} q19 8 38 0" stroke="${c.m.rim}" stroke-width="3" fill="none" opacity=".55"/>`).join('')
    + spec(40, 34, 7),
  feather: c => `<path d="M60 14 q18 26 2 50 q-12 18 -26 22 q4 -22 6 -34 q4 -22 18 -38Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="2.8"/>`
    + `<path d="M60 16 q-16 30 -24 68" stroke="${c.m.deep}" stroke-width="2.6" fill="none" opacity=".5"/>`
    + [0, 1, 2, 3, 4].map(i => `<path d="M${54 - i * 3} ${28 + i * 10} l12 -4" stroke="${c.m.rim}" stroke-width="2" opacity=".5"/>`).join(''),
  bone: c => {
    // classic four-knob bone, drawn as one silhouette so the knobs weld to the shaft
    const knob = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="11"/>`;
    const body = `<g>${knob(30, 32)}${knob(30, 54)}${knob(70, 46)}${knob(70, 68)}`
      + `<path d="M28 38 L68 52 L72 62 L32 48Z"/><rect x="26" y="36" width="48" height="16" rx="8" transform="rotate(19 50 44)"/></g>`;
    const g = lg(c, [[0, c.m.hi], [0.5, c.m.base], [1, c.m.lo]]);
    return `<g fill="${c.m.line}" stroke="${c.m.line}" stroke-width="6" stroke-linejoin="round">${body}</g>`
      + `<g fill="${g}">${body}</g>`
      + spec(32, 30, 5, 0.55);
  },
  fossil: c => circleSolid(c, 50, 52, 30, c.a)
    + `<path d="M50 76 q-20 -4 -20 -22 q0 -16 18 -16 q14 0 14 13 q0 11 -11 11 q-8 0 -8 -7"
      fill="none" stroke="${c.m.base}" stroke-width="7" stroke-linecap="round"/>` + spec(38, 38, 8, 0.4),
  mushroom: c => `<rect x="41" y="48" width="18" height="34" rx="9" fill="${lg(c, [[0, c.a.hi], [1, c.a.base]])}" stroke="${c.a.line}" stroke-width="2.6"/>`
    + `<path d="M14 50 q6 -32 36 -32 q30 0 36 32Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + [[30, 36, 6], [52, 28, 7], [70, 38, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".65"/>`).join('')
    + `<ellipse cx="50" cy="50" rx="36" ry="6" fill="${c.m.lo}" opacity=".5"/>`,
  slime: c => solid(c, 'M50 24 q30 6 30 34 q0 22 -30 24 q-30 -2 -30 -24 q0 -28 30 -34Z')
    + `<circle cx="41" cy="50" r="6" fill="#fff"/><circle cx="59" cy="50" r="6" fill="#fff"/>`
    + `<circle cx="42" cy="51" r="3" fill="#25324a"/><circle cx="60" cy="51" r="3" fill="#25324a"/>`
    + `<path d="M43 64 q7 6 14 0" stroke="${c.m.deep}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`
    + spec(38, 36, 8, 0.7),
  totem: c => `<rect x="30" y="20" width="40" height="62" rx="10" fill="${lg(c, [[0, c.m.hi], [1, c.m.lo]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<circle cx="42" cy="40" r="5" fill="${c.a.base}"/><circle cx="58" cy="40" r="5" fill="${c.a.base}"/>`
    + `<path d="M40 56 q10 8 20 0" stroke="${c.a.base}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    + `<path d="M24 26 h52 M24 74 h52" stroke="${c.a.base}" stroke-width="5" stroke-linecap="round"/>` + twinkle(80, 24, 7),
  mask: c => solid(c, 'M50 16 q26 4 26 30 q0 32 -26 40 q-26 -8 -26 -40 q0 -26 26 -30Z')
    + `<path d="M34 42 q8 -8 16 0 M50 42 q8 -8 16 0" stroke="${c.a.base}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    + `<path d="M40 64 q10 8 20 0" stroke="${c.a.base}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    + `<path d="M50 20 v60" stroke="${c.m.deep}" stroke-width="2" opacity=".3"/>` + spec(40, 34, 7),
  crown: c => `<path d="M18 70 l4 -40 16 16 12 -26 12 26 16 -16 4 40Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<rect x="16" y="68" width="68" height="12" rx="6" fill="${c.m.base}" stroke="${c.m.line}" stroke-width="2.6"/>`
    + [[30, 74], [50, 74], [70, 74]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${c.a.base}"/>`).join('')
    + twinkle(84, 22, 8) + twinkle(18, 30, 6),

  /* --- built things: the grand finale of a chain usually wants one of these --- */
  house: c => solid(c, 'M22 52 L50 28 L78 52 v30 q0 4 -4 4 H26 q-4 0 -4 -4Z')
    + `<path d="M16 54 L50 24 L84 54" fill="none" stroke="${c.a.line}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="M16 54 L50 24 L84 54" fill="none" stroke="${c.a.base}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<rect x="42" y="62" width="16" height="24" rx="3" fill="${c.a.lo}" stroke="${c.m.line}" stroke-width="2.6"/>`
    + `<circle cx="32" cy="64" r="6" fill="${c.a.hi}" stroke="${c.m.line}" stroke-width="2.6"/>`
    + `<circle cx="68" cy="64" r="6" fill="${c.a.hi}" stroke="${c.m.line}" stroke-width="2.6"/>` + spec(30, 52, 5, 0.3),
  tower: c => solid(c, 'M30 86 V40 q0 -14 20 -14 q20 0 20 14 v46Z')
    + `<path d="M22 40 L50 14 L78 40Z" fill="${lg(c, [[0, c.a.hi], [1, c.a.base]])}" stroke="${c.m.line}" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M40 60 q10 -12 20 0 v16 h-20Z" fill="${c.a.lo}" stroke="${c.m.line}" stroke-width="2.6"/>`
    + `<rect x="28" y="40" width="44" height="7" rx="3.5" fill="${c.a.base}" stroke="${c.m.line}" stroke-width="2.4"/>`
    + twinkle(80, 20, 6) + spec(38, 48, 5, 0.3),
  arch: c => solid(c, 'M12 88 V40 q0 -24 38 -24 q38 0 38 24 v48 h-20 V44 q0 -12 -18 -12 q-18 0 -18 12 v44Z')
    + `<path d="M12 40 h76" stroke="${c.m.deep}" stroke-width="2" opacity=".28"/>`
    + [30, 52].map(y => `<path d="M12 ${y} h20 M68 ${y} h20" stroke="${c.m.deep}" stroke-width="2" opacity=".24"/>`).join('')
    + `<path d="M8 88 h84 v-8 q0 -4 -6 -4 H14 q-6 0 -6 4Z" fill="${lg(c, [[0, c.a.hi], [1, c.a.base]])}" stroke="${c.m.line}" stroke-width="2.8"/>`
    + `<circle cx="50" cy="26" r="6" fill="${c.a.hi}" stroke="${c.m.line}" stroke-width="2.4"/>` + spec(24, 46, 6, 0.3),
  book: c => solid(c, 'M18 26 q16 -8 32 0 q16 -8 32 0 v52 q-16 -8 -32 0 q-16 -8 -32 0Z')
    + `<path d="M50 26 v52" stroke="${c.m.line}" stroke-width="3"/>`
    + [36, 46, 56].map(y => `<path d="M26 ${y} q12 -5 20 -1 M54 ${y - 1} q10 -4 20 1" stroke="${c.a.base}" stroke-width="2.6" fill="none" opacity=".75" stroke-linecap="round"/>`).join('')
    + spec(32, 34, 6, 0.3),
  boat: c => solid(c, 'M12 62 h76 q-6 22 -38 22 q-32 0 -38 -22Z')
    + `<path d="M48 60 V18 L76 40 L48 46" fill="${lg(c, [[0, c.a.hi], [1, c.a.base]])}" stroke="${c.m.line}" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M46 62 V16" stroke="${c.m.line}" stroke-width="4" stroke-linecap="round"/>` + spec(30, 68, 7, 0.3),
  balloon: c => `<path d="M50 60 q-24 -14 -24 -30 q0 -18 24 -18 q24 0 24 18 q0 16 -24 30Z" fill="${rg(c, [[0, c.m.hi], [0.6, c.m.base], [1, c.m.lo]], 0.34, 0.26, 0.88)}" stroke="${c.m.line}" stroke-width="3"/>`
    + `<path d="M44 58 h12 l-3 8 h-6Z" fill="${c.a.base}" stroke="${c.m.line}" stroke-width="2.4"/>`
    + `<path d="M50 66 v8" stroke="${c.m.line}" stroke-width="2.4"/>`
    + `<path d="M38 78 h24 v10 h-24Z" fill="${lg(c, [[0, c.a.hi], [1, c.a.lo]])}" stroke="${c.m.line}" stroke-width="2.6"/>`
    + `<path d="M40 78 L44 68 M60 78 L56 68" stroke="${c.m.line}" stroke-width="2.2"/>` + spec(38, 28, 8, 0.5),
  anvil: c => solid(c, 'M14 44 h58 q14 0 14 10 q-10 0 -14 6 H60 v10 H40 v10 h26 v8 H34 v-8 h6 V60 H26 q-6 -6 -12 -6Z')
    + spec(34, 48, 7, 0.32),
  ring: c => `<circle cx="50" cy="58" r="24" fill="none" stroke="${c.m.line}" stroke-width="13"/>`
    + `<circle cx="50" cy="58" r="24" fill="none" stroke="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke-width="9"/>`
    + `<path d="M40 34 L50 20 L60 34Z" fill="${c.m.base}" stroke="${c.m.line}" stroke-width="2.6"/>`
    + `<path d="M50 12 l9 12 -9 12 -9 -12Z" fill="${lg(c, [[0, c.a.hi], [1, c.a.base]])}" stroke="${c.m.line}" stroke-width="2.6"/>`
    + spec(38, 46, 5, 0.5) + twinkle(76, 20, 6),
  bird: c => `<path d="M62 36 q20 -6 22 6 q-8 6 -20 4Z" fill="${c.a.base}" stroke="${c.m.line}" stroke-width="2.6" stroke-linejoin="round"/>`
    + solid(c, 'M60 44 q4 -20 -12 -22 q-20 -2 -22 22 q-2 22 16 26 q22 4 24 -14 q1 -8 -6 -12Z')
    + `<path d="M28 48 q14 -6 24 8 q-12 14 -24 2Z" fill="${lg(c, [[0, c.a.hi], [1, c.a.base]])}" stroke="${c.m.line}" stroke-width="2.6"/>`
    + `<path d="M26 66 q-16 6 -18 18 q16 -2 22 -10Z" fill="${c.a.base}" stroke="${c.m.line}" stroke-width="2.6" stroke-linejoin="round"/>`
    + `<circle cx="52" cy="34" r="3.4" fill="#25324a"/><circle cx="53.2" cy="33" r="1.2" fill="#fff"/>`
    + `<path d="M66 36 l10 3 -10 3Z" fill="${R('gold').base}" stroke="${R('gold').line}" stroke-width="1.6"/>`
    + `<path d="M40 82 v8 M56 82 v8" stroke="${R('gold').base}" stroke-width="3.4" stroke-linecap="round"/>`,
  butterfly: c => {
    const wing = (sx: number) => `<g transform="translate(50 52) scale(${sx} 1)">`
      + `<path d="M2 -4 q22 -26 32 -8 q8 16 -12 20 q-16 3 -20 -4Z" fill="${lg(c, [[0, c.m.hi], [1, c.m.base]])}" stroke="${c.m.line}" stroke-width="3" stroke-linejoin="round"/>`
      + `<path d="M2 6 q18 -2 24 12 q4 14 -12 12 q-12 -2 -14 -14Z" fill="${lg(c, [[0, c.a.hi], [1, c.a.base]])}" stroke="${c.m.line}" stroke-width="3" stroke-linejoin="round"/>`
      + `<circle cx="18" cy="-6" r="4" fill="${c.a.hi}" opacity=".9"/><circle cx="12" cy="18" r="3" fill="${c.m.hi}" opacity=".9"/></g>`;
    return wing(1) + wing(-1)
      + `<rect x="47" y="34" width="6" height="42" rx="3" fill="${R('bark').base}" stroke="${R('bark').line}" stroke-width="2.4"/>`
      + `<path d="M48 34 q-8 -10 -12 -14 M52 34 q8 -10 12 -14" stroke="${R('bark').line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
      + `<circle cx="36" cy="19" r="2.6" fill="${c.a.base}"/><circle cx="64" cy="19" r="2.6" fill="${c.a.base}"/>`;
  },
};

/* --------------------------------------------------------------- assembly */

/** decoration that scales with how precious the item is */
function deco(c: Ctx, extra: string[]) {
  /* Restraint. The item itself is supposed to look better as it climbs, not wear
     a hat: the old tier-6 gold laurel read as a shopping trolley under a loaf of
     bread. All that is left is a warm halo behind the rare ones and a sparkle or
     two, which is all this genre ever does. */
  let s = '';
  const t = c.tier;
  const glow = extra.indexOf('glow') >= 0 || t >= 5;
  if (glow) {
    s += `<circle cx="50" cy="48" r="46" fill="${rg(c, [[0, c.m.hi + (t >= 6 ? '4d' : '33')], [1, c.m.hi + '00']], 0.5, 0.5, 0.5)}"/>`;
  }
  return s;
}

/** sparkles sit *over* the item, so they are added after the body */
function deco2(c: Ctx, extra: string[]) {
  let s = '';
  const t = c.tier;
  if (t >= 4) s += twinkle(83, 21, 7.5, '#fffdf0', 0.95);
  if (t >= 5) s += twinkle(19, 31, 5.5, '#fffdf0', 0.8);
  if (t >= 6) s += twinkle(75, 76, 5, '#fffdf0', 0.7) + twinkle(30, 72, 3.6, '#fffdf0', 0.6);
  if (extra.indexOf('motes') >= 0 || t >= 7) {
    s += [24, 148, 272].map(a =>
      `<circle cx="${(50 + Math.cos(a * Math.PI / 180) * 42).toFixed(1)}" cy="${(48 + Math.sin(a * Math.PI / 180) * 42).toFixed(1)}" r="3.6" fill="#fff6c8" opacity=".9"/>`).join('');
  }
  return s;
}

export type ItemSpec = {
  shape: string;
  mat: string;
  accent?: string;
  tier?: number;
  deco?: string[];
};

/** Render one item spec into a standalone SVG string. */
export function renderItem(spec: ItemSpec): string {
  const c: Ctx = {
    id: 'a' + (uid++).toString(36),
    defs: [],
    m: R(spec.mat),
    a: R(spec.accent || spec.mat),
    tier: spec.tier || 1,
  };
  const draw = SHAPES[spec.shape] || SHAPES.pebble;
  const extras = spec.deco || [];
  const halo = deco(c, extras);        // behind the item
  const body = draw(c);
  const sparks = deco2(c, extras);     // in front of it
  return `<svg viewBox="0 0 100 100" class="art"><defs>${c.defs.join('')}</defs>`
    + halo + SH() + body + sparks + '</svg>';
}

/** A producer is the same primitive library, but staged as a *source*: it sits
 *  on a mound of ground with a soft aura, so it reads as scenery, not loot. */
export function renderProducer(spec: ItemSpec & { ground?: string }): string {
  const c: Ctx = {
    id: 'p' + (uid++).toString(36), defs: [],
    m: R(spec.mat), a: R(spec.accent || spec.mat), tier: 1,
  };
  const g = R(spec.ground || 'moss');
  const draw = SHAPES[spec.shape] || SHAPES.bush;
  // every gradient has to be *collected* before the <defs> is serialised, so the
  // body and the mound are built first and only then wrapped
  const mound = `<ellipse cx="50" cy="86" rx="38" ry="11" fill="${lg(c, [[0, g.base], [1, g.lo]])}" stroke="${g.line}" stroke-width="2.6"/>`
    + `<ellipse cx="44" cy="83" rx="18" ry="4.5" fill="${g.hi}" opacity=".45"/>`
    + `<circle cx="50" cy="50" r="42" fill="${c.m.hi}" opacity=".14"/>`;
  const body = `<g transform="translate(50 47) scale(0.9) translate(-50 -47)">${draw(c)}</g>`;
  return `<svg viewBox="0 0 100 100" class="art"><defs>${c.defs.join('')}</defs>`
    + mound + body
    + twinkle(84, 20, 6, '#fffbe0', 0.75) + twinkle(17, 30, 5, '#fffbe0', 0.6)
    + '</svg>';
}

/* -------------------------------------------------------------- faces */

export type FaceSpec = { kind: string; mat: string; accent?: string };

/** A cast member's portrait, composed the same way items are. `kind` sets the
 *  silhouette; the palette does the rest, so a new alien is one JSON line. */
export function renderFace(spec: FaceSpec): string {
  const c: Ctx = { id: 'f' + (uid++).toString(36), defs: [], m: R(spec.mat), a: R(spec.accent || 'cream'), tier: 1 };
  const m = c.m, a = c.a;
  const g = rg(c, [[0, m.hi], [0.55, m.base], [1, m.lo]], 0.34, 0.26, 0.9);
  const eyes = (x1: number, x2: number, y: number, r: number) =>
    `<ellipse cx="${x1}" cy="${y}" rx="${r}" ry="${r * 1.2}" fill="#fff"/><ellipse cx="${x2}" cy="${y}" rx="${r}" ry="${r * 1.2}" fill="#fff"/>`
    + `<circle cx="${x1 + 1}" cy="${y + 1.5}" r="${r * 0.52}" fill="#2a2038"/><circle cx="${x2 + 1}" cy="${y + 1.5}" r="${r * 0.52}" fill="#2a2038"/>`
    + `<circle cx="${x1 + 2.4}" cy="${y - 1}" r="${r * 0.22}" fill="#fff"/><circle cx="${x2 + 2.4}" cy="${y - 1}" r="${r * 0.22}" fill="#fff"/>`;
  const smile = (y: number) => `<path d="M43 ${y} q7 6 14 0" stroke="${m.line}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  const blush = (y: number) => `<ellipse cx="30" cy="${y}" rx="6" ry="3.4" fill="${a.base}" opacity=".5"/><ellipse cx="70" cy="${y}" rx="6" ry="3.4" fill="${a.base}" opacity=".5"/>`;
  let body: string;
  switch (spec.kind) {
    case 'bug':
      body = `<path d="M50 14 q-8 -8 -16 -10 M50 14 q8 -8 16 -10" stroke="${m.line}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`
        + `<circle cx="32" cy="5" r="4" fill="${a.base}"/><circle cx="68" cy="5" r="4" fill="${a.base}"/>`
        + `<ellipse cx="50" cy="54" rx="36" ry="34" fill="${g}" stroke="${m.line}" stroke-width="3"/>`
        + eyes(38, 62, 50, 9) + smile(72) + blush(66); break;
    case 'fish':
      body = `<path d="M84 50 q14 -14 16 0 q-2 14 -16 0Z" fill="${a.base}" stroke="${m.line}" stroke-width="3"/>`
        + `<ellipse cx="48" cy="52" rx="38" ry="32" fill="${g}" stroke="${m.line}" stroke-width="3"/>`
        + `<path d="M18 30 q-10 -12 2 -16 q10 4 8 18Z" fill="${a.base}" stroke="${m.line}" stroke-width="2.6"/>`
        + eyes(38, 62, 48, 9) + `<ellipse cx="50" cy="72" rx="8" ry="5" fill="${m.line}" opacity=".8"/>` + blush(64); break;
    case 'bird':
      body = `<ellipse cx="50" cy="54" rx="35" ry="33" fill="${g}" stroke="${m.line}" stroke-width="3"/>`
        + `<path d="M40 18 q10 -14 20 -2 q-10 4 -20 2Z" fill="${a.base}" stroke="${m.line}" stroke-width="2.6"/>`
        + eyes(38, 62, 48, 9)
        + `<path d="M44 66 l6 8 6 -8Z" fill="${R('gold').base}" stroke="${R('gold').line}" stroke-width="2"/>` + blush(64); break;
    case 'crystal':
      body = `<path d="M50 12 L84 48 L50 90 L16 48Z" fill="${g}" stroke="${m.line}" stroke-width="3" stroke-linejoin="round"/>`
        + eyes(39, 61, 50, 8) + smile(70); break;
    case 'flame':
      body = `<path d="M50 8 q26 22 26 44 q0 30 -26 30 q-26 0 -26 -30 q0 -22 26 -44Z" fill="${g}" stroke="${m.line}" stroke-width="3"/>`
        + eyes(39, 61, 52, 8.5) + smile(72); break;
    case 'cloud':
      body = `<path d="M22 70 q-14 0 -14 -13 q0 -12 13 -13 q1 -18 19 -18 q12 0 17 10 q6 -6 14 -2 q10 5 8 16 q12 2 12 13 q0 13 -14 13Z" fill="${g}" stroke="${m.line}" stroke-width="3" stroke-linejoin="round"/>`
        + eyes(40, 60, 50, 7.5) + smile(64); break;
    case 'robot':
      body = `<rect x="18" y="26" width="64" height="56" rx="18" fill="${g}" stroke="${m.line}" stroke-width="3"/>`
        + `<rect x="29" y="44" width="42" height="21" rx="10" fill="${m.deep}"/>`
        + `<circle cx="40" cy="54" r="6" fill="${a.hi}"/><circle cx="60" cy="54" r="6" fill="${a.hi}"/>`
        + `<rect x="40" y="71" width="20" height="5" rx="2.5" fill="${m.deep}"/>`
        + `<path d="M50 26 v-12" stroke="${m.line}" stroke-width="4"/><circle cx="50" cy="11" r="6" fill="${a.base}"/>`; break;
    default:
      body = `<ellipse cx="50" cy="55" rx="37" ry="34" fill="${g}" stroke="${m.line}" stroke-width="3"/>`
        + `<path d="M28 26 q6 -16 14 -4 M72 26 q-6 -16 -14 -4" stroke="${m.line}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`
        + eyes(38, 62, 50, 9) + smile(72) + blush(66);
  }
  return `<svg viewBox="0 0 100 100" class="face"><defs>${c.defs.join('')}</defs>`
    + `<circle cx="50" cy="52" r="40" fill="${m.hi}" opacity=".35"/>` + body + '</svg>';
}

/** the plain colours a composed face uses for its body, for the order cards */
export function faceColors(spec: FaceSpec) {
  const m = R(spec.mat);
  return { body: m.base, trim: m.line };
}

/** every primitive name, for the art contact sheet and the validator */
export const SHAPE_NAMES = Object.keys(SHAPES);
export const MAT_NAMES = Object.keys(MATS);
