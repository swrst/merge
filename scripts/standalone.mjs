/* Bundles dist/ into one double-clickable HTML file (no server, no npm needed).
   Handy for quick playtesting and for sharing a build with someone. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');

const assets = readdirSync(join(dist, 'assets'));
for (const file of assets) {
  const body = readFileSync(join(dist, 'assets', file), 'utf8');
  if (file.endsWith('.css')) {
    html = html.replace(new RegExp(`<link[^>]*href="[^"]*${file}"[^>]*>`), `<style>\n${body}\n</style>`);
  } else if (file.endsWith('.js')) {
    html = html.replace(new RegExp(`<script[^>]*src="[^"]*${file}"[^>]*></script>`),
      `<script type="module">\n${body}\n</script>`);
  }
}
// drop the icon links: they point at files we are not inlining
html = html.replace(/<link rel="(icon|apple-touch-icon)"[^>]*>\s*/g, '');
writeFileSync('MergeRocket.html', html);
console.log('standalone -> MergeRocket.html', (html.length / 1024).toFixed(0) + ' kB');
