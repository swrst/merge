/* Build the art order: one row per asset the game can take a painted file for,
   each with a ready-to-paste prompt, plus the merge catalogue as a document.

   Usage:  npm run art:manifest      ->  art/manifest.csv, art/manifest.json,
                                         art/CATALOGUE.md                     */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const items = read('src/content/items.json');
const chains = read('src/content/chains.json');
const prods = read('src/content/producers.json');
const worlds = read('src/content/worlds.json');

/* --- the house style, repeated on every single prompt ------------------- */
const STYLE = 'cartoon mobile merge-game asset, Travel Town / Merge Mansion style, '
  + '3/4 view from slightly above as if sitting on a table, thick dark warm-brown outline, '
  + 'soft baked lighting from the upper left, glossy highlight on the top surface, '
  + 'saturated friendly palette, subtle contact shadow under the object, '
  + 'centred, filling about 80% of the frame, transparent background, no text, no border, '
  + 'clean vector-painted finish, 512x512';

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
  2: 'a step up: a little bigger, a little tidier',
  3: 'clearly made, not found: neat shape, one small metal or painted detail',
  4: 'handsome: richer colour, a trim or a band, a faint sheen',
  5: 'precious: fine detailing, gold or gem accents, a soft glow around it',
  6: 'a showpiece: ornate, glowing, floating motes of light',
  7: 'the crown of the chain: a small monument of a thing, radiant, unmistakably the best',
};

const rows = [];
const add = (path, kind, name, group, prompt) => rows.push({ path, kind, name, group, prompt });

/* ---------------------------------------------------------------- items */
for (const [ck, ch] of Object.entries(chains)) {
  const world = worlds[ch.world] ? worlds[ch.world].name : ch.world;
  ch.items.forEach((id, n) => {
    const it = items[id]; if (!it) return;
    const a = it.art || {};
    const shape = SHAPE[a.shape] || 'object';
    const mat = MAT[a.mat] || 'painted';
    const acc = a.accent && MAT[a.accent] ? `, with ${MAT[a.accent]} accents` : '';
    const tier = TIER[it.tier] || TIER[4];
    add(`src/sprites/items/${id}.png`, 'item', it.name, `${ch.name} (${world})`,
      `${it.name} — a ${mat} ${shape}${acc}. Step ${n + 1} of ${ch.items.length} in the `
      + `"${ch.name}" merge chain, so it must read as ${tier}. It has to be recognisable at 60px `
      + `on a tile next to ${ch.items.length - 1} relatives, so keep the silhouette simple and distinct. ${STYLE}`);
  });
}
/* ------------------------------------------------------------ producers */
for (const [, p] of Object.entries(prods)) {
  const a = p.spec || {};
  const shape = SHAPE[a.shape] || p.name.toLowerCase();
  const mat = MAT[a.mat] || 'painted';
  const ground = MAT[a.ground] || 'earth';
  const drops = [...new Set(p.drops)].map(d => items[d] && items[d].name).filter(Boolean).slice(0, 3).join(', ');
  add(`src/sprites/producers/${p.art}.png`, 'producer', p.name, 'producer',
    `${p.name} — a ${mat} ${shape} rooted on a small mound of ${ground}, a source the player taps `
    + `for ${drops}. Slightly taller than wide, planted and heavy, clearly scenery rather than loot; `
    + `the mound is part of the sprite. ${STYLE}`);
}
/* --------------------------------------------------------------- scenes */
const SCENE_EXTRA = 'Painted background art, 1086x1448 portrait, no transparency, no text, no UI. '
  + 'Leave the middle of the frame calm and uncluttered — a board of tiles is drawn over it. '
  + 'Across the lower third put 5 clearly separated flat round plinths or clearings for objects to stand on, '
  + 'and one larger raised launch pad on the left. Same cartoon style as the items: '
  + 'saturated, soft baked light, painterly but clean.';
for (const [k, w] of Object.entries(worlds)) {
  add(`src/sprites/scenes/${k}.webp`, 'scene', w.name, 'world backdrop',
    `${w.name} — ${w.subtitle || ''}. The camp you stand in on this world. ${SCENE_EXTRA}`);
}
add('src/sprites/scenes/lab.webp', 'scene', 'Research Lab', 'world backdrop',
  'The inside of a small research lab built onto a rocket: a curved white-and-brass workbench across the '
  + 'lower half with two round empty sockets side by side and a third larger one to the right, a glass '
  + 'cabinet of shelves on the left, a big round porthole on the right looking out at floating islands. '
  + SCENE_EXTRA.replace('Across the lower third put 5 clearly separated flat round plinths or clearings for objects to stand on, and one larger raised launch pad on the left. ', ''));

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
  `${name} — ${desc}. Same house style as the items: thick dark warm-brown outline, soft baked light from the upper left, glossy top highlight, saturated friendly palette, transparent background, no text.`));

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
  `${name} — sprite sheet, ${desc}. Read left to right, top to bottom, evenly spaced, each frame the same size, transparent background, no text. Cartoon mobile game VFX, saturated, soft glow, matching a warm Travel Town style.`));

/* ------------------------------------------------------------- write out */
mkdirSync(join(root, 'art'), { recursive: true });
const esc = v => `"${String(v).replace(/"/g, '""')}"`;
writeFileSync(join(root, 'art/manifest.csv'),
  'path,kind,name,group,prompt\n' + rows.map(r => [r.path, r.kind, r.name, r.group, r.prompt].map(esc).join(',')).join('\n') + '\n');
writeFileSync(join(root, 'art/manifest.json'), JSON.stringify(rows, null, 2) + '\n');

/* the merge catalogue, as a document a person can read */
let md = '# The merge catalogue\n\n'
  + `${Object.keys(items).length} items across ${Object.keys(chains).length} chains, `
  + `${Object.keys(prods).length} producers, ${Object.keys(worlds).length} worlds.\n\n`
  + 'Each chain is a ladder: two of a thing make the next thing up. The last item in a\n'
  + 'chain is its finale — finishing one for the first time pays Bloom essence.\n';
for (const [wk, w] of Object.entries(worlds)) {
  md += `\n## ${w.name}${w.subtitle ? ` — *${w.subtitle}*` : ''}\n`;
  const mine = Object.entries(chains).filter(([, c]) => c.world === wk);
  for (const [, c] of mine) {
    md += `\n**${c.name}**  \n`;
    md += c.items.map(id => `${items[id].name} *(t${items[id].tier})*`).join(' → ') + '\n';
  }
  const ps = Object.values(prods).filter(p => (w.start || []).some(s => s.producer === p.art)
    || (w.grow || []).some(g => g.producer === p.art));
  if (ps.length) md += `\n*Producers:* ${ps.map(p => p.name).join(', ')}\n`;
}
writeFileSync(join(root, 'art/CATALOGUE.md'), md);

console.log(`art/manifest.csv + manifest.json: ${rows.length} assets`);
console.log(`  ${rows.filter(r => r.kind === 'item').length} items, `
  + `${rows.filter(r => r.kind === 'producer').length} producers, `
  + `${rows.filter(r => r.kind === 'scene').length} scenes, `
  + `${rows.filter(r => r.kind === 'ui').length} UI, `
  + `${rows.filter(r => r.kind === 'fx').length} animation sheets`);
console.log('art/CATALOGUE.md written');
