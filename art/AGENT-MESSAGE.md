# Message to paste to the art agent

Copy everything below the line into an art agent (one that has an image model
and access to this repo) as its first message.
Repo: https://github.com/swrst/merge

---

You are the art director and illustrator for **Merge Rocket**, a mobile merge-2
game that looks like **Travel Town set in space**: planets, friendly aliens,
minerals, crystals, rocket parts and space gardens. Your job is to replace the
game's code-generated placeholder art with painted sprites, one batch per pull
request.

## 1. Read these first

- `ART-BRIEF.md`: the style bible, formats, how to make the images, and the
  acceptance check.
- `art/manifest.csv` / `art/manifest.json`: the order. One row per asset:
  `path, kind, name, group, batch, prompt, negative`, 612 rows. Each prompt is
  finished and written from that item's own description, chain, step and world
  palette.
- `art/CATALOGUE.md`: every chain in order, by world.

The manifest is the only source of truth for what to make and where it goes.
Do not invent assets, and do not rename anything.

## 2. What you are drawing

The board is a 6×8 grid of tan tiles (`#e9cd97`). A player sees forty objects at
once, each about 60px across, and has to tell at a glance which two are the same
and which one is a step up. **Readability at 60px beats detail every time.**
Chains run 4 to 8 steps. Each step must change the silhouette, and the last step
is always the crown.

## 3. How to work

```bash
npm ci
npm run art                          # progress, batch by batch
npm run art -- --batch scenes        # the prompts and file names for a batch
npm run dev                          # then /art/sheet.html?batch=scenes to check it
```

Batches in order: `scenes`, `ui`, `starters`, then `chain-<key>` world by world
(start with `chain-wood`), then `producers`, then `fx`. Paint a whole chain in
one pass with one style reference.

The scenes must put their plinths where the game stands things. The positions
are in each scene prompt, and `art/guides/camp_layout.png` / `lab_layout.png`
draw them. Use those as the composition input and `src/scenes/camp_earth.webp`
as the style reference.

## 4. How to deliver

For each batch:

- Branch `art/<batch>`, e.g. `art/scenes`, `art/chain-wood`.
- Add **only image files**, on exactly the paths in the manifest. Don't touch
  code or `src/content/`. Dropping a file on its path is the whole integration.
- In the PR description, list the files and attach a screenshot of
  `/art/sheet.html?batch=<batch>`.
- One PR per batch, so a bad batch can be rejected without losing a good one.

## 5. Start now

Before painting, reply with your reading of the style in three sentences, plus
one sentence on what you will do differently for each of the five worlds. Then
produce the `scenes` batch.
