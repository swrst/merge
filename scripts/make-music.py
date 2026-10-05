#!/usr/bin/env python3
"""The music, rebuilt so it never wears thin.

One 30-second loop per world, forever, is what made the old score annoying.
Now every world gets FOUR different phrases (same key and tempo, different
chords, melody and lead instrument) plus a quiet ambience bed. The game plays
them like a radio that knows when to be quiet: a phrase or two, then the
ambience alone for a while, then a different phrase (see MusicDirector in
src/audio.ts). Nothing repeats back to back, and there is room to breathe.

Melodies are written by a small, seeded composer: pentatonic, stepwise, long
notes and lots of rests, built as motif / answer / motif / cadence so they
sound like tunes, not noodles. Re-run any time:

    python3 scripts/make-music.py            (needs numpy + ffmpeg)
"""
import importlib.util, math, os, sys
import numpy as np

here = os.path.dirname(__file__)
spec = importlib.util.spec_from_file_location('ma', os.path.join(here, 'make-audio.py'))
ma = importlib.util.module_from_spec(spec); spec.loader.exec_module(ma)
SR, note, music, write = ma.SR, ma.note, ma.music, ma.write

# chord tables in semitones from the world's root (triads + an added colour)
MAJOR = {'I': [0, 4, 7, 11], 'ii': [2, 5, 9, 12], 'iii': [4, 7, 11, 14], 'IV': [5, 9, 12, 16],
         'V': [7, 11, 14, 17], 'vi': [9, 12, 16, 19], 'IVsus': [5, 7, 12, 14], 'Iadd9': [0, 4, 7, 14]}
MINOR = {'i': [0, 3, 7, 10], 'iv': [5, 8, 12, 15], 'v': [7, 10, 14, 17], 'VI': [8, 12, 15, 19],
         'III': [3, 7, 10, 14], 'VII': [10, 14, 17, 21], 'iisus': [2, 5, 7, 12], 'iadd9': [0, 3, 7, 14]}
PENT_MAJ, PENT_MIN = [0, 2, 4, 7, 9], [0, 3, 5, 7, 10]

WORLDS = {
    # key root (semitones from C4, the bed sits an octave or two down), tempo, mode, leads, progressions
    'earth': dict(root=-5, bpm=68, mode='maj', leads=['marimba', 'flute', 'kalimba', 'marimba'], air=0.04,
                  progs=[['I', 'vi', 'IV', 'V', 'I', 'vi', 'ii', 'V'], ['IV', 'I', 'V', 'vi', 'IV', 'I', 'IVsus', 'I'],
                         ['vi', 'IV', 'I', 'V', 'vi', 'IV', 'ii', 'Iadd9'], ['I', 'iii', 'IV', 'I', 'ii', 'V', 'IV', 'I']]),
    'luna': dict(root=-3, bpm=58, mode='maj', leads=['kalimba', 'glass', 'flute', 'kalimba'], air=0.06,
                 progs=[['Iadd9', 'IVsus', 'vi', 'IV', 'Iadd9', 'iii', 'IV', 'IVsus'], ['vi', 'IV', 'Iadd9', 'V', 'vi', 'IV', 'IVsus', 'Iadd9'],
                        ['IV', 'Iadd9', 'IV', 'iii', 'ii', 'vi', 'IVsus', 'Iadd9'], ['I', 'IVsus', 'I', 'vi', 'IV', 'ii', 'IVsus', 'I']]),
    'cindra': dict(root=-7, bpm=64, mode='min', leads=['marimba', 'kalimba', 'flute', 'glass'], air=0.05,
                   progs=[['i', 'VI', 'III', 'VII', 'i', 'iv', 'VI', 'v'], ['i', 'iv', 'i', 'VI', 'III', 'VII', 'iisus', 'i'],
                          ['VI', 'VII', 'i', 'i', 'iv', 'VI', 'v', 'iadd9'], ['i', 'III', 'iv', 'VI', 'i', 'VII', 'VI', 'v']]),
    'nerith': dict(root=-8, bpm=56, mode='min', leads=['kalimba', 'flute', 'glass', 'kalimba'], air=0.08,
                   progs=[['iadd9', 'VI', 'III', 'VII', 'iadd9', 'iv', 'VI', 'VII'], ['VI', 'VII', 'III', 'i', 'iv', 'VI', 'iisus', 'iadd9'],
                          ['i', 'v', 'VI', 'III', 'iv', 'i', 'VII', 'i'], ['iadd9', 'iv', 'VI', 'VII', 'iadd9', 'III', 'iv', 'VII']]),
    'vela': dict(root=-1, bpm=60, mode='maj', leads=['glass', 'kalimba', 'flute', 'glass'], air=0.05,
                 progs=[['Iadd9', 'V', 'vi', 'IVsus', 'Iadd9', 'iii', 'IV', 'V'], ['IV', 'Iadd9', 'vi', 'V', 'IV', 'Iadd9', 'IVsus', 'Iadd9'],
                        ['vi', 'IVsus', 'Iadd9', 'V', 'vi', 'ii', 'IVsus', 'Iadd9'], ['I', 'IV', 'vi', 'IV', 'I', 'V', 'IVsus', 'I']]),
}

RHYTHMS = [  # two-bar motif rhythms in beats; None = rest. Lots of space on purpose.
    [(1.5, 1), (.5, 1), (2, 1), (None, 2), (2, 1), (None, 1)],
    [(1, 1), (1, 1), (2, 1), (1, 1), (1, 1), (None, 2)],
    [(3, 1), (1, 1), (2, 1), (None, 2)],
    [(.5, 1), (.5, 1), (1, 1), (2, 1), (None, 4)],
    [(2, 1), (2, 1), (3, 1), (None, 1)],
]


def compose(cfg, chords, seed):
    """motif (bars 1-2), answer (3-4), motif again a step higher (5-6), cadence (7-8)"""
    r = np.random.default_rng(seed)
    scale = PENT_MAJ if cfg['mode'] == 'maj' else PENT_MIN
    deg = lambda i: scale[i % 5] + 12 * (i // 5)
    def line(start_bar, rhythm, start_deg, lift=0):
        out, at, d = [], start_bar * 4.0, start_deg
        for item in rhythm:
            ln = item[0]
            if ln is None:  # the rest length rides in slot 1 of the tuple
                at += item[1]; continue
            # lean on chord tones on the beat
            ch = chords[int(at // 4) % len(chords)]
            if abs(at - round(at)) < 1e-6 and r.random() < 0.55:
                target = (ch[int(r.integers(0, 3))] - 0) % 12
                cands = [i for i in range(0, 11) if deg(i) % 12 == target]
                if cands: d = min(cands, key=lambda c: abs(c - d))
            else:
                d = int(np.clip(d + int(r.choice([-1, -1, 1, 1, 0, 2, -2])), 2, 10))
            out.append((at, deg(d) + lift, ln))
            at += ln
        return out, d
    rh = RHYTHMS[int(r.integers(0, len(RHYTHMS)))]
    rh2 = RHYTHMS[int(r.integers(0, len(RHYTHMS)))]
    m1, d = line(0, rh, int(r.integers(4, 8)))
    m2, d = line(2, rh2, d)
    m3 = [(a + 16, n + (2 if cfg['mode'] == 'maj' else 0), l) for a, n, l in m1]   # the motif comes back
    # cadence: settle on the root with one long note and a long rest
    m4 = [(24.0, deg(5), 2), (26.0, deg(4), 1), (27.0, deg(2), 1), (28.0, deg(5), 3)]
    return m1 + m2 + m3 + m4


def build_world(w, cfg):
    names = []
    tbl = MAJOR if cfg['mode'] == 'maj' else MINOR
    for k, prog in enumerate(cfg['progs']):
        chords = [[x + cfg['root'] for x in tbl[c]] for c in prog]
        mel = compose(cfg, chords, seed=sum(map(ord, w)) * 31 + k * 7)
        lead = cfg['leads'][k % len(cfg['leads'])]
        # phrases differ in texture too: some with a gentle arp, one almost bare
        arp = [(0, None, 2, None), (0, 2, 1, None), (None, None, None, None), (0, None, None, 3)][k % 4]
        name, l, rr = music(f'music_{w}_{k + 1}', cfg['bpm'], 8, chords, mel,
                            pad_gain=0.22 if k != 2 else 0.27, lead=lead, arp=arp, arp_gain=0.08,
                            arp_oct=12 if cfg['mode'] == 'min' else 24, shake=None,
                            reverb_mix=0.45, cut=1150, mel_gain=0.21 if lead != 'flute' else 0.17, air=cfg['air'])
        # fade the tail out so a phrase can end on its own and hand over to silence
        fade = int(SR * 2.5)
        for side in (l, rr): side[-fade:] *= np.linspace(1, 0, fade) ** 1.5
        names.append((name, l, rr))
    return names


# ------------------------------------------------------------- ambience beds
def birds(dur, seed):
    r = np.random.default_rng(seed); out = np.zeros(int(SR * dur))
    for _ in range(int(dur / 2.2)):
        at = r.uniform(0, dur - 1); f0 = r.uniform(2600, 4200)
        for k in range(int(r.integers(2, 5))):
            ln = r.uniform(.05, .12); n = int(SR * ln)
            f = np.linspace(f0 * r.uniform(.9, 1.1), f0 * r.uniform(1.1, 1.35), n)
            chirp = np.sin(2 * np.pi * np.cumsum(f) / SR) * ma.env(n, .005, ln * .5, .3, ln * .4)
            i = int(SR * (at + k * r.uniform(.08, .16)))
            m = min(n, len(out) - i)
            if m > 0: out[i:i + m] += chirp[:m] * r.uniform(.05, .12)
    return out


def ambience(w):
    dur = 24.0; n = int(SR * dur)
    wind = ma.lowpass_fast(ma.noise(dur), 500) * (0.55 + 0.45 * np.sin(2 * np.pi * np.arange(n) / n * 3)) * 0.12
    if w == 'earth': x = wind + birds(dur, 1)
    elif w == 'luna': x = wind * .6 + ma.sparkle(dur, 10, 3) * .05 + ma.sine(55, dur) * .02
    elif w == 'cindra':
        crackle = (np.random.default_rng(5).random(n) > 0.9993).astype(float) * np.random.default_rng(6).uniform(-.5, .5, n)
        x = wind * 1.2 + ma.lowpass_fast(crackle, 3000) * .5
    elif w == 'nerith':
        swell = 0.5 + 0.5 * np.sin(2 * np.pi * np.arange(n) / SR / 6.0)
        x = ma.lowpass_fast(ma.noise(dur), 900) * swell * .2 + birds(dur, 9) * .3
    else: x = wind * .7 + ma.sparkle(dur, 14, 8) * .06
    # loop seam
    fade = int(SR * 2); x[:fade] = x[:fade] * np.linspace(0, 1, fade) + x[-fade:] * np.linspace(1, 0, fade)
    x = x[:-fade]
    return np.clip(x / max(1e-9, np.max(np.abs(x))) * 0.5, -1, 1)


def main():
    out_dir = os.path.join(here, '..', 'src', 'audio')
    total = 0
    for w, cfg in WORLDS.items():
        for name, l, r in build_world(w, cfg):
            total += write(name, l, stereo=r, quality='0'); print('  ', name)
        total += write(f'amb_{w}', ambience(w), quality='0'); print('  ', f'amb_{w}')
        old = os.path.join(out_dir, f'music_{w}.ogg')
        if os.path.exists(old): os.remove(old)
    print(f'total {total / 1024:.0f} kB')


if __name__ == '__main__':
    main()
