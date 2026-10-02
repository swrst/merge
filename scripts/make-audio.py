#!/usr/bin/env python3
"""Synthesise the game's whole sound pack into src/audio/*.ogg.

Everything here is generated maths — no sampled material, so nothing to license
and nothing to attribute. Run it whenever a sound needs changing:

    python3 scripts/make-audio.py

Needs numpy and ffmpeg (for the vorbis encode). The .ogg files are committed, so
players and CI never have to run this.
"""
import math
import os
import subprocess
import sys

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'audio')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


# --------------------------------------------------------------- primitives
def t(dur):
    return np.linspace(0, dur, int(SR * dur), endpoint=False)


def env(n, a=0.005, d=0.08, s=0.0, r=0.1, sus=0.0):
    """ADSR over n samples; a/d/r in seconds, s the sustain level."""
    out = np.zeros(n)
    ai, di, si = int(a * SR), int(d * SR), int(sus * SR)
    ri = max(1, n - ai - di - si)
    i = 0
    if ai:
        out[i:i + ai] = np.linspace(0, 1, ai); i += ai
    if di:
        out[i:i + di] = np.linspace(1, s, di); i += di
    if si:
        out[i:i + si] = s; i += si
    k = min(ri, n - i)
    if k > 0:
        out[i:i + k] = np.linspace(s, 0, k)
    return out


def expdecay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def sine(f, dur, phase=0.0):
    return np.sin(2 * np.pi * f * t(dur) + phase)


def harm(f, dur, partials=(1.0, 0.4, 0.18, 0.08), detune=0.0):
    """Additive tone — the body of most of the musical hits."""
    x = np.zeros(int(SR * dur))
    for k, amp in enumerate(partials, start=1):
        x += amp * np.sin(2 * np.pi * f * k * (1 + detune * k) * t(dur))
    return x / max(1e-9, sum(partials))


def fm_bell(f, dur, ratio=2.7, index=6.0, tau=0.35):
    """Classic 2-operator FM bell: bright attack, long metallic tail."""
    tt = t(dur)
    mod = np.sin(2 * np.pi * f * ratio * tt) * index * np.exp(-tt / (tau * 0.7))
    return np.sin(2 * np.pi * f * tt + mod) * np.exp(-tt / tau)


def pluck(f, dur, damp=0.5, bright=0.5):
    """Karplus-Strong string — used for the marimba/uke-ish melodies."""
    n = int(SR * dur)
    ln = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, ln)
    # low-pass the excitation for a rounder, less fizzy pluck
    buf = buf * bright + np.convolve(buf, np.ones(4) / 4, mode='same') * (1 - bright)
    out = np.zeros(n)
    idx = 0
    prev = 0.0
    for i in range(n):
        cur = buf[idx]
        nxt = (cur + prev) * 0.5 * (1 - 0.5 * (1 - damp) * 0.02 - 0.0005)
        out[i] = cur
        buf[idx] = nxt * 0.998
        prev = cur
        idx = (idx + 1) % ln
    return out


def mallet(f, dur, hardness=0.5):
    """The little knock of a beater hitting wood, pitched with the bar."""
    n = int(SR * dur)
    x = lowpass_fast(noise(dur), 1200 + 5000 * hardness, 2) * expdecay(n, 0.004 + 0.004 * hardness)
    x += np.sin(2 * np.pi * f * 3.1 * t(dur)) * expdecay(n, 0.006) * 0.35
    return x


def marimba(f, dur, soft=0.5):
    """Warm wooden bar: a fundamental, the 4th and 10th partials a marimba has,
       a touch of FM for the attack, and a beater knock on the front."""
    n = int(SR * dur)
    tt = t(dur)
    body = np.sin(2 * np.pi * f * tt) * expdecay(n, dur * 0.34)
    body += 0.34 * np.sin(2 * np.pi * f * 3.99 * tt) * expdecay(n, dur * 0.12)
    body += 0.12 * np.sin(2 * np.pi * f * 9.2 * tt) * expdecay(n, dur * 0.05)
    mod = np.sin(2 * np.pi * f * 4 * tt) * 1.4 * expdecay(n, 0.02)
    body += 0.3 * np.sin(2 * np.pi * f * tt + mod) * expdecay(n, dur * 0.18)
    x = body * (1 - 0.35 * soft) + mallet(f, dur, 0.35) * 0.3 * (1 - soft * 0.6)
    # a soft attack ramp keeps it from clicking at the very start
    ramp = min(n, int(SR * 0.004))
    x[:ramp] *= np.linspace(0, 1, ramp)
    return lowpass_fast(x, 5200 - 1600 * soft, 1)


def kalimba(f, dur):
    """Thumb piano: almost a pure tone with a slightly sharp second partial."""
    n = int(SR * dur)
    tt = t(dur)
    x = np.sin(2 * np.pi * f * tt) * expdecay(n, dur * 0.42)
    x += 0.28 * np.sin(2 * np.pi * f * 2.02 * tt) * expdecay(n, dur * 0.16)
    x += 0.10 * np.sin(2 * np.pi * f * 3.05 * tt) * expdecay(n, dur * 0.08)
    x += fit(mallet(f, min(dur, 0.05), 0.2) * 0.16, n)
    ramp = min(n, int(SR * 0.003))
    x[:ramp] *= np.linspace(0, 1, ramp)
    return lowpass_fast(x, 4200, 1)


def saw(f, dur, detune=0.0):
    """Band-limited-ish saw by additive partials — the pad's raw material."""
    x = np.zeros(int(SR * dur))
    tt = t(dur)
    for k in range(1, 13):
        if f * k > 7000:
            break
        x += np.sin(2 * np.pi * f * k * (1 + detune) * tt) / k
    return x * 0.5


def warmpad(f, dur, cut=1500):
    """Three detuned saws through a gentle filter, breathing in and out."""
    x = saw(f, dur, 0) + saw(f, dur, 0.004) * 0.8 + saw(f, dur, -0.005) * 0.8
    x += saw(f * 0.5, dur, 0.002) * 0.35
    lfo = 1 + 0.12 * np.sin(2 * np.pi * 0.13 * t(dur))
    return lowpass_fast(x * lfo, cut, 2) * 0.33


def shaker(dur, bright=6000):
    n = int(SR * dur)
    return highpass_fast(lowpass_fast(noise(dur), bright, 2), 2600, 1) * expdecay(n, 0.018)


def noise(dur):
    return rng.uniform(-1, 1, int(SR * dur))


def lowpass(x, cut, order=2):
    """One-pole cascade — cheap and smooth enough for this."""
    a = math.exp(-2 * math.pi * cut / SR)
    y = x.astype(float).copy()
    for _ in range(order):
        out = np.zeros_like(y)
        z = 0.0
        for i in range(len(y)):
            z = (1 - a) * y[i] + a * z
            out[i] = z
        y = out
    return y


def lowpass_fast(x, cut, order=2):
    """Vectorised-ish IIR via scipy when available (much faster for long music)."""
    try:
        from scipy.signal import butter, lfilter
        b, a = butter(order, min(0.99, cut / (SR / 2)), btype='low')
        return lfilter(b, a, x)
    except Exception:
        return lowpass(x, cut, order)


def highpass_fast(x, cut, order=2):
    try:
        from scipy.signal import butter, lfilter
        b, a = butter(order, max(0.001, cut / (SR / 2)), btype='high')
        return lfilter(b, a, x)
    except Exception:
        return x


def reverb(x, size=0.35, mix=0.22):
    """Small room: a handful of decaying taps, then a diffuse tail."""
    n = len(x)
    tail_len = int(SR * size * 2.2)
    imp = rng.uniform(-1, 1, tail_len) * np.exp(-np.arange(tail_len) / (size * SR))
    imp = lowpass_fast(imp, 4200)
    imp[0] = 1.0
    wet = np.convolve(x, imp)[:n]
    wet /= max(1e-9, np.max(np.abs(wet)))
    return (1 - mix) * x + mix * wet


def fit(x, n):
    out = np.zeros(n)
    k = min(n, len(x))
    out[:k] = x[:k]
    return out


def mixdown(parts, dur):
    n = int(SR * dur)
    buf = np.zeros(n)
    for start, sig, gain in parts:
        i = int(start * SR)
        k = min(n - i, len(sig))
        if k > 0:
            buf[i:i + k] += sig[:k] * gain
    return buf


def master(x, peak=0.92, fade=0.006):
    x = np.asarray(x, dtype=float)
    # gentle soft-clip keeps transients punchy without digital crunch
    x = np.tanh(x * 1.15)
    m = np.max(np.abs(x))
    if m > 0:
        x = x / m * peak
    f = int(SR * fade)
    if f * 2 < len(x):
        x[:f] *= np.linspace(0, 1, f)
        x[-f:] *= np.linspace(1, 0, f)
    return x


def write(name, x, stereo=None, quality='2'):
    """Write a temp WAV then encode to OGG vorbis."""
    import wave
    raw = os.path.join('/tmp', name + '.wav')
    if stereo is not None:
        data = np.stack([x, stereo], axis=1)
        ch = 2
    else:
        data = x.reshape(-1, 1)
        ch = 1
    pcm = np.clip(data, -1, 1)
    pcm = (pcm * 32767).astype('<i2')
    with wave.open(raw, 'wb') as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, name + '.ogg')
    subprocess.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-c:a', 'libvorbis', '-q:a', quality, dst],
        check=True)
    os.remove(raw)
    return os.path.getsize(dst)


# ------------------------------------------------------------------- sounds
SEMI = 2 ** (1 / 12)


def note(n):
    """MIDI-ish: 0 = C4."""
    return 261.63 * (SEMI ** n)


def s_tap():
    """A soft wooden tok. You hear this hundreds of times, so it stays quiet."""
    return master(marimba(note(-12), 0.14, soft=0.8) * 0.9, 0.34)


def bloop(f0, f1, dur=0.11):
    """A round water-drop 'bloop': a sine that bends up. The body of a merge."""
    n = int(SR * dur)
    f = np.linspace(f0, f1, n) ** 1.0
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.003, dur * 0.35, 0.35, dur * 0.5, 0.0)


def glass(f, dur):
    """A soft glassy chime: FM bell with the metal filed off."""
    return lowpass_fast(fm_bell(f, dur, ratio=3.01, index=1.6, tau=dur * 0.38), 7000, 1)


def sparkle(dur, amount, seed=0):
    """A scatter of tiny high chimes, like dust catching the light."""
    r = np.random.default_rng(100 + seed)
    out = np.zeros(int(SR * dur))
    for _ in range(amount):
        at = r.uniform(0.02, dur * 0.55)
        f = note(24 + r.choice([0, 2, 4, 7, 9, 12, 14, 16]))
        g = r.uniform(0.25, 0.6)
        tone = glass(f, 0.35) * g
        k = int(at * SR)
        m = min(len(out) - k, len(tone))
        out[k:k + m] += tone[:m]
    return out


def s_pop(pitch=1.0):
    """An item landing on the board: a soft bubbly bloop and a tiny tick."""
    b = bloop(320 * pitch, 620 * pitch, 0.09)
    tick = kalimba(note(16) * pitch, 0.18)
    return master(mixdown([(0, b, 0.7), (0.012, tick, 0.28)], 0.26), 0.55)


def s_merge(tier):
    """The sound you hear most, so it has to feel good every time.
       A bubbly 'bloop' as the two squash together, then a bright little chime
       chord that climbs a major-pentatonic step with every tier, and more
       sparkle the higher it goes. Short, round, never harsh."""
    PENT = [0, 2, 4, 7, 9, 12, 14, 16]
    root = PENT[min(tier, 8) - 1]
    dur = 0.55 + 0.08 * tier
    parts = [(0, bloop(260 + 25 * tier, 700 + 40 * tier, 0.1), 0.55)]
    chord = [0, 4, 7] if tier < 4 else [0, 4, 7, 12]
    for k, off in enumerate(chord):
        f = note(root + off + 12)
        parts.append((0.035 + k * 0.035, glass(f, 0.5 + 0.05 * tier), 0.34))
        parts.append((0.035 + k * 0.035, marimba(f / 2, 0.35, soft=0.5), 0.22))
    if tier >= 3:
        parts.append((0.06, sparkle(dur, 2 + tier, tier), 0.16 + 0.02 * tier))
    return master(reverb(mixdown(parts, dur), 0.3, 0.2 + 0.015 * tier), 0.7 + 0.02 * min(tier, 6))


def s_crown():
    """Finishing a chain: the merge, then a short rising fanfare in glass and
       marimba, with a warm pad blooming underneath."""
    parts = [(0, bloop(300, 900, 0.12), 0.55)]
    run = [0, 4, 7, 12, 16, 19, 24]
    for i, off in enumerate(run):
        f = note(off + 7)
        parts.append((0.05 + i * 0.06, glass(f, 0.9), 0.32))
        parts.append((0.05 + i * 0.06, marimba(f / 2, 0.5, soft=0.4), 0.2))
    parts.append((0.1, sparkle(1.4, 14, 99), 0.22))
    pad = warmpad(note(7), 1.6, 1600) * env(int(SR * 1.6), .15, .3, .6, .8, .2)
    parts.append((0.08, pad, 0.34))
    return master(reverb(mixdown(parts, 1.9), 0.55, 0.32), 0.88)


def s_coin():
    """Coins: two bright glass notes up a fifth with a pinch of sparkle."""
    parts = [(0, glass(note(19), 0.45), 0.5),
             (0.06, glass(note(26), 0.5), 0.45),
             (0.0, kalimba(note(7), 0.3), 0.3),
             (0.04, sparkle(0.5, 4, 3), 0.12)]
    return master(reverb(mixdown(parts, 0.6), 0.25, 0.2), 0.6)


def s_sell():
    parts = [(0, kalimba(note(16), 0.35), 0.6),
             (0.05, kalimba(note(9), 0.4), 0.5),
             (0, lowpass_fast(noise(0.2), 2600) * expdecay(int(SR * 0.2), 0.05), 0.08)]
    return master(mixdown(parts, 0.45), 0.6)


def s_levelup():
    """A warm rising pentatonic run on marimba, with a pad swelling behind it."""
    parts = []
    for i, off in enumerate([0, 4, 7, 12, 16, 19]):
        f = note(off)
        parts.append((i * 0.085, marimba(f, 0.8, soft=0.4), 0.5))
        parts.append((i * 0.085, kalimba(f * 2, 0.5) * 0.4, 0.14))
    pad = warmpad(note(0), 1.4, 1400) * env(int(SR * 1.4), 0.2, 0.3, 0.6, 0.6, 0.3)
    parts.append((0.05, pad, 0.4))
    return master(reverb(mixdown(parts, 1.5), 0.5, 0.3), 0.8)


def s_discover():
    """A pentatonic run up the kalimba over a pad swell — something new exists."""
    parts = []
    for i, off in enumerate([0, 4, 7, 9, 12, 16, 19, 21, 24]):
        parts.append((i * 0.055, kalimba(note(off + 7), 0.7), 0.4))
    pad = warmpad(note(7), 1.4, 1500) * env(int(SR * 1.4), .25, .3, .55, .6, .1)
    parts.append((0.08, pad, 0.42))
    return master(reverb(mixdown(parts, 1.7), 0.5, 0.3), 0.85)


def s_install():
    """Metal plate seating into place, with a servo whine."""
    n = int(SR * 0.5)
    clunk = lowpass_fast(noise(0.5), 900) * expdecay(n, 0.05)
    thud = sine(90, 0.5) * expdecay(n, 0.09)
    ring = lowpass_fast(fm_bell(440, 0.5, 1.7, 3.5, 0.16), 4200)
    servo = np.sin(2 * np.pi * np.cumsum(np.linspace(300, 900, n)) / SR) * expdecay(n, 0.12) * 0.25
    return master(reverb(mixdown([(0, thud, .9), (0, clunk, .5), (0.03, ring, .35), (0.06, servo, .3)], 0.7), .3, .2), 0.95)


def s_fuel():
    """Glug of liquid then a pressurised hiss."""
    parts = []
    for i in range(4):
        f = 170 + i * 25
        g = sine(f, 0.1) * env(int(SR * 0.1), 0.005, 0.09)
        parts.append((i * 0.075, g, 0.5))
    hiss = highpass_fast(noise(0.45), 3000) * np.concatenate(
        [np.linspace(0, 1, int(SR * .08)), expdecay(int(SR * .37), 0.12)])
    parts.append((0.28, hiss, 0.22))
    return master(mixdown(parts, 0.8), 0.8)


def s_meteor():
    """Whistle in, then a big low impact with a rumble tail."""
    n = int(SR * 1.1)
    whistle = np.sin(2 * np.pi * np.cumsum(np.linspace(2200, 420, n)) / SR) * np.linspace(0.05, 0.7, n) ** 2
    imp = int(SR * 0.25)
    boom = (lowpass_fast(noise(0.25), 180) * expdecay(imp, 0.07) * 1.4
            + np.sin(2 * np.pi * np.cumsum(np.linspace(110, 38, imp)) / SR) * expdecay(imp, 0.1))
    rumble = lowpass_fast(noise(0.9), 120) * expdecay(int(SR * 0.9), 0.3)
    crack = highpass_fast(noise(0.2), 2500) * expdecay(int(SR * 0.2), 0.03)
    return master(reverb(mixdown(
        [(0, whistle, 0.45), (1.05, boom, 1.0), (1.05, crack, 0.3), (1.08, rumble, 0.5)], 2.2), 0.6, 0.3), 0.98)


def s_dig():
    grit = lowpass_fast(noise(0.3), 2600) * expdecay(int(SR * 0.3), 0.06)
    thud = sine(120, 0.2) * expdecay(int(SR * 0.2), 0.05)
    tick = highpass_fast(noise(0.08), 4000) * expdecay(int(SR * 0.08), 0.015)
    return master(mixdown([(0, thud, .7), (0, grit, .55), (0.02, tick, .3)], 0.4), 0.8)


def s_error():
    n = int(SR * 0.22)
    buzz = np.sign(np.sin(2 * np.pi * 150 * t(0.22))) * 0.4 + sine(150, 0.22) * 0.6
    return master(lowpass_fast(buzz, 900) * env(n, 0.005, 0.1, 0.3, 0.1, 0.02), 0.55)


def s_lift():
    """Picking an item up: a tiny rising bloop, light as a bubble leaving water."""
    b = bloop(420, 900, 0.07)
    return master(mixdown([(0, b, 0.6), (0.01, kalimba(note(19), 0.12), 0.14)], 0.16), 0.42)


def s_land():
    """Setting an item down on an empty tile: a soft round thump with a wooden tick."""
    n = int(SR * 0.16)
    thump = sine(150, 0.16) * expdecay(n, 0.035)
    thump = thump + fit(bloop(520, 260, 0.06), n) * 0.5
    tick = marimba(note(4), 0.12, soft=0.7)
    return master(mixdown([(0, thump, 0.7), (0.005, tick, 0.3)], 0.18), 0.5)


def s_swap():
    """Two items trading places: two quick bloops passing each other."""
    a = bloop(380, 700, 0.07)
    b = bloop(700, 380, 0.07)
    return master(mixdown([(0, a, 0.55), (0.06, b, 0.55), (0.11, kalimba(note(12), 0.14), 0.18)], 0.26), 0.5)


def s_hover():
    """Over a tile it would merge with: the faintest glass tick, a promise."""
    return master(glass(note(26), 0.18), 0.28)


def s_click():
    """A menu button: a short soft tok, quieter than the board's tap."""
    return master(mixdown([(0, marimba(note(-5), 0.09, soft=0.9), 0.8), (0, bloop(500, 650, 0.03), 0.25)], 0.1), 0.3)


def s_nope():
    """A refused move: a gentle two-note 'uh-uh', not a buzzer."""
    a = kalimba(note(4), 0.12)
    b = kalimba(note(0), 0.18)
    return master(lowpass_fast(mixdown([(0, a, 0.6), (0.09, b, 0.6)], 0.3), 2400), 0.45)


def s_whoosh():
    n = int(SR * 0.4)
    sw = highpass_fast(noise(0.4), 700) * np.concatenate(
        [np.linspace(0, 1, int(SR * .12)) ** 2, expdecay(n - int(SR * .12), 0.09)])
    return master(lowpass_fast(sw, 6000), 0.55)


def s_launch():
    n = int(SR * 2.6)
    rumble = lowpass_fast(noise(2.6), 150) * np.concatenate(
        [np.linspace(0, 1, int(SR * .8)), np.ones(n - int(SR * .8))])
    rise = np.sin(2 * np.pi * np.cumsum(np.linspace(60, 520, n)) / SR) * np.linspace(0.1, 0.9, n)
    air = highpass_fast(noise(2.6), 1200) * np.linspace(0.1, 0.6, n)
    return master(reverb(mixdown([(0, rumble, 1.0), (0, rise, 0.4), (0, air, 0.3)], 2.8), 0.7, 0.25), 0.95)


def s_build():
    """Three wooden taps, then a little chord that says it is finished."""
    parts = []
    for i in range(3):
        n = int(SR * 0.22)
        hit = (lowpass_fast(noise(0.22), 1100) * expdecay(n, 0.03) * 0.7
               + marimba(note(-10 - i * 2), 0.22, soft=0.7))
        parts.append((i * 0.17, hit, 0.75))
    for i, off in enumerate([0, 7, 12, 16]):
        parts.append((0.55 + i * 0.05, marimba(note(off + 12), 0.7, soft=0.4), 0.4))
    parts.append((0.55, warmpad(note(0), 1.1, 1300) * env(int(SR * 1.1), .15, .3, .5, .5, .1), 0.3))
    return master(reverb(mixdown(parts, 1.7), 0.42, 0.28), 0.85)


def s_streak(step=0):
    """Each combo step is the next note of a pentatonic ladder, on the kalimba."""
    PENT = [0, 2, 4, 7, 9]
    f = note(12 + PENT[step % 5] + 12 * (step // 5))
    return master(mixdown([(0, kalimba(f, 0.35), 0.8)], 0.4), 0.55)


def s_bag():
    zip_ = lowpass_fast(highpass_fast(noise(0.18), 1400), 5200) * expdecay(int(SR * 0.18), 0.05)
    thump = marimba(note(-14), 0.22, soft=0.85)
    return master(mixdown([(0, zip_, 0.28), (0.02, thump, 0.6)], 0.3), 0.55)


def s_boost():
    n = int(SR * 0.7)
    rise = np.sin(2 * np.pi * np.cumsum(np.linspace(260, 1100, n)) / SR) * env(n, 0.03, 0.22, 0.45, 0.3, 0.1)
    air = lowpass_fast(highpass_fast(noise(0.7), 2200), 6500) * expdecay(n, 0.16)
    return master(reverb(mixdown([(0, lowpass_fast(rise, 3200), 0.35), (0, air, 0.16),
                                  (0.22, kalimba(note(19), 0.6), 0.6)], 0.9), 0.35, 0.25), 0.72)


# -------------------------------------------------------------------- music
def music(name, bpm, bars, chords, mel, *, pad_gain=0.2, bass_oct=-24,
          lead='marimba', arp=(0, 2, 1, 2), arp_gain=0.16, arp_oct=12,
          shake=None, reverb_mix=0.34, cut=1600, mel_oct=12, mel_gain=0.3, air=0.0):
    """A loopable stereo bed, built the way a cosy game actually scores itself:
       a pad holding the chord, a soft bass on the down beat, a gentle arpeggio
       keeping time, and a melody with *rests* in it. Eight bars, so the loop
       takes long enough that you stop hearing the seam.

       `mel` is a list of (beat, semitone|None, length) — None is a rest, which
       is what was missing before: a note on every single beat is a ringtone."""
    beat = 60.0 / bpm
    dur = beat * 4 * bars
    L, R = [], []

    def add(start, sig, gain, pan=0.5):
        L.append((start, sig, gain * (1 - pan) * 2 * 0.5))
        R.append((start, sig, gain * pan * 2 * 0.5))

    for b in range(bars):
        ch = chords[b % len(chords)]
        t0 = b * beat * 4
        hold = beat * 4.15
        # pad — the warm bed everything else sits on
        for i, off in enumerate(ch):
            p = warmpad(note(off), hold, cut) * env(int(SR * hold), beat * 0.9, beat * 0.7, 0.7, 0.7, beat * 1.6)
            add(t0, p, pad_gain, 0.5 + (0.16 if i % 2 else -0.16))
        # bass — one long note, and a soft nudge at the half bar
        bf = note(ch[0] + bass_oct)
        bs = lowpass_fast(saw(bf, beat * 2.2, 0.003), 420, 2) * env(int(SR * beat * 2.2), .02, .4, .45, .5, beat * 0.6)
        add(t0, bs, 0.34)
        add(t0 + beat * 2, bs * 0.6, 0.24)
        # arpeggio — keeps time without a drum kit
        for k, deg in enumerate(arp):
            if deg is None:
                continue
            f = note(ch[deg % len(ch)] + arp_oct + 12 * (deg // len(ch)))
            sig = kalimba(f, beat * 1.5)
            add(t0 + k * beat, sig, arp_gain, 0.5 + 0.2 * math.sin(k * 1.3 + b))
        if shake:
            for sh in shake:
                add(t0 + sh * beat, shaker(0.12), 0.055, 0.62)

    for (at, off, ln) in mel:
        if off is None:
            continue
        f = note(off + mel_oct)
        sig = marimba(f, ln * beat, soft=0.45) if lead == 'marimba' else kalimba(f, ln * beat)
        add(at * beat, sig, mel_gain, 0.5 + 0.1 * math.sin(at * 1.7))

    if air:
        # a slow breath of filtered noise under everything: room tone, not a sound
        n = int(SR * dur)
        swell = 0.55 + 0.45 * np.sin(2 * np.pi * np.arange(n) / n * 2 - math.pi / 2)
        for pan in (0.2, 0.8):
            add(0, lowpass_fast(noise(dur), 700) * swell, air, pan)

    left = reverb(mixdown(L, dur), 0.62, reverb_mix)
    right = reverb(mixdown(R, dur), 0.68, reverb_mix)
    # wrap the reverb tail back to the head so the loop has no seam
    wrap = int(SR * 1.2)
    for side in (left, right):
        side[:wrap] += side[-wrap:] * np.linspace(1, 0, wrap) * 0.6
    peak = max(np.max(np.abs(left)), np.max(np.abs(right)), 1e-9)
    left = np.tanh(left / peak * 0.8) * 0.78
    right = np.tanh(right / peak * 0.8) * 0.78
    return name, left, right


def phrase(pairs, start=0.0):
    """(semitone|None, beats) pairs -> the (beat, note, length) list music wants."""
    out, at = [], start
    for off, ln in pairs:
        out.append((at, off, ln))
        at += ln
    return out


def earth_theme():
    """Sunny Meadow: major, unhurried, marimba and a shaker. Home."""
    chords = [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-1, 2, 7],
              [0, 4, 7], [2, 5, 9], [-5, -1, 4], [-3, 0, 4]]
    mel = phrase([
        (7, 2), (4, 1), (7, 1), (9, 2), (None, 2),
        (4, 1.5), (2, .5), (0, 2), (None, 4),
        (7, 2), (9, 1), (11, 1), (12, 3), (None, 1),
        (9, 1), (7, 1), (4, 2), (None, 12),
    ])
    return music('music_earth', 66, 8, chords, mel, pad_gain=0.24,
                 arp=(0, None, 2, None), arp_gain=0.1, shake=None, reverb_mix=0.42,
                 cut=1250, mel_gain=0.22, air=0.05)


def luna_theme():
    """Crater Camp: weightless, almost no pulse, kalimba far away."""
    chords = [[-3, 2, 7, 11], [-5, 0, 5, 9], [-8, -1, 4, 7], [-3, 2, 6, 11],
              [-5, 0, 4, 9], [-7, -3, 2, 7], [-8, -1, 4, 11], [-3, 2, 7, 14]]
    mel = phrase([
        (11, 3), (None, 1), (9, 2), (7, 2),
        (None, 4), (4, 2), (7, 2),
        (11, 4), (None, 4),
        (9, 2), (7, 1), (4, 1), (2, 4), (None, 8),
    ])
    return music('music_luna', 56, 8, chords, mel, pad_gain=0.28, lead='kalimba',
                 arp=(0, None, None, None), arp_gain=0.09, arp_oct=24,
                 shake=None, reverb_mix=0.52, cut=1100, mel_gain=0.2, air=0.06)


def cindra_theme():
    """Ember Hollow: minor and low, but still cosy — a fire, not an alarm."""
    chords = [[-5, -1, 2, 7], [-7, -3, 0, 5], [-10, -5, -1, 2], [-5, -1, 3, 7],
              [-7, -3, 0, 4], [-8, -5, -1, 4], [-10, -5, 0, 5], [-5, -1, 2, 7]]
    mel = phrase([
        (3, 2), (2, 1), (3, 1), (7, 2), (None, 2),
        (5, 1.5), (3, .5), (2, 2), (None, 4),
        (7, 2), (10, 2), (7, 2), (5, 1), (3, 1),
        (2, 3), (None, 5),
    ])
    return music('music_cindra', 62, 8, chords, mel, pad_gain=0.25,
                 arp=(0, None, 2, None), arp_gain=0.1, shake=None, reverb_mix=0.44,
                 cut=1150, mel_gain=0.2, air=0.05)


def nerith_theme():
    """Tidal Shallows: slow swell, wide, a little melancholy."""
    chords = [[-5, 0, 3, 7], [-7, -2, 2, 5], [-10, -5, 0, 3], [-5, 0, 3, 10],
              [-7, -2, 2, 7], [-12, -5, 0, 5], [-5, 0, 3, 7], [-7, -2, 3, 7]]
    mel = phrase([
        (0, 3), (None, 1), (3, 2), (5, 2),
        (7, 4), (None, 4),
        (3, 2), (2, 1), (0, 1), (-2, 4),
        (None, 4), (0, 2), (3, 2),
    ])
    return music('music_nerith', 54, 8, chords, mel, pad_gain=0.28, lead='kalimba',
                 arp=(0, None, 2, None), arp_gain=0.09, arp_oct=12,
                 shake=None, reverb_mix=0.54, cut=1050, mel_gain=0.2, air=0.08)


def vela_theme():
    """Aurora Reach: high, shimmering, hopeful — the end of the story."""
    chords = [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 0, 4, 7], [-1, 2, 7, 11],
              [0, 4, 9, 12], [-3, 2, 7, 11], [-5, 0, 4, 9], [0, 4, 7, 14]]
    mel = phrase([
        (12, 2), (11, 1), (9, 1), (7, 3), (None, 1),
        (9, 2), (11, 2), (12, 3), (None, 1),
        (16, 2), (14, 1), (12, 1), (11, 4),
        (None, 2), (7, 2), (9, 4),
    ])
    return music('music_vela', 58, 8, chords, mel, pad_gain=0.27, lead='kalimba',
                 arp=(0, None, 3, None), arp_gain=0.09, arp_oct=24,
                 shake=None, reverb_mix=0.52, cut=1300, mel_gain=0.2, air=0.06)


# --------------------------------------------------------------------- main
def main():
    sfx = {
        'tap': s_tap(),
        'pop': s_pop(1.0),
        'pop_hi': s_pop(1.25),
        'merge1': s_merge(1), 'merge2': s_merge(2), 'merge3': s_merge(3),
        'merge4': s_merge(4), 'merge5': s_merge(5), 'merge6': s_merge(6),
        'merge7': s_merge(7), 'merge8': s_merge(8), 'merge_crown': s_crown(),
        'coin': s_coin(),
        'sell': s_sell(),
        'levelup': s_levelup(),
        'discover': s_discover(),
        'install': s_install(),
        'fuel': s_fuel(),
        'meteor': s_meteor(),
        'dig': s_dig(),
        'error': s_error(),
        'whoosh': s_whoosh(),
        'launch': s_launch(),
        'build': s_build(),
        'streak1': s_streak(0), 'streak2': s_streak(1), 'streak3': s_streak(2),
        'streak4': s_streak(3), 'streak5': s_streak(4),
        'bag': s_bag(),
        'boost': s_boost(),
        'lift': s_lift(), 'land': s_land(), 'swap': s_swap(), 'hover': s_hover(),
        'click': s_click(), 'nope': s_nope(),
    }
    only = [a for a in sys.argv[1:] if not a.startswith('-')]
    if only:
        sfx = {k: v for k, v in sfx.items() if k in only}
    total = 0
    for name, buf in sfx.items():
        size = write(name, buf, quality='1')
        total += size
        print(f'  sfx  {name:<10} {len(buf)/SR:5.2f}s  {size/1024:6.1f} kB')

    if only:
        return
    for maker in (earth_theme, luna_theme, cindra_theme, nerith_theme, vela_theme):
        name, l, r = maker()
        size = write(name, l, stereo=r, quality='0')
        total += size
        print(f'  mus  {name:<12} {len(l)/SR:5.2f}s  {size/1024:6.1f} kB')

    print(f'\ntotal {total/1024:.0f} kB in {OUT}')


if __name__ == '__main__':
    if subprocess.run(['which', 'ffmpeg'], capture_output=True).returncode != 0:
        sys.exit('ffmpeg is required to encode the .ogg files')
    main()
