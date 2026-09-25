/* Which painted sprites exist, which are still generated, and the prompts for
   the next batch.

   Usage:  npm run art                         summary, batch by batch
           npm run art -- --todo               just the missing paths, one per line
           npm run art -- --batch chain-wood   the prompts for one batch, ready to paste
           npm run art -- --batch scenes --missing   ...only the ones not painted yet

   Reads art/manifest.json (npm run art:manifest). Batches, in the order to paint
   them: scenes, ui, starters, then chains world by world, producers, fx. */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows = JSON.parse(readFileSync(join(root, 'art/manifest.json'), 'utf8'));
const args = process.argv.slice(2);
const has = r => existsSync(join(root, r.path))
  || existsSync(join(root, r.path.replace(/\.(png|webp)$/, r.path.endsWith('.png') ? '.webp' : '.png')));

const ORDER = ['scenes', 'ui', 'starters'];
const batches = [...new Set(rows.map(r => r.batch))].sort((a, b) => {
  const rank = x => ORDER.includes(x) ? ORDER.indexOf(x) : x === 'producers' ? 90 : x === 'fx' ? 99 : 10;
  return rank(a) - rank(b);                         // Array.sort is stable: chains keep catalogue order
});

const bi = args.indexOf('--batch');
if (bi >= 0) {
  const name = args[bi + 1];
  const mine = rows.filter(r => r.batch === name && (!args.includes('--missing') || !has(r)));
  if (!mine.length) {
    console.error(`no batch "${name}". Batches: ${batches.join(', ')}`);
    process.exit(1);
  }
  console.log(`# Batch ${name} — ${mine.length} image(s)\n`);
  mine.forEach((r, i) => {
    console.log(`## ${i + 1}. ${r.name}${has(r) ? '  (already painted)' : ''}`);
    console.log(`Save as: ${r.path}\n`);
    console.log(r.prompt + '\n');
    console.log(`Negative: ${r.negative}\n`);
  });
} else if (args.includes('--todo')) {
  rows.filter(r => !has(r)).forEach(r => console.log(r.path));
} else {
  const done = rows.filter(has).length;
  console.log(`painted ${done} of ${rows.length} assets\n`);
  for (const b of batches) {
    const mine = rows.filter(r => r.batch === b), n = mine.filter(has).length;
    const mark = n === mine.length ? '✓' : n ? '…' : ' ';
    console.log(`  ${mark} ${b.padEnd(22)} ${String(n).padStart(3)}/${mine.length}   ${mine[0].group}`);
  }
  console.log('\nnpm run art -- --batch <name>   prints that batch\'s prompts');
  console.log('npm run dev, then /art/sheet.html?batch=<name>   checks the files you dropped in');
}
