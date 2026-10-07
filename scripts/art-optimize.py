#!/usr/bin/env python3
"""Shrink painted sprites to what the game actually shows.

Every file under src/sprites/ is inlined into the single-file GalaxyAdventure.html,
so a 250 kB item times 500 items is a 125 MB page. The board draws an item at
~60 px (168 px texture), so 256 px is plenty:

  items/ producers/   -> 192x192 WebP with alpha (~10 kB); a new .png dropped
                         in is re-framed, converted and the .png removed
  chars/               -> 256x256 WebP with alpha
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


FILL = {'items': 0.86, 'producers': 0.92, 'chars': 0.94}
WEBP_SIDE = {'items': 192, 'producers': 192, 'chars': 256}


def recentre(im, sub, force=False):
    """Items are drawn on a tile, so a sprite whose subject sits off to one side
    or fills half the frame looks wrong next to its neighbours. Crop to what is
    painted and put it back centred at a consistent size. Returns None when the
    sprite is already fine, so a clean file is never re-encoded."""
    a = im.split()[3].point(lambda v: 255 if v > 40 else 0)
    bb = a.getbbox()
    if not bb:
        return None
    w, h = im.size
    cx = (bb[0] + bb[2]) / 2 / w - .5
    cy = (bb[1] + bb[3]) / 2 / h - .5
    fill = max(bb[2] - bb[0], bb[3] - bb[1]) / max(w, h)
    want = FILL[sub]
    if not force and abs(cx) <= .025 and abs(cy) <= .03 and abs(fill - want) <= .07:
        return None
    crop = im.crop(bb)
    side = round(SQUARE * want)
    k = side / max(crop.width, crop.height)
    crop = crop.resize((max(1, round(crop.width * k)), max(1, round(crop.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (SQUARE, SQUARE), (0, 0, 0, 0))
    out.paste(crop, ((SQUARE - crop.width) // 2, (SQUARE - crop.height) // 2), crop)
    return out


def main():
    before = after = 0
    for sub in ('items', 'producers', 'chars', 'ui', 'scenes'):
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
            if sub in WEBP_SIDE:
                side = WEBP_SIDE[sub]
                im = im.convert('RGBA')
                if ext == '.webp' and im.width <= side:
                    after += size
                    continue
                if sub != 'chars':
                    fixed = recentre(im, sub, force=im.width != im.height)
                    if fixed is not None:
                        im = fixed
                if im.width != im.height:
                    sq = Image.new('RGBA', (max(im.size),) * 2, (0, 0, 0, 0))
                    sq.paste(im, ((sq.width - im.width) // 2, sq.height - im.height))
                    im = sq
                im = im.resize((side, side), Image.LANCZOS)
                b = io.BytesIO()
                im.save(b, 'WEBP', quality=80, method=6, alpha_quality=85)
                dst = os.path.splitext(p)[0] + '.webp'
                with open(dst, 'wb') as fh:
                    fh.write(b.getvalue())
                if dst != p:
                    os.remove(p)
                after += len(b.getvalue())
                continue
            if sub == 'ui' and ext == '.webp':
                after += size                      # photographic backdrops stay WebP
                continue
            if sub == 'scenes':
                if size <= 300_000:
                    after += size
                    continue
                b = io.BytesIO()
                im.convert('RGB').save(b, 'WEBP', quality=80, method=6)
                data = b.getvalue()
            else:
                im = im.convert('RGBA')
                fixed = None
                if sub in FILL:
                    # a non-square file (a slice off a strip) is always re-framed
                    fixed = recentre(im, sub, force=im.width != im.height)
                    if fixed is None and im.width > SQUARE:
                        im = im.resize((SQUARE, SQUARE), Image.LANCZOS)
                if fixed is not None:
                    im = fixed
                    print(f'  {sub}/{f:28s} re-centred')
                elif size <= 40_000 and im.width <= SQUARE:
                    after += size
                    continue
                data = palette_png(im)
                if fixed is not None:
                    with open(p, 'wb') as fh:
                        fh.write(data)
                    after += len(data)
                    continue
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
