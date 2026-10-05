# Next art batch: prompts for the Art agent (v24)

Paste the **setup message** once, then one numbered prompt per picture. Save every result into `Desktop\chatgpt art`. File names don't matter; I cut, rename and wire everything in.
Still open from earlier: `WORLD1-MISSING.md` (meteor, crater, section icons, wheel pin), `CINDRA-PROMPT.md` (world 3), and `CHARACTERS-PROMPT.md` (Halo, Wren).

---

## Setup message (send once)

We're continuing the art for my mobile merge game "Merge Rocket" (Travel Town style, a space theme: a cosy merge board on alien planets). Keep EXACTLY the style of the attached references:
- one chunky, rounded, toy-like object per cell
- soft glossy painterly semi-3D, bright saturated colours
- warm key light from the upper left with one soft white highlight
- shaded side a richer version of the base colour (never grey or black)
- thin warm-brown edge line, small soft contact shadow
- three-quarter view from about 30° above

Characters are funny, weird-looking adult cartoon aliens (overbites, extra eyes, a visible personality flaw), never babies and never scary.

Rules for every SHEET:
- Exactly the grid asked for. Every object is centred in its own cell with WIDE empty gaps, and nothing touches a neighbour.
- Plain pure-white or transparent background. No grid lines, no frames, no text, no labels.
- Read left→right, then the next row.
- Square, 2048×2048. Every object must still read as a 60 px icon.

Attach as reference: `src/sprites/items/twig.png`, `treehouse.png`, `mrock.png`, `src/sprites/producers/geyser.png`, `src/sprites/ui/ic_trophy.png`, `src/sprites/chars/rokk_full.png`.

---

## A. Feedback and claim UI (needed now: the game shows these in v24)

**A1. Claim and badge icons**: grid 4×2, round gold-rimmed badges like `ic_trophy.png`:
1. checklist with a green tick (daily task done)
2. hammer + crane hook (chapter ready to build)
3. bell ringing with motion lines (something to claim)
4. open gift with light rays (free gift)
5. glowing flask with bubbles (research ready)
6. hourglass turning into a star (timer finished)
7. envelope with a heart seal (message from a character)
8. a key with a star bow (something unlocked)

**A2. Reward card**: one picture, 1024×1024, transparent background. An empty glossy cream card with a gold rim and a golden burst of light rays behind it, a curved red ribbon across the top (blank, no text), and space in the middle for an item. It is used for every "You got X!" moment.

**A3. Claim ribbon**: one wide picture, 2048×512, transparent background. A cream pill banner with a gold rim and a small round icon socket on the left. Blank, with a soft drop shadow. It slides in from the top when something is ready.

**A4. Celebration effects** (sprite sheets, evenly spaced frames, transparent background):
- `confetti.png`: 4×2 frames of colourful confetti bursting and falling.
- `star_pop.png`: 4×2 frames of a gold star popping into sparkles.
- `heart_float.png`: 3×2 frames of a little pink heart floating up and fading.

---

## B. New catalogue items: Sunny Meadow side chains (unlock mid-game)

**B1. Sheet**: 4 columns × 4 rows. Rows 1–2 are "Picnic", rows 3–4 are "Lanterns".
- **Picnic:** 1 crumb, 2 sandwich, 3 picnic basket, 4 checked blanket with basket, 5 picnic set with lemonade jug, 6 picnic under a little parasol, 7 grand garden party table, 8 golden picnic pavilion with bunting
- **Lanterns:** 1 candle stub, 2 jar candle, 3 paper lantern, 4 string of fairy lights, 5 hanging lantern cluster, 6 lantern post, 7 glowing lantern arch, 8 floating sky-lantern festival boat

**B2. Sheet**: 4×4. Rows 1–2 are "Alien Pets", rows 3–4 are "Music".
- **Alien Pets:** 1 a spotted egg, 2 cracked egg with an eye peeking out, 3 blob hatchling, 4 blob pup with a collar, 5 pup in a bed, 6 pup house, 7 pet playground, 8 golden pet palace
- **Music:** 1 a single note on a pebble, 2 whistle, 3 ukulele, 4 drum, 5 small jukebox, 6 one-alien band stand, 7 bandstand gazebo, 8 golden concert shell with spotlights

**B3. Sheet**: 4×4. Rows 1–2 are "Rocket Parts", rows 3–4 are "Weather".
- **Rocket Parts:** 1 bolt, 2 gear, 3 fin, 4 nose cone, 5 small booster, 6 fuel tank, 7 engine block, 8 shiny mini rocket on a stand
- **Weather:** 1 raindrop, 2 little cloud, 3 rain cloud, 4 rainbow cloud, 5 weather vane, 6 weather station, 7 cloud machine, 8 golden sun dial with a rainbow

---

## C. Starters and producers (new and upgraded)

Every producer stands on its own small round mound and is slightly taller than wide.

**C1. Sheet**: 3×3, new producers:
1. picnic hamper on legs
2. lantern stall
3. alien egg nest (gives pets)
4. busking robot with a speaker (gives music)
5. scrap rocket hull (gives rocket parts)
6. little weather balloon tethered to a crate
7. honey tree with a door
8. tea kettle cottage
9. toy chest that opens by itself

**C2. Sheet**: 4 columns × 3 rows, producer **upgrade levels**. Each row is one producer in level 1 → 2 → 3 → 4, getting bigger, shinier and more decorated (level 4 has gold trim and a sparkle).
- Row 1: wood pile
- Row 2: berry bush
- Row 3: water well

---

## D. Characters (same rules as `CHARACTERS-PROMPT.md`: two files each, head-and-shoulders + full body)

Halo and Wren are still missing (prompts in `CHARACTERS-PROMPT.md`). New ones:

- **Postie Blorb**: a sweaty, out-of-breath pale-blue alien mail carrier with six legs and a bulging satchel of parcels, a too-small cap, and one eye always on his watch. He brings daily gifts.
- **Madame Oops**: an accident-prone violet alien fortune-teller with a cracked crystal ball, a turban sliding off and a nervous grin. She runs the Lucky Wheel.
- **Grub Brothers**: two identical yellow-green worm aliens sharing one baseball cap, one smiling and one scowling. They run the Market.
- **Moon Pup**: the player's pet. A chubby cream blob-dog alien with three floppy ears and a glowing antenna, drawn at four sizes on one 4×1 sheet (baby → grown) for the pet feature. Funny, not babyish-cute.
- **Captain Glimmer**: a pompous gold-plated robot event host with a megaphone, light-bulb eyes and a tiny cape. He hosts events.

**D-extra. Expression sheet** for the main helper Zib: 4×2, head only, same character: happy, laughing, surprised, worried, smug, sleepy, angry, love-struck. Used in story scenes.

---

## E. Events (banner + token + prize for each)

For each event make:
- one wide banner, 2048×768, transparent background, no text, with an empty ribbon area for a title
- one 3×1 sheet: the event token (coin-sized), a small prize chest, a big prize chest

1. **Harvest Rush**: overflowing baskets of giant alien fruit, a scarecrow robot, autumn leaves.
2. **Merge Madness**: purple lightning, swirling items colliding into sparkles, a crazy-eyed Dr. Zonk.
3. **Visitor Week**: a cute flying saucer landing on the meadow with a red carpet and a welcome sign (blank).
4. **Lucky Crates**: a tower of wobbling crates with gem light leaking through the cracks.
5. **Season Pass**: a long winding path of 30 stepping stones up a hill to a golden rocket. 2048×1024, no text, one free lane and one gold lane side by side.

---

## F. Backgrounds and scenes

1. **Camp scenes**, one per world, 1080×1920 portrait, no characters, no text, with a calm empty middle where buildings get placed:
   - Meadow camp at golden hour
   - Moon crater camp under Earth-rise
   - Cindra lava hollow with glowing rivers
   - Nerith tidal shallows at sunset
   - Vela aurora snowfield at night
2. **Galaxy map**, 1080×2400 portrait: a dreamy purple-blue space with a winding dotted flight path connecting five empty planet spots, soft nebulas and stars. No planets drawn (we place them).
3. **Splash screen**, 1080×1920: the player's battered orange rocket lifting off from the meadow, aliens waving, a big empty sky for the logo.
4. **Loading tips frame**, 1080×1920: soft blurred meadow with a rounded cream note card in the lower third (blank).

---

## G. Camp decorations (a coin sink: players buy these)

**G1. Sheet**: 4×3 Meadow decorations, small, standing on a tiny shadow:
1. picket fence piece
2. flower lamp post
3. bird bath
4. bench
5. gnome-style alien statue
6. windmill
7. hammock between two posts
8. mailbox
9. little fountain
10. signpost
11. pumpkin stack
12. telescope on a tripod

**G2. Sheet**: 4×3 Moon decorations: crater lamp, antenna dish, rover parking spot, moon-rock garden, flag on a pole, space bench, satellite statue, glow mushrooms, helium balloon cart, star lantern, moon swing, crater pool.

---

## H. Seasonal skins (cheap art, big freshness)

**H1. Halloween board tiles**, 3×1: light tile, dark tile, locked tile, matching `tile_light.png` (attach it). Pumpkin-orange and purple, with a cobweb on the locked tile. Friendly, not spooky.

**H2. Winter board tiles**, 3×1: the same with snow, icy blue and a scarf-wrapped locked tile.

**H3. Producer hats**, 4×2 small accessories: witch hat, pumpkin cap, Santa hat, scarf, earmuffs, party hat, crown of flowers, bunny ears. They are drawn on top of producers and characters.

---

## I. Replace the last emoji in the UI

One sheet, 5×2, badges like `ic_trophy.png`:
1. map with a pin (📜 Goals)
2. microscope (🔬 Lab)
3. big gem (💎)
4. single coin (🪙)
5. lightning bolt in a battery (⚡)
6. carnival tent (🎪 Fun)
7. shopping cart full of crates (🛒 Shop)
8. globe with a ring (🌍 Map)
9. photo album (📖 Album)
10. speaker with music notes (sound settings)

---

## Priority order

1. A1–A3 (the claim UI shows them now)
2. Section icons from `WORLD1-MISSING.md`, then I
3. B1 + C1 (more Meadow content; players finish the Meadow too fast)
4. E1 + E5 (events and the season pass are the retention loop)
5. D (Postie, Madame Oops, Moon Pup)
6. F camps, G decorations, H seasonal
