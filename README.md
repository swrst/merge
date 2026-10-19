# Galaxy Adventure

A Travel Town–style merge game set on alien planets.

- Merge items, fill contracts and restore five worlds chapter by chapter: Sunny Meadow → Crater Camp → Ember Hollow → Tidal Shallows → Aurora Reach.
- **1000 items in 155 chains, 129 producers**, 220 story chapters, a cast of aliens, the Lab, pets, the Star Album, constellations, monthly Star Expeditions, a shop, rewarded ads and in-app purchases.
- TypeScript + PixiJS (the board) + plain DOM (everything around it), wrapped with Capacitor 8 for Android (and later iOS).

## Commands

```bash
npm install
npm run dev              # http://localhost:5173 (dev panel in Settings)
npm run content          # rebuild src/content/*.json from scripts/content/*.mjs (must print "content OK")
npm run check            # type check
npm test                 # playtest regression run (needs `npm run dev` running)
node scripts/ux-check.mjs   # UI and services regression run (needs `npm run dev`)
npm run build            # test build: dist/ + GalaxyAdventure.html (whole game in one file)
npm run build:release    # store build: no tester tools, live ads (Vite mode "release")
npm run version:bump     # next version in version.json (do this before every Play upload)
build-apk.bat            # Windows: tester APK  -> GalaxyAdventure-test.apk
build-release.bat        # Windows: Play Store bundle -> GalaxyAdventure-<version>.aab
```

## Docs

| Doc | What |
|---|---|
| [docs/ANDROID-RELEASE.md](docs/ANDROID-RELEASE.md) | **publishing on Google Play, step by step** (accounts, keys, Firebase, AdMob, purchases, listing) |
| [docs/SERVICES.md](docs/SERVICES.md) | ads, purchases, analytics, crash reports, notifications, review: how each one goes live |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | code map, content pipeline, art pipeline, tests, phone builds |
| [docs/GAME.md](docs/GAME.md) | what is in the game, system by system |
| [docs/SOUND-PROMPTS.md](docs/SOUND-PROMPTS.md) | how to make and drop in new sounds and music |
| [site/](site/) | the public web page and privacy policy, on Firebase Hosting (`npm run site`) |
| [art/CATALOGUE.md](art/CATALOGUE.md) | every chain and producer, generated |
| [CHANGELOG.md](CHANGELOG.md) | what changed, version by version |

## Folders

```
src/              the game (game.ts, board.ts, expedition.ts, art.ts, audio.ts, services/)
src/content/      generated catalogue JSON (never edit by hand)
src/sprites/      painted art: items, producers, chars, scenes, ui
src/audio/        sounds and music (.ogg; an .mp3 with the same name overrides it)
scripts/          content generator, art tools, tests, release helpers
scripts/content/  the catalogue source: chains, producers, worlds, chapters, contracts
art/              art prompts, style reference, generated catalogue
android/ ios/     Capacitor native projects
resources/        app icon, splash, Play Store graphics and screenshots
docs/             everything you read
version.json      the one version number (Android and the game both read it)
```
