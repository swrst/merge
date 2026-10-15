# Development

## Code map

| File | What |
|---|---|
| `src/main.ts` | boot: fonts, screen fitting, save hydration, services, error screen |
| `src/game.ts` | the game: state and save (`S`, `migrate()`), HUD, contracts, chapters, producers, shop, Lab, pets, album, events, constellations, story, popups |
| `src/board.ts` | the PixiJS merge board: tiles, sprites, drag and drop, merge animations and effects, a safety net that keeps sprites in sync with the save |
| `src/expedition.ts` | Star Expeditions, the monthly event board (self-contained, DOM) |
| `src/art.ts`, `src/artgen.ts`, `src/sprites.ts` | painted sprites by id, with generated SVG stand-ins as a fallback |
| `src/audio.ts` | Web Audio: sound effects, music beds, ambience |
| `src/native.ts` | Capacitor glue: haptics, save mirror, status bar, Android back button |
| `src/services/` | ads, purchases, analytics, notifications, review, games, share (see SERVICES.md) |
| `src/style.css` | all styling; later blocks override earlier ones (the current look is "Holo Command", near the end) |
| `index.html` | the shell markup |

The save lives in `localStorage` under `mergeRocket_v2` (mirrored to Capacitor Preferences on phones). **Never rename that key or remove fields without a step in `migrate()`**: every old save is upgraded there on load.

## Content pipeline

The catalogue is written in `scripts/content/*.mjs` and compiled to `src/content/*.json`:

```bash
npm run content       # must print "content OK"
```

| Source | What |
|---|---|
| `chains.mjs` | chains: `[key, Name, world, unlockLevel, 'id|Name|shape|material|description', …]` |
| `producers.mjs` | producers: `['world', level, 'id|Name|art|nrg:1 or bat:10/60|drops|description']`; level 99 = a story chapter unlocks it |
| `projects.mjs`, `projects-more.mjs` | story chapters per world (what they ask, what they unlock) |
| `contracts.mjs` | which chains contracts may ask for (every chain needs an entry) |
| `worlds.mjs` | worlds, villagers, start boards, growth schedule |

The generator refuses broken content (unknown ids, unreachable chains, producers nothing unlocks).

## Art pipeline

All art is painted in ChatGPT (only ChatGPT art may ship). Settings prompt: `art/guides/ART-PROMPTS.md` + `STYLE-REFERENCE.png`.

1. `npm run art:prompts` → `art/guides/ART-PROMPTS-ITEMS.md` lists every chain or producer without art (empty when everything is drawn) plus one-off UI prompts from `prompts-extra.md`.
2. Cut each object from the sheet (transparent background), name it by id, drop it in `src/sprites/items|producers|chars|ui`.
3. `npm run art:optimize` (resizes to WebP/PNG) and `npm run art:manifest` (refreshes `art/CATALOGUE.md`).

UI art is picked up by name: `ART.uiIcon('name')`, `ART.spriteUi('name')`, CSS var `--ui-name`. Emoji in game text that have a painted twin are swapped automatically (`EMO` in `game.ts`).

## Sound

`src/audio/*.ogg`; an `.mp3` with the same name overrides it. `docs/SOUND-PROMPTS.md` has prompts for every sound and music track. `scripts/make-sound.py` regenerates the built-in procedural pack.

## Tests

With `npm run dev` running:

```bash
npm test                     # scripts/playtest.mjs: a full scripted run through the game
node scripts/ux-check.mjs    # screens, popups, services
node scripts/bot.mjs         # pacing bot: how long chapters take for a new player
```

## Phone builds

- **Tester APK (Windows):** `build-apk.bat` → `GalaxyAdventure-test.apk`, send it to testers.
- **Android Studio:** `npm run android` builds, syncs and opens the project; press Run.
- **Store bundle:** `build-release.bat` → `GalaxyAdventure-<version>.aab` (see ANDROID-RELEASE.md).
- **iPhone:** needs a Mac with Xcode: `npm run ios`.

If Gradle cannot find the SDK, create `android/local.properties` with `sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk`.

## Tester tools

In test builds: Settings → tap the version line 5 times → buttons for energy, coins, gems, refills, chapter items and XP. Never in store builds.
