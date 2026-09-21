# Merge Rocket

Casual merge game (Travel Town style): gather on Earth, fill orders, survive a meteor crash,
rebuild a rocket and fly to new worlds — then spend your coins in the Trading Post and invent
relics in the Research Lab. TypeScript + PixiJS, wrapped with Capacitor for Android and iOS.

**Play it right now:** double-click `MergeRocket.html` — the whole game in one file, no install.

```bash
npm install
npm run dev        # http://localhost:5173, hot reload
npm test           # headless regression run (with dev running)
npm run build      # dist/ + a fresh MergeRocket.html
npm run android    # build, sync, open Android Studio
npm run apk        # build a debug APK to sideload
```

📱 **[MOBILE.md](MOBILE.md)** — putting it on a phone, Android and iOS.

📖 **[GAME.md](GAME.md)** is the handbook: every feature, how to play, how to run it on a
phone, how to add items/producers/worlds (all content is JSON), the tuning knobs, the
architecture and what's next.
