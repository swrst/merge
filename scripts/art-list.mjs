/* Which painted sprites exist, and which are still generated.
   Usage:  npm run art            (summary)
           npm run art -- --todo  (just the missing filenames, one per line) */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const items = read('src/content/items.json');
const chains = read('src/content/chains.json');
const prods = read('src/content/producers.json');
const worlds = read('src/content/worlds.json');

const have = d => existsSync(join(root, d))
  ? new Set(readdirSync(join(root, d)).map(f => f.replace(/\.(png|webp|jpg|jpeg)$/i, '')))
  : new Set();
const hi = have('src/sprites/items'), hp = have('src/sprites/producers'), hs = have('src/sprites/scenes');

const todo = process.argv.includes('--todo');
const missing = [];
for (const [k, c] of Object.entries(chains))
  for (const id of c.items) if (!hi.has(id)) missing.push(['items', id, items[id].name, c.name]);
for (const [k, p] of Object.entries(prods)) if (!hp.has(p.art)) missing.push(['producers', p.art, p.name, 'producer']);
for (const k of Object.keys(worlds)) if (!hs.has(k)) missing.push(['scenes', k, worlds[k].name, 'backdrop']);
if (!hs.has('lab')) missing.push(['scenes', 'lab', 'Research Lab', 'backdrop']);

if (todo) {
  missing.forEach(([dir, id]) => console.log(`src/sprites/${dir}/${id}.png`));
} else {
  console.log(`painted: ${hi.size} items, ${hp.size} producers, ${hs.size} scenes`);
  console.log(`still generated: ${missing.filter(m => m[0] === 'items').length} items, `
    + `${missing.filter(m => m[0] === 'producers').length} producers, `
    + `${missing.filter(m => m[0] === 'scenes').length} scenes`);
  let chain = '';
  missing.filter(m => m[0] === 'items').forEach(([, id, name, ch]) => {
    if (ch !== chain) { chain = ch; console.log(`\n  ${chain}`); }
    console.log(`    ${id}.png`.padEnd(28) + name);
  });
  console.log('\n  producers');
  missing.filter(m => m[0] === 'producers').forEach(([, id, name]) => console.log(`    ${id}.png`.padEnd(28) + name));
  console.log('\n  scenes');
  missing.filter(m => m[0] === 'scenes').forEach(([, id, name]) => console.log(`    ${id}.webp`.padEnd(28) + name));
}
