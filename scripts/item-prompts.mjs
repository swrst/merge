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
  return w.join(' ').replace(/\b(purple|lilac|violet|plum)\s*/gi, '');
};
const list = Object.entries(Array.isArray(chains) ? Object.fromEntries(chains.map(c => [c.id, c])) : chains)
  .filter(([k, c]) => !SKIP.has(k) && WORLDS.includes(c.world) && (c.items || []).length >= 3)
  .sort((a, b) => WORLDS.indexOf(a[1].world) - WORLDS.indexOf(b[1].world) || a[1].unlock - b[1].unlock);
const STYLE = 'COLOURS: use the main colour named above for this sheet, with one or two warm accents. Do NOT make everything purple; purple only when the sheet asks for it. Space / extraterrestrial objects only: no Earth trees, plants, berries, fruit, bread or Earth animals. Travel Town–style items: clean, friendly and easy to recognise at a glance, with soft glossy shading and a soft outline. Keep the details light: no clutter, no sparkles everywhere, and no ground or grass under the object. Each object fills about 80% of its cell, and each step looks clearly bigger or richer than the step before. Plain white background, square 1024×1024, no text, equal cells, objects not touching. Match the drawing style of the reference image, but not its colours.';
let out = `# Galaxy Adventure: catalogue redo, Travel Town style

ChatGPT makes ONE image per message. So each block below is one complete message: copy one block, send it, wait for the image, then send the next block. Attach STYLE-REFERENCE.png to the first message, or to every message if the style drifts.

(In agent mode you can instead paste several blocks and say "make each block as its own separate image".)

Save the images into \`chatgpt art\` with the sheet name. ${list.length} sheets in total.

`;
/* every sheet gets its own main colour so the board is a mix, not a wall of purple */
const COLOR = { wood: 'steel grey and warm orange', stone: 'sandy beige and teal crystal', berry: 'bright orange and cream', water: 'clear sky blue', grass: 'sunny yellow and deep blue', flower: 'warm yellow light', honey: 'golden amber', mush: 'red and white', cloth: 'white and orange', feather: 'red and silver', clay: 'terracotta orange', garden: 'lime green', veggie: 'fresh green and white', stargaze: 'brass gold and navy', visitor: 'mint green', bakery: 'cheese yellow', tea: 'pink and turquoise', pond: 'lime slime green', toys: 'primary red, blue and yellow', picnic: 'brown cardboard and orange', pets: 'pastel pink and mint', music: 'gold and red', parts: 'white and red', weather: 'sky blue and white', potion: 'green', junk: 'rusty orange and grey' };
const ROT = ['coral red', 'sunny yellow', 'sky blue', 'lime green', 'orange', 'turquoise', 'pink', 'gold', 'silver and blue', 'mint green', 'warm brown', 'cherry red'];
let n = 0, cur = '';
for (const [k, c] of list) {
  if (c.world !== cur) { cur = c.world; out += `\n## ${WNAME[cur]}\n\n`; }
  const ids = c.items, cols = ids.length > 6 ? 4 : 3, rows = Math.ceil(ids.length / cols), empty = cols * rows - ids.length;
  n++;
  const redo = REDO[k];
  if (redo && redo[1].length !== ids.length) throw new Error(`REDO ${k}: ${redo[1].length} steps, chain has ${ids.length}`);
  const col = COLOR[k] || ROT[n % ROT.length];
  const head = `Sheet ${n}: ${redo ? redo[0] : c.name}. Main colour: ${col}. One image: a grid of ${cols}×${rows}${empty ? ` with the last ${empty > 1 ? empty + ' cells' : 'cell'} empty` : ''}, one object per cell, left to right:`;
  const lines = ids.map((id, i) => `${i + 1}. ${redo ? redo[1][i] : simple(notes[id]) || items[id]?.name}`).join('\n');
  out += `**${n}. sheet_${k}**\n\n\`\`\`\n${head}\n${lines}\n${CREATURES.has(k) ? 'These are cute, round, funny alien creatures in the style of Bob and Bloop in the reference.\n' : ''}${STYLE}\n\`\`\`\n\n`;
}
writeFileSync('art/guides/ART-PROMPTS-ITEMS.md', out);
console.log('ART-PROMPTS-ITEMS.md:', n, 'sheets');
