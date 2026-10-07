#!/usr/bin/env python3
"""Galaxy Adventure's whole sound pack: dreamy space music, sci-fi effects and
alien voices.

    python3 scripts/make-sound.py            everything
    python3 scripts/make-sound.py sfx        effects + voices only
    python3 scripts/make-sound.py music      music only
    python3 scripts/make-sound.py voice      voices only

Needs numpy, scipy and ffmpeg. Everything is synthesised (no samples, nothing
to license). Output: src/audio/*.ogg.

The music
  Ambient space music, deliberately unobtrusive: every world has two slow
  ~50 s loops (music_<world>_1..2) and a drone bed (amb_<world>). No lead
  melody to get stuck in your head — drifting analog chords (12 s each), a
  soft sub, sparse FM star-bells with long echoes, a whisper-quiet pulsing
  arpeggio that swells in and out, and one cosmic noise swell per loop.

The effects
  One sci-fi family: bubbly bloops, glassy FM pings, soft laser sweeps and
  shimmer, all tuned to C major pentatonic so nothing clashes with the music.
  Merges rise with the tier; errors are a soft descending "wah-wah".

The voices
  Characters babble in an alien language. Each syllable is a real little
  vowel (formant synthesis on a glottal pulse) with a consonant in front, and
  there are seven voice types (squeak, chirp, mid, deep, robot, gloop,
  dreamy), eight syllables each: voice_<type>_<n>. The game strings a few
  together per line, pitched per character.
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
def sine(f, t):
    return np.sin(2 * np.pi * f * t)


def lead(f, dur, vel=0.6):
    """glassy space lead: sine + soft triangle partials, delayed vibrato, slow attack"""
    n = int(SR * (dur + 0.9)); t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.18) / 0.3, 0, 1)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    x = np.sin(ph) + 0.22 * np.sin(3 * ph) / 3 + 0.08 * np.sin(5 * ph) / 5 + 0.12 * np.sin(2 * ph)
    env = np.minimum(1, t / 0.05)
    s = int(SR * dur)
    env[s:] *= np.exp(-(t[s:] - dur) / 0.25)
    env *= 0.8 + 0.2 * np.exp(-t / 0.4)
    return onepole_lp(x * env, 3800) * vel


def fmbell(f, dur, vel=0.5, ratio=3.5, index=2.2, tau=1.4):
    """FM star-bell: bright strike, long glassy tail"""
    n = int(SR * (dur + tau * 1.6)); t = np.arange(n) / SR
    mod = index * np.exp(-t / (tau * 0.25)) * np.sin(2 * np.pi * f * ratio * t)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / tau)
    x += 0.25 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / (tau * 0.5))
    return x * np.minimum(1, t / 0.002) * vel


def kalimba(f, dur, vel=0.6):
    n = int(SR * (dur + 1.2)); t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.7)
         + 0.35 * np.sin(2 * np.pi * f * 5.43 * t) * np.exp(-t / 0.06)
         + 0.12 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.3))
    return x * np.minimum(1, t / 0.0015) * vel


def epiano(f, dur, vel=0.7, tail=1.2):
    """soft electric piano for the broken chords"""
    n = int(SR * (dur + tail)); t = np.arange(n) / SR
    x = np.zeros(n)
    for k, a in enumerate([1.0, 0.42, 0.2, 0.09, 0.05], start=1):
        tau = 1.9 / (1 + 0.75 * (k - 1)) * (0.6 + 0.5 * vel)
        x += a * np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) * np.exp(-t / tau)
    att = np.minimum(1, t / 0.006)
    rel = np.ones(n); s = int(SR * dur)
    if s < n:
        rel[s:] = np.exp(-(t[s:] - dur) / 0.35)
    return x * att * rel * vel


VOWELS = {'a': (750, 1200, 2500), 'o': (450, 800, 2400), 'u': (330, 700, 2300),
          'e': (480, 1900, 2600), 'i': (300, 2300, 3000), 'ae': (650, 1700, 2500)}


def formant_amp(fk, F, bw=(90, 120, 160)):
    return sum(np.exp(-0.5 * ((fk - Fi) / b) ** 2) * g for Fi, b, g in zip(F, bw, (1.0, 0.6, 0.25)))


def choir(freqs, dur, vel=0.16, vowel='o'):
    """breathing alien choir: harmonics shaped by vowel formants, slow ensemble drift"""
    n = int(SR * (dur + 2.0)); t = np.arange(n) / SR
    x = np.zeros(n)
    F = VOWELS[vowel]
    for f in freqs:
        for d in (-0.004, 0.0, 0.0045):
            g = f * (1 + d)
            ph0 = np.random.uniform(0, 2 * np.pi)
            drift = 1 + 0.002 * np.sin(2 * np.pi * (0.2 + abs(d) * 30) * t + ph0)
            ph = 2 * np.pi * g * np.cumsum(drift) / SR
            for k in range(1, 14):
                fk = g * k
                if fk > 4000:
                    break
                a = formant_amp(fk, F) / k ** 0.3 + 0.02
                x += a * np.sin(k * ph)
    x /= max(1, len(freqs) * 6)
    env = np.minimum(1, t / 1.4)
    s = int(SR * dur)
    env[s:] *= np.exp(-(t[s:] - dur) / 0.9)
    return x * env * (0.8 + 0.2 * np.sin(2 * np.pi * 0.09 * t)) * vel


def analog_pad(freqs, dur, vel=0.14, bright=1400):
    """warm detuned saw pad; its filter opens and closes across the chord"""
    n = int(SR * (dur + 1.8)); t = np.arange(n) / SR
    cut = bright * (0.55 + 0.45 * np.sin(np.pi * np.clip(t / (dur + 0.5), 0, 1)))
    x = np.zeros(n)
    for f in freqs:
        for d in (-0.006, 0.0, 0.0061):
            g = f * (1 + d); ph = np.random.uniform(0, 2 * np.pi)
            for k in range(1, 16):
                fk = g * k
                if fk > 5000:
                    break
                x += (1 / k) * np.exp(-fk / cut) * np.sin(2 * np.pi * fk * t + ph * k)
    x /= max(1, len(freqs) * 3)
    env = np.minimum(1, t / 0.9)
    s = int(SR * dur)
    env[s:] *= np.exp(-(t[s:] - dur) / 0.7)
    return x * env * vel


def bass(f, dur, vel=0.5):
    n = int(SR * (dur + 0.6)); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.4)
    env = np.minimum(1, t / 0.04) * np.exp(-t / (dur * 1.4 + 0.4))
    return x * env * vel


def pluck(f, dur, vel=0.6):
    """dark crystal pluck (Cindra)"""
    n = int(SR * (dur + 1.2)); t = np.arange(n) / SR
    x = np.zeros(n)
    for k, a in enumerate([1.0, 0.5, 0.3, 0.15, 0.08], start=1):
        x += a * np.sin(2 * np.pi * f * k * t) * np.exp(-t / (1.0 / k ** 0.7))
    return onepole_lp(x * np.minimum(1, t / 0.003), 2600) * vel


def bubble_bell(f, dur, vel=0.5):
    """watery FM with a little pitch dip (Nerith)"""
    n = int(SR * (dur + 1.2)); t = np.arange(n) / SR
    bend = 1 - 0.03 * np.exp(-t / 0.05)
    ph = 2 * np.pi * f * np.cumsum(bend) / SR
    x = np.sin(ph + 1.4 * np.exp(-t / 0.15) * np.sin(2 * ph)) * np.exp(-t / 0.9)
    return x * np.minimum(1, t / 0.002) * vel


INSTR = {'lead': lead, 'bell': fmbell, 'kalimba': kalimba, 'pluck': pluck, 'bubble': bubble_bell, 'epiano': epiano}


def hall(x, seconds=2.8, mix=0.32, seed=0, damp=3200):
    rng = np.random.default_rng(seed)
    n = int(SR * seconds); t = np.arange(n) / SR
    out = []
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (seconds / 4.5))
        ir = onepole_lp(ir, damp)
        ir[: int(SR * 0.015)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        wet = fftconvolve(x, ir)[: len(x)]
        out.append((1 - mix) * x + mix * wet * 1.6)
    return out[0], out[1]


def pingpong(L, R, delay, fb=0.38, mix=0.28, damp=2600):
    """stereo echo bouncing left-right: the 'space' in space music"""
    d = int(SR * delay); n = len(L)
    wl, wr = np.zeros(n), np.zeros(n)
    src = onepole_lp((L + R) * 0.5, damp)
    g = 1.0
    for k in range(1, 7):
        g *= fb
        off = d * k
        if off >= n:
            break
        tgt = wl if k % 2 else wr
        tgt[off:] += src[:n - off] * g
    return L + wl * mix * 2, R + wr * mix * 2


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
    data = np.stack([left, right], 1) if right is not None else left.reshape(-1, 1)
    pcm = (np.clip(data, -1, 1) * 32767).astype('<i2')
    with wave.open(raw, 'wb') as w:
        w.setnchannels(data.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, name + '.ogg')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-ar', '32000', '-c:a', 'libvorbis', '-q:a', q, dst], check=True)
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
    #  root (from C4), bpm, scale, lead + sparkle instruments, pad style, choir vowel, progressions
    'earth': dict(root=0, bpm=66, scale=MAJ, lead='lead', sparkle='kalimba', choir='o', bright=1500,
                  progs=[['I', 'vi', 'IV', 'V', 'I', 'vi', 'IV', 'I'], ['IV', 'I', 'V', 'vi', 'IV', 'I', 'V', 'I'],
                         ['I', 'iii', 'vi', 'IV', 'ii', 'V', 'IV', 'I'], ['vi', 'IV', 'I', 'V', 'vi', 'IV', 'V', 'I']]),
    'luna': dict(root=-3, bpm=58, scale=MAJ, lead='bell', sparkle='bell', choir='u', bright=1100,
                 progs=[['I', 'IV', 'vi', 'IV', 'I', 'iii', 'IV', 'I'], ['vi', 'IV', 'I', 'V', 'vi', 'IV', 'V', 'I'],
                        ['IV', 'I', 'IV', 'iii', 'ii', 'vi', 'V', 'I'], ['I', 'V', 'vi', 'iii', 'IV', 'I', 'V', 'I']]),
    'cindra': dict(root=2, bpm=62, scale=MIN, lead='pluck', sparkle='bell', choir='a', bright=1100,
                   progs=[['i', 'VI', 'III', 'VII', 'i', 'VI', 'VII', 'i'], ['i', 'iv', 'VII', 'III', 'VI', 'iv', 'v', 'i'],
                          ['VI', 'VII', 'i', 'i', 'VI', 'VII', 'v', 'i'], ['i', 'III', 'VII', 'iv', 'i', 'VI', 'VII', 'i']]),
    'nerith': dict(root=4, bpm=60, scale=MAJ, lead='bubble', sparkle='kalimba', choir='u', bright=1300,
                   progs=[['I', 'V', 'vi', 'IV', 'I', 'V', 'IV', 'I'], ['IV', 'vi', 'I', 'V', 'IV', 'vi', 'V', 'I'],
                          ['vi', 'iii', 'IV', 'I', 'ii', 'IV', 'V', 'I'], ['I', 'IV', 'I', 'V', 'vi', 'IV', 'V', 'I']]),
    'vela': dict(root=-2, bpm=56, scale=MAJ, lead='lead', sparkle='bell', choir='a', bright=1700,
                 progs=[['I', 'iii', 'IV', 'I', 'vi', 'IV', 'V', 'I'], ['IV', 'V', 'iii', 'vi', 'ii', 'V', 'IV', 'I'],
                        ['I', 'vi', 'iii', 'IV', 'I', 'vi', 'V', 'I'], ['vi', 'V', 'IV', 'I', 'ii', 'IV', 'V', 'I']]),
}


def phrase(w, k):
    """One slow ambient space loop (~48 s). No lead melody — just drifting
    chords, a soft sub, sparse star-bells with long echoes, a very quiet
    pulsing arpeggio that fades in and out, and one cosmic swell."""
    cfg = WORLDS[w]
    rng = np.random.default_rng(sum(ord(c) * 31 ** i for i, c in enumerate(w)) % 100000 * 10 + k)
    np.random.seed(int(rng.integers(1e9)))
    scale, root = cfg['scale'], cfg['root']
    prog = cfg['progs'][k][::2]                     # 4 chords, 12 s each
    chord_s = 12.0
    total = chord_s * len(prog) + 6.0
    buf = [np.zeros(int(SR * total)), np.zeros(int(SR * total))]
    for b, ch in enumerate(prog):
        deg = DEG[ch]
        tones = [root - 12 + sd_to_semi(scale, x) for x in chord_tones(scale, deg)]
        voicing = [tones[0] - 12, tones[2] - 12, tones[1], tones[2] + 0]
        start = b * chord_s
        place(buf, start, analog_pad([hz(x) for x in voicing], chord_s + 0.5, 0.2, cfg['bright'] * 0.6), 0.7, -0.2 if b % 2 else 0.2)
        place(buf, start, bass(hz(tones[0] - 12), chord_s - 1.0, 0.45), 0.4, 0.0)
        # the arpeggio: soft triangle-ish pluck, 8ths at a slow pulse, only in the middle chords
        if 0 < b < len(prog) - 1:
            step = 60 / 84 / 2
            pat = [tones[0] + 12, tones[1] + 12, tones[2] + 12, tones[1] + 24, tones[2] + 12, tones[1] + 12]
            n = int(chord_s / step)
            for i in range(n):
                env = np.sin(np.pi * i / n) ** 2
                place(buf, start + i * step, kalimba(hz(pat[i % len(pat)]), step, 0.18 * env), 0.18, 0.6 if i % 2 else -0.6)
    # sparse star-bells: a pentatonic note every few seconds
    t0 = 1.5
    while t0 < total - 5:
        f = hz(root + 12 + pent(int(rng.integers(3, 11))))
        place(buf, t0, fmbell(f, 0.2, 0.22, ratio=3.5, index=1.4, tau=1.6), 0.3, float(rng.uniform(-0.7, 0.7)))
        t0 += float(rng.uniform(2.5, 5.5))
    # one cosmic swell
    at = float(rng.uniform(10, total - 14))
    sw = 6.0; t = T(sw)
    swell = onepole_lp(onepole_hp(np.random.randn(len(t)), 300), 1800) * np.sin(np.pi * t / sw) ** 2 * 0.05
    place(buf, at, swell, 1.0, 0.0)
    L, R = pingpong(buf[0], buf[1], 60 / 84 * 0.75, fb=0.45, mix=0.3, damp=2200)
    L = hall(L, 4.0, mix=0.45, seed=1, damp=2400)[0]
    R = hall(R, 4.0, mix=0.45, seed=2, damp=2400)[1]
    L, R = onepole_lp(L, 5000), onepole_lp(R, 5000)
    m = max(np.max(np.abs(L)), np.max(np.abs(R)), 1e-9)
    L, R = L / m * 0.75, R / m * 0.75
    fade = int(SR * 4.0)
    L[-fade:] *= np.linspace(1, 0, fade); R[-fade:] *= np.linspace(1, 0, fade)
    fi = int(SR * 2.0)
    L[:fi] *= np.linspace(0, 1, fi); R[:fi] *= np.linspace(0, 1, fi)
    return L, R


def ambience(w):
    """deep space drone for the quiet stretches: a far choir, a breathing sub,
    star twinkles and the odd far-off radio beep"""
    cfg = WORLDS[w]
    rng = np.random.default_rng(len(w) * 7)
    dur = 28.0
    n = int(SR * dur); t = np.arange(n) / SR
    tones = [cfg['root'] - 24 + sd_to_semi(cfg['scale'], x) for x in (0, 4, 7)]
    x = analog_pad([hz(v) for v in tones], dur, 0.2, 450)[:n]
    x += 0.10 * np.sin(2 * np.pi * hz(tones[0] - 12) * t) * (0.6 + 0.4 * np.sin(2 * np.pi * t / 7.0))
    air = onepole_lp(onepole_hp(np.random.randn(n), 400), 2200) * 0.01
    x += air * (0.5 + 0.5 * np.sin(2 * np.pi * t / 9.0) ** 2)
    for k in range(14):
        at = rng.uniform(0.5, dur - 3)
        f = hz(cfg['root'] + 12 + pent(int(rng.integers(5, 14))))
        i = int(at * SR); sig = fmbell(f, 0.2, 0.18, ratio=4.0, index=1.5, tau=1.1)
        kk = min(n - i, len(sig)); x[i:i + kk] += sig[:kk]
    for k in range(3):
        at = rng.uniform(2, dur - 3); i = int(at * SR)
        for j in range(3):
            tt = T(0.06); b = np.sin(2 * np.pi * (1800 + 200 * j) * tt) * np.sin(np.linspace(0, np.pi, len(tt))) * 0.02
            o = i + int(j * 0.11 * SR); x[o:o + len(b)] += b
    cf = int(SR * 3)
    x[:cf] = x[:cf] * np.linspace(0, 1, cf) + x[-cf:] * np.linspace(1, 0, cf)
    x = x[:-cf]
    L, R = hall(x, 3.4, 0.5, 3, 2600)
    m = max(np.max(np.abs(L)), 1e-9)
    return L / m * 0.35, R / m * 0.35


# ------------------------------------------------------------------ effects
PENT = [0, 2, 4, 7, 9]


def pent(i):
    o, d = divmod(i, 5)
    return PENT[d] + 12 * o


C = lambda i: hz(pent(i))       # C major pentatonic, i = steps from C4


def bloop(f0, f1, dur=0.14, vel=0.7, shape=0.04):
    """a bubbly sine that slides from f0 to f1"""
    t = T(dur)
    f = f1 + (f0 - f1) * np.exp(-t / shape)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.15 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return x * np.minimum(1, t / 0.003) * np.exp(-t / (dur * 0.45)) * vel


def ping(f, dur=0.6, vel=0.5):
    x = fmbell(f, 0.05, vel, ratio=3.0, index=1.2, tau=dur * 0.45)[: int(SR * dur)]
    k = min(len(x), int(SR * 0.08))
    x[-k:] *= np.linspace(1, 0, k)
    return x


def sweep(f0, f1, dur, vel=0.4, noise=0.0):
    """soft laser/whoosh: a sine glide with optional airy noise"""
    t = T(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    if noise:
        x += noise * onepole_lp(onepole_hp(np.random.randn(len(t)), 400), 3000)
    return x * np.sin(np.linspace(0, np.pi, len(t))) ** 0.8 * vel


def shimmer(base, n=5, step=0.045, vel=0.45, up=True):
    return seq([(i * step, ping(C(base + (i if up else -i)), 0.7, vel), 0.6) for i in range(n)], n * step + 0.8)


def softnoise(dur, lo, hi, tau):
    t = T(dur)
    x = onepole_lp(onepole_hp(np.random.randn(len(t)), lo), hi)
    return x * np.exp(-t / tau) * np.minimum(1, t / 0.004)


def seq(parts, dur):
    n = int(SR * dur); x = np.zeros(n)
    for s, sig, g in parts:
        i = int(s * SR); k = min(n - i, len(sig))
        if k > 0:
            x[i:i + k] += sig[:k] * g
    return x


def room(x, mix=0.2):
    L, _ = hall(x, 1.2, mix, 5, 4500)
    return L


def space(x, mix=0.3):
    """effects that should feel big get a short echo too"""
    d = int(SR * 0.13); y = x.copy()
    for k in range(1, 4):
        y[d * k:] += x[:len(x) - d * k] * 0.35 ** k
    return room(y, mix)


def norm(x, peak):
    m = np.max(np.abs(x))
    x = x / m * peak if m else x
    f = 64
    x[-f:] *= np.linspace(1, 0, f)
    return x


def sfx_all():
    np.random.seed(11)
    S = {}
    S['tap'] = norm(bloop(hz(7), hz(0), 0.09, 0.8, 0.02), 0.3)
    S['click'] = norm(bloop(hz(12), hz(7), 0.07, 0.8, 0.015), 0.28)
    S['hover'] = norm(ping(C(9), 0.15, 0.4), 0.16)
    S['pop'] = norm(room(seq([(0, bloop(C(3), C(7), 0.16, 0.9, 0.03), 1), (0.02, ping(C(10), 0.25), 0.25)], 0.3)), 0.45)
    S['pop_hi'] = norm(room(seq([(0, bloop(C(5), C(9), 0.16, 0.9, 0.03), 1), (0.02, ping(C(12), 0.25), 0.25)], 0.3)), 0.45)
    for k in range(1, 9):
        base = 3 + k                                  # climbs the pentatonic with the tier
        x = seq([(0, bloop(C(base - 3), C(base), 0.2, 0.8, 0.03), 0.7),
                 (0.05, ping(C(base + 2), 0.8, 0.5), 0.6),
                 (0.10, ping(C(base + 4), 0.9, 0.4), 0.5 if k > 2 else 0.0),
                 (0.0, sweep(C(base) * 0.5, C(base + 5), 0.35, 0.2), 0.4 if k > 4 else 0.0)], 1.1)
        S[f'merge{k}'] = norm(room(x, 0.28), 0.5)
    S['merge_crown'] = norm(space(seq([(i * 0.08, ping(C(7 + i), 1.4, 0.6), 0.7) for i in range(6)]
                                      + [(0, sweep(200, 1600, 0.6, 0.25, 0.3), 0.6)], 2.2), 0.35), 0.6)
    S['coin'] = norm(room(seq([(0, ping(C(11), 0.4), 0.7), (0.06, ping(C(13), 0.5), 0.7)], 0.6)), 0.42)
    S['sell'] = norm(room(seq([(0, ping(C(10), 0.35), 0.6), (0.06, ping(C(8), 0.4), 0.5)], 0.5)), 0.38)
    S['collect'] = norm(space(shimmer(8, 4, 0.06, 0.5), 0.25), 0.48)
    S['ready'] = norm(space(seq([(0, ping(C(9), 1.0, 0.5), 0.6), (0.12, ping(C(11), 1.0, 0.5), 0.5)], 1.4), 0.3), 0.4)
    S['levelup'] = norm(space(seq([(i * 0.11, ping(C(5 + 2 * i), 1.3, 0.6), 0.6) for i in range(5)]
                                  + [(0, sweep(150, 1200, 0.9, 0.25, 0.2), 0.5), (0.3, choir([hz(0), hz(4), hz(7)], 1.0, 0.5, 'a'), 0.5)], 2.6), 0.35), 0.6)
    S['discover'] = norm(space(seq([(i * 0.09, ping(C(8 + i), 1.4, 0.5), 0.5) for i in range(4)]
                                   + [(0, sweep(500, 2400, 0.5, 0.15, 0.2), 0.4)], 2.0), 0.35), 0.5)
    S['unlock'] = norm(space(seq([(0, ping(C(7), 1.2), 0.6), (0.14, ping(C(9), 1.2), 0.6), (0.28, ping(C(12), 1.6), 0.6),
                                  (0.0, sweep(300, 900, 0.4, 0.2), 0.4)], 2.0), 0.3), 0.52)
    S['build'] = norm(space(seq([(0, bloop(C(0), C(2), 0.3), 0.8), (0.12, bloop(C(2), C(4), 0.3), 0.7), (0.24, bloop(C(4), C(7), 0.3), 0.7),
                                 (0.4, ping(C(7), 1.4), 0.6), (0.4, ping(C(9), 1.4), 0.4)], 2.0), 0.3), 0.58)
    S['install'] = norm(room(seq([(0, bloop(C(2), C(4), 0.25), 0.7), (0.1, ping(C(7), 1.2), 0.6), (0, softnoise(0.2, 1500, 6000, 0.05), 0.15)], 1.4)), 0.5)
    S['boost'] = norm(room(seq([(0, sweep(300, 2000, 0.4, 0.4), 0.6)] + [(i * 0.05, ping(C(6 + i), 0.4), 0.4) for i in range(6)], 0.9)), 0.45)
    S['fuel'] = norm(room(seq([(0, softnoise(0.5, 200, 1500, 0.15), 0.5), (0, bloop(C(2), C(5), 0.4, 0.6, 0.1), 0.6)], 0.6)), 0.4)
    S['bag'] = norm(room(seq([(0, bloop(C(4), C(1), 0.18), 1), (0, softnoise(0.12, 800, 3000, 0.03), 0.4)], 0.3)), 0.35)
    S['lift'] = norm(bloop(C(5), C(8), 0.12, 0.6, 0.03), 0.22)
    S['land'] = norm(bloop(C(6), C(3), 0.14, 0.7, 0.03), 0.28)
    S['swap'] = norm(seq([(0, bloop(C(4), C(6), 0.1), 0.6), (0.05, bloop(C(6), C(4), 0.1), 0.6)], 0.2), 0.28)
    S['open'] = norm(room(seq([(0, sweep(400, 900, 0.18, 0.4), 0.6), (0.06, ping(C(9), 0.3), 0.4)], 0.45)), 0.3)
    S['close'] = norm(room(seq([(0, sweep(900, 400, 0.18, 0.4), 0.6)], 0.4)), 0.24)
    S['tab'] = norm(bloop(C(6), C(4), 0.1, 0.7, 0.02), 0.26)
    t = T(0.5)
    wah = np.sin(2 * np.pi * np.cumsum(hz(-10) * (1 - 0.25 * t / 0.5) * (1 + 0.04 * np.sin(2 * np.pi * 7 * t))) / SR)
    S['nope'] = norm(onepole_lp(wah + 0.15 * np.sin(2 * np.pi * np.cumsum(hz(-22) * np.ones(len(t))) / SR), 900) * np.exp(-t / 0.22) * np.minimum(1, t / 0.01), 0.32)
    S['error'] = S['nope']
    S['dig'] = norm(room(seq([(0, softnoise(0.3, 120, 900, 0.07), 1), (0, bloop(hz(-12), hz(-17), 0.2), 0.6)], 0.35)), 0.4)
    S['whoosh'] = norm(sweep(300, 1200, 0.5, 0.2, 1.4), 0.3)
    t = T(1.8)
    S['meteor'] = norm(space(softnoise(1.8, 80, 1400, 0.6) * np.sin(np.linspace(0, np.pi, len(t))) ** 0.5
                             + np.concatenate([sweep(1600, 120, 1.0, 0.25), np.zeros(len(t) - int(SR * 1.0))])
                             + 0.8 * np.sin(2 * np.pi * 50 * t) * np.exp(-np.maximum(0, t - 1.0) / 0.25) * (t > 1.0), 0.25), 0.55)
    t = T(2.8)
    S['launch'] = norm(space(softnoise(2.8, 50, 1400, 1.3) * np.minimum(1, t / 0.8)
                             + np.concatenate([np.zeros(int(SR * 0.4)), sweep(80, 900, 2.0, 0.3), np.zeros(len(t) - int(SR * 2.4))])
                             + seq([(0.8 + i * 0.14, ping(C(5 + 2 * i), 1.2), 0.4) for i in range(5)], 2.8), 0.3), 0.6)
    for i in range(5):
        S[f'streak{i + 1}'] = norm(room(seq([(0, ping(C(7 + 2 * i), 0.5), 0.7), (0.05, ping(C(9 + 2 * i), 0.6), 0.5),
                                             (0, bloop(C(4 + 2 * i), C(7 + 2 * i), 0.15), 0.4)], 0.7)), 0.42)
    tb = T(0.4)
    S['boing'] = norm(np.sin(2 * np.pi * np.cumsum(hz(-5) * (1 + 0.6 * np.exp(-tb / 0.08) * np.sin(2 * np.pi * 11 * tb))) / SR)
                      * np.exp(-tb / 0.14), 0.32)
    S['goo'] = norm(room(seq([(i * 0.07, bloop(C(2 + i) * 0.7, C(5 + i), 0.12, 0.8, 0.02), 0.7) for i in range(4)], 0.6)), 0.4)
    return S


# ------------------------------------------------------------------- voices
VOICE_TYPES = {
    #           f0 (Hz), formant scale, glide, vibrato rate/depth, extra
    'squeak': dict(f0=420, fs=1.35, glide=0.18, vib=(9, 0.03), dur=(0.07, 0.11)),
    'chirp':  dict(f0=330, fs=1.2, glide=0.25, vib=(6, 0.02), dur=(0.08, 0.13), trill=True),
    'mid':    dict(f0=200, fs=1.0, glide=0.12, vib=(5, 0.015), dur=(0.10, 0.15)),
    'deep':   dict(f0=95, fs=0.78, glide=0.08, vib=(4, 0.01), dur=(0.13, 0.19)),
    'robot':  dict(f0=150, fs=1.0, glide=0.0, vib=(0, 0), dur=(0.09, 0.13), robot=True),
    'gloop':  dict(f0=260, fs=1.1, glide=0.2, vib=(17, 0.06), dur=(0.10, 0.15), bubbly=True),
    'dreamy': dict(f0=240, fs=1.08, glide=0.1, vib=(5.5, 0.02), dur=(0.12, 0.17), airy=True),
}
CONS = ['', 'b', 'k', 'z', 'm', 'sh', 'l', 'g', 'p', 'n', 'v', 'r']
VSEQ = ['a', 'o', 'u', 'e', 'i', 'ae']


def voiced(f0curve, F, fs):
    """glottal-pulse vowel: harmonics of the pitch curve weighted by the formants"""
    n = len(f0curve)
    ph = 2 * np.pi * np.cumsum(f0curve) / SR
    x = np.zeros(n)
    fm = float(np.mean(f0curve))
    Fs = [f * fs for f in F]
    for k in range(1, 40):
        if fm * k > 5000:
            break
        a = formant_amp(fm * k, Fs, (80 * fs, 110 * fs, 150 * fs)) / k ** 0.15 + 0.004
        x += a * np.sin(k * ph)
    return x


def syllable(vt, rng):
    p = VOICE_TYPES[vt]
    c = CONS[int(rng.integers(len(CONS)))]
    v = VSEQ[int(rng.integers(len(VSEQ)))]
    dur = rng.uniform(*p['dur'])
    t = T(dur)
    f0 = p['f0'] * (1 + rng.uniform(-0.08, 0.08))
    g = p['glide'] * rng.choice([-1, 1])
    curve = f0 * (1 + g * (t / dur - 0.3))
    if p['vib'][0]:
        curve *= 1 + p['vib'][1] * np.sin(2 * np.pi * p['vib'][0] * t)
    if p.get('trill'):
        curve *= 1 + 0.06 * (np.sin(2 * np.pi * 28 * t) > 0)
    if p.get('robot'):
        curve = np.round(curve / 25) * 25                       # stepped pitch
    x = voiced(curve, VOWELS[v], p['fs'])
    env = np.sin(np.linspace(0, np.pi, len(t))) ** 0.6
    x *= env
    # consonant onset
    on = np.zeros(0)
    if c in ('sh', 'z', 'v'):
        on = softnoise(0.05, 2500 if c == 'sh' else 1800, 7000, 0.03) * (0.5 if c == 'sh' else 0.3)
        if c in ('z', 'v'):
            on = on + 0.3 * voiced(np.full(len(on), f0), VOWELS['u'], p['fs']) * np.linspace(0.3, 1, len(on))
    elif c in ('k', 'p', 'g', 'b'):
        on = softnoise(0.018, 800 if c in ('b', 'g') else 1500, 5000, 0.006) * 0.8
    elif c in ('m', 'n', 'l', 'r'):
        on = onepole_lp(voiced(np.full(int(SR * 0.04), f0 * (0.97)), VOWELS['u'], p['fs']), 700 if c in ('m', 'n') else 1500) * np.linspace(0.2, 1, int(SR * 0.04))
        if c == 'r':
            on *= 1 + 0.5 * np.sin(2 * np.pi * 30 * T(0.04))
    x = np.concatenate([on, x])
    if p.get('robot'):
        tt = np.arange(len(x)) / SR
        x = x * (0.6 + 0.4 * np.sin(2 * np.pi * 60 * tt))
        x = np.tanh(x * 2.0) * 0.6
    if p.get('bubbly'):
        tt = np.arange(len(x)) / SR
        x = x + 0.25 * np.sin(2 * np.pi * np.cumsum(500 + 300 * np.exp(-tt / 0.03)) / SR) * np.exp(-tt / 0.04)
    if p.get('airy'):
        tt = np.arange(len(x)) / SR
        x = x + 0.35 * np.sin(2 * np.pi * f0 * 2 * tt) * np.sin(np.linspace(0, np.pi, len(tt))) + 0.03 * onepole_hp(np.random.randn(len(tt)), 3000)
    x = onepole_hp(x, 90)
    x = np.concatenate([x, np.zeros(int(SR * 0.08))])
    return norm(room(x, 0.12 if not p.get('airy') else 0.3), 0.32)


def voices():
    S = {}
    for vt in VOICE_TYPES:
        rng = np.random.default_rng(sum(map(ord, vt)))
        for k in range(8):
            S[f'voice_{vt}_{k + 1}'] = syllable(vt, rng)
    return S


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    total = 0
    if what in ('all', 'sfx'):
        for name, x in sfx_all().items():
            total += to_ogg(name, x, q='2')
        print('effects done')
    if what in ('all', 'sfx', 'voice'):
        for f in os.listdir(OUT):
            if f.startswith('blip'):
                os.remove(os.path.join(OUT, f))
        for name, x in voices().items():
            total += to_ogg(name, x, q='1')
        print('voices done')
    if what in ('all', 'music'):
        for w in WORLDS:
            for f in os.listdir(OUT):
                if f.startswith(f'music_{w}_'):
                    os.remove(os.path.join(OUT, f))
            for k in range(2):
                L, R = phrase(w, k)
                total += to_ogg(f'music_{w}_{k + 1}', L, R, q='0')
            L, R = ambience(w)
            total += to_ogg(f'amb_{w}', L, R, q='0')
            print('music', w)
    print(f'{total / 1024:.0f} kB')


if __name__ == '__main__':
    main()
