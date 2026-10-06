# Art: how it gets into the game

## Where the files go

| Folder | What | File name |
|---|---|---|
| `src/sprites/items/` | merge items | `<item id>.png` |
| `src/sprites/producers/` | producers | `<producer art>.png` |
| `src/sprites/chars/` | characters | `<id>.png` (head) + `<id>_full.png` (full body) |
| `src/sprites/ui/` | UI | see below |
| `src/sprites/scenes/` | painted backgrounds | `.webp` |

- A file present = painted. A file missing = the generated stand-in drawing from `src/artgen.ts`.
- No code change is needed. Ids are in `art/CATALOGUE.md` and in `scripts/content/*.mjs`.

## The workflow

1. Paste **`art/ALL-ART-PROMPT.md`** into ChatGPT. It is one prompt with everything still to paint.
   - Attach `STYLE-REFERENCE.png`, and get **one image per reply**; collages come out too small.
   - `node scripts/world-prompt.mjs <world>` prints one world's missing sheets on its own.
2. Save the result into `Desktop\chatgpt art`.
3. Cut each object out (alpha segmentation), rename it to its id, and drop it into the folder above.
   - Rename the source sheet `_USED`.
4. Run `npm run art:optimize`: items and producers become 256 px palette PNGs, and the subject is recentred.
5. Run `npm run art:manifest`: the catalogue and prompt data are refreshed.

## UI files

UI files are picked up by name:

- **As images:** `ART.uiIcon('<name>')`.
- **As CSS:** the root gets class `ui-<name>` and variable `--ui-<name>`.

| Group | Files |
|---|---|
| Board tiles | `tile_light`, `tile_dark`, `tile_locked`, plus per world `tile_light_<world>` etc. |
| Section titles | `sec_*` |
| Claim ribbon and inline icons | `cl_*`, `ic_*` |
| Currencies | `icon_*` |
| Events | `banner_<event>`, `tok_<event>` |
| Side games | `fun_*` |
| Lucky Wheel | `wheel`, `wheel_pin`, `wheel_hub` |
| Reward card | `reward_card` |
| Meteor | `meteor` (rock bottom-left, trail to top-right) |

**Emoji.** Any emoji in the game's text that has a painted twin is swapped for it automatically (`EMO` in `src/game.ts`). Paint an icon, add it to that map, and every emoji of that kind changes.

## Still to paint

Everything below is in `art/ALL-ART-PROMPT.md` (21 images):

- **The pet:** 8 evolution forms and 4 moods.
- **Aurora Reach (Vela):** 8 chains.
- **Tidal Shallows (Nerith):** most chains, the producers and the tiles.
- **Higher-resolution redos** of the v25 collage art: the Meadow side chains, the new producers and the helpers.
- **Unused art kept for later** (decorations, hats, holiday tiles, Moon Pup, Zib's faces, event banners, backgrounds) is in `art/library/`.

## The pet's forms

Each form is `src/sprites/chars/pet_<form>.png`, where the form is one of `baby`, `pup`, `star`, `crater`, `comet`, `nova`, `titan`, `king`. Until a form is painted, the game draws the pup growth sprites (`pup1`–`pup5`) tinted for that branch.
