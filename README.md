# Merge Rocket

A Travel Town–style merge game in space.

- Merge items, fill contracts and rebuild a village chapter by chapter.
- Fix the rocket and fly on to the next world: Sunny Meadow → Crater Camp → Ember Hollow → Tidal Shallows → Aurora Reach.
- **589 items in 97 chains, 90 producers**, a story with a cast of oddball aliens, events, side games, a Lab, a shop, and mocked ads and purchases ready to go live.
- Built with TypeScript + PixiJS, wrapped with Capacitor for Android and iOS.

**Play it right now:** open `MergeRocket.html` (made by `npm run build`). It is the whole game in one file.

```bash
npm install
npm run dev        # http://localhost:5173
npm run content    # rebuild the catalogue from scripts/content/*.mjs
npm test           # regression run (with dev running); also scripts/ux-check.mjs
npm run build      # dist/ + MergeRocket.html
build-apk.bat      # Windows: the tester APK
```

| Doc | What |
|---|---|
| [GAME.md](GAME.md) | handbook: every feature, the tuning, the architecture |
| [TESTING.md](TESTING.md) | building the tester APK and running a phone test |
| [MOBILE.md](MOBILE.md) | Android and iOS builds in detail |
| [SERVICES.md](SERVICES.md) | ads, purchases, store, notifications (mock-first) |
| [ROADMAP.md](ROADMAP.md) | what's next |
| [ART.md](ART.md) | how art gets in, and what's still to paint |
| [art/CATALOGUE.md](art/CATALOGUE.md) | every chain, in order |
