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
const DONE = new Set(["wood", "stone", "berry", "water", "grass", "flower", "honey", "mush", "cloth", "feather", "clay", "garden", "veggie", "stargaze", "visitor", "bakery", "tea", "pond", "toys", "picnic", "pets", "music", "parts", "weather", "moon", "glow", "dust", "ice", "crystal", "lantern", "silver", "comet", "lunamoth", "moonpup", "rover", "helium", "meteorite", "dish", "moonmelon", "magma", "shroom", "iron", "obsid", "glassw", "forge", "spice", "copper", "phoenix", "salamander"]);
const simple = d => {
  let w = (d || '').replace(/\s*\([^)]*\)/g, '').split(/,| with | on a | in a | under | over | that | which | full of | covered in | topped | stamped | tied | overflowing /)[0].trim().split(' ');
  while (w.length > 2 && /(ed|ing)$/.test(w[w.length - 1])) w.pop();
  return w.join(' ').replace(/\b(purple|lilac|violet|plum)\s*/gi, '');
};
const list = Object.entries(Array.isArray(chains) ? Object.fromEntries(chains.map(c => [c.id, c])) : chains)
  .filter(([k, c]) => !SKIP.has(k) && !DONE.has(k) && WORLDS.includes(c.world) && (c.items || []).length >= 3)
  .sort((a, b) => WORLDS.indexOf(a[1].world) - WORLDS.indexOf(b[1].world) || a[1].unlock - b[1].unlock);
let out = `# Galaxy Adventure: catalogue sheets

Send the SETUP from ART-PROMPTS.md first. Then one block per message (ChatGPT makes one image per message). ${list.length} sheets.

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
out += `\n## Producers (the ones still drawn as trees, bushes or plants)\n\n**${++n}. sheet_producers_new**\n\n\`\`\`\nSheet ${n}: producers. One image: a grid of 4×2, one object per cell, each on its own small round mound, left to right:\n1. Meteor Crater: a crater with a glowing meteor in it\n2. Snack Cart: a hovering snack vending cart\n3. Light Post: a glowing space lamp post\n4. Suit Loom: a machine sewing spacesuits\n5. Jet Workshop: a small hangar with a jetpack on a stand\n6. Fizz Vent: a bubbling soda vent with a tap\n7. Fire Gel Spring: a glowing orange gel pool\n8. Lava Lamp Spring: a pool with giant lava lamps growing out of it\n\`\`\`\n`;
writeFileSync('art/guides/ART-PROMPTS-ITEMS.md', out);
console.log('ART-PROMPTS-ITEMS.md:', n, 'sheets');
