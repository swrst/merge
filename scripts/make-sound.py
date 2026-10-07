#!/usr/bin/env python3
"""Merge Rocket's whole sound pack: calm melodic music and soft effects.

    python3 scripts/make-sound.py            everything
    python3 scripts/make-sound.py sfx        effects only
    python3 scripts/make-sound.py music      music only

Needs numpy, scipy and ffmpeg. Everything is synthesised (no samples, nothing
to license). Output: src/audio/*.ogg.

The music
  Every world has four 8-bar phrases (music_<world>_1..4) in one key and tempo
  plus an ambience bed (amb_<world>). Instruments: a soft electric piano for
  the melody, a music box that doubles it now and then, a broken-chord piano
  accompaniment, a warm pad and a round bass, all in a long, soft hall. Slow
  tempos (58–72 bpm), diatonic progressions, no drums.

  The melodies are composed, not random noodling: a two-bar motif, the motif
  again over the next chords, a contrasting answer, and a cadence that lands
  on the home note. Strong beats sit on chord tones, weak beats step between
  them, and the tune keeps to a singable range.

The effects
  One family: soft marimba, glass and bell tones tuned to C major pentatonic,
  short and quiet, so a hundred taps never grate. Merges climb the scale with
  the tier; errors are a soft low "bonk", never a buzzer.
"""
import os
import subprocess
import sys
import wave

import numpy as np
from scipy.signal import fftconvolve, lfilter

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'audio')
os.makedirs(OUT, exist_ok=True)


def T(dur):
    return np.arange(int(SR * dur)) / SR


def hz(n):
    """semitones from C4"""
    return 261.6256 * 2 ** (n / 12)


def onepole_lp(x, cut):
    a = np.exp(-2 * np.pi * cut / SR)
    return lfilter([1 - a], [1, -a], x)


def onepole_hp(x, cut):
    return x - onepole_lp(x, cut)


def adsr(n, a, r, sus_level=1.0):
    e = np.ones(n) * sus_level
    ai = min(n, int(a * SR)); ri = min(n - ai, int(r * SR))
    if ai: e[:ai] = np.linspace(0, sus_level, ai)
    if ri: e[n - ri:] *= np.linspace(1, 0, ri)
    return e


# ------------------------------------------------------------- instruments
def epiano(f, dur, vel=0.7, tail=1.2):
    """Soft electric piano: warm partials that die from the top down, a faint tine."""
    n = int(SR * (dur + tail)); t = np.arange(n) / SR
    x = np.zeros(n)
    for k, a in enumerate([1.0, 0.42, 0.2, 0.09, 0.05, 0.025], start=1):
        tau = 1.9 / (1 + 0.75 * (k - 1)) * (0.6 + 0.5 * vel)
        x += a * np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) * np.exp(-t / tau)
    x += 0.10 * vel * np.sin(2 * np.pi * f * 7.02 * t) * np.exp(-t / 0.05)
    att = np.minimum(1, t / 0.006)
    rel = np.ones(n); ri = int(SR * min(tail, 0.6)); s = int(SR * dur)
    if s < n:
        rel[s:] = np.exp(-(t[s:] - dur) / 0.35)
    return x * att * rel * vel


def musicbox(f, dur, vel=0.6):
    n = int(SR * (dur + 1.6)); t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / 1.1)
         + 0.28 * np.sin(2 * np.pi * f * 3.0 * t) * np.exp(-t / 0.35)
         + 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.12))
    return x * np.minimum(1, t / 0.002) * vel


def pluckharp(f, dur, vel=0.6):
    n = int(SR * (dur + 1.4)); t = np.arange(n) / SR
    x = np.zeros(n)
    for k, a in enumerate([1.0, 0.5, 0.25, 0.12, 0.06], start=1):
        x += a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (1.3 / k ** 0.8))
    return onepole_lp(x * np.minimum(1, t / 0.003), 3500) * vel


def pad(freqs, dur, vel=0.18, bright=1400):
    n = int(SR * (dur + 1.8)); t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for d in (-0.0035, 0.0, 0.0041):
            ph = np.random.uniform(0, 2 * np.pi)
            g = f * (1 + d)
            x += np.sin(2 * np.pi * g * t + ph) + 0.25 * np.sin(4 * np.pi * g * t + ph) + 0.08 * np.sin(6 * np.pi * g * t)
    x /= max(1, len(freqs) * 3)
    env = np.minimum(1, t / 1.1)
    s = int(SR * dur)
    env[s:] *= np.exp(-(t[s:] - dur) / 0.7)
    x = onepole_lp(x * env, bright)
    # slow swell keeps it breathing
    return x * (0.85 + 0.15 * np.sin(2 * np.pi * 0.11 * t)) * vel


def bass(f, dur, vel=0.5):
    n = int(SR * (dur + 0.6)); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.4)
    env = np.minimum(1, t / 0.03) * np.exp(-t / (dur * 1.4 + 0.4))
    return x * env * vel


def flute(f, dur, vel=0.4):
    n = int(SR * (dur + 0.5)); t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.0 * t) * np.minimum(1, t / 0.4)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    x = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    x += 0.04 * onepole_lp(np.random.randn(n), 2000)
    env = np.minimum(1, t / 0.09)
    s = int(SR * dur)
    env[s:] *= np.exp(-(t[s:] - dur) / 0.12)
    return x * env * vel


INSTR = {'epiano': epiano, 'musicbox': musicbox, 'harp': pluckharp, 'flute': flute}


def hall(x, seconds=2.8, mix=0.32, seed=0, damp=3200):
    rng = np.random.default_rng(seed)
    n = int(SR * seconds); t = np.arange(n) / SR
    out = []
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (seconds / 4.5))
        ir = onepole_lp(ir, damp)
        ir[: int(SR * 0.012)] = 0                        # a little pre-delay
        ir /= np.sqrt(np.sum(ir ** 2))
        wet = fftconvolve(x, ir)[: len(x)]
        out.append((1 - mix) * x + mix * wet * 1.6)
    return out[0], out[1]


def place(buf, start, sig, gain=1.0, pan=0.0):
    i = int(start * SR)
    k = min(len(buf[0]) - i, len(sig))
    if k <= 0:
        return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0][i:i + k] += sig[:k] * gain * l * 1.41
    buf[1][i:i + k] += sig[:k] * gain * r * 1.41


def to_ogg(name, left, right=None, q='3'):
    raw = os.path.join('/tmp', name + '.wav')
    data = np.stack([left, right if right is not None else left], 1) if right is not None else left.reshape(-1, 1)
    pcm = (np.clip(data, -1, 1) * 32767).astype('<i2')
    with wave.open(raw, 'wb') as w:
        w.setnchannels(data.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, name + '.ogg')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-c:a', 'libvorbis', '-q:a', q, dst], check=True)
    os.remove(raw)
    return os.path.getsize(dst)


# ------------------------------------------------------------------ theory
MAJ = [0, 2, 4, 5, 7, 9, 11]
MIN = [0, 2, 3, 5, 7, 8, 10]
DEG = {'I': 0, 'ii': 1, 'iii': 2, 'IV': 3, 'V': 4, 'vi': 5, 'vii': 6,
       'i': 0, 'III': 2, 'iv': 3, 'v': 4, 'VI': 5, 'VII': 6}


def chord_tones(scale, deg, seventh=False):
    """scale-degree indices of a diatonic triad (or 7th) on degree deg"""
    return [deg, deg + 2, deg + 4] + ([deg + 6] if seventh else [])


def sd_to_semi(scale, sd):
    o, d = divmod(sd, 7)
    return scale[d] + 12 * o


# Bar rhythms in eighth notes (8 per bar). Negative = rest.
RHY_A = [[3, 1, 2, 2], [2, 2, 4], [1, 1, 2, 4], [2, 1, 1, 4], [4, 2, 2], [3, 1, 4]]
RHY_B = [[2, 2, 2, 2], [2, 2, 3, 1], [1, 1, 1, 1, 4], [2, 4, 2]]
RHY_END = [[6, -2], [4, 4], [8]]


def compose(scale, prog, rng, lo=7, hi=18):
    """8-bar melody as [(start_eighth, dur_eighths, scale_degree)].
    motif (bars 1-2) · motif again (3-4) · answer (5-6) · cadence (7-8)."""
    r1, r2 = RHY_A[rng.integers(len(RHY_A))], RHY_A[rng.integers(len(RHY_A))]
    rb1, rb2 = RHY_B[rng.integers(len(RHY_B))], RHY_A[rng.integers(len(RHY_A))]
    rend = RHY_END[rng.integers(len(RHY_END))]
    bars = [r1, r2, r1, r2, rb1, rb2, RHY_A[rng.integers(len(RHY_A))], rend]
    contour = [1, -1, 1, -1, 1, 1, -1, -1]          # arch: up, settle, climb, come home
    notes, cur = [], 7 + rng.integers(0, 3)          # start around the 5th above root
    motif_steps = []
    for b, rhythm in enumerate(bars):
        deg = DEG[prog[b]]
        tones = [x + 7 * o for x in chord_tones(scale, deg) for o in (0, 1, 2)]
        pos = 0
        for k, d in enumerate(rhythm):
            if d < 0:
                pos += -d; continue
            strong = pos in (0, 4)
            if b in (2, 3) and motif_steps and k < len(motif_steps[b - 2]):
                # bars 3-4 replay the motif's shape over the new chords
                step = motif_steps[b - 2][k]
                cand = cur + step
                if strong:
                    cand = min(tones, key=lambda x: abs(x - cand))
                cur = cand
            elif b == 7 and k == max(i for i, x in enumerate(rhythm) if x > 0):
                cur = min([x for x in (7, 14) if lo <= x <= hi] or [7], key=lambda x: abs(x - cur))   # home
            elif strong:
                want = cur + contour[b] * rng.integers(1, 3)
                cur = min(tones, key=lambda x: abs(x - want) + 0.3 * rng.random())
            else:
                cur = cur + contour[b] * (1 if rng.random() < 0.75 else 2) * (1 if rng.random() < 0.85 else -1)
            cur = int(np.clip(cur, lo, hi))
            notes.append((b * 8 + pos, d, cur))
            pos += d
        if b < 2:
            seq = [n[2] for n in notes if n[0] // 8 == b]
            motif_steps.append([0] + [seq[i] - seq[i - 1] for i in range(1, len(seq))])
    return notes


WORLDS = {
    #          root (from C4), bpm, scale, lead, colour instrument, progressions (8 bars each)
    'earth': dict(root=0, bpm=70, scale=MAJ, lead='epiano', colour='flute', bright=1600,
                  progs=[['I', 'vi', 'IV', 'V', 'I', 'vi', 'IV', 'I'], ['IV', 'I', 'V', 'vi', 'IV', 'I', 'V', 'I'],
                         ['I', 'iii', 'vi', 'IV', 'ii', 'V', 'IV', 'I'], ['vi', 'IV', 'I', 'V', 'vi', 'IV', 'V', 'I']]),
    'luna': dict(root=-3, bpm=60, scale=MAJ, lead='musicbox', colour='epiano', bright=1200,
                 progs=[['I', 'IV', 'vi', 'IV', 'I', 'iii', 'IV', 'I'], ['vi', 'IV', 'I', 'V', 'vi', 'IV', 'V', 'I'],
                        ['IV', 'I', 'IV', 'iii', 'ii', 'vi', 'V', 'I'], ['I', 'V', 'vi', 'iii', 'IV', 'I', 'V', 'I']]),
    'cindra': dict(root=2, bpm=66, scale=MIN, lead='harp', colour='flute', bright=1300,
                   progs=[['i', 'VI', 'III', 'VII', 'i', 'VI', 'VII', 'i'], ['i', 'iv', 'VII', 'III', 'VI', 'iv', 'v', 'i'],
                          ['VI', 'VII', 'i', 'i', 'VI', 'VII', 'v', 'i'], ['i', 'III', 'VII', 'iv', 'i', 'VI', 'VII', 'i']]),
    'nerith': dict(root=4, bpm=62, scale=MAJ, lead='harp', colour='musicbox', bright=1500,
                   progs=[['I', 'V', 'vi', 'IV', 'I', 'V', 'IV', 'I'], ['IV', 'vi', 'I', 'V', 'IV', 'vi', 'V', 'I'],
                          ['vi', 'iii', 'IV', 'I', 'ii', 'IV', 'V', 'I'], ['I', 'IV', 'I', 'V', 'vi', 'IV', 'V', 'I']]),
    'vela': dict(root=-2, bpm=58, scale=MAJ, lead='musicbox', colour='flute', bright=1800,
                 progs=[['I', 'iii', 'IV', 'I', 'vi', 'IV', 'V', 'I'], ['IV', 'V', 'iii', 'vi', 'ii', 'V', 'IV', 'I'],
                        ['I', 'vi', 'iii', 'IV', 'I', 'vi', 'V', 'I'], ['vi', 'V', 'IV', 'I', 'ii', 'IV', 'V', 'I']]),
}


def phrase(w, k):
    cfg = WORLDS[w]
    rng = np.random.default_rng(sum(ord(c) * 31 ** i for i, c in enumerate(w)) % 100000 * 10 + k)
    np.random.seed(int(rng.integers(1e9)))
    scale, root, prog = cfg['scale'], cfg['root'], cfg['progs'][k]
    eighth = 60 / cfg['bpm'] / 2
    bars = 8
    total = bars * 8 * eighth + 3.5
    buf = [np.zeros(int(SR * total)), np.zeros(int(SR * total))]
    mel = compose(scale, prog, rng)
    lead = INSTR[cfg['lead']]
    loct = 0 if cfg['lead'] == 'musicbox' else -12     # warm instruments sit an octave lower
    for (s, d, sd) in mel:
        f = hz(root + loct + sd_to_semi(scale, sd))
        v = 0.55 + 0.15 * rng.random()
        place(buf, s * eighth, lead(f, d * eighth * 0.95, v), 0.55, -0.05)
    # the colour instrument doubles the answer an octave up, softly
    col = INSTR[cfg['colour']]
    for (s, d, sd) in mel:
        if 32 <= s < 56:
            f = hz(root + loct + 12 + sd_to_semi(scale, sd))
            place(buf, s * eighth, col(f, d * eighth * 0.95, 0.35), 0.28 if cfg['colour'] != 'flute' else 0.2, 0.3)
    for b, ch in enumerate(prog):
        deg = DEG[ch]
        tones = [root - 12 + sd_to_semi(scale, x) for x in chord_tones(scale, deg, seventh=(b % 4 == 3))]
        start = b * 8 * eighth
        # pad
        place(buf, start, pad([hz(x) for x in tones], 8 * eighth, 0.22, cfg['bright']), 0.6, 0.0)
        # bass: root on 1, fifth on 3 (soft)
        place(buf, start, bass(hz(tones[0] - 12), 4 * eighth, 0.5), 0.55, 0.0)
        place(buf, start + 4 * eighth, bass(hz(tones[2] - 24 if tones[2] - 24 > tones[0] - 19 else tones[0] - 12), 4 * eighth, 0.35), 0.5, 0.0)
        # broken chord: up and down in eighths, very soft, panned a touch left
        arp = [tones[0], tones[1], tones[2], tones[1] + 12 if len(tones) < 4 else tones[3], tones[2], tones[1], tones[2], tones[1]]
        for i, n in enumerate(arp):
            if b == bars - 1 and i > 3:
                break
            place(buf, start + i * eighth, epiano(hz(n), eighth * 1.6, 0.28 + 0.06 * (i % 4 == 0)), 0.32, -0.35)
    L = hall(buf[0], mix=0.34, seed=1)[0]
    R = hall(buf[1], mix=0.34, seed=2)[1]
    m = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-9)
    L, R = L / m * 0.8, R / m * 0.8
    fade = int(SR * 2.5)
    L[-fade:] *= np.linspace(1, 0, fade); R[-fade:] *= np.linspace(1, 0, fade)
    L[:300] *= np.linspace(0, 1, 300); R[:300] *= np.linspace(0, 1, 300)
    return L, R


def ambience(w):
    """a hushed bed for the quiet stretches: the home chord far away, a little air"""
    cfg = WORLDS[w]
    dur = 24.0
    n = int(SR * dur); t = np.arange(n) / SR
    tones = [cfg['root'] - 24 + sd_to_semi(cfg['scale'], x) for x in (0, 4, 7, 9)]
    x = pad([hz(v) for v in tones], dur, 0.25, 700)[:n]
    air = onepole_lp(onepole_hp(np.random.randn(n), 300), 1800) * 0.012
    air *= 0.6 + 0.4 * np.sin(2 * np.pi * t / 8.0) ** 2
    x = x + air
    # seamless loop: crossfade the end into the start
    cf = int(SR * 3)
    x[:cf] = x[:cf] * np.linspace(0, 1, cf) + x[-cf:] * np.linspace(1, 0, cf)
    x = x[:-cf]
    L, R = hall(x, 2.2, 0.4, 3, 2400)
    m = max(np.max(np.abs(L)), 1e-9)
    return L / m * 0.35, R / m * 0.35


# ------------------------------------------------------------------ effects
PENT = [0, 2, 4, 7, 9]


def pent(i):
    o, d = divmod(i, 5)
    return PENT[d] + 12 * o


def marim(f, dur=0.35, vel=0.7):
    t = T(dur)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.12) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / 0.025)
         + 0.1 * np.sin(2 * np.pi * f * 10 * t) * np.exp(-t / 0.008))
    return x * np.minimum(1, t / 0.002) * vel


def glass(f, dur=0.6, vel=0.5):
    t = T(dur)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.3) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.12)
    return x * np.minimum(1, t / 0.003) * vel


def bell(f, dur=1.0, vel=0.5):
    t = T(dur)
    mod = np.sin(2 * np.pi * f * 1.4 * t) * 1.2 * np.exp(-t / 0.2)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / (dur / 3)) * np.minimum(1, t / 0.002) * vel


def seq(parts, dur):
    n = int(SR * dur); x = np.zeros(n)
    for s, sig, g in parts:
        i = int(s * SR); k = min(n - i, len(sig))
        if k > 0:
            x[i:i + k] += sig[:k] * g
    return x


def softnoise(dur, lo, hi, tau):
    t = T(dur)
    x = onepole_lp(onepole_hp(np.random.randn(len(t)), lo), hi)
    return x * np.exp(-t / tau) * np.minimum(1, t / 0.004)


def room(x, mix=0.18):
    L, _ = hall(x, 0.9, mix, 5, 4500)
    return L


def norm(x, peak):
    m = np.max(np.abs(x))
    x = x / m * peak if m else x
    f = 64
    x[-f:] *= np.linspace(1, 0, f)
    return x


C = lambda i: hz(pent(i))       # C major pentatonic, i = steps from C4


def sfx_all():
    np.random.seed(11)
    S = {}
    S['tap'] = norm(marim(hz(-5), 0.12, 0.8), 0.32)
    S['click'] = norm(marim(hz(2), 0.08, 0.7), 0.3)
    S['hover'] = norm(glass(C(7), 0.12, 0.4), 0.18)
    S['pop'] = norm(room(seq([(0, marim(C(5), 0.25), 1), (0, glass(C(10), 0.2), 0.3)], 0.3)), 0.45)
    S['pop_hi'] = norm(room(seq([(0, marim(C(7), 0.25), 1), (0, glass(C(12), 0.2), 0.3)], 0.3)), 0.45)
    for k in range(1, 9):
        base = 3 + k                                  # climbs the pentatonic with the tier
        x = seq([(0, marim(C(base), 0.5), 0.8), (0.06, glass(C(base + 2), 0.7, 0.5), 0.6),
                 (0.12, glass(C(base + 4), 0.9, 0.4), 0.5 if k > 3 else 0.0)], 1.0)
        S[f'merge{k}'] = norm(room(x, 0.25), 0.5)
    S['merge_crown'] = norm(room(seq([(i * 0.09, bell(C(7 + i), 1.4, 0.6), 0.7) for i in range(5)], 2.0), 0.3), 0.6)
    S['coin'] = norm(room(seq([(0, glass(C(10), 0.4), 0.7), (0.07, glass(C(12), 0.5), 0.7)], 0.6)), 0.42)
    S['sell'] = norm(room(seq([(0, glass(C(9), 0.35), 0.6), (0.06, glass(C(7), 0.4), 0.5)], 0.5)), 0.38)
    S['collect'] = norm(room(seq([(i * 0.07, glass(C(8 + i), 0.6), 0.6) for i in range(4)], 1.0)), 0.48)
    S['ready'] = norm(room(seq([(0, bell(C(9), 1.2, 0.5), 0.6), (0.12, bell(C(11), 1.2, 0.5), 0.5)], 1.4)), 0.4)
    S['levelup'] = norm(room(seq([(i * 0.12, bell(C(5 + 2 * i), 1.4, 0.6), 0.6) for i in range(5)]
                                 + [(0, epiano(hz(-12), 1.0, 0.4), 0.4), (0, epiano(hz(-5), 1.0, 0.3), 0.3)], 2.4), 0.35), 0.6)
    S['discover'] = norm(room(seq([(i * 0.1, bell(C(8 + i), 1.5, 0.5), 0.5) for i in range(4)], 2.0), 0.35), 0.5)
    S['unlock'] = norm(room(seq([(0, bell(C(7), 1.2), 0.6), (0.14, bell(C(9), 1.2), 0.6), (0.28, bell(C(12), 1.6), 0.6)], 2.0), 0.3), 0.52)
    S['build'] = norm(room(seq([(0, marim(C(0), 0.4), 0.8), (0.12, marim(C(2), 0.4), 0.7), (0.24, marim(C(4), 0.4), 0.7),
                                (0.4, bell(C(7), 1.4), 0.6), (0.4, bell(C(9), 1.4), 0.4)], 2.0), 0.3), 0.58)
    S['install'] = norm(room(seq([(0, marim(C(2), 0.3), 0.7), (0.1, bell(C(7), 1.2), 0.6)], 1.4)), 0.5)
    S['boost'] = norm(room(seq([(i * 0.05, glass(C(6 + i), 0.4), 0.5) for i in range(6)], 0.9)), 0.45)
    S['fuel'] = norm(room(seq([(0, softnoise(0.5, 200, 1500, 0.15), 0.5), (0, glass(C(5), 0.5), 0.5)], 0.6)), 0.4)
    S['bag'] = norm(room(seq([(0, marim(C(2), 0.25), 1), (0, softnoise(0.15, 800, 3000, 0.04), 0.5)], 0.3)), 0.35)
    S['lift'] = norm(glass(C(6), 0.15, 0.5), 0.22)
    S['land'] = norm(marim(C(3), 0.18, 0.7), 0.3)
    S['swap'] = norm(seq([(0, marim(C(4), 0.15), 0.6), (0.05, marim(C(5), 0.15), 0.6)], 0.25), 0.3)
    S['open'] = norm(room(seq([(0, glass(C(5), 0.3), 0.5), (0.05, glass(C(7), 0.3), 0.5)], 0.45)), 0.3)
    S['close'] = norm(room(seq([(0, glass(C(7), 0.25), 0.5), (0.05, glass(C(5), 0.25), 0.5)], 0.4)), 0.26)
    S['tab'] = norm(marim(C(4), 0.15, 0.7), 0.28)
    S['nope'] = norm(seq([(0, marim(hz(-17), 0.25, 0.9), 0.8), (0.09, marim(hz(-19), 0.3, 0.9), 0.7)], 0.45), 0.32)
    S['error'] = S['nope']
    S['dig'] = norm(room(seq([(0, softnoise(0.3, 120, 900, 0.07), 1), (0, marim(hz(-14), 0.25), 0.6)], 0.35)), 0.4)
    S['whoosh'] = norm(softnoise(0.6, 300, 2500, 0.2) * np.sin(np.linspace(0, np.pi, int(SR * 0.6))), 0.3)
    t = T(1.6)
    S['meteor'] = norm(room(softnoise(1.6, 80, 1200, 0.5) * np.sin(np.linspace(0, np.pi, len(t))) ** 0.5
                            + 0.8 * np.sin(2 * np.pi * 55 * t) * np.exp(-np.maximum(0, t - 0.9) / 0.25) * (t > 0.9)), 0.55)
    t = T(2.6)
    S['launch'] = norm(room(softnoise(2.6, 60, 1400, 1.2) * np.minimum(1, t / 0.8)
                            + seq([(0.6 + i * 0.15, bell(C(5 + 2 * i), 1.2), 0.4) for i in range(5)], 2.6), 0.3), 0.6)
    for i in range(5):
        S[f'streak{i + 1}'] = norm(room(seq([(0, glass(C(7 + 2 * i), 0.5), 0.7), (0.05, glass(C(9 + 2 * i), 0.6), 0.5)], 0.7)), 0.42)
    tb = T(0.35)
    S['boing'] = norm(np.sin(2 * np.pi * np.cumsum(hz(-5) * (1 + 0.5 * np.exp(-tb / 0.05) * np.sin(2 * np.pi * 9 * tb))) / SR)
                      * np.exp(-tb / 0.12), 0.32)
    # voices: soft vowel-ish blips (formant-filtered, gentle)
    vow = [(700, 1100), (400, 1700), (300, 2300), (500, 900), (600, 1500), (350, 800)]
    for k, (f1, f2) in enumerate(vow):
        tt = T(0.11)
        f0 = hz(-2 + (k % 3) * 2)
        src = np.sign(np.sin(2 * np.pi * f0 * tt)) * 0.3 + np.sin(2 * np.pi * f0 * tt)
        x = onepole_lp(src, f2) * 0.6 + onepole_lp(src, f1) * 0.4
        x *= np.sin(np.linspace(0, np.pi, len(tt))) ** 0.7
        S[f'blip{k + 1}'] = norm(x, 0.3)
    return S


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    total = 0
    if what in ('all', 'sfx'):
        for name, x in sfx_all().items():
            total += to_ogg(name, x, q='2')
        print('effects done')
    if what in ('all', 'music'):
        for w in WORLDS:
            for k in range(4):
                L, R = phrase(w, k)
                total += to_ogg(f'music_{w}_{k + 1}', L, R, q='1')
            L, R = ambience(w)
            total += to_ogg(f'amb_{w}', L, R, q='1')
            print('music', w)
    print(f'{total / 1024:.0f} kB')


if __name__ == '__main__':
    main()
