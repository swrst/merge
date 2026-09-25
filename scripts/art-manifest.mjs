/* Build the art order: one row per asset the game can take a painted file for,
   each with a ready-to-paste prompt, plus the merge catalogue as a document.

   Usage:  npm run art:manifest      ->  art/manifest.csv, art/manifest.json,
                                         art/CATALOGUE.md

   Every row carries the batch it belongs to (scenes, ui, starters, producers,
   chain-<key>, fx) so a whole batch can be pulled out with
   `npm run art -- --batch chain-wood`. The prompts are written to be pasted
   into an image model (Midjourney, Stable Diffusion, GPT-image, ...) as they
   are; `negative` is there for the models that take one.                     */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const items = read('src/content/items.json');
const chains = read('src/content/chains.json');
const prods = read('src/content/producers.json');
const worlds = read('src/content/worlds.json');
let notes = { items: {}, producers: {} };
try { notes = read('art/notes.json'); } catch { /* run `npm run content` first for the descriptions */ }

/* --- the house style, repeated on every single prompt -------------------
   Travel Town's look, moved into space: chunky rounded toy objects, glossy
   semi-3D paint, bright friendly colour, soft light from the upper left. */
const STYLE = 'Mobile merge-game item in the style of Travel Town: one chunky, rounded, toy-like object, '
  + 'soft glossy semi-3D painted rendering, bright saturated friendly colours, '
  + 'gentle warm key light from the upper left with one soft white highlight on the top surface, '
  + 'shaded side a deeper richer version of the base colour (never grey or black), '
  + 'a thin darker warm-brown edge line, a small soft contact shadow directly beneath. '
  + 'Three-quarter view from about 30 degrees above, as if sitting on a table. '
  + 'Isolated on a plain transparent background, centred, filling about 80% of the frame, '
  + 'simple bold silhouette that still reads as a 60-pixel icon. '
  + 'No text, no letters, no numbers, no frame, no card, no scenery, no watermark. 512x512';
const NEGATIVE = 'text, letters, numbers, watermark, signature, logo, background scenery, ground plane, '
  + 'frame, border, card, multiple objects, cropped, photo, photorealistic, realistic texture, '
  + 'grain, noise, blurry, dark, gloomy, muddy colours, neon, flat vector clip art, black outline';

/* the key colours of each world, so a chain stays inside its family */
const PALETTE = {
  earth: 'Sunny Meadow palette — grass green, honey amber, warm tan, sky blue',
  luna: 'Crater Camp palette — lilac, pale silver, slate blue, glowing cyan',
  cindra: 'Ember Hollow palette — ember orange, magma red, obsidian purple-black, ash grey',
  nerith: 'Tidal Shallows palette — turquoise, coral pink, pearl white, wet sand',
  vela: 'Aurora Reach palette — violet, aurora teal, starlight gold, cloud white',
};

/* shape key -> what it actually is, so the painter is not guessing */
const SHAPE = {
  seed: 'plump seed', sprout: 'seedling with two leaves', leaf: 'leaf', clover: 'clover',
  bud: 'flower bud', flower: 'five-petal flower', blossom: 'open blossom', vine: 'curling vine',
  fern: 'fern frond', twig: 'forked twig', log: 'cut log', plank: 'stack of planks',
  stump: 'tree stump', tree: 'round-crowned tree', bush: 'leafy bush', pebble: 'smooth pebble',
  rock: 'chunky rock', boulder: 'big boulder', crystal: 'faceted crystal shard', gem: 'cut gemstone',
  geode: 'cracked geode', ingot: 'metal ingot', ore: 'ore chunk with veins', prism: 'glass prism',
  droplet: 'water droplet', bubble: 'soap bubble', jar: 'lidded jar', bottle: 'corked bottle',
  flask: 'round lab flask', barrel: 'wooden barrel', wave: 'curling wave', ice: 'ice shard',
  snowflake: 'snowflake', ember: 'glowing ember', flame: 'flame', coal: 'lump of coal',
  lantern: 'hanging lantern', berry: 'single berry', berrycluster: 'cluster of berries',
  fruit: 'round fruit', grain: 'bundle of grain', bread: 'loaf of bread', pie: 'pie in a dish',
  cake: 'tiered cake', honey: 'honeycomb', cheese: 'wedge of cheese', candy: 'wrapped candy',
  soup: 'bowl of soup', rope: 'coil of rope', cloth: 'folded cloth', sack: 'tied sack',
  basket: 'woven basket', crate: 'wooden crate', chest: 'treasure chest', pot: 'clay pot',
  key: 'ornate key', cog: 'cog wheel', bell: 'hand bell', scroll: 'rolled scroll',
  compass: 'brass compass', star: 'five-point star', moon: 'crescent moon', orb: 'polished orb',
  planet: 'little ringed planet', comet: 'comet with a tail', cloud: 'puffy cloud',
  shell: 'spiral seashell', spiral: 'spiral coil', pearl: 'pearl in a shell', coral: 'branching coral',
  fish: 'small fish', egg: 'speckled egg', cocoon: 'silk cocoon', feather: 'feather',
  bone: 'clean bone', fossil: 'fossil in stone', mushroom: 'toadstool', slime: 'blob of slime',
  totem: 'carved totem', mask: 'ceremonial mask', crown: 'jewelled crown', house: 'little house',
  tower: 'stone tower', arch: 'stone arch', book: 'thick book', boat: 'small boat',
  balloon: 'hot-air balloon', anvil: 'anvil', ring: 'jewelled ring', bird: 'round little bird',
  butterfly: 'butterfly',
};
/* material key -> the words a painter needs */
const MAT = {
  wood: 'warm honey-brown wood', bark: 'dark rough bark', straw: 'pale golden straw', leaf: 'fresh green leaf',
  moss: 'bright moss green', vine: 'deep green vine', grass: 'yellow-green grass', fern: 'blue-green fern',
  stone: 'cool grey stone', slate: 'blue-grey slate', sand: 'warm sand', clay: 'terracotta clay',
  iron: 'dull iron', steel: 'bright polished steel', gold: 'rich gold', copper: 'warm copper',
  silver: 'pale silver', obsidian: 'near-black purple obsidian', crystal: 'clear cyan crystal',
  amethyst: 'violet amethyst', ruby: 'deep red ruby', emerald: 'green emerald', sapphire: 'blue sapphire',
  topaz: 'golden topaz', berry: 'crimson berry red', cherry: 'bright cherry red', plum: 'purple plum',
  peach: 'soft peach orange', honey: 'glowing amber honey', cream: 'pale cream', dough: 'raw dough beige',
  choco: 'dark chocolate brown', water: 'clear blue water', ice: 'pale blue ice', frost: 'white frost',
  deepsea: 'deep ocean blue', flame: 'orange flame', ember: 'red-orange ember', magma: 'molten red magma',
  smoke: 'grey smoke', moon: 'pale lilac moonstone', dusk: 'dusky violet', star: 'golden starlight',
  aurora: 'teal-green aurora glow', glow: 'soft cyan glow', spore: 'violet spore', fungus: 'salmon fungus',
  shell: 'pale shell pink', coral: 'coral pink', pearl: 'iridescent pearl white', kelp: 'dark sea green',
  bone: 'ivory bone', cloth: 'warm red cloth', rope: 'tan rope', glass: 'pale blue glass',
  rust: 'rusty orange-brown', coal: 'charcoal black', cloud: 'soft blue-white cloud',
  jade: 'jade green', lilac: 'pale lilac', mint: 'mint green', rose: 'rose pink',
};
const TIER = {
  1: 'the smallest, plainest thing in its chain — tiny, humble, no decoration',
  2: 'a step up: a little bigger, a little tidier, still found rather than made',
  3: 'clearly made, not found: neat shape, one small metal or painted detail',
  4: 'handsome: richer colour, a trim or a band, a faint sheen',
  5: 'precious: fine detailing, gold or gem accents, a soft glow around it',
  6: 'a showpiece: ornate, glowing, a few floating motes of light',
  7: 'the crown of the chain: a small monument, radiant, unmistakably the best',
};
/* Chains run 4 to 8 steps. The look climbs over the whole chain whatever its
   length: step one is always plainest, the last is always the crown. */
const readOf = (n, len) => len <= 1 ? 7 : Math.min(7, 1 + Math.round(n * 6 / (len - 1)));

const rows = [];
const add = (path, kind, name, group, prompt, batch, negative = NEGATIVE) =>
  rows.push({ path, kind, name, group, batch, prompt, negative });

/* -------------------------------------------------------------- scenes */
/* Where the camp screen stands things, as fractions of the 1086x1448 picture
   (x across, y down). These are the anchors in src/game.ts (PAD, PROD_PADS,
   LAB_PAD) — a painting that puts its plinths elsewhere has spots floating
   over nothing. art/guides/*.png draws the same layout for img2img/ControlNet. */
const pct = ([x, y]) => `${Math.round(x * 100)}% across, ${Math.round(y * 100)}% down`;
const CAMP = {
  rocket: [0.355, 0.435], lab: [0.545, 0.545], heart: [0.788, 0.472],
  prods: [[0.265, 0.742], [0.512, 0.742], [0.788, 0.738], [0.36, 0.90], [0.64, 0.90], [0.15, 0.605]],
};
const LAB = { a: [0.255, 0.545], b: [0.435, 0.552], out: [0.645, 0.545], book: [0.275, 0.325], scope: [0.90, 0.50] };
const SCENE_STYLE = 'Painted mobile-game background in the style of Travel Town: soft glossy semi-3D cartoon painting, '
  + 'bright saturated friendly colour, warm light from the upper left, clean shapes, no photorealism. '
  + 'Portrait 1086x1448 (3:4), opaque, seen from slightly above like a game map. '
  + 'Keep everything important inside the middle 70% of the width — tall phones crop the sides. '
  + 'No characters, no text, no letters, no UI, no watermark.';
const CAMP_LAYOUT = 'Layout, which must be followed because the game stands objects on these exact spots: '
  + `a large raised round launch pad with a few steps, its top centred at ${pct(CAMP.rocket)}; `
  + `a small flat clearing at ${pct(CAMP.lab)} for the lab; `
  + `one raised round plinth at ${pct(CAMP.heart)} for the world's Heart; `
  + `and six flat round stone plinths for producers, their tops at ${CAMP.prods.map(pct).join('; ')}. `
  + 'Every plinth and pad is empty. Paths of open ground link them. '
  + 'The area between them stays calm and simple — the merge board is also drawn over this picture, blurred. '
  + 'Composition reference: art/guides/camp_layout.png. Style and layout reference: src/scenes/camp_earth.webp.';
const SCENES = {
  earth: 'Sunny Meadow, the Earth-like home world at midday: rolling green hills and a sandy clearing, '
    + 'honey-gold sunlight, a clean sky-blue sky with a pale moon and a small ringed planet low on the horizon, '
    + 'wildflowers, ferns and a few small cyan crystals in the grass, a stream on one side.',
  luna: 'Crater Camp on Luna, a small lilac moon under a starry sky: pale silver-lilac crater ground with soft round craters, '
    + 'slate-blue shadows, cyan glowing crystals and glow-plants around the edges, a big blue ringed planet hanging on the horizon, '
    + 'two little dome habitats and an antenna far in the distance.',
  cindra: 'Ember Hollow on Cindra, a volcanic world at dusk: dark purple-black obsidian ground, rivers of glowing orange lava at the edges, '
    + 'a smoking volcano in the distance under a magenta-to-orange sky, ash-grey haze, mushroom trees glowing warm orange, '
    + 'the lava glow lighting everything warmly.',
  nerith: 'Tidal Shallows on Nerith, an ocean world: bright turquoise shallow water, wet-sand islands and sandbars as the ground, '
    + 'coral-pink reefs visible under the clear water, pearl-white foam at the edges, drowned domed ruins poking out of the sea '
    + 'in the distance, two small suns low in a pale sky.',
  vela: 'Aurora Reach on Vela, cloudtops at night: a deep violet starry sky with sweeping teal aurora ribbons, soft white cloud islands '
    + 'as the ground, starlight-gold lanterns on posts, floating rocks and a distant cloud castle.',
};
for (const [k, w] of Object.entries(worlds)) {
  add(`src/sprites/scenes/${k}.webp`, 'scene', w.name, 'world backdrop',
    `${SCENES[k] || w.name + ' — ' + (w.subtitle || '')} The camp you stand in on this world. ${CAMP_LAYOUT} ${SCENE_STYLE}`,
    'scenes', 'characters, people, animals, text, letters, UI, buttons, watermark, photo, photorealistic, dark, muddy colours, objects on the plinths');
}
add('src/sprites/scenes/lab.webp', 'scene', 'Research Lab', 'world backdrop',
  'The inside of a small cosy research lab built into a rocket: white panels with brass trim, warm lamps, pipes and dials. '
  + `A curved white-and-brass workbench runs across the middle with two round empty sockets side by side, at ${pct(LAB.a)} and ${pct(LAB.b)}, `
  + `and a third, larger glowing socket at ${pct(LAB.out)}. A glass cabinet of shelves on the left with an open recipe book at ${pct(LAB.book)}. `
  + `A big round porthole on the right, around ${pct(LAB.scope)}, looking out at floating islands and stars. `
  + 'All sockets empty. Composition reference: art/guides/lab_layout.png; style reference: src/scenes/lab.webp. '
  + SCENE_STYLE,
  'scenes', 'characters, people, text, letters, UI, buttons, watermark, photo, photorealistic, dark, muddy colours, objects in the sockets');

/* ---------------------------------------------------------- starters */
/* the two producers every world opens with, plus the rocket wreck */
const STARTERS = new Set(['wreck']);
Object.values(worlds).forEach(w => (w.start || []).forEach(x => STARTERS.add(x.producer)));
const byWorld = {};
Object.entries(worlds).forEach(([k, w]) => {
  (w.start || []).forEach(x => { byWorld[x.producer] = k; });
  (w.grow || []).forEach(x => { byWorld[x.producer] = k; });
});
const prodRow = (id, p) => {
  const a = p.spec || {};
  const shape = SHAPE[a.shape] || p.name.toLowerCase();
  const mat = MAT[a.mat] || 'painted';
  const ground = MAT[a.ground] || 'earth';
  const what = notes.producers[id] || `a ${mat} ${shape}`;
  const wk = byWorld[id];
  const drops = [...new Set(p.drops)].map(d => items[d] && items[d].name).filter(Boolean).slice(0, 3).join(', ');
  add(`src/sprites/producers/${p.art}.png`, 'producer', p.name, wk ? `producer (${worlds[wk].name})` : 'producer',
    `${p.name} — ${what}, standing on its own small round mound of ${ground}. A source the player taps for ${drops}. `
    + 'Slightly taller than wide, planted and heavy, clearly scenery rather than loot; the mound is part of the sprite and the only ground shown. '
    + `${wk ? PALETTE[wk] + '. ' : ''}${STYLE}`,
    STARTERS.has(id) ? 'starters' : 'producers');
};
Object.entries(prods).filter(([id]) => STARTERS.has(id)).forEach(([id, p]) => prodRow(id, p));
Object.entries(prods).filter(([id]) => !STARTERS.has(id)).forEach(([id, p]) => prodRow(id, p));

/* -------------------------------------------------------------- items */
const ORDER = [...Object.keys(worlds), 'ship', 'any'];
const chainList = Object.entries(chains).sort((a, b) => {
  const wa = ORDER.indexOf(a[1].world), wb = ORDER.indexOf(b[1].world);
  return wa !== wb ? wa - wb : (a[1].unlock - b[1].unlock);
});
for (const [ck, ch] of chainList) {
  const world = worlds[ch.world] ? worlds[ch.world].name : ch.world === 'ship' ? 'Rocket parts' : 'every world';
  const pal = PALETTE[ch.world] ? PALETTE[ch.world] + '. ' : '';
  const len = ch.items.length;
  ch.items.forEach((id, n) => {
    const it = items[id]; if (!it) return;
    const a = it.art || {};
    const fallback = `a ${MAT[a.mat] || 'painted'} ${SHAPE[a.shape] || 'object'}`
      + (a.accent && MAT[a.accent] ? `, with ${MAT[a.accent]} accents` : '');
    const what = notes.items[id] || fallback;
    const up = n ? ` One step up from the ${items[ch.items[n - 1]].name}, and its outline must be clearly different from it.` : '';
    add(`src/sprites/items/${id}.png`, 'item', it.name, `${ch.name} (${world})`,
      `${it.name} — ${what}. Step ${n + 1} of ${len} in the "${ch.name}" merge chain, so it must read as `
      + `${TIER[readOf(n, len)]}.${up} ${pal}${STYLE}`,
      `chain-${ck}`);
  });
}
/* ------------------------------------------------------------------- UI */
const UI = [
  ['ui/panel_wood.png', 'Panel frame', '9-slice panel frame: a rounded warm-cream card with a thick white rim and a soft brown drop edge, empty middle, 256x256 with 48px corners'],
  ['ui/btn_green.png', 'Primary button', 'chunky rounded rectangle button, grass-green gradient with a lighter top lip, thick white rim, solid darker green edge underneath so it looks pressable, empty middle, 256x96'],
  ['ui/btn_gold.png', 'Gold button', 'as the green button but warm gold'],
  ['ui/btn_blue.png', 'Blue button', 'as the green button but sky blue'],
  ['ui/btn_round.png', 'Round icon button', 'round cream button with a thick white rim and a brown drop edge, empty middle, 128x128'],
  ['ui/tile_light.png', 'Board tile, light', 'single flat board tile, warm light tan, very slightly rounded corners, a faint lighter sheen along the top edge, 128x128, no outline'],
  ['ui/tile_dark.png', 'Board tile, dark', 'as tile_light but one shade deeper, for the checkerboard'],
  ['ui/tile_locked.png', 'Board tile, overgrown', 'a board tile covered in short grass and weeds, dustier tan underneath, 128x128'],
  ['ui/icon_coin.png', 'Coin', 'stack-of-one gold coin seen 3/4, thick outline, bright rim light, 128x128'],
  ['ui/icon_energy.png', 'Energy', 'rounded lightning bolt, electric blue with a white core, 128x128'],
  ['ui/icon_gem.png', 'Premium gem', 'violet cut gem with a white sparkle, 128x128'],
  ['ui/icon_star.png', 'Star core', 'golden five-point star with rounded points, 128x128'],
  ['ui/icon_bloom.png', 'Bloom essence', 'a floating seed of green-gold light, petals of light around a bright core, 128x128'],
  ['ui/frame_rare.png', 'Rarity frame', 'thin glowing rounded-square frame, violet, for marking a rare item on its tile, 128x128, transparent middle'],
  ['ui/badge_ready.png', 'Ready badge', 'small round green badge with a white tick, thick white rim, 96x96'],
  ['ui/ribbon.png', 'Panel ribbon', 'a gold banner ribbon that sits across the top of a panel, empty middle for a title, 512x128'],
  ['ui/bar_track.png', 'Progress bar', 'empty rounded progress-bar track, dark warm brown, 256x48, plus a separate bright green fill of the same shape'],
  ['ui/order_card.png', 'Contract card', 'blank order card: rounded cream card, thick white rim, a slot circle at the top for a character portrait and three empty square slots in a row below, 512x640'],
  ['ui/plinth.png', 'Camp plinth', 'flat round stone plinth seen 3/4 from above, cracked pale stone with grass at the edges, for a producer to stand on, 512x256, transparent background'],
];
UI.forEach(([p, name, desc]) => add(`src/sprites/${p}`, 'ui', name, 'interface',
  `${name} — ${desc}. Mobile game UI in the style of Travel Town: soft glossy semi-3D, bright friendly colours, `
  + 'rounded chunky shapes, soft light from the upper left with a glossy top highlight, a thin warm-brown edge line, '
  + 'transparent background, no text, no letters, no icons unless described.', 'ui'));

/* ------------------------------------------------------- animation sheets */
const FX = [
  ['fx/merge_burst.png', 'Merge burst', '8 frames in a 4x2 grid, 256px per frame: a ring of golden sparks bursting outward and fading, transparent background'],
  ['fx/spawn_puff.png', 'Spawn puff', '6 frames in a 3x2 grid, 256px per frame: a soft white-green puff of leaves and dust appearing and dissipating'],
  ['fx/level_rays.png', 'Level-up rays', '8 frames in a 4x2 grid, 256px per frame: golden light rays sweeping out from the centre'],
  ['fx/sparkle.png', 'Idle sparkle', '4 frames in a 2x2 grid, 128px per frame: a single four-point twinkle appearing and fading'],
  ['fx/coin_pop.png', 'Coin pop', '6 frames in a 3x2 grid, 128px per frame: a coin flipping and rising'],
  ['fx/bloom_wake.png', 'Bloom wake', '8 frames in a 4x2 grid, 256px per frame: green-gold light unfurling like a flower opening'],
];
FX.forEach(([p, name, desc]) => add(`src/sprites/${p}`, 'fx', name, 'animation',
  `${name} — sprite sheet, ${desc}. Read left to right, top to bottom, evenly spaced, each frame the same size, transparent background, no text. Cartoon mobile game VFX, saturated, soft glow, matching a warm Travel Town style.`, 'fx'));

/* ------------------------------------------------------------- write out */
mkdirSync(join(root, 'art'), { recursive: true });
const esc = v => `"${String(v).replace(/"/g, '""')}"`;
writeFileSync(join(root, 'art/manifest.csv'),
  'path,kind,name,group,batch,prompt,negative\n'
  + rows.map(r => [r.path, r.kind, r.name, r.group, r.batch, r.prompt, r.negative].map(esc).join(',')).join('\n') + '\n');
writeFileSync(join(root, 'art/manifest.json'), JSON.stringify(rows, null, 2) + '\n');

/* the merge catalogue, as a document a person can read */
const worldItems = Object.values(chains).filter(c => worlds[c.world]).reduce((a, c) => a + c.items.length, 0);
let md = '# The merge catalogue\n\n'
  + `${Object.keys(items).length} items across ${Object.keys(chains).length} chains `
  + `(${worldItems} of them in the five worlds, the rest shared and rocket parts), `
  + `${Object.keys(prods).length} producers, ${Object.keys(worlds).length} worlds.\n\n`
  + 'Each chain is a ladder: two of a thing make the next thing up. Chains run from 4 to 8\n'
  + 'steps. The last item in a chain is its finale — finishing one for the first time pays\n'
  + 'Bloom essence. *Lv* is the world level the chain wakes at.\n\n'
  + 'Generated by `npm run art:manifest` from `scripts/content/` — edit those, not this.\n';
for (const [wk, w] of Object.entries(worlds)) {
  const mine = Object.entries(chains).filter(([, c]) => c.world === wk);
  md += `\n## ${w.name}${w.subtitle ? ` — *${w.subtitle}*` : ''}\n\n`
    + `${mine.length} chains, ${mine.reduce((a, [, c]) => a + c.items.length, 0)} items.\n`;
  for (const [ck, c] of mine) {
    const src = Object.values(prods).find(p => p.drops.some(d => items[d] && items[d].chain === ck));
    md += `\n**${c.name}** · ${c.items.length} steps · Lv ${c.unlock}${src ? ` · from the ${src.name}` : ''}  \n`;
    md += c.items.map(id => items[id].name).join(' → ') + '\n';
  }
}
md += '\n## Shared and rocket\n';
for (const [, c] of Object.entries(chains).filter(([, c]) => !worlds[c.world])) {
  md += `\n**${c.name}** · ${c.items.length} steps  \n` + c.items.map(id => items[id].name).join(' → ') + '\n';
}
writeFileSync(join(root, 'art/CATALOGUE.md'), md);

console.log(`art/manifest.csv + manifest.json: ${rows.length} assets`);
console.log(`  ${rows.filter(r => r.kind === 'item').length} items, `
  + `${rows.filter(r => r.kind === 'producer').length} producers, `
  + `${rows.filter(r => r.kind === 'scene').length} scenes, `
  + `${rows.filter(r => r.kind === 'ui').length} UI, `
  + `${rows.filter(r => r.kind === 'fx').length} animation sheets`);
console.log('art/CATALOGUE.md written');
