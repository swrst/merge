/* Writes art/guides/ART-PROMPTS-ITEMS.md: one SIMPLE-icon sheet prompt per
   chain, for redrawing the whole catalogue in a clean, readable style.
   Order = the order a player meets the chains (world, then unlock level).
     node scripts/item-prompts.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import { REDO, CREATURES } from './content/alien-redo.mjs';
const chains = JSON.parse(readFileSync('src/content/chains.json', 'utf8'));
const items = JSON.parse(readFileSync('src/content/items.json', 'utf8'));
const notes = JSON.parse(readFileSync('art/notes.json', 'utf8')).items || {};
const WORLDS = ['earth', 'luna', 'cindra', 'nerith', 'vela', 'any'];
const WNAME = { earth: 'Sunny Meadow', luna: 'Crater Camp', cindra: 'Ember Hollow', nerith: 'Tidal Shallows', vela: 'Aurora Reach', any: 'Everywhere (events, lab, junk)' };
const SKIP = new Set(['scrap', 'relic', 'bloom', 'chest', 'rainbow']);
const simple = d => {
  let w = (d || '').replace(/\s*\([^)]*\)/g, '').split(/,| with | on a | in a | under | over | that | which | full of | covered in | topped | stamped | tied | overflowing /)[0].trim().split(' ');
  while (w.length > 2 && /(ed|ing)$/.test(w[w.length - 1])) w.pop();
  return w.join(' ');
};
const list = Object.entries(Array.isArray(chains) ? Object.fromEntries(chains.map(c => [c.id, c])) : chains)
  .filter(([k, c]) => !SKIP.has(k) && WORLDS.includes(c.world) && (c.items || []).length >= 3)
  .sort((a, b) => WORLDS.indexOf(a[1].world) - WORLDS.indexOf(b[1].world) || a[1].unlock - b[1].unlock);
let out = `# Galaxy Adventure: catalogue redo in SIMPLE icon style

Every item gets redrawn simpler, chain by chain, in the order players meet them. Send the SETUP from ART-PROMPTS.md once, then one sheet per message.

**Add this paragraph to EVERY sheet:**

> Space / extraterrestrial objects only: no Earth trees, plants, berries, fruit, bread or Earth animals. Travel Town–style items: clean, friendly and easy to recognise at a glance, with soft glossy shading and a soft outline. Keep the details light: no clutter, no sparkles everywhere, and no ground or grass under the object. Each object fills about 80% of its cell, and each step looks clearly bigger or richer than the step before.

Save as \`sheet_<chain>\` and drop it in \`chatgpt art\`. ${list.length} sheets in total.

`;
let n = 0, cur = '';
for (const [k, c] of list) {
  if (c.world !== cur) { cur = c.world; out += `\n## ${WNAME[cur]}\n\n`; }
  const ids = c.items, cols = ids.length > 6 ? 4 : 3, rows = Math.ceil(ids.length / cols), empty = cols * rows - ids.length;
  n++;
  const redo = REDO[k];
  if (redo && redo[1].length !== ids.length) throw new Error(`REDO ${k}: ${redo[1].length} steps, chain has ${ids.length}`);
  out += `**${n}. sheet_${k}**: ${redo ? redo[0] : c.name} (grid ${cols}×${rows}${empty ? `, last ${empty > 1 ? empty + ' cells' : 'cell'} EMPTY` : ''})${CREATURES.has(k) ? ': cute, round, funny alien creatures in the style of Bob and Bloop' : ''}\n`;
  out += ids.map((id, i) => `${i + 1}. ${redo ? redo[1][i] : simple(notes[id]) || items[id]?.name}`).join('\n') + '\n\n';
}
writeFileSync('art/guides/ART-PROMPTS-ITEMS.md', out);
console.log('ART-PROMPTS-ITEMS.md:', n, 'sheets');
