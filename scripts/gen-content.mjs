/* Builds src/content/*.json from the compact tables in scripts/content/.
 *
 *   node scripts/gen-content.mjs
 *
 * The JSON stays the game's source of truth at runtime — this just means the
 * catalogue is authored as a few hundred readable lines instead of a few
 * thousand lines of braces. Run it after editing anything in scripts/content/. */
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CHAINS, SPECIAL } from './content/chains.mjs';
import { PRODUCERS, CELLS } from './content/producers.mjs';
import { WORLDS, LOCKS, CHARACTERS, STORY } from './content/worlds.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content');

/* --------------------------------------------------------------- curves */
/* A tier is worth roughly 2.4x the one below it: enough that merging up always
   beats selling down, not so much that one lucky tier-7 trivialises the shop. */
const SELL = [2, 5, 13, 32, 78, 185, 430, 980];
const sell = t => SELL[Math.min(t, SELL.length) - 1];

/* ---------------------------------------------------------------- items */
const items = {};
const chains = {};

for (const [key, name, world, unlock, ...lines] of CHAINS) {
  const ids = [];
  lines.forEach((line, i) => {
    const [id, label, shape, matPart] = line.split('|');
    if (!id || !label || !shape || !matPart) throw new Error(`bad item line: ${line}`);
    const [matAcc, decoPart] = matPart.split('+');
    const [mat, accent] = matAcc.split('/');
    const tier = i + 1;
    const art = { shape, mat };
    if (accent) art.accent = accent;
    if (decoPart) art.deco = decoPart.split(',').filter(Boolean);
    if (items[id]) throw new Error(`duplicate item id "${id}"`);
    items[id] = { name: label, chain: key, tier, sell: sell(tier), art, ...(SPECIAL[id] || {}) };
    ids.push(id);
  });
  if (chains[key]) throw new Error(`duplicate chain key "${key}"`);
  chains[key] = { name, world, unlock, items: ids };
}

/* ------------------------------------------------------------ producers */
const producers = {};
const grow = {};                                   // world -> [{producer, atLevel, cells}]
const starts = {};                                 // world -> [{cell, producer}]
const seen = {};                                   // world -> how many producers placed

for (const [world, at, line] of PRODUCERS) {
  const [id, name, artPart, modePart, dropPart] = line.split('|');
  const drops = dropPart.split(/\s+/).filter(Boolean);
  drops.forEach(d => { if (!items[d]) throw new Error(`producer "${id}" drops unknown item "${d}"`); });
  const p = { name, art: id, drops };
  if (artPart.includes(':')) {
    const [shape, rest] = artPart.split(':');
    const [mat, ground] = rest.split('/');
    p.spec = { shape, mat, ...(ground ? { ground } : {}) };
  } else {
    p.art = artPart;                               // a hand-drawn piece in art.ts
  }
  if (modePart.startsWith('once')) {
    p.mode = 'once'; p.uses = +modePart.split(':')[1];
  } else {
    // bat:<charges>/<minutes to refill from empty>
    const [cap, mins] = modePart.split(':')[1].split('/');
    p.mode = 'battery'; p.cap = +cap;
    p.every = Math.round(+mins * 60000 / +cap);
  }
  producers[id] = p;

  if (world === '*') continue;                      // placed by the game, not the world
  const n = seen[world] = (seen[world] || 0) + 1;
  const cells = (CELLS[world] || [])[n - 1] || [19];
  if (at <= 1) (starts[world] ||= []).push({ cell: cells[0], producer: id });
  else (grow[world] ||= []).push({ producer: id, atLevel: at, cells });
}

/* --------------------------------------------------------------- worlds */
const locks = {};
for (const [lvl, cells] of Object.entries(LOCKS)) cells.forEach(c => { locks[c] = +lvl; });

const worlds = {};
for (const w of WORLDS) {
  const mine = Object.entries(chains).filter(([, c]) => c.world === w.key).map(([k]) => k);
  worlds[w.key] = {
    name: w.name, subtitle: w.subtitle, planet: w.planet,
    chains: mine,
    start: starts[w.key] || [],
    locks: { ...locks },
    folks: w.folks,
    grow: grow[w.key] || [],
    tapCost: w.tapCost, perk: w.perk,
    heart: w.heart, bloom: w.bloom, intro: w.intro,
  };
}

/* --------------------------------------------------------------- output */
const write = (file, data) => {
  writeFileSync(join(OUT, file), JSON.stringify(data, null, 2) + '\n');
  console.log(`  ${file.padEnd(18)} ${JSON.stringify(data).length.toLocaleString()} bytes`);
};

write('items.json', items);
write('chains.json', chains);
write('producers.json', producers);
write('worlds.json', worlds);
write('characters.json', CHARACTERS);
write('story.json', STORY);

/* ------------------------------------------------------------ sanity pass */
const errs = [];
const artgen = readFileSync(join(OUT, '..', 'artgen.ts'), 'utf8');
const shapes = new Set([...artgen.matchAll(/^ {2}([a-zA-Z]+): (?:c =>|\(c[^)]*\) =>|c => \{)/gm)].map(m => m[1]));
const mats = new Set([...(artgen.match(/const MATS[^;]*;/s)?.[0].matchAll(/([a-z]+): '#/g) || [])].map(m => m[1]));
const check = (sp, where) => {
  if (sp.shape && !shapes.has(sp.shape)) errs.push(`${where}: unknown shape "${sp.shape}"`);
  [sp.mat, sp.accent, sp.ground].forEach(m => { if (m && !mats.has(m)) errs.push(`${where}: unknown material "${m}"`); });
};
Object.entries(items).forEach(([id, it]) => it.art && check(it.art, `item ${id}`));
Object.entries(producers).forEach(([id, p]) => p.spec && check(p.spec, `producer ${id}`));
Object.values(worlds).forEach(w => w.folks.forEach(f => {
  if (!CHARACTERS[f]) errs.push(`world ${w.name} lists unknown character "${f}"`);
}));
STORY.forEach(s => { if (!CHARACTERS[s.who]) errs.push(`story "${s.id}" uses unknown character "${s.who}"`); });

console.log(`\n  ${Object.keys(items).length} items · ${Object.keys(chains).length} chains · `
  + `${Object.keys(producers).length} producers · ${Object.keys(worlds).length} worlds`);
if (errs.length) { console.error('\n' + errs.map(e => '  ✗ ' + e).join('\n')); process.exit(1); }
console.log('  content OK\n');
