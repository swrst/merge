# Painted art — how to drop it in

Every drawing in this game is generated from a shape and a material. That is why
504 items cost no drawing time, and it is also the ceiling: code can draw a
convincing toy, but it cannot paint one the way a person can.

So the game takes painted files too. Put one in and it replaces the generated
drawing **everywhere** — board, order cards, catalogue, camp, backdrop — with no
code change, no manifest, no content rebuild.

```
src/sprites/items/<item id>.png           twig.png, royaljelly.png, gemstone.png
src/sprites/producers/<producer art>.png  tree.png, bush.png, rocks.png
src/sprites/scenes/<world>.webp           earth.webp, luna.webp, cindra.webp,
                                          nerith.webp, vela.webp, lab.webp
```

Reload in dev, or `npm run build` for the single-file `MergeRocket.html` — the
sprites are inlined into it, so the one file still works with no server. (That is
why they live under `src/` and not `public/`.)

## What to name them

`npm run art` prints everything still generated, grouped by chain, with the name
of the thing so you know what to draw:

```
$ npm run art
painted 0 of 612 assets

    scenes                   0/6   world backdrop
    ui                       0/19   interface
    starters                 0/11   producer (Sunny Meadow)
    chain-wood               0/8   Woodworks (Sunny Meadow)
    ...
```

`npm run art -- --todo` prints just the paths, one per line, for feeding to a
batch job. `npm run art -- --batch chain-wood` prints one batch's prompts, and
`/art/sheet.html` (under `npm run dev`) checks the files you dropped in.

You do not have to do all of them. Paint the chains you look at most — the two
starters of each world and the first three tiers — and the rest keeps its
generated art; they sit side by side without looking broken, because the
generated art already wears the same contour and the same light.

## The brief

**Items.** Square, **transparent background**, 256×256 (512 if you want headroom).
One object, centred, filling about 80% of the frame with a little air around it.
Three-quarter view from slightly above, as if it were sitting on a table in front
of you. One warm light from the upper left, a soft shadow pooling under the object
— the shadow is part of the sprite, it sits on the tile. Thick dark-brown contour
all the way round, about 6px at 256. Saturated, friendly colours, a glossy
highlight on the top surface. No text, no drop shadow onto a background, no
background at all.

**Producers.** Same, but the object stands on a little patch of ground (a mound of
grass, sand, rock — whatever suits the world) and can be a touch taller than wide.

**Scenes.** 1086×1448 (3:4), no transparency, painted background art: a place you
are standing in, with the middle of the frame left uncluttered — the board panel,
the plinths and the rocket pad are drawn on top of it. The camp scenes want a
clear flat foreground with 3–5 round plinths or clearings across the bottom third
for the producers to stand on, and a distinct pad on the left for the rocket.

A prompt that gets close to the reference style:

> cartoon mobile game asset, <the thing>, 3/4 view, thick dark outline, soft
> baked lighting from upper left, glossy highlight, saturated warm palette,
> centred on a transparent background, no text, Travel Town / Merge Mansion
> style, high detail, square

## What the code does on top

Whatever the source, every item is put through one more pass before it reaches a
tile (`inked()` in `src/art.ts`): the silhouette is dilated into a single thick
warm-dark contour, and an offset copy of itself is subtracted to lay a band of
shade inside the bottom edge and a lip of light along the top. That is what makes
a hundred unrelated objects read as one box of toys. A painted sprite gets it too,
which is why painted and generated art can share a board without clashing — if a
sprite already has its own heavy outline the extra one just reads as a rim.
