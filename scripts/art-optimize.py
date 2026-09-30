#!/usr/bin/env python3
"""Shrink painted sprites to what the game actually shows.

Every file under src/sprites/ is inlined into the single-file MergeRocket.html,
so a 250 kB item times 500 items is a 125 MB page. The board draws an item at
~60 px (168 px texture), so 256 px is plenty:

  items/ producers/   -> 256x256 PNG, 256-colour palette with alpha (~20 kB)
  scenes/             -> WebP, quality 80, 1086x1448 (~150 kB)
  ui/                 -> palette PNG at its current size

Safe to run again: files already small enough are left alone. Needs Pillow.

    python3 scripts/art-optimize.py
"""
import io
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'sprites')
SQUARE = 256


def palette_png(im):
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    b = io.BytesIO()
    q.save(b, 'PNG', optimize=True)
    return b.getvalue()


def main():
    before = after = 0
    for sub in ('items', 'producers', 'ui', 'scenes'):
        d = os.path.join(ROOT, sub)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            p = os.path.join(d, f)
            ext = os.path.splitext(f)[1].lower()
            if ext not in ('.png', '.webp'):
                continue
            size = os.path.getsize(p)
            before += size
            im = Image.open(p)
            if sub == 'scenes':
                if size <= 260_000:
                    after += size
                    continue
                b = io.BytesIO()
                im.convert('RGB').save(b, 'WEBP', quality=80, method=6)
                data = b.getvalue()
            else:
                im = im.convert('RGBA')
                if sub in ('items', 'producers') and im.width > SQUARE:
                    im = im.resize((SQUARE, SQUARE), Image.LANCZOS)
                if im.mode == 'RGBA' and size <= 40_000 and im.width <= SQUARE:
                    after += size
                    continue
                data = palette_png(im)
            if len(data) < size:
                with open(p, 'wb') as fh:
                    fh.write(data)
                after += len(data)
                print(f'  {sub}/{f:28s} {size // 1024:5d} kB -> {len(data) // 1024:4d} kB')
            else:
                after += size
    print(f'\nsprites: {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB')


if __name__ == '__main__':
    sys.exit(main())
