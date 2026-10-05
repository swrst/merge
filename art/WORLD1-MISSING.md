# World 1 (Sunny Meadow): art still missing

Save every image into `Desktop\chatgpt art` with the file name given. I cut, rename and wire everything in.

## 1. Characters
Done: the Meadow cast now wears the new paintings (Zib, Nana Luma, Ember, Sirra, Mayor Marin, plus Chef Gubbo, Duchess Splatt, Dr. Zonk, Rokk, Nix, Vulk, Kelpa, Zephyr as customers). Still without a picture, for the sky world: **Halo** and **Wren** — prompts in `CHARACTERS-PROMPT.md`.

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
