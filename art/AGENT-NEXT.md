# Next message for the art agent (v9 UI + portraits)

Paste everything below the line into the ChatGPT art agent.

---

You are continuing as art director and illustrator for **Merge Rocket** (repo `swrst/merge`, branch `main`). It's a Travel Town–style merge game set in space. The game's UI has just been redesigned to work like Travel Town. Your job now is to paint the **character portraits** and the **new UI pieces**, and then go back to the Meadow chains.

## What changed in the game (look at it first: `npm ci && npm run dev`)
- A **bottom dock** of six big buttons: Map · Goals · Fun · Lab · Album · Shop.
- Every panel is now a **popup** over the board: a cream card with a coloured ribbon title and a round red ✕.
- **Story scenes**: a big character portrait stands on top of a speech box, with a name tag.
- **Lucky Wheel** (8 wedges), **Alien Pairs** (a memory game with face-down cards), and a live **event** with a reward track.
- Right now all of these use CSS and emoji. Each painted file you add replaces its stand-in automatically. There's no code to touch.

## Read first
- `ART-BRIEF.md`: the style bible.
- `art/manifest.csv`: the only source of truth. Use each row's `prompt` and save to its exact `path`.
- `npm run art -- --batch ui2` and `npm run art -- --batch portraits` list the new rows.
- Style references: `src/sprites/ui/btn_green.png`, `ribbon.png`, `panel_wood.png`, `icon_coin.png` and `src/sprites/producers/well.png`. Match their gloss, outline weight and warm light exactly.

## Order (one PR per step)
1. **`art/portraits`**, batch `portraits` (**18 files**, the top priority). Every character gets a painted face: Pip, Granny Fern, Timmy, Gigi, Biscuit, Bloop, Zib, Luma, Rokk, Nix, Vulk, Ember, Marin, Kelpa, Sirra, Zephyr, Halo and Wren.
   - **Where they show:** big (150px) in story scenes, and small (36px, in a circle) on every contract card. Both sizes have to work, so give each one a clear silhouette and a face that fills the upper middle of the square.
   - **Style:** head and shoulders, a friendly expression, the same warm light from the upper left, and the same painterly semi-3D finish as the producers. Paint them as one set.
   - **Order:** do the six Sunny Meadow characters first (pip, grandma, timmy, gigi, biscuit, bloop) and **push them**, then the other twelve.
2. **`art/ui2`**, batch `ui2` (16 files):
   - `dock_bar`, `dock_btn`, `popup_frame`, `btn_close`, `talk_box`, `card_back`, `wheel`
   - icons `ic_map`, `ic_goals`, `ic_fun`, `ic_lab`, `ic_album`, `ic_shop`, `ic_spin`, `ic_event`, `ic_science`
   - **9-slice pieces** (`popup_frame`, `talk_box`, `dock_bar`): keep the corners inside the stated corner size, and keep the middle plain so it can stretch without smearing.
   - **The wheel** must have exactly 8 equal wedges. Wedge 1 starts at 12 o'clock and the rest go clockwise in the colours listed in its prompt. Leave every wedge empty: the game draws the prizes on top.
   - **The dock icons** must read at 34px. Use a bold, simple silhouette; no fine detail.
3. **Meadow chains**, one PR each: `chain-grass`, `chain-flower`, `chain-honey`, `chain-mush`, `chain-cloth`, `chain-feather`, `chain-visitor`, `chain-veggie`, `chain-stargaze`, `chain-clay`, `chain-garden`.
4. **The rest of the Meadow producers**: `flowerbed`, `hive`, `raincloud`, `crashsite`, `mosslog`, `cottonpatch`, `nestbox`, `vegpatch`, `tinkerbench`, then `chain-chest` (`chest`, `bigchest`).

**Item framing:** the game now re-centres every item automatically and scales it so the painted part fills about 86% of the square. You don't need to pad or centre by hand, but keep a single subject per file with a clean transparent edge.

## Rules
- PNG with a transparent background, at the size in each prompt (or 2× that).
- No text and no letters. The only exception is the white X on `btn_close`.
- Shrink each icon to 34px and each item to 60px and check it still reads. If it doesn't, simplify it.
- Add only image files, on the manifest paths. Don't touch code, `src/content/` or the manifest.

## Delivery: never lose work
- Work on branch `art/<step>`, and **commit and push after every 3–4 images**. Uncommitted work gets lost when credits run out.
- If you can't push, say so straight away and list the files you made.
- In each PR, list the files and attach a screenshot of `npm run dev` → `/art/sheet.html?batch=<batch>`. For `ui2`, also attach a screenshot of the game with the dock and a popup open.

## Start now
Reply in three lines: how you read the existing UI style, how you'll keep the 9-slice frames stretchable, and which batch you're starting. Then produce step 1.
