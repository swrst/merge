# Merge Rocket

Casual merge game in the Travel Town mould, with a story of its own: the Bloom collapsed,
the worlds went dormant, and your rocket is the last **Seed Vault**. Gather and merge, fill
orders, survive a meteor crash, rebuild the rocket, and fly to five worlds — each one asleep
until you finish its chains, feed its Heart, and watch it come back to life.

**286 items across 57 chains**, earned two starters at a time — max out every producer you
own before the next one takes root — four side games, constellations you light for permanent
blessings, a Trading Post and a Research Lab, a painted camp and lab you tap your way around,
and a side rail instead of a bottom dock. TypeScript + PixiJS, wrapped with Capacitor for
Android and iOS.

**Play it right now:** double-click `MergeRocket.html` — the whole game in one file, no install.

```bash
npm install
npm run dev        # http://localhost:5173, hot reload
npm run content    # rebuild the catalogue from scripts/content/*.mjs
npm test           # headless regression run (with dev running)
npm run build      # dist/ + a fresh MergeRocket.html
npm run android    # build, sync, open Android Studio
npm run apk        # build a debug APK to sideload
```

📱 **[MOBILE.md](MOBILE.md)** — putting it on a phone, Android and iOS.

📖 **[GAME.md](GAME.md)** is the handbook: every feature, how to play, how to run it on a
phone, how to add items/producers/worlds (all content is JSON), the tuning knobs, the
architecture and what's next.
