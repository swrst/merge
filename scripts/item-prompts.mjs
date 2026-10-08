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
/* sheets already redrawn and in the game */
const DONE = new Set(["basalt", "wood", "stone", "berry", "water", "grass", "flower", "honey", "mush", "cloth", "feather", "clay", "garden", "veggie", "stargaze", "visitor", "bakery", "tea", "pond", "toys", "picnic", "pets", "music", "parts", "weather", "moon", "glow", "dust", "ice", "crystal", "lantern", "silver", "comet", "lunamoth", "moonpup", "rover", "helium", "meteorite", "dish", "moonmelon", "magma", "shroom", "iron", "obsid", "glassw", "forge", "spice", "copper", "phoenix", "salamander", "rubyc", "sulfur", "emberfruit", "shellc", "steam", "fishc", "pearlc", "coralc", "tide", "kelp", "salt", "sunkn", "lumin", "squid", "turtle", "harbour", "seaglass", "urchin", "manta", "cloudc", "aurorac", "starc", "wind", "skyfruit", "chime", "prismv", "skynest", "balloonc", "starling", "satellite", "nebula", "starflower", "planets", "kite", "ev_star", "ev_lantern", "ev_candy", "potion", "junk"]);
const simple = d => {
  let w = (d || '').replace(/\s*\([^)]*\)/g, '').split(/,| with | on a | in a | under | over | that | which | full of | covered in | topped | stamped | tied | overflowing /)[0].trim().split(' ');
  while (w.length > 2 && /(ed|ing)$/.test(w[w.length - 1])) w.pop();
  return w.join(' ').replace(/\b(purple|lilac|violet|plum)\s*/gi, '');
};
const list = Object.entries(Array.isArray(chains) ? Object.fromEntries(chains.map(c => [c.id, c])) : chains)
  .filter(([k, c]) => !SKIP.has(k) && !DONE.has(k) && WORLDS.includes(c.world) && (c.items || []).length >= 3)
  .sort((a, b) => WORLDS.indexOf(a[1].world) - WORLDS.indexOf(b[1].world) || a[1].unlock - b[1].unlock);
let out = `# Galaxy Adventure: catalogue sheets

Send the SETUP from ART-PROMPTS.md first, with STYLE-REFERENCE.png. Then one block per message (ChatGPT makes one image per message).

`;
let n = 0, cur = '';
for (const [k, c] of list) {
  if (c.world !== cur) { cur = c.world; out += `\n## ${WNAME[cur]}\n\n`; }
  const ids = c.items, cols = ids.length > 6 ? 4 : 3, rows = Math.ceil(ids.length / cols), empty = cols * rows - ids.length;
  n++;
  const redo = REDO[k];
  if (redo && redo[1].length !== ids.length) throw new Error(`REDO ${k}: ${redo[1].length} steps, chain has ${ids.length}`);
  const head = `Sheet ${n}: ${redo ? redo[0] : c.name}. One image: a grid of ${cols}×${rows}${empty ? ` with the last ${empty > 1 ? empty + ' cells' : 'cell'} empty` : ''}, one object per cell, left to right:`;
  const lines = ids.map((id, i) => `${i + 1}. ${redo ? redo[1][i] : simple(notes[id]) || items[id]?.name}`).join('\n');
  out += `**${n}. sheet_${k}**\n\n\`\`\`\n${head}${CREATURES.has(k) ? ' (alien critters)' : ''}\n${lines}\n\`\`\`\n\n`;
}
/* producers: every one, redrawn to match the new items, 16 to a sheet */
const PRODS = JSON.parse(readFileSync('src/content/producers.json', 'utf8'));
const plist = (Array.isArray(PRODS) ? PRODS : Object.entries(PRODS).map(([id, v]) => ({ id, ...v })))
  .filter(p => !['wreck', 'crater'].includes(p.id));
const wOf = p => { const d = (p.drops || [])[0]; const it = items[d]; const ch = it && chains[it.chain]; return ch ? ch.world : 'any'; };
const pw = {}; plist.forEach(p => (pw[wOf(p)] = pw[wOf(p)] || []).push(p));
/* every producer was redrawn in v43; flip this to print the producer sheets again */
const PRODS_DONE = true;
if (!PRODS_DONE) out += `\n## Producers (every producer redrawn to match the new items)\n\n`;
let pk = 0;
for (const w of PRODS_DONE ? [] : WORLDS) {
  const ps = pw[w] || [];
  for (let i = 0; i < ps.length; i += 16) {
    const part = ps.slice(i, i + 16), cols = 4, rows = Math.ceil(part.length / cols), empty = cols * rows - part.length;
    pk++;
    out += `**P-${pk}. sheet_producers_${w}${ps.length > 16 ? '_' + (i / 16 + 1) : ''}**\n\n\`\`\`\nProducers for ${WNAME[w]}. One image: a grid of ${cols}×${rows}${empty ? ` with the last ${empty > 1 ? empty + ' cells' : 'cell'} empty` : ''}, one object per cell, each standing on its own small plain round mound, left to right:\n`
      + part.map((p, k) => `${k + 1}. ${p.name}: the place or machine that makes ${items[p.drops[0]] ? items[p.drops[0]].name.toLowerCase().replace(/(x|s|sh|ch)$/, '$1e') + 's' : 'things'}`).join('\n') + '\n```\n\n';
  }
}
out += readFileSync('art/guides/prompts-extra.md', 'utf8');
writeFileSync('art/guides/ART-PROMPTS-ITEMS.md', out);
console.log('ART-PROMPTS-ITEMS.md:', n, 'sheets');
