# Galaxy Adventure: new sounds

Every sound in the game is a file in `src/audio`. To replace one, make it with one of the tools below, save it as **`<name>.mp3`** (the name in the table), and drop it into `src/audio`. An `.mp3` beats the old `.ogg` of the same name, so nothing else needs changing. Run `npm run dev` and listen.

## Which tool

| What | Tool | Free? | Use in the game? |
|---|---|---|---|
| Sound effects | **ElevenLabs Sound Effects** (elevenlabs.io → Sound Effects) | Free plan has monthly credits | Free plan: needs attribution and no commercial licence. For the store build, use a paid month (Starter) or redo them with Stable Audio. |
| Sound effects + music loops | **Stable Audio 3.0** (stableaudio.com, or the free open models on Hugging Face) | Open models are free | Yes, commercial use is fine while the company earns under $1M a year (Stability AI Community License). |
| Music | **Suno** | Free plan | Free-plan songs are **non-commercial only**. Make the music during a paid month (Pro) to be allowed to ship it. |
| Ready-made, no AI | **Kenney.nl** audio packs (Interface Sounds, Sci-Fi Sounds) | Free | Yes, CC0: no credit needed. |

Tips:
- Short and soft wins. Most effects here should be **under 1 second**. Set the duration in the tool (0.5–1 s) instead of trimming.
- Generate 4 versions of each and pick the softest one. Loud, sharp sounds get annoying after 100 merges.
- Add "**no music, single sound, clean, no reverb tail**" to every effect prompt.

## Sound effects

| File | Length | Prompt |
|---|---|---|
| `tap.mp3` | 0.2 s | soft bubbly tap on a glass button, cute, sci-fi |
| `pop.mp3` | 0.3 s | small soft pop of an item appearing, cute bubble pop |
| `pop_hi.mp3` | 0.3 s | small high-pitched bubble pop, sparkly |
| `lift.mp3` | 0.2 s | tiny soft whoosh of picking up an object, airy |
| `land.mp3` | 0.25 s | soft thud of a small object landing on a cushion |
| `swap.mp3` | 0.3 s | two soft swishes, objects swapping places |
| `merge1.mp3` … `merge8.mp3` | 0.6 s | magical merge chime, bright crystal sparkle, **one note**; make 8 versions going up in pitch (prompt: "…, low pitch" for 1, "…, very high pitch" for 8) |
| `merge_crown.mp3` | 1.5 s | triumphant short fanfare of sparkling chimes, magical achievement, cute |
| `coin.mp3` | 0.4 s | single bright coin clink, cartoon, cheerful |
| `sell.mp3` | 0.5 s | coins dropping into a small pouch, cartoon |
| `collect.mp3` | 0.7 s | sparkly reward collect sound, rising shimmer |
| `chest.mp3` | 1.2 s | small treasure chest creaking open with a magical sparkle |
| `unlock.mp3` | 0.8 s | magical unlock, soft click then shimmering chime |
| `discover.mp3` | 1 s | wondrous discovery sound, soft harp gliss with twinkles |
| `levelup.mp3` | 2 s | cheerful level up jingle, synth bells, space theme, short |
| `chapter.mp3` | 2.5 s | chapter complete jingle, warm synth brass and bells, uplifting |
| `open.mp3` | 0.3 s | soft holographic panel opening, gentle sci-fi swoosh |
| `close.mp3` | 0.3 s | soft holographic panel closing, gentle reverse swoosh |
| `tab.mp3` | 0.2 s | tiny sci-fi interface blip |
| `click.mp3` | 0.15 s | soft UI click, rounded, sci-fi |
| `hover.mp3` | 0.15 s | very soft UI tick |
| `nope.mp3` / `error.mp3` | 0.3 s | gentle low "bonk", friendly error sound, not harsh |
| `ready.mp3` | 0.6 s | soft ding-dong notification, something is ready |
| `boing.mp3` | 0.4 s | cartoon spring boing, soft |
| `goo.mp3` | 0.5 s | squishy alien slime squelch, cute |
| `dig.mp3` | 0.5 s | small shovel digging in moon dust |
| `build.mp3` | 1 s | short cartoon construction: a few hammer taps and a ding |
| `install.mp3` | 0.8 s | robotic part clicking into place, servo whirr and clunk |
| `fuel.mp3` | 0.8 s | liquid fuel glugging into a tank, cartoon |
| `boost.mp3` | 0.7 s | power-up zap, rising synth |
| `bag.mp3` | 0.4 s | object zipped into a soft bag |
| `unseal.mp3` | 0.6 s | bubble seal popping open, wet and sparkly |
| `whoosh.mp3` | 0.6 s | fast spaceship whoosh past the camera |
| `launch.mp3` | 2.5 s | small cartoon rocket launch, rumble then whoosh up |
| `meteor.mp3` | 2 s | meteor falling and landing with a deep soft boom, cartoon |
| `star.mp3` | 0.6 s | twinkling star chime |
| `streak1.mp3` … `streak5.mp3` | 0.5 s | combo chime, each one a step higher in pitch |

Character voices (`voice_<kind>_1…8.mp3`, 0.3 s each, 8 versions each): short alien gibberish syllables, cute, like Animal Crossing speech. Kinds: `chirp` (high bird-like alien), `deep` (low friendly giant), `dreamy` (soft airy), `gloop` (gooey slime), `mid` (normal cheerful alien), `robot` (little robot beeps), `squeak` (tiny squeaky creature).

## Music (Suno Pro or Stable Audio)

Each world has 3 tracks that rotate, plus an ambience bed. Ask for **instrumental, 2–3 minutes, seamless loop, no vocals**.

| File | Prompt |
|---|---|
| `music_earth_1…3.mp3` | calm cozy space ambient, soft synth pads, gentle marimba and kalimba, warm, slow, relaxing mobile game background, no drums |
| `music_luna_1…3.mp3` | dreamy lunar ambient, slow airy pads, soft piano notes, sparkling chimes, tranquil, weightless |
| `music_cindra_1…3.mp3` | warm volcanic world ambient, deep soft pads, gentle hand drums far away, glowing, calm |
| `music_nerith_1…3.mp3` | underwater alien ocean ambient, slow watery synths, soft bubbles, whale-like pads, peaceful |
| `music_vela_1…3.mp3` | floating sky islands ambient, light airy pads, soft flute and harp, breezy, hopeful |
| `amb_<world>.mp3` | quiet nature ambience of an alien planet, soft wind and distant gentle creature sounds, no music, loop (one per world: earth, luna, cindra, nerith, vela) |
