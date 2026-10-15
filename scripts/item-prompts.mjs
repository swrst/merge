/* Writes art/guides/ART-PROMPTS-ITEMS.md: a ChatGPT sheet prompt for every chain
   and producer that has no painted sprite yet (nothing, once the catalogue is
   drawn), followed by art/guides/prompts-extra.md for one-off UI art.
   Order = the order a player meets the chains (world, then unlock level).
     npm run art:prompts */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const chains = JSON.parse(readFileSync('src/content/chains.json', 'utf8'));
const items = JSON.parse(readFileSync('src/content/items.json', 'utf8'));
const prods = JSON.parse(readFileSync('src/content/producers.json', 'utf8'));
const notes = JSON.parse(readFileSync('art/notes.json', 'utf8')).items || {};
const WORLDS = ['earth', 'luna', 'cindra', 'nerith', 'vela', 'any'];
const WNAME = { earth: 'Sunny Meadow', luna: 'Crater Camp', cindra: 'Ember Hollow', nerith: 'Tidal Shallows', vela: 'Aurora Reach', any: 'Everywhere (events, lab, junk)' };
const painted = (dir, id) => ['webp', 'png'].some(x => existsSync(`src/sprites/${dir}/${id}.${x}`));

/* a short "what to draw" from the item's note: the first clause */
const simple = d => (d || '').replace(/\s*\([^)]*\)/g, '').split(/,| with | that | which /)[0].trim();

const missing = Object.entries(chains)
  .filter(([, c]) => WORLDS.includes(c.world) && c.items.some(id => !painted('items', id)))
  .sort((a, b) => WORLDS.indexOf(a[1].world) - WORLDS.indexOf(b[1].world) || a[1].unlock - b[1].unlock);

let out = `# Galaxy Adventure: catalogue sheets still to draw

Send the SETUP from ART-PROMPTS.md first, with STYLE-REFERENCE.png. Then one block per message (ChatGPT makes one image per message).

`;
let n = 0, cur = '';
for (const [k, c] of missing) {
  if (c.world !== cur) { cur = c.world; out += `\n## ${WNAME[cur]}\n\n`; }
  const ids = c.items, cols = ids.length > 6 ? 4 : 3, rows = Math.ceil(ids.length / cols), empty = cols * rows - ids.length;
  n++;
  out += `**${n}. sheet_${k}** (${c.name})\n\n\`\`\`\nOne image: a grid of ${cols}×${rows}${empty ? ` with the last ${empty > 1 ? empty + ' cells' : 'cell'} empty` : ''}, one object per cell, left to right:\n`
    + ids.map((id, i) => `${i + 1}. ${simple(notes[id]) || items[id].name}`).join('\n') + '\n```\n\n';
}

const prodList = Object.entries(prods).filter(([id, p]) => !painted('producers', p.art || id));
if (prodList.length) {
  out += `\n## Producers still to draw\n\n\`\`\`\nOne image: a grid of 4×${Math.ceil(prodList.length / 4)}, one producer per cell, each standing on its own small round patch of ground, left to right:\n`
    + prodList.map(([, p], i) => `${i + 1}. ${p.name}: ${p.desc || 'the place that makes ' + (items[p.drops?.[0]]?.name || 'things')}`).join('\n') + '\n```\n\n';
}
if (!n && !prodList.length) out += 'Every item and producer in the game has its painted art.\n\n';

out += readFileSync('art/guides/prompts-extra.md', 'utf8');
writeFileSync('art/guides/ART-PROMPTS-ITEMS.md', out);
console.log('ART-PROMPTS-ITEMS.md:', n, 'chain sheets,', prodList.length, 'producers missing art');
