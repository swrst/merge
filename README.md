# Merge Rocket

Casual merge game (Travel Town style) built as a web app and shipped to phones with Capacitor.
Gather on Earth → fill orders → a meteor crashes → rebuild the rocket → fly to new worlds.

## Run it

```bash
npm install          # once
npm run dev          # http://localhost:5173, hot reload
```

Open the dev URL on your phone too (same Wi-Fi): Vite prints a `Network:` address.

## Build

```bash
npm run build        # -> dist/  and  MergeRocket.html
```

`MergeRocket.html` is a single self-contained file — double-click it to play, no server, no Node.
Good for quick playtests and for sending a build to someone.

## Android

Needs Android Studio (it brings the SDK and Gradle).

```bash
npm run android      # build + sync + open Android Studio
```

Then press Run. For a store build: Build → Generate Signed App Bundle, upload the `.aab` to
Play Console ($25 one-time developer fee).

## iOS

Needs a Mac with Xcode — that is Apple's rule, not Capacitor's.

```bash
npx cap add ios
npm run build && npx cap sync ios
npx cap open ios     # Xcode: set signing team, Run
```

No Mac? Use a cloud macOS builder (Codemagic, GitHub Actions macOS runner) — the repo builds
unchanged there. Apple Developer Program is $99/yr.

## Layout

```
index.html              app shell (HUD, board, tabs, modals)
src/main.ts             entry: icons, native setup, starts the game
src/game.ts             game loop: board, merging, orders, levels, story, worlds
src/art.ts              all artwork, drawn as inline SVG
src/native.ts           Capacitor bits: haptics, save mirroring, status bar
src/style.css           the whole look
resources/              source icon + splash (1024 / 2732)
android/                generated native project (committed, so it builds anywhere)
scripts/standalone.mjs  inlines dist/ into MergeRocket.html
```

## Notes

- Saves live in `localStorage` and are mirrored into Capacitor Preferences on device, so the OS
  can't evict progress. Reset from the ⚙️ menu in game.
- `npm run check` runs the TypeScript check. Types are deliberately loose for now (`strict: false`)
  since this came from a JS prototype — tighten as systems settle.
- Content (items, chains, producers, worlds, characters, missions) is in tables at the top of
  `src/game.ts`. Next refactor: move those into JSON so content can grow without touching code.
- After changing web code, `npx cap sync` copies the new build into the native projects.
