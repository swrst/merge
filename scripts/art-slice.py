#!/usr/bin/env python3
"""Cut a one-row strip of items (one ChatGPT image per chain) into item files.

    python3 scripts/art-slice.py <strip.png> <chain key>

The strip must show the chain's items left to right, in order, on a
transparent background with clear gaps between them. Each object is found by
its transparent gaps, then saved as src/sprites/items/<item id>.png
(art:optimize re-centres and shrinks them afterwards)."""
import json, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
src, key = sys.argv[1], sys.argv[2]
chain = json.load(open(os.path.join(ROOT, 'src/content/chains.json')))[key]['items']
im = Image.open(src).convert('RGBA')
a = im.split()[3].point(lambda v: 255 if v > 24 else 0)
W, H = im.size
cols = [any(a.getpixel((x, y)) for y in range(0, H, 3)) for x in range(W)]
runs, start = [], None
for x, on in enumerate(cols + [False]):
    if on and start is None: start = x
    if not on and start is not None:
        if x - start > W * 0.02: runs.append((start, x))
        start = None
# merge runs separated by tiny gaps (a single object with a hole in it)
merged = []
for r in runs:
    if merged and r[0] - merged[-1][1] < W * 0.012: merged[-1] = (merged[-1][0], r[1])
    else: merged.append(r)
if len(merged) != len(chain):
    sys.exit(f'found {len(merged)} objects but {key} has {len(chain)} items — regenerate with clearer gaps')
for (x0, x1), iid in zip(merged, chain):
    part = im.crop((x0, 0, x1, H)); bb = part.getbbox(); part = part.crop(bb)
    out = os.path.join(ROOT, 'src/sprites/items', iid + '.png')
    part.save(out); print('  ', iid, part.size)
