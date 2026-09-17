/* Bundles dist-standalone/ into one double-clickable HTML file (no server, no npm).
   Handy for quick playtesting and for sharing a build with someone. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist-standalone';
let html = readFileSync(join(dist, 'index.html'), 'utf8');

// a literal </script> inside bundled code would close the tag early
const escapeJs = s => s.replace(/<\/(script)/gi, '<\\/$1');
const escapeCss = s => s.replace(/<\/(style)/gi, '<\\/$1');

for (const file of readdirSync(join(dist, 'assets'))) {
  const body = readFileSync(join(dist, 'assets', file), 'utf8');
  // function replacements: the bundle contains $& / $' sequences that a string
  // replacement would treat as capture-group references
  if (file.endsWith('.css')) {
    html = html.replace(new RegExp(`<link[^>]*href="[^"]*${file}"[^>]*>`),
      () => `<style>\n${escapeCss(body)}\n</style>`);
  } else if (file.endsWith('.js')) {
    html = html.replace(new RegExp(`<script[^>]*src="[^"]*${file}"[^>]*></script>`),
      () => `<script type="module">\n${escapeJs(body)}\n</script>`);
  }
}
// icon links point at files we are not inlining
html = html.replace(/<link rel="(icon|apple-touch-icon)"[^>]*>\s*/g, '');

if (/<script[^>]*src=/.test(html) || /<link[^>]*stylesheet/.test(html)) {
  console.error('standalone: something did not inline — check dist-standalone/assets');
  process.exit(1);
}
writeFileSync('MergeRocket.html', html);
console.log('standalone -> MergeRocket.html', (html.length / 1024).toFixed(0) + ' kB');
