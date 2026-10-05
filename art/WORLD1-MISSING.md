# World 1 (Sunny Meadow): art still missing

Save every image into `Desktop\chatgpt art` with the file name given. I cut, rename and wire everything in.

## 1. Characters (5 to replace, 2 new) — the most visible gap
Zorp, Nana Gloop, Gorbo and Madame Fleeb still show the old childish art. Mayor Snorb has no picture at all.

## Setup message (send first, once)
We're redoing the whole cast of my mobile merge game "Merge Rocket". Style of the PAINTING stays exactly like the attached reference (our producers/UI): soft glossy painterly semi-3D, saturated colour, warm light from upper left, thin warm-brown outline.
But the CHARACTERS change: funny, weird-looking ADULT cartoon aliens — think The Simpsons / Futurama / Rick and Morty energy: odd proportions, overbites, bulging or extra eyes, droopy stalks, sweaty, smug, tired, a visible personality flaw. Not cute, not babies, not a kids-show mascot. No humans, no dogs.
Rules for every image: one character, transparent background, 1024x1024, no text. For each character make TWO files:
1. `<id>.png` — head and shoulders, centred, face in the upper-middle (it's shown at 150px and at 36px in a circle, so the silhouette must read tiny).
2. `<id>_full.png` — full body standing, same pose language, feet at the bottom.
Keep the cast consistent with each other: same rendering, same light, same outline weight.

- **Zorp** → `pip.png` + `pip_full.png`: a lanky teenage alien slacker, lime-green skin, three eyestalks of different lengths (one droopy), a huge overbite, a slouchy hoodie with the hood over the stalks, bored half-lidded eyes but a sneaky grin
- **Nana Gloop** → `grandma.png` + `grandma_full.png`: a tiny ancient purple blob grandmother with a towering beehive hairdo full of curlers, thick pop-bottle glasses that make her eyes enormous, one snaggle tooth, a knitted shawl and a suspicious squint
- **Gorbo** → `timmy.png` + `timmy_full.png`: a stocky orange alien kid-brother type, one giant eye in the middle of a wide flat head, a gap in his teeth, a propeller beanie, a slingshot in his back pocket, mischievous grin
- **Madame Fleeb** → `gigi.png` + `gigi_full.png`: a tall skinny pink alien fashion diva with four arms (one holding a long bubble-wand holder, one a hand mirror), a long neck, heavy blue eyeshadow, a giant feathered hat and a sneer of superiority
- **Mayor Snorb** → `biscuit.png` + `biscuit_full.png`: a pompous fat slug-like alien mayor, yellow-olive skin, tiny arms, a sash and a too-small top hat, a big droopy moustache made of tentacles, sweating, giving a fake politician smile

For later worlds (same rules):
- **Halo** → `halo.png` + `halo_full.png`: a tall gaunt aurora-crystal mystic, teal-to-violet, three serene closed eyes, tiny stars orbiting the head, slightly creepy calm smile
- **Wren** → `wren.png` + `wren_full.png`: a scrawny topaz bird-alien gossip, long neck, beady eyes, a twig-nest hat and a beak open mid-chatter

---

## 2. Meteor Crater → `crater.png`
Same style as our other producers (attach `src/sprites/producers/hive.png` and `scrapwreck.png` as reference): a fresh little meteor crater in grass, cracked earth around the rim, a glowing orange-hot space rock in the middle, a thin wisp of smoke, two or three small cyan crystal shards. Stands on its own small round grassy mound. One object, transparent background, 1024×1024, no text.

## 3. Falling meteor → `meteor.png`
A chunky cartoon meteor rock (dark purple-brown, glowing orange cracks) with a big curved fire-and-sparkle trail, flying DOWN-LEFT: the rock at the bottom-left of the square, the trail sweeping up to the top-right corner. Same glossy painted style. Transparent background, 1024×1024, no text.

## 4. Section icons → one sheet `icons_sections.png`
Grid **5 columns × 2 rows**, wide gaps, transparent or pure white background. Round gold-rimmed badge icons in the exact style of our existing `ic_*` icons (attach `src/sprites/ui/ic_trophy.png` and `ic_calendar.png`). Each must read at 24 px: one bold simple object in the badge.
1. Gift box (today's deals)
2. Treasure chest (chests)
3. Magic wand with sparkles (boosters)
4. Golden star with an up-arrow (permanent upgrades)
5. Small rocket (rocket & lab)
6. Target with an arrow (getting started / quests)
7. Little temple with columns (relic vault)
8. Open book with a bookmark (collection)
9. Crane lifting a crate (restore the world / chapters)
10. Padlock (locked)

## 5. Lucky Wheel pin and hub → one sheet `wheel_bits.png`
Grid **2 columns × 1 row**, wide gap, transparent background, matching `src/sprites/ui/wheel.png`.
1. The pointer that sits on top of the wheel: a chunky gold arrowhead pointing DOWN with a red gem.
2. The round centre cap: a gold button with a star, glossy.

## 6. Optional: effect sprite sheets
The game draws its own sparkle effects, so these only polish. Each is a sprite sheet, evenly spaced frames, transparent background:
- `merge_burst.png` — 8 frames (4×2), a ring of golden sparks bursting out and fading.
- `level_rays.png` — 8 frames (4×2), golden light rays sweeping out from the centre.
- `coin_pop.png` — 6 frames (3×2), a coin flipping and rising.

---

Moon (world 2) is in `LUNA-PROMPT.md`: generate each sheet as its own full-size picture.
