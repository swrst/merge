# Merge Rocket — handbook

A kid-friendly merge game in the Travel Town mould. You start in a meadow on Earth,
gather and merge, fill orders for goofy neighbours, survive a meteor crash, rebuild the
alien's rocket piece by piece, brew fuel, and fly to new worlds.

Built as a web app (TypeScript + PixiJS) and wrapped with Capacitor so the same code
ships to Android and iOS.

---

## 1. Starting the game

### Fastest: no install
Double-click **`MergeRocket.html`**. It's the whole game inlined into one file — no server,
no Node, works offline. Regenerate it any time with `npm run build`.

### Developing
Needs [Node LTS](https://nodejs.org). Once:

```bash
npm install
```

Then:

```bash
npm run dev      # http://localhost:5173 — edit any file, the page updates instantly
```

Vite also prints a `Network:` address — open that on your phone (same Wi-Fi) to test touch.

| command | what it does |
| --- | --- |
| `npm run dev` | dev server with hot reload |
| `npm run build` | production build into `dist/` **and** the single-file `MergeRocket.html` |
| `npm run check` | TypeScript check (no emit) |
| `npm run android` | build + sync + open Android Studio |
| `npm run sync` | build + copy the web build into the native projects |
| `npm run icons` | regenerate launcher icons and splash from `resources/` |

### On an Android phone
Needs Android Studio (it brings the SDK and Gradle).

```bash
npm run android      # then press Run in Android Studio
```

The repo already contains the generated `android/` project, app id `dev.artursolak.mergerocket`,
launcher icon and splash. For the Play Store: *Build → Generate Signed App Bundle*, upload the
`.aab` ($25 one-time developer fee).

> Fresh clone? Run `npm install && npm run build && npx cap sync` first — Capacitor's own
> gitignore excludes the copied web assets, so they need regenerating once.

### On an iPhone
Requires a Mac with Xcode — Apple's rule, not Capacitor's.

```bash
npx cap add ios
npm run build && npx cap sync ios
npx cap open ios     # set a signing team in Xcode, then Run
```

No Mac? A cloud macOS builder (Codemagic, GitHub Actions macOS runner) builds this repo
unchanged. Apple Developer Program is $99/yr.

---

## 2. How to play

- **Tap a producer** (Big Tree, Rock Pile) to shake out an item. Tap producers cost ⚡ energy.
- **Timer producers** (Berry Bush, Fuel Pod, Glow Pod) fill themselves for free, bank up to 3
  charges, and glow green with a badge when there's something to collect.
- **Drag one item onto a matching one** to merge into the next tier. Tap-tap works too.
- **Fill orders** from the cards above the board — they're the main source of XP.
- **Level up** to refill energy to full and clear weed tiles, growing the board.
- Tap any item to see what it sells for and what it merges into; sell spares for coins.
- Stuck? **💡 Hint** highlights a mergeable pair (and fires by itself if you idle).

---

## 3. Features

### Board and merging
- 6 × 8 board, rendered on a **WebGL canvas** (PixiJS) with **GSAP** motion.
- Drag-and-drop merging with a lifted, scaled-up tile and a coloured drop ring —
  green for a merge, blue for an empty tile. Tap-to-select merging as a fallback.
- Items **arc out of producers** and land with a bounce; merges fly together, pop out of
  the next tier with an elastic overshoot, a ring pulse and a particle burst.
- Producers squash when tapped; idle tiles bob gently so the board feels alive.
- Locked weed/rock tiles show the level that clears them.

### Resources and chains
- Four-tier chains per world (Woodworks, Rock Quarry, Berry Kitchen on Earth;
  Moon Rocks and Glow Garden on Luna), plus rocket-part and fuel chains.
- Every item has a name, tier and sell price; top-tier items are the money makers.

### Orders (contracts)
- Three order cards at a time, each from a character with a portrait and a throwaway line.
- Live `x/y` counters with a green tick per requirement; the card glows and bounces when
  it can be delivered.
- Orders only ask for chains whose producer you already have, so you're never sent
  hunting for something that doesn't exist yet.
- Tapping a card points at the item on the board, or tells you which producer makes it.
- Rewards scale with tier and quantity: coins, XP, sometimes fuel.

### Progression
- Levels start at 1. XP mostly comes from orders (`3 + tier·2 + qty`), a trickle from merges.
- Each level needs more XP, refills energy completely and clears more board tiles.
- Energy: 50 + 5/level, +1 every 15 s, plus a 🍪 Snack Break (+20, 60 s cooldown).
- Eight story missions track the whole arc, each paying coins on completion.

### Events and story
- **Meteor crashes** streak in from the sky, shake the board and leave rare Star Scrap.
  Keep a tile free for them to land on.
- The first meteor (level 3) is the story beat: Professor Bloop crawls out of the wreck.
- The wreck becomes a producer dropping broken bits across four chains:
  Bolt → Bolt Pack → **Hull**, Spring → Coil → **Engine**, Wire → Circuit → **Nav Dish**,
  Glass → Tank Glass → **Fuel Tank**.
- Finished parts install themselves onto the rocket, which visually assembles in the 🚀 tab.
- Then the Fuel Pod appears: Fuel Ore → Fuel Can → **Rocket Fuel**, three to fill the tank.
- **Launch** plays a warp cutscene and lands you on Luna: new palette, new chains, new
  alien customers. Refuel to fly again.

### Screens
- **🧩 Board** — the game.
- **🚀 Rocket** — mission list with progress and the rocket assembling part by part.
- **📖 Guide** — every chain as picture rows, with `???` for what you haven't discovered,
  plus what each producer makes and costs.
- **🗺️ Map** — the worlds, travel costs, and the launch button.

### Presentation and feel
- All artwork is hand-written SVG (`src/art.ts`), rasterised into GPU textures at startup.
- Characters are round cartoon portraits used in cards, the guide bubble and story modals.
- Sound: small WebAudio blips (toggle in ⚙️). Haptics on merge, part install and level-up.
- Level-up banner with confetti, floating labels, screen shake, toasts.

### Saving
- Progress lives in `localStorage`, mirrored into Capacitor Preferences on device so the OS
  can't evict it. Reset from the ⚙️ menu.

---

## 4. Changing content

**All content is JSON.** Adding items, chains, producers, characters, missions or whole
worlds means editing data — no engine code.

```
src/content/items.json        every item: name, chain, tier, sell price
src/content/chains.json       merge chains: which items, in which order, which world
src/content/producers.json    producers: tap or timer, cost, refill, what they drop
src/content/worlds.json       worlds: chains, starting producers, locked tiles, characters
src/content/characters.json   names and order lines
src/content/missions.json     the story mission list
src/content/config.json       tuning: board size, energy, XP curve, meteor timings
src/content/index.ts          types + lookups + the validator
```

### Add an item to an existing chain
1. `items.json` — add the entry, with `tier` equal to its position in the chain:
   ```json
   "plank": { "name": "Plank", "chain": "wood", "tier": 5, "sell": 70 }
   ```
2. `chains.json` — append the id to that chain's `items` array.
3. `src/art.ts` — add a `plank: () => svg(...)` drawing under `ITEM`.

### Add a producer
```json
"beehive": { "name": "Bee Hive", "art": "beehive", "mode": "timer",
             "every": 20000, "cap": 3, "drops": ["honeydrop", "honeydrop", "honeycomb"] }
```
Then draw `beehive` under `PROD` in `src/art.ts`, and place it in a world's `start` array
(or spawn it from code for a story beat).

### Add a world
```json
"cinder": {
  "name": "Ashen Wastes", "subtitle": "Cindra", "planet": "cinder",
  "chains": ["magma", "relic"],
  "start": [{ "cell": 19, "producer": "lavaVent" }, { "cell": 22, "producer": "ruins" }],
  "locks": { "0": 2, "5": 2, "42": 2, "47": 2 },
  "folks": ["zib", "nix"]
}
```
Add its chains and producers, draw a `planet` variant in `art.ts`, and add a card in the
Map screen's list. Cells are board indices: `row * cols + col`, so cell 19 is row 3, col 1.

### The safety net
`validateContent()` runs on every dev boot and prints problems to the console: items pointing
at chains that don't exist, chains listing missing items, tiers that don't match their
position, producers dropping unknown items, worlds referencing missing producers or
characters, cells outside the board, duplicate mission ids. If the console is quiet, the
content is consistent.

### Tuning knobs (`config.json`)
| key | meaning |
| --- | --- |
| `board.cols/rows` | board size — the renderer adapts automatically |
| `start.coins/energy` | what a new save begins with |
| `energy.base/perLevel/regenMs` | energy ceiling and refill rate |
| `energy.snack` | the 🍪 button's amount and cooldown |
| `xp.base/perLevel` | level curve: `base + (level-1) × perLevel` |
| `xp.perMerge/orderBase` | XP from a merge / the flat part of an order reward |
| `orders.slots` | how many order cards are visible |
| `orders.maxTierAtLevel` | how quickly orders start asking for higher tiers |
| `meteor.*` | when the story meteor fires and how often the random ones land |
| `rocket.fuelToLaunch` | fuel needed per trip |
| `hint.idleMs` | idle time before a hint fires on its own |

---

## 5. Project structure

```
index.html              app shell: HUD, order row, board host, tabs, modals
src/main.ts             entry point: icons, native setup, ads init, starts the game
src/game.ts             rules: merging, orders, levels, missions, story, worlds
src/board.ts            the board: PixiJS rendering, drag input, GSAP animation
src/art.ts              every drawing, as inline SVG
src/content/            all game data as JSON + types + validator
src/native.ts           Capacitor: haptics, save mirroring, status bar
src/ads.ts              ad seam — no-ops until a network is wired in
src/style.css           everything outside the board
scripts/standalone.mjs  inlines the single-bundle build into MergeRocket.html
resources/              1024 icon + 2732 splash, source for the launcher art
android/                generated native project
```

**The split that matters:** `game.ts` owns state and rules and never touches a sprite.
It calls `board.sync(cells)` plus animation methods (`animSpawn`, `animMerge`, `burst`,
`floatText`, `meteor`, `shake`), and the board calls back through four hooks
(`onTap`, `onDrop`, `dropKind`, `canDrag`). Board input is hit-tested with grid maths inside
Pixi, not the DOM — which is also why the browser's native drag gesture can't hijack a merge.

Textures come from `board.preload()`, which rasterises each SVG string once at startup.
Swapping in PNG sprite atlases later changes only that one function.

---

## 6. Testing

Dev builds expose `window.__board` and `window.__game` (state, cells, content tables);
production strips them. That's enough to drive the whole game from Playwright: compute a
cell centre from `__board.center(i)`, click or drag, then assert on `__game.state()`.

The regression that matters runs the entire arc headlessly: spawn → merge → deliver →
level 3 → meteor → four rocket parts → three fuel → launch → Luna, asserting no console
errors along the way.

---

## 7. Ads (not live yet)

`src/ads.ts` is the seam. `ads.available` is false and `ads.rewarded()` resolves false, so
callers fall back to giving the player the reward for free — the 🍪 Snack Break already goes
through it. To switch it on:

```bash
npm i @capacitor-community/admob && npx cap sync
```

then fill in `init()` / `rewarded()` and swap Google's test ad unit ids for real ones.
Use **AdMob mediation** to reach AppLovin, Meta, Unity Ads and the rest through that single
SDK rather than integrating each network. Natural rewarded placements: refill energy, double
an order payout, instant-finish a producer timer.

---

## 8. Known gaps / next up

- Art is still rasterised SVG. Real PNG/WebP sprite atlases are the biggest visual upgrade
  available, and they'd also cut CPU at startup.
- Characters and celebrations could move to Spine (official Pixi v8 runtime) or Rive.
- TypeScript is deliberately loose (`strict: false`) since this grew out of a JS prototype.
- Only two worlds are playable; the third is a "coming soon" card.
- Orders are all "fetch N of X" — timed and bundle orders would add variety.
- Sound is synthesised blips; real effects and music are still missing.
