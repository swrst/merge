# Orbital Holo UI — B/C combination

A pearl ceramic and orbital gold instrument system with mint projector details.
The art stays colorful; neutral reading surfaces support it. Galaxy and Star Chart
retain dark space, Camp and Lab retain their painted scenes, and planets and
expeditions retain their own backgrounds. This is not parchment or wood.

## Categorized original sheets

Each source sheet is a transparent 3-column × 2-row grid; read left to right.

| Sheet | Top row | Bottom row |
| --- | --- | --- |
| [01 Panels](sheets/01-panels.png) | Pearl panel, petrol panel, mint holo panel | Pearl title, petrol dock, collectible card |
| [02 Controls](sheets/02-controls.png) | Primary, secondary, completion | Disabled, selected tab, unselected tab |
| [03 Navigation](sheets/03-navigation.png) | Projector, Galaxy, Camp | Lab, Star Chart, Missions |
| [04 Board](sheets/04-board.png) | Pearl tile, mint tile, locked crater tile | Storage socket, selected tile, reward tile |

Generated with the built-in image generation tool, using the user's
STYLE-REFERENCE.png as the art reference. Original sheets are preserved here;
24 optimized WebP sprites are additive `src/sprites/ui/oh_*` files. No original
art was deleted or overwritten. `manifest.json` records extraction bounds.
`python3 scripts/extract-orbital-ui.py` reproduces extraction (Pillow, NumPy, SciPy).

## Runtime use

- New default: Orbital Holo. Settings → Orbital Holo UI switches back to the
  original Space Hologram design immediately. The preference persists separately
  from `mergeRocket_v2`; no save migration or reset is required.
- `src/themes/orbital.css` is an isolated, theme-scoped stylesheet loaded last.
- `src/themes/theme.ts` owns selection and live icon refresh. The Pixi board
  redraws tile textures on the theme event, preserving every item and position.
- Generated control/dock, navigation, board and collection art is integrated.
  Large variable-height panels are CSS surfaces so content is never baked into
  a stretched image. Remaining variants are supplied as reusable kit assets.
- All labels, counts, tabs and actions remain live HTML; no generated text ships.
- The same tokens cover Mission Log, shop, collections, achievements, profile,
  energy, storage, upgrades, rewards, tutorials, mini-games and expedition panels.
- Reduced-motion mode removes decorative CSS animation; keyboard focus is visible.

## Validation

`npm run check`, `npm run build`, and `node scripts/orbital-ui-review.mjs`.
The last command needs a running dev server and Playwright Chromium. It captures
28 views, checks visible image loading and horizontal page overflow, and tests
both theme choices, persistence and inventory preservation. GitHub Actions
uploads the images and report as `orbital-ui-review`. Review screenshots before
merging; image-generation concepts are not screenshots of the implemented game.
