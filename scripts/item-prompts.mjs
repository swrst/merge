/* Writes art/guides/ART-PROMPTS-ITEMS.md: one SIMPLE-icon sheet prompt per
   chain, for redrawing the whole catalogue in a clean, readable style.
   Order = the order a player meets the chains (world, then unlock level).
     node scripts/item-prompts.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
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

> ICON STYLE, VERY SIMPLE: each object is one big chunky shape you can name in one word, with a bold dark outline, 2–3 main colours and one soft highlight. No small parts, no sparkles, no stars or planets painted on it, no scenery and no ground or grass under it. The object fills 80% of its cell. It must be recognisable at 40 px, like a mobile-game inventory icon. Each step must look clearly bigger or richer than the step before.

Save as \`sheet_<chain>\` and drop it in \`chatgpt art\`. ${list.length} sheets in total.

`;
let n = 0, cur = '';
for (const [k, c] of list) {
  if (c.world !== cur) { cur = c.world; out += `\n## ${WNAME[cur]}\n\n`; }
  const ids = c.items, cols = ids.length > 6 ? 4 : 3, rows = Math.ceil(ids.length / cols), empty = cols * rows - ids.length;
  n++;
  out += `**${n}. sheet_${k}**: ${c.name} (grid ${cols}×${rows}${empty ? `, last ${empty > 1 ? empty + ' cells' : 'cell'} EMPTY` : ''})\n`;
  out += ids.map((id, i) => `${i + 1}. ${items[id] ? items[id].name : id}: ${simple(notes[id]) || items[id]?.name}`).join('\n') + '\n\n';
}
writeFileSync('art/guides/ART-PROMPTS-ITEMS.md', out);
console.log('ART-PROMPTS-ITEMS.md:', n, 'sheets');
