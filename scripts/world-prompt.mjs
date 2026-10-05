/* Write the ChatGPT Images prompt pack for one world's missing art.
 *
 *   node scripts/world-prompt.mjs cindra   → art/CINDRA-PROMPT.md
 *
 * Items go two chains per sheet (4 columns, each chain on its own pair of
 * rows, in merge order), producers 9 + the rest per sheet, then the board
 * tiles. Only what is still missing is asked for. The sheets can come back as
 * separate pictures or as one collage of all of them — both get cut. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = process.argv[2] || 'cindra';
const rd = f => JSON.parse(readFileSync(join(root, f), 'utf8'));
const chains = rd('src/content/chains.json'), worlds = rd('src/content/worlds.json'), manifest = rd('art/manifest.json');
const world = worlds[W]; if (!world) throw new Error('no world ' + W);
const by = {}; manifest.forEach(r => { by[r.path] = r; });
const have = p => existsSync(join(root, p));
const desc = r => { const p = r.prompt; const a = p.indexOf(' — '); return p.slice(a + 3, p.indexOf('. ', a)); };
const anyItem = manifest.find(r => r.kind === 'item' && (r.group || '').includes(world.name));
const palette = anyItem ? (anyItem.prompt.match(/[A-Z][\w ]+ palette — [^.]*\./) || [''])[0] : '';

const list = Object.entries(chains).filter(([, c]) => c.world === W)
  .filter(([, c]) => c.items.some(id => !have(`src/sprites/items/${id}.png`)));
const prods = manifest.filter(r => r.kind === 'producer' && (r.group || '').includes(world.name) && !have(r.path));
const tilesMissing = !have(`src/sprites/ui/tile_light_${W}.png`);
const tag = W.toLowerCase();

const out = [];
out.push(`# World: ${world.name} (${world.subtitle || W}) — art to generate

Paste the **setup message** first, then the sheets. Save into \`Desktop\\chatgpt art\` (any file name is fine; one collage of all sheets also works — it gets cut the same way).

To do: ${list.reduce((a, [, c]) => a + c.items.length, 0)} items in ${list.length} chains, ${prods.length} producers${tilesMissing ? ', the board tiles' : ''}.

---

## Setup message (send once)

We're continuing the art for my mobile merge game "Merge Rocket" (Travel Town style). This batch is the world **${world.name}**: ${world.intro || ''}
Keep EXACTLY the style of the attached references (our Meadow and Moon items and producers): one chunky, rounded, toy-like object per cell, soft glossy painterly semi-3D, bright saturated colours, warm key light from the upper left with one soft white highlight, shaded side a deeper richer version of the base colour (never grey/black), thin darker warm-brown edge line, small soft contact shadow, three-quarter view from ~30° above.
${palette} Friendly and inviting, never scary.

Rules for every SHEET:
- A grid exactly as specified, every object centred in its own cell with **wide empty gaps** — nothing touches or overlaps a neighbour (leave clear space even around beams, flames and smoke).
- Plain flat **pure white** or transparent background, no grid lines, no frames, no labels, no text anywhere.
- Reading order: left→right, then next row. Cells marked EMPTY stay empty.
- Inside a chain each step is clearly bigger, richer and more special than the last; step 1 tiny and plain, the last step a grand crown piece with a little sparkle.
- Square, 2048×2048 if you can. Every object must still read as a 60-pixel icon.

Attach **STYLE-REFERENCE.png** (in the chatgpt art folder) as the style reference.

**Send each sheet as its own message and save each result separately at full size.** Collages of many sheets in one picture come out too small to use.
`);
let n = 0;
for (let i = 0; i < list.length; i += 2) {
  n++;
  const pair = list.slice(i, i + 2);
  out.push(`---\n\n## Sheet ${n} → \`${tag}_sheet${n}.png\`\n\nGrid: **4 columns × ${pair.length * 2} rows**. ${pair.map(([, c], j) => `Rows ${j * 2 + 1}–${j * 2 + 2}: the "${c.name}" chain`).join('; ')}.\n`);
  for (const [j, [, c]] of pair.entries()) {
    out.push(`**${c.name}** (rows ${j * 2 + 1}–${j * 2 + 2}):`);
    c.items.forEach((id, x) => { const r = by[`src/sprites/items/${id}.png`]; out.push(`${x + 1}. ${r ? r.name + ' — ' + desc(r) : id}`); });
    if (c.items.length < 8) out.push(c.items.length === 7 ? '8. EMPTY' : `${c.items.length + 1}–8. EMPTY`);
    out.push('');
  }
}
const pd = r => { const p = r.prompt; return p.slice(p.indexOf(' — ') + 3, p.indexOf(', standing on')); };
for (let i = 0; i < prods.length; i += 9) {
  n++;
  const part = prods.slice(i, i + 9), cols = part.length > 4 ? 3 : 2;
  out.push(`---\n\n## Sheet ${n} → \`${tag}_sheet${n}.png\` (producers)\n\nGrid: **${cols} columns × ${Math.ceil(part.length / cols)} rows**. PRODUCERS: things the player taps to get items, so they read as scenery, not loot. Each stands on its own small round mound (the mound is part of the object and the only ground shown), slightly taller than wide, a touch bigger and more detailed than items.\n`);
  part.forEach((r, x) => out.push(`${x + 1}. ${r.name} — ${pd(r)}`));
  out.push('');
}
if (tilesMissing) {
  out.push(`---\n\n## Sheet ${++n} → \`${tag}_tiles.png\` (board tiles)\n\nGrid: **3 columns × 1 row**, wide gaps. Merge-board squares for ${world.name}, matching the shape, corner radius and bevel of the plain board tiles in STYLE-REFERENCE.png. Straight from above, perfectly square, calm in the middle.
1. Light tile — ${world.name} ground, very subtle texture.
2. Dark tile — the same, slightly deeper, for a gentle checkerboard.
3. Locked tile — the same tile buried under this world's "not yours yet" cover (ash, rubble, sand, cloud…), friendly, with a couple of small sparkles.
`);
}
const file = join(root, 'art', `${W.toUpperCase()}-PROMPT.md`);
writeFileSync(file, out.join('\n') + '\n');
console.log('wrote', file, '—', n, 'sheets');
