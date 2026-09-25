# Merge Rocket — art brief

Everything needed to produce the game's visuals, and everything the game will
accept. There are **612 assets** listed in `art/manifest.csv`, each with its own
finished prompt. This file is the style bible around them.

`art/CATALOGUE.md` is the full merge catalogue: 504 items in 84 chains, every
chain in order, by world.

---

## 1. The one-paragraph brief

> **Travel Town, in space.** A bright, friendly mobile merge world of planets,
> friendly aliens, minerals, crystals, rocket parts and space gardens. Objects
> are chunky rounded toys with a soft, glossy, semi-3D painted finish. They are
> seen from a slight top-down three-quarter angle and all lit by the same soft
> warm light from the upper left, with a glossy highlight on top and a small soft
> shadow underneath. Colours are saturated and cheerful, never muddy, never neon,
> never gritty sci-fi. Nothing is photoreal, and nothing is flat vector clip art.

That paragraph is the test. If a new asset can sit on a board beside the others
and you cannot tell it was made separately, it passes.

## 2. The rules

**Angle.** Three-quarter view from about 30° above, as if the object were sitting
on a table. Use the same angle for everything.

**Light.** One warm key light from the upper left. The shaded side is a deeper,
richer version of the base colour, never grey or black. One soft white highlight
goes on the top surface.

**Edge.** A thin, darker warm-brown edge line, as in Travel Town. Never a heavy
black outline.

**Shadow.** A small soft contact shadow directly under the object, as part of the
sprite.

**Silhouette.** This matters most. An item is seen at 60px next to its relatives.
Each step of a chain must change the *outline*, not just add detail: twig →
branch → log → stack of planks, not four increasingly detailed sticks.

**Tier reads.** Chains run **4 to 8 steps**. However long the chain is, its
first step is the plainest and its last is the crown. The prompt for each item
already says which read it gets.

| Read | What it should look like |
|---|---|
| 1 | The smallest, plainest version. Tiny, humble, no decoration. |
| 2 | A little bigger, a little tidier. Still found, not made. |
| 3 | Clearly made rather than found: a neat shape and one painted or metal detail. |
| 4 | Handsome: richer colour, a trim or a band, a faint sheen. |
| 5 | Precious: fine detail, gold or gem accents, a soft glow around it. |
| 6 | A showpiece: ornate, glowing, motes of light floating near it. |
| 7 | The crown of the chain. A small monument. Radiant and unmistakable. |

**World palettes.** Keep each item inside its world's colour family.

| World | Mood | Key colours |
|---|---|---|
| Sunny Meadow | warm midday, an Earth lookalike | grass green, honey amber, warm tan, sky blue |
| Crater Camp | cold lilac moonlight | lilac, pale silver, slate blue, glowing cyan |
| Ember Hollow | volcanic dusk | ember orange, magma red, obsidian purple-black, ash grey |
| Tidal Shallows | bright shallow sea | turquoise, coral pink, pearl white, wet sand |
| Aurora Reach | night sky and cloudtops | violet, aurora teal, starlight gold, cloud white |

**Never.** No text or numbers baked into a sprite. No background, card, frame
or ground plane (producers are the exception: they stand on their own mound).
No watermark. No photoreal texture. No heavy noise or grain.

## 3. What to produce

`art/manifest.csv` (and `art/manifest.json`) has one row per asset:
`path, kind, name, group, batch, prompt, negative`. The `path` is exactly where
the file goes, and the filename **is** the id the game looks up. Rename nothing.

| Kind | Count | Goes in | Size |
|---|---|---|---|
| item | 504 | `src/sprites/items/<id>.png` | 512² transparent (256² accepted) |
| producer | 77 | `src/sprites/producers/<art>.png` | 512² transparent |
| scene | 6 | `src/sprites/scenes/<world>.webp` | 1086×1448 opaque |
| ui | 19 | `src/sprites/ui/<name>.png` | as the row says |
| fx | 6 | `src/sprites/fx/<name>.png` | sprite sheets, transparent |

### Order of work — one batch at a time

1. **`scenes`** — the five camps and the lab. They set the light and palette for
   everything else.
2. **`ui`** — panel, buttons, tiles, icons, order card, plinth.
3. **`starters`** — the two producers each world opens with, plus the Rocket
   Wreck.
4. **`chain-<key>`** — items, one whole chain per batch, world by world, starting
   with Sunny Meadow (`chain-wood`, `chain-stone`, …). Paint a whole chain in one
   sitting with one style reference, because the climb only works if its steps
   were made together.
5. **`producers`** — the rest of the producers.
6. **`fx`** — the six sprite sheets.

Partial delivery is fine. Anything not painted keeps its generated drawing.

## 4. Making the images

The prompts are written to be pasted into an image model as they are: Midjourney,
Stable Diffusion/Flux, GPT-image, or similar.

```bash
npm run art                               # progress, batch by batch
npm run art -- --batch chain-wood         # that batch's prompts and file names
npm run art -- --batch scenes --missing   # only what is still to do
```

- **One chain, one reference.** Make the first image of a chain, then use it as
  the style/image reference for the rest (`--sref` in Midjourney, IP-Adapter in
  SD, the reference image in GPT-image). Once the first batches look right, use
  one approved item as a house reference for everything.
- **Transparency.** GPT-image can output a transparent background directly.
  With other models, generate on a plain flat light background and cut it out
  (rembg, remove.bg, Photoshop). Keep the soft contact shadow when you cut.
- **Scenes must follow the layout.** The game stands the rocket, the lab, the
  Heart and six producers on fixed spots in the picture (listed in each scene
  prompt). Use `art/guides/camp_layout.png` (or `lab_layout.png`) as the
  img2img / ControlNet composition input, and `src/scenes/camp_earth.webp` as
  the style reference. Export as WebP, 1086×1448.
- **Size.** Export items and producers at exactly 512×512, object centred and
  filling about 80% of the frame.

## 5. Feeding it back in

Drop the files onto their paths and reload. That is the whole integration: no
code change, no manifest update, no content rebuild. The build inlines the files
into the single-file `MergeRocket.html`, which is why they live under `src/`.

```bash
npm run dev             # the game, and the check sheet at /art/sheet.html
npm test                # the full playtest
npm run build           # dist/ + a fresh single-file MergeRocket.html
```

The catalogue itself is authored in `scripts/content/` (chains, producers,
worlds). After editing it, run `npm run content && npm run art:manifest`.

## 6. Acceptance check

Open `/art/sheet.html?batch=<name>` with `npm run dev` running. It lays the
batch on the board-tile colour at full size and at 60px, lays each chain out in
order, marks where the game stands things on each scene, and flags files that
are missing, the wrong size, or not transparent at the corners. A batch passes
when:

1. Nothing disappears into the `#e9cd97` tile colour or screams out of it.
2. Every item can be named at 60px.
3. Each chain's climb is obvious without the names, and the last step is clearly
   the best. The most common failure is a middle step looking better than the
   crown.
4. Angle, light direction and edge weight match across the batch. One asset lit
   from the right is worse than ten mediocre assets lit the same way.
5. On scenes, every red anchor dot lands on a plinth or pad.
