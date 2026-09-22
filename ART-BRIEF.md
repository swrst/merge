# Merge Rocket — art brief

Everything an art agent needs to produce the game's visuals, and everything the
game will accept. There are **367 assets** listed in `art/manifest.csv`, each with
its own finished prompt. This file is the style bible around them.

Read `art/CATALOGUE.md` for the full merge catalogue — every chain, in order, with
the name and tier of each item.

---

## 1. The one-paragraph brief

> A warm, sunny, hand-painted cartoon world seen from a slight top-down three-quarter
> angle, in the manner of **Travel Town** and **Merge Mansion**. Objects are toys:
> chunky, rounded, simplified, with no small fiddly detail. Every object wears the
> same thick dark warm-brown contour and is lit by the same soft light from the
> upper left, with a glossy highlight on its top surface and a soft shadow pooling
> under it. Colours are saturated and friendly — sunlit greens, honey ambers, warm
> tans, clean sky blues — never muddy, never neon. Nothing is photoreal, nothing is
> flat vector clip art: the finish is painted, but clean.

That paragraph is the test. If a new asset can sit on a board beside the others and
you cannot tell it was made separately, it passed.

## 2. The rules, in detail

**Angle.** Three-quarter from about 30° above, as if the object were sitting on a
table in front of you. Not flat-on, not top-down. The same angle for everything, so
a board of forty objects looks like one table.

**Light.** One key light from the upper left, warm. The top and upper-left faces are
brightest; the lower right falls into a deeper, *more saturated* version of the base
colour — never grey, never black. A narrow bounce of light along the bottom edge
keeps the object from looking stuck on. One soft white glossy highlight on the
top-most curved surface.

**Contour.** A single thick dark warm-brown outline (≈ #41280f) around the whole
silhouette, roughly 6px at 512×512, even weight all the way round. Interior lines,
if any, are thinner and the same family of colour. No black.

**Shadow.** A soft elliptical contact shadow directly under the object, part of the
sprite, about 60% of the object's width, low opacity. It sits on a tan tile, so
tint it warm.

**Silhouette.** This is the part that matters most. An item is seen at 60px on a
tile next to six relatives from the same chain. A player must tell them apart by
shape alone, at a glance, while scrolling. Within one chain each step should change
the outline, not just add a detail: twig → branch → log → stack of planks, not four
increasingly detailed sticks.

**Tier reads.** Chains climb, and the climb has to be visible:

| Tier | What it should look like |
|---|---|
| 1 | The smallest, plainest version. Tiny, humble, no decoration. |
| 2 | A little bigger, a little tidier. Still found, not made. |
| 3 | Clearly made rather than found: neat shape, one painted or metal detail. |
| 4 | Handsome: richer colour, a trim or a band, a faint sheen. |
| 5 | Precious: fine detail, gold or gem accents, a soft glow around it. |
| 6 | A showpiece: ornate, glowing, motes of light floating near it. |
| 7 | The crown of the chain. A small monument. Radiant and unmistakable. |

**Palette per world.** Each world has a key. Keep items inside their world's family.

| World | Mood | Key colours |
|---|---|---|
| Sunny Meadow | warm midday countryside | grass green, honey amber, warm tan, sky blue |
| Crater Camp | cold lilac moonlight | lilac, pale silver, slate blue, glowing cyan |
| Ember Hollow | volcanic dusk | ember orange, magma red, obsidian purple-black, ash grey |
| Tidal Shallows | bright shallow sea | turquoise, coral pink, pearl white, wet sand |
| Aurora Reach | night sky and cloudtops | violet, aurora teal, starlight gold, cloud white |

**Formats.** Items, producers, UI: **PNG, transparent, square, 512×512** (256 is
acceptable, 512 gives headroom). Scenes: **WebP or PNG, 1086×1448 portrait, opaque**.
Sprite sheets: PNG, transparent, frames in an even grid, read left-to-right then
top-to-bottom.

**Never.** No text or numbers baked into a sprite. No background, no card, no frame,
no ground plane (except producers, which stand on their own mound). No drop shadow
onto a backdrop. No watermark. No photoreal texture. No heavy noise or grain.

## 3. What to produce

`art/manifest.csv` has one row per asset: `path, kind, name, group, prompt`. The
`path` is exactly where the file goes in the repo, and the filename **is** the id
the game looks up — rename nothing.

| Kind | Count | Goes in | Size |
|---|---|---|---|
| item | 286 | `src/sprites/items/<id>.png` | 512² transparent |
| producer | 50 | `src/sprites/producers/<art>.png` | 512² transparent |
| scene | 6 | `src/sprites/scenes/<world>.webp` | 1086×1448 opaque |
| ui | 19 | `src/sprites/ui/<name>.png` | as noted per row |
| fx | 6 | `src/sprites/fx/<name>.png` | sprite sheets |

### Order of work

1. **Six scenes.** They set the light and the palette for everything else, and they
   change the look of the game more than anything else on this list.
2. **The nineteen UI pieces.** Panel, buttons, tiles, icons, order card, plinth.
   These are what the player's eye sits on all the time.
3. **The ten starter producers** (`tree`, `rocks`, `bush`, `well`, `geyser`,
   `glowpod`, `lavavent`, `shroomlog`, `shellbed`, `kelpbed`, `cloudbank`,
   `auroraloom`), then the rest.
4. **Items, chain by chain, in tier order** — a whole chain at a time, never
   scattered, because the climb only works if the seven were drawn together.
   Start with Sunny Meadow's seven chains; that is the first hour of the game.
5. **The six sprite sheets** last.

Partial delivery is fine and expected. Anything not painted keeps its generated
drawing, and the two sit together without looking broken because the generated art
already wears the same contour and the same light.

### Consistency across a batch

Paint a chain in one pass with the same seed/style reference, and put the whole
chain on one sheet to check the climb before exporting the pieces. The single most
common failure is tier 4 looking better than tier 6.

## 4. Feeding it back in

Drop the files into the paths in the manifest and reload. That is the whole
integration — no code change, no manifest to update, no content rebuild. The build
inlines them into the single-file `MergeRocket.html`, which is why they live under
`src/` and not `public/`.

```bash
npm run art             # what is painted, what is still generated
npm run art -- --todo   # just the missing paths, one per line
npm run art:manifest    # rebuild manifest.csv / manifest.json / CATALOGUE.md
npm run dev             # look at it
npm test                # 136 checks, including that every item can still be drawn
npm run build           # dist/ + a fresh single-file MergeRocket.html
```

## 5. The master prompt

For an agent that takes one system prompt and then a list of jobs:

> You are producing 2D art for a mobile merge game called Merge Rocket. The house
> style is warm hand-painted cartoon in the manner of Travel Town and Merge
> Mansion: objects are chunky simplified toys seen three-quarter from about 30°
> above, each with a single thick dark warm-brown contour (#41280f) of even weight,
> lit by one soft warm key light from the upper left, a glossy white highlight on
> the top surface, the shaded side a deeper *more saturated* version of the base
> colour rather than grey, a narrow bounce of light along the bottom edge, and a
> soft warm elliptical contact shadow beneath. Saturated friendly colours, clean
> painted finish, no photorealism, no flat vector clip art, no small fiddly detail,
> no text, no background, no frame, no watermark.
>
> Every asset is delivered as a PNG with a transparent background, square, 512×512,
> the object centred and filling about 80% of the frame, unless the job says
> otherwise. The object must be readable as a 60-pixel silhouette.
>
> I will give you jobs one per line as `path | name | prompt`. Produce exactly one
> image per job and name the file after the final path segment, unchanged. If a job
> belongs to a merge chain it will say which step it is; the chain must climb
> visibly from plain and small to ornate and radiant, and each step must change the
> silhouette, not just add detail.

Then feed it rows from `art/manifest.csv`.

## 6. Acceptance check

Before a batch is accepted:

1. Put all of it on one sheet against `#e9cd97` (the board tile colour). Anything
   that disappears into the background, or screams out of it, fails.
2. Scale the sheet to 60px per item. Anything you cannot name at that size fails.
3. Lay each chain out in order. If the climb is not obvious without the names, the
   chain fails as a chain even if every item is good on its own.
4. Check the contour weight and the light direction across the batch. One asset lit
   from the right is worse than ten mediocre assets lit the same way.
