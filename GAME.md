# Merge Rocket — handbook

A kid-friendly merge game in the Travel Town mould, with a spine of its own.

**The story.** The Bloom — the living network that linked every world — collapsed, and the
worlds went dormant. Your rocket is the last **Seed Vault**: every growing thing that ever
was is asleep inside it, and Bloop is its last curator. Merging is not tidying, it is
*remembering*: two small things recalling what they add up to. Finish a chain and the Vault
pays you Bloom Essence; feed that to a world's dormant **Heart** and the world wakes up
around you, stage by visible stage. Five worlds, five Hearts, one job.

You start in a meadow on Earth, gather and merge, fill orders for goofy neighbours, survive
a meteor crash, rebuild the rocket piece by piece, brew fuel, and fly on.

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
| `npm test` | headless regression run against `npm run dev` (needs Playwright) |
| `npm run android` | build + sync + open Android Studio |
| `npm run sync` | build + copy the web build into the native projects |
| `npm run icons` | regenerate launcher icons and splash from `resources/` |
| `npm run apk` | build a debug APK you can sideload (see **MOBILE.md**) |
| `npm run ios` | build and open the Xcode project (macOS only) |
| `python3 scripts/make-audio.py` | regenerate the whole sound pack (needs numpy + ffmpeg) |

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
- **Timer producers** (Berry Bush, Glow Pod) fill themselves for free, bank up to 3
  charges, and glow green with a badge when there's something to collect.
- **Drag one item onto a matching one** to merge into the next tier. Tap-tap works too.
- **Fill orders** from the cards above the board — they're the main source of XP.
- **Level up** to refill energy to full and clear weed tiles, growing the board.
- Tap any item to see what it sells for and what it merges into; sell spares for coins.
- **Energy is the brake.** It trickles back one every 40 s (plus a 🍪 Snack Break every 3 min),
  so a tap producer is a real decision, not a button to mash.
- **Meteors are the event of the session.** One falls every 3½–6 minutes. It leaves a **crater**
  you can dig 7 times, and that crater is the only source of **Fuel Ore** in the game.
- **Spend those coins.** The 🛒 Trading Post opens at level 4: materials, salvage crates and
  four permanent upgrades. The 🔬 **Research Lab has to be built** — once the rocket flies,
  Bloop will put one up for 3 Star Scrap and 600 coins, and only then does its tab appear.
- **Stash** anything into the 🎒 bag to get it off the board, and take it back whenever.
- **Boosters** sit above the board: a Merge Wand that clears every pair at once, a Tidy Bomb
  that sells the small leftovers, and a Rainbow Gem that merges with *anything*.
- A **cargo ship** docks now and then with a timed manifest and a big payout.
- Stuck? **💡 Hint** highlights a mergeable pair (and fires by itself if you idle).
  If the board ever fills with nothing to merge, Bloop turns up and clears it for you —
  the game cannot be soft-locked.

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
- **286 items across 57 chains**, five to seven tiers each: twelve chains on Earth, nine per
  world after that, plus rocket parts, fuel, relics, Bloom Essence and the Wildcard.
- The last tier of a chain is a *masterpiece* — Great Oak, Monument, Royal Jelly, Phoenix,
  Coral Palace, Sky Bell. It sells for a fortune, it is a lab ingredient, and the first time
  you make one the Vault pays you a **Bloom Spark**.
- A five-tier **Relic** chain (Sun Amber → Prism Hearth → Tide Compass → Grove Sigil → Vault
  Key) sits on top. No producer makes relics: they only come out of the Research Lab, and
  once you own one, two of them still merge into the next like anything else.
- Nothing is on the board at once. Each chain has an `unlock` — the **world level** it comes
  back at — so a world opens with two chains and grows into nine or twelve.
- Every item has a name, tier and sell price; sell prices follow one curve (2, 5, 13, 32, 78,
  185, 430, 980), so a tier is worth about 2.4× the one below it.

### Where the art comes from
The hand-drawn pieces — producers, characters, the rocket, the planets, the hero items —
live in `src/art.ts` as inline SVG. The hundreds of ordinary merge items are **composed**:
`src/artgen.ts` holds ~90 primitives (seed, log, crystal, bell, bird, tower, butterfly…) and
~65 materials (wood, honey, obsidian, aurora…), and an item is one line of data:

```json
"royaljelly": { "name": "Royal Jelly", "chain": "honey", "tier": 6, "sell": 185,
                "art": { "shape": "orb", "mat": "honey", "accent": "gold",
                         "deco": ["glow", "crest"] } }
```

A material yields a whole lighting ramp (highlight, base, shade, deep shade, rim, outline),
and every primitive is drawn with the same stack — gradient body, ambient occlusion, rim
light, specular, contact shadow — so 286 items look like one set rather than 286 doodles.
Tier adds sparkle, a glow, a gold laurel on a chain's finale. Producers and alien faces use
the same library (`renderProducer`, `renderFace`), which is why a new world costs data, not
drawing time.

### Orders (contracts)
- Three order cards at a time, each showing the **whole customer** — a full-body figure that
  hops when the order is ready — their name, a throwaway line, and what they pay.
- Wanted items are drawn large in their own slots with a live `x/y` counter and a green tick
  when a requirement is met; the whole card glows and bounces when it can be delivered.
- Orders only ask for chains whose producer you already have, so you're never sent
  hunting for something that doesn't exist yet.
- Tapping a card points at the item on the board, or tells you which producer makes it.
- Rewards scale with tier and quantity: coins, XP, and a **gift item**. While the rocket is
  unfinished, most customers hand back a piece for the part you are furthest from finishing —
  orders are the steady drip that keeps the build moving.

### Progression — two levels, on purpose
**Account level** is the veteran's level. XP mostly comes from orders (`3 + tier·2 + qty`),
a trickle from merges. The curve is quadratic — `8 + (l-1)·7 + 2.6·(l-1)²` — so 8, 18, 32,
52, 78, 108, 144, 184, 230, 282… It sets energy, the tier of things people ask for, and when
the Trading Post opens. It never resets.

**World level** is the one that hands you new toys. Every world keeps its own level and its
own XP pot (`22 + (l-1)·26 + 6·(l-1)²`, capped at 8), fed by whatever you earn while standing
there. It clears the overgrown board cells, grows in new producers, and **unlocks chains** —
which is why landing somewhere new is exciting even at account level 30: Vela starts with two
chains, two producers and a cramped board, exactly like Earth did.

- Energy: 50 + 5/level (+10 per Backpack upgrade), +1 every 40 s, plus a 🍪 Snack Break
  (+20, 3 minute cooldown). Slow on purpose: it is the pacing brake for the whole game.
- Twenty missions track the whole arc, each paying coins on completion.

### 🌱 The Heart and the Bloom
The long goal. Every world has a dormant Heart — the Meadow Heart, the Crater Heart, the
Shallow Heart — shown in the 🌍 World tab with its own progress bar.

- **Earning essence.** The first time you finish any chain in a world, the Vault pays a
  **Bloom Spark**. Sparks merge: Spark → Mote → Core → Heart, worth 1, 2, 4 and 8 Bloom.
  The Crater Dig also turns one up now and then.
- **Feeding it.** One button hands every essence tile on the board to the Heart.
- **Waking up.** Each world has three or four stages. Crossing one pays coins and energy,
  fires a story beat, and *visibly* brightens the world — the hills and the sun get their
  colour back, a stage at a time.
- Wake all five and the last beat of the story plays.

### 🎲 Side games
Four small games in the 🌍 World tab, each a different verb, each on its own cooldown.

- **⛏️ Crater Dig** (6 ⚡, 5 min) — press-your-luck. Twenty buried tiles, six digs, items and
  coins under most of them and a cave-in under a few. Cash out whenever you like; one bad
  dig buries the whole pile.
- **⚗️ Fuel Brewing** (4 ⚡, 4 min) — timing. A needle sweeps a bar, you stop it in the green.
  Five stirs, and the green shrinks every time. Each hit is Fuel Ore; a perfect five is a
  Fuel Canister, which is the fastest honest route to a launch.
- **🛸 Alien Market** (free, 7 min) — a gamble about information. Three crates, you may look
  inside two, you keep exactly one — so the unopened one is always tempting. Zib will then
  haggle your prize up a tier for coins.
- **✨ Constellations** (free) — the permanent one, and what Star Cores are finally *for*.
  Trace a shape by tapping its stars in order and it stays lit for the rest of the game: The
  Plough (+10 % coins), The Lantern (taps cost 1 less energy), The Seed (timers 20 % faster),
  The Vault (Bloom Essence counts double). They apply in every world.

### 🛒 Trading Post (level 4)
The answer to "what are the coins even for".
- **Today's supplies** — a shelf of three materials drawn from the chains you are actually
  playing, at 3× their sell price, restocked every 3 minutes. Buying drops the item straight
  onto your board.
- **Salvage crates** — only while the rocket is unfinished. *Salvage Crate* (240) gives a
  random piece for a part you still need; *Blueprint Kit* (520) lets you pick the part.
  Either one unsticks a build that has gone cold.
- **Fuel depot** — replaces the crates the moment the rocket is done, so the shop never
  becomes dead weight: Fuel Ore and Fuel Cans at 4.5–5× their value.
- **Build the Research Lab** — a one-off construction card (see below).
- **Permanent upgrades**, forever and across every world: Bigger Backpack (+10 max energy,
  ×5), Fertiliser (auto producers refill 15 % faster, ×4), Order Board (+1 order slot, ×2),
  Big Cookie (+10 snack energy, ×3). Prices escalate per level.

### 🔬 Research Lab (built, not unlocked)
It does not exist until you pay for it. Once the rocket is whole, a build card appears in the
shop — **3 Star Scrap + 600 coins** — and the 🔬 tab is hidden from the dock until then, so
the game never shows a locked door it has not explained. The twist on top of merging:
*some things cannot be merged into existence*.
- Load **two items from your board** onto the bench and hit EXPERIMENT. Any run costs a flat
  40 coin bench fee — so *discovering* a recipe is cheap, while *brewing a known one again*
  costs its full price (250 → 1400 coins). Every coin you spend anywhere floats up from the
  button you pressed, so a purchase is never a silent number change.
- A dud costs the fee and keeps your samples. Every third dud, Bloop spots a **clue** and the
  first ingredient of one unknown recipe is revealed.
- Six recipes across two worlds, shown as riddles in the **Rumours** list until you crack them
  ("Bake the gem into something sweet. Yes, really."). Impatient? Buy the rumour outright for
  1.5× the brew price.
- Discovered recipes land in the **Lab book** with a one-tap *brew again* button.
- Relics pay for the next round of upgrades, and collectors start ordering them once you have
  made your first.

### Events and story
- The first meteor (level 3) is the story beat: Professor Bloop crawls out of the wreck.
- The wreck is a **one-time** producer dropping broken bits across four chains:
  Bolt → Bolt Pack → **Hull**, Spring → Coil → **Engine**, Wire → Circuit → **Nav Dish**,
  Glass → Tank Glass → **Fuel Tank**. It aims its drops at the part you are furthest from
  finishing, and the moment the rocket is whole it is picked clean and vanishes — leftover
  bits are cashed in, and the part chains stop appearing in orders and in the shop.
- Finished parts install themselves onto the rocket, which visually assembles in the 🚀 tab.
- **Meteors after that are the fuel loop.** They are rare (3½–6 minutes apart, announced, one
  crater at a time) and each leaves a **Meteor Crater**: a producer good for 7 digs of Star
  Scrap and Fuel Ore, then it collapses. Fuel Ore → Fuel Can → **Rocket Fuel**, three to fill
  the tank — about three craters per trip. A meteor that arrives while you are on another
  screen or with a full board is retried a few seconds later rather than lost.
- The Fuel Depot in the shop sells ore at a steep price for anyone who will not wait.
- **Launch** plays a warp cutscene and lands you on Luna: new palette, new chains, new
  alien customers. Refuel to fly again.

### 📋 Tasks
Three small goals at a time — merge fifteen things, fill two contracts, dig a crater —
each paying coins and a Star Scrap. They live at the top of the 🚀 tab, refresh as you finish
them, and exist so the next ten minutes always have a shape.

### 🏛️ Relic Vault
What relics are *for*. Six permanent perks bought with Star Gems, Sun Ambers and Prism
Hearts: +15 % coins, +25 % XP, faster energy, an extra contract slot, more bag slots, and
meteors that arrive sooner. Each stacks two or three times, applies in every world, and is
the only sink big enough to keep the lab worth running.

### ✨ Star Forge
What meteor stars are for. Star Scrap and Star Cores buy instant favours in the shop:
refill energy, fill every timer producer at once, swap the whole contract board, or pull a
meteor down on demand.

### 🎒 Storage bag
The board is the scarce resource in a merge game, so the bag is the release valve. It does
not exist until you buy the Storage Bag upgrade; each level adds two slots. Tap an item,
press **Stash**, and it waits in a tray you can pull down from the button row.

### Boosters
One-shot helpers bought with coins, shown as buttons above the board with a count:
- **Merge Wand** — merges every matching pair on the board, lowest tier first.
- **Tidy Bomb** — sells every tier-1 leftover nobody has ordered and frees the tiles.
- **Rainbow Gem** — a wildcard tile. Drop it on anything and it becomes that thing's next
  tier; every merge check in the game runs through one function so the wildcard works with
  drag, tap-tap, the hint finder and the wand alike.

### Contracts
The row holds between two and five cards depending on how busy the world is, and new ones
drift in on a timer rather than replacing a delivery instantly — so the board is never quite
the same three faces. Arrows appear at the edges when there are more than fit.

### Combos, dailies and the cargo ship
- **Combo streaks**: merges inside 3.5 s of each other chain up, and from the third one on
  each merge pays bonus coins with a rising ping and a `COMBO ×N` label.
- **Daily rewards**: a seven-day calendar, escalating from coins to boosters, shown on the
  first launch of each day. Miss a day and it restarts at day one.
- **Cargo ship**: every so often a ship docks with a three-item manifest and a real
  countdown. Fill it before it sails for several times the usual payout plus a booster.

### Worlds
Five playable worlds, each with its own sky, board palette, chains, producers, customers,
music and Heart. They open in order and each trip costs fuel.

| world | chains | opens with | its own event |
| --- | --- | --- | --- |
| **Sunny Meadow** (Earth) | 12 — wood, stone, berries, water, hay, flowers, honey, fungi, weaving, nesting, pottery, butterflies | Woodworks + Rock Quarry | **rain** fills every timer producer at once |
| **Crater Camp** (Luna) | 9 — moon rock, glow garden, dust, ice, crystal, lanterns, silver, comets, moths | Moon Rocks + Glow Garden | **low gravity** bounces an input back on roughly one merge in five |
| **Ember Hollow** (Cindra) | 9 — magma, ash garden, iron, obsidian, glass, the smithy, spice, copper, phoenix | Magma Works + Ash Garden | **eruptions** throw hot rocks onto free tiles |
| **Tidal Shallows** (Nerith) | 9 — shells, kelp, pearls, coral, fish, tide pools, salt, sunken finds, deep lights | Shell Bed + Kelp Forest | tides |
| **Aurora Reach** (Vela) | 9 — clouds, aurora weaving, stars, wind, sky orchard, chimes, prisms, sky nests, drift yards | Cloud Bank + Aurora Weave | aurora |

A world keeps its own board **and its own level**, and travelling resets the shop shelf, the
cargo ship and the contract board, so nothing from the last planet leaks into the next one.
The Guide only lists what you can make where you are standing — and shows the chains still
sleeping here as silhouettes with the level they come back at. The bag is what carries goods
between worlds.

### Screens
- **🧩 Board** — the game.
- **🛒 Shop** — supplies, crates and upgrades (level 4).
- **🔬 Lab** — the experiment bench, lab book and rumours (level 6).
- **🚀 Rocket** — mission list with progress and the rocket assembling part by part.
- **📖 Guide** — the **catalogue**: a collection bar (`38/286` found), every awake chain as
  picture rows with sell price and how many you own right now, `???` for the undiscovered,
  a silhouette row for the chains still sleeping in this world, plus what each producer makes
  and costs.
- **🌍 World** — the hub for *where am I*: the Heart and its bloom progress, the four side
  games, the constellations, and the galaxy map with travel costs and the launch button.

### Presentation and feel
- All artwork is hand-written SVG (`src/art.ts`), rasterised into GPU textures at startup.
- Characters are round cartoon portraits, and order cards show the **whole customer** as a
  full-body figure (`ART.figure()` nests the portrait on a body built from a per-character
  palette) that hops when the order is ready.
- **Rarity reads at a glance**: tier-3 tiles get a blue frame, tier-4 a violet one, and
  tier-5 items and relics a gold frame, a breathing halo and three orbiting motes.
- Tiles are drawn with a seated shadow, an inset floor and a top light, so the board reads
  as physical rather than as flat rounded rectangles.
- **Sound is a real audio pack**, not blips: 27 effects and three music beds, all synthesised
  by `scripts/make-audio.py` (no sampled material, nothing to license) and encoded to ~510 kB
  of Ogg Vorbis. Merges are pitched by tier, repeats get slight pitch drift, music crossfades
  between worlds and ducks under the big moments. Effects and music toggle separately in ⚙️.
- Level-up banner with confetti, floating labels, screen shake, toasts, and a `−N 🪙` that
  floats up from whichever button you pressed.

### Saving
- Progress lives in `localStorage`, mirrored into Capacitor Preferences on device so the OS
  can't evict it. Reset from the ⚙️ menu.

---

## 4. Changing content

**All content is data.** Adding items, chains, producers, characters, missions or whole
worlds means editing data — no engine code.

The game reads JSON at runtime. Four of those files are *generated* from compact tables,
because 286 items written out as JSON is a few thousand lines of braces nobody can read:

```
scripts/content/chains.mjs      the catalogue: one line per item
scripts/content/producers.mjs   the sources, and where they get planted
scripts/content/worlds.mjs      worlds, the cast, the Seed Vault story
scripts/gen-content.mjs         builds the JSON, then sanity-checks every shape and
                                material against src/artgen.ts

npm run content                 <- run this after editing any of the above
```

```
src/content/items.json        GENERATED  every item: name, chain, tier, sell price, art spec
src/content/chains.json       GENERATED  merge chains: items in order, world, unlock level
src/content/producers.json    GENERATED  tap or timer, cost, refill, `uses`, drops, art spec
src/content/worlds.json       GENERATED  chains, starting producers, locks, folks, Heart, bloom
src/content/characters.json   GENERATED  names, order lines, generated-face specs
src/content/story.json        GENERATED  the story beats and when they fire
src/content/missions.json     the mission list
src/content/research.json     lab recipes: two inputs -> one relic, price, riddle
src/content/shop.json         shelf settings, upgrades and crates
src/content/config.json       tuning: board size, energy, both XP curves, meteors, unlocks,
                              combo streaks, the daily calendar, the cargo ship, the side games
src/content/index.ts          types + lookups + the validator
```

### Add an item to an existing chain
One line in `scripts/content/chains.mjs`, in the chain's list, at the position you want:

```js
'plank|Plank|plank|wood/straw+crest',
//  id  | name | shape | material / accent + decorations
```

Then `npm run content`. Tier, sell price and the drawing all follow. The shape comes from
`SHAPE_NAMES` and the material from `MAT_NAMES` in `src/artgen.ts`; the generator refuses to
build if you name one that does not exist. Decorations are `glow`, `ring`, `crest`, `motes`.

### Add a whole chain
```js
['pottery', 'The Pottery', 'earth', 6,      // key, name, world, world level it wakes at
  'mud|Clay Daub|pebble|clay',
  'claypot|Clay Pot|pot|clay',
  'kiln|Kiln|house|clay/flame'],
```

### Add a producer
One line in `scripts/content/producers.mjs`:

```js
['earth', 4, 'hive|Wild Hive|honey:honey/bark|timer:18/3|nectar nectar honeydrop'],
// world, world level it appears at, id|name|art|mode|drops
```

`art` is either a hand-drawn key from `src/art.ts` (`tree`, `rocks`, `well`…) or
`shape:material/ground` to compose one. `mode` is `tap:<energy>` or
`timer:<seconds>/<charges>`. Cells are assigned from the `CELLS` table in the same file.

### Add a lab recipe
```json
{ "id": "r7", "result": "relic3", "inputs": ["statue", "relic2"], "coins": 1400,
  "note": "Something carved, and something that glows." }
```
No code: the bench, the lab book and the rumour riddle all read from this file. Two recipes
may share a result but never the same pair of inputs — the validator says so if they do.

### Add a shop upgrade
Add it to `shop.json` **and** give it a `<id>PerStep` value in `config.json`'s `upgrades`
block, then apply it wherever it belongs in `game.ts` (the existing four are one-liners:
`maxEnergy()`, `everyOf()`, `orderSlots()`, `snackAmt()`).

### Add a world
Add an entry to `WORLDS` in `scripts/content/worlds.mjs` — name, planet art key, tap cost,
perk, the cast, its **Heart**, its bloom stages and its intro line. Then give it chains (at
least two at `unlock: 1`) and producers (at least one at level 1), add it to `WORLD_ORDER` in
`game.ts`, draw a `planet` variant in `art.ts`, and give it a sky and a board palette in
`style.css` (`.app.<key>`) and a tile theme in `board.ts`'s `THEME`. Cells are board indices:
`row * cols + col`, so cell 19 is row 3, col 1.

New characters need no drawing — give them a `face` spec (`{ kind, mat, accent }`, kinds:
blob, bug, fish, bird, crystal, flame, cloud, robot) and `renderFace` composes the portrait
and the full-body order-card figure.

### Add a story beat
`STORY` in `scripts/content/worlds.mjs`. `at: { world, lvl }` fires it when that world reaches
that world level; `at: { flag }` fires it when the game calls `checkStory('<flag>')`.

### The safety net
Two nets. `npm run content` refuses to generate if a shape, material, character or dropped
item does not exist. Then `validateContent()` runs on every dev boot and prints problems to
the console: items pointing at chains that don't exist, chains listing missing items, tiers
that don't match their position, producers dropping unknown items, worlds referencing missing
producers or characters, cells outside the board, duplicate mission or story ids, bloom stages
that do not get harder, and — the one that would soft-lock a player — **a world that opens
with fewer than two chains or no producer**. If both are quiet, the content is consistent.

### Tuning knobs (`config.json`)
| key | meaning |
| --- | --- |
| `board.cols/rows` | board size — the renderer adapts automatically |
| `start.coins/energy` | what a new save begins with |
| `energy.base/perLevel/regenMs` | energy ceiling and refill rate |
| `energy.snack` | the 🍪 button's amount and cooldown |
| `xp.base/perLevel/growth` | level curve: `base + (l-1)·perLevel + growth·(l-1)²` |
| `xp.perMerge/orderBase` | XP from a merge / the flat part of an order reward |
| `orders.slots` | how many order cards are visible |
| `orders.maxTierAtLevel` | how quickly orders start asking for higher tiers |
| `meteor.*` | when the story meteor fires and how often the random ones land |
| `lab.build` | what the Research Lab costs to put up |
| `streak.*` | combo window, when bonuses start, and what a step pays |
| `daily.rewards` | the seven-day login calendar |
| `ship.*` | when the cargo ship first docks, how often, how long it waits |
| `upgrades.bagPerStep` | slots added per Storage Bag level |
| `rocket.fuelToLaunch` | fuel needed per trip |
| `orders.partRewardChance` | how often an order gifts a rocket piece while the rocket is unfinished |
| `orders.itemRewardChance` | how often it gifts an ordinary item otherwise |
| `unlocks.shopAtLevel` | when the 🛒 tab opens (the 🔬 lab is built, not unlocked) |
| `upgrades.*PerStep` | what one level of each shop upgrade is worth |
| `lab.failFee/clueEvery` | bench fee for an experiment, and how many duds earn a clue |
| `hint.idleMs` | idle time before a hint fires on its own |

---

## 5. Project structure

```
index.html              app shell: HUD, order row, board host, tabs, modals
src/main.ts             entry point: icons, native setup, ads init, starts the game
src/game.ts             rules: merging, orders, levels, missions, story, worlds
src/board.ts            the board: PixiJS rendering, drag input, GSAP animation
src/art.ts              hand-drawn art: producers, characters, rocket, planets, hero items
src/artgen.ts           the art engine: ~90 primitives x ~65 materials, plus producers
                        and alien faces composed from the same library
src/content/            all game data as JSON + types + validator
scripts/content/        the compact source tables the JSON is generated from
scripts/gen-content.mjs builds src/content/*.json (npm run content)
src/native.ts           Capacitor: haptics, save mirroring, status bar
src/ads.ts              ad seam — no-ops until a network is wired in
src/style.css           everything outside the board
MOBILE.md               getting the game onto an Android phone or an iPhone
src/audio.ts            the WebAudio mixer: buses, crossfades, ducking
src/audio/*.ogg         the generated sound pack (see scripts/make-audio.py)
scripts/standalone.mjs  inlines the single-bundle build into MergeRocket.html
scripts/playtest.mjs    the headless regression run (npm test)
resources/              1024 icon + 2732 splash, source for the launcher art
android/                generated native project
```

**Layout**: the shell is locked to a phone aspect (never wider than 0.489 × its height), the
stage and board host are flex-grow, and `board.layout()` simply measures the host and takes
the smaller of the width fit and the height fit. No arithmetic in the board knows what else
is on screen, so the grid can never spill under the dock however tall the HUD gets. Every
overlay is `pointer-events:none` unless open — a closed screen that still swallowed taps was
what made the game feel frozen.

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

`scripts/playtest.mjs` is that regression, wired to `npm test`. Start `npm run dev` in one
shell, run `npm test` in another, and it drives the whole arc headlessly in **28 sections**:
the XP curve, producers and merging, buying supplies and upgrades (and checking max energy
and the extra order card actually changed), the wreck spreading pieces across every
unfinished part chain, 60 rolled orders to confirm the part-gift rate, a dud experiment that
costs the fee but keeps its samples, a real discovery that consumes both, the bag, the
boosters, the cargo ship, the soft-lock rescue, launches to all four other worlds —

and then the v6 systems: that a fresh world really does start with two chains and a cramped
board, that **no contract ever asks for something that has not woken up yet**, that world
levels unlock chains, that finishing a chain pays a Bloom Spark, that feeding the Heart wakes
a stage and fires its story beat, all four side games end to end, tracing a constellation and
paying its Star Cores, and that all 286 items can be drawn — asserting no console errors
throughout.

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
  available, and they'd also cut CPU at startup. Order-card figures are composed
  (`ART.figure()` nests the portrait on a body) rather than drawn one by one — fine for now,
  a limit later.
- Characters and celebrations could move to Spine (official Pixi v8 runtime) or Rive.
- TypeScript is deliberately loose (`strict: false`) since this grew out of a JS prototype.
- Five worlds are playable. A sixth is data, not code — see *Add a world*.
- Orders are all "fetch N of X" — timed and bundle orders would add variety.
- The world "wakes up" through palette and scenery; per-stage scenery props (flowers, reefs,
  aurora curtains appearing on the backdrop) would sell it much harder.
- The side games have no leaderboard or streak of their own; Crater Dig especially wants a
  "deepest run" record.
- Bloom Essence is earned from chain finales and the Dig. A third source — a weekly Vault
  contract, say — would smooth the late curve.
