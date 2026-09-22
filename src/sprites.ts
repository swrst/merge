/* Painted art, dropped in by hand.
 *
 * Everything the game draws is generated from shapes and materials, which is
 * how 286 items cost no drawing time. Generated art has a ceiling; a painted
 * sprite does not — so any PNG or WebP put in
 *
 *   src/sprites/items/<item id>.png           e.g. twig.png, royaljelly.png
 *   src/sprites/producers/<producer art>.png  e.g. tree.png, bush.png
 *   src/sprites/scenes/<world>.webp           e.g. earth.webp, luna.webp, lab.webp
 *
 * silently replaces the generated one everywhere: on the board, on the order
 * cards, in the catalogue, in the camp, behind the board. No code to change, no
 * manifest to keep, no content rebuild. Drop the file in and reload.
 *
 * They live under src/ rather than public/ on purpose: the build inlines them
 * into the single-file MergeRocket.html, which a public/ file would not be.
 *
 * Square, transparent background, object filling most of the frame, 256x256 is
 * plenty for a tile. ART.md has the full brief and the whole filename list.
 */

/* import.meta.glob is rewritten by the bundler at build time, so the pattern
   has to sit here literally — it cannot come from a variable. */
const ITEMS_G = import.meta.glob('./sprites/items/*.{png,webp,jpg,jpeg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const PRODS_G = import.meta.glob('./sprites/producers/*.{png,webp,jpg,jpeg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const SCENES_G = import.meta.glob('./sprites/scenes/*.{png,webp,jpg,jpeg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function byName(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.keys(files).forEach(path => {
    const name = (path.split('/').pop() || '').replace(/\.(png|webp|jpg|jpeg)$/i, '');
    if (name) out[name] = files[path];
  });
  return out;
}

export const SPRITE = {
  item: byName(ITEMS_G),
  producer: byName(PRODS_G),
  scene: byName(SCENES_G),
};

export const spriteCount = () =>
  Object.keys(SPRITE.item).length + Object.keys(SPRITE.producer).length + Object.keys(SPRITE.scene).length;
