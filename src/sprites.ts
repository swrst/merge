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
 * into the single-file GalaxyAdventure.html, which a public/ file would not be.
 *
 * Square, transparent background, object filling most of the frame, 256x256 is
 * plenty for a tile. ART.md has the full brief and the whole filename list.
 */

/* import.meta.glob is rewritten by the bundler at build time, so the pattern
   has to sit here literally — it cannot come from a variable. */
const ITEMS_G = import.meta.glob('./sprites/items/*.{png,webp,jpg,jpeg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const PRODS_G = import.meta.glob('./sprites/producers/*.{png,webp,jpg,jpeg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const SCENES_G = import.meta.glob('./sprites/scenes/*.{png,webp,jpg,jpeg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const UI_G = import.meta.glob('./sprites/ui/*.{png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const CHARS_G = import.meta.glob('./sprites/chars/*.{png,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

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
  ui: byName(UI_G),
  char: byName(CHARS_G),
};

/* The holographic projector kit (art/ui/holo, painted in ChatGPT) stands in for
   older pieces under their old names, so every icon, emoji twin and painted UI
   lookup in the game picks it up without touching each call. Off in the
   classic look (Settings), which reloads the game. */
export const HOLO_ALIAS: Record<string, string> = {
  // only art that lives inside popups, rewards and the board: the HUD, side buttons, dock and nav icons keep their own
  gem_s: 'hq_gems', coin_s: 'hq_coins',
  chest_opening: 'hx_capsule', complete_stamp: 'hx_seal', victory_banner: 'hx_banner', seal_bubble: 'hs_sealed',
  ic_sound: 'ic2_sound', ic_music: 'ic2_music', ic_games: 'ic2_games', pp_buddy: 'bot_idle', oh_projector: 'bot_idle',
};
export const holoOn = (() => { try { return localStorage.getItem('galaxyAdventure.uiTheme') !== 'classic'; } catch { return true; } })();
if (holoOn) Object.entries(HOLO_ALIAS).forEach(([k, v]) => { if (SPRITE.ui[v]) SPRITE.ui[k] = SPRITE.ui[v]; });

/* Painted UI pieces are skinned in through CSS: each file becomes a custom
   property (--ui-btn_green) and a class on <html> (ui-btn_green), and
   style.css only swaps the look when that class is there. No file, no change. */
if (typeof document !== 'undefined') {
  const root = document.documentElement;
  Object.entries(SPRITE.ui).forEach(([k, url]) => {
    root.style.setProperty('--ui-' + k, `url("${url}")`);
    root.classList.add('ui-' + k);
  });
  if (SPRITE.char.player) root.classList.add('has-player');
}

export const spriteCount = () =>
  Object.keys(SPRITE.item).length + Object.keys(SPRITE.producer).length + Object.keys(SPRITE.scene).length
  + Object.keys(SPRITE.ui).length + Object.keys(SPRITE.char).length;
