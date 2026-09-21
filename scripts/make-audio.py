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


def s_pop(pitch=1.0):
    """An item landing: one round kalimba note, no fizz."""
    body = kalimba(note(4) * pitch, 0.3)
    air = lowpass_fast(noise(0.04), 2200) * expdecay(int(SR * 0.04), 0.012)
    return master(mixdown([(0, body, 0.8), (0, air, 0.1)], 0.34), 0.6)


def s_merge(tier):
    """Two marimba notes a fourth apart, climbing a pentatonic step per tier,
       with a soft bell an octave up. Warm, short, never shrill."""
    PENT = [0, 2, 4, 7, 9]
    root = PENT[(tier - 1) % 5] + 12 * ((tier - 1) // 5)
    dur = 0.7
    parts = []
    for k, (off, at) in enumerate([(0, 0.0), (7, 0.07)]):
        f = note(root + off)
        parts.append((at, marimba(f, 0.55, soft=0.35), 0.62))
        parts.append((at, kalimba(f * 2, 0.4) * 0.5, 0.2))
    parts.append((0.03, marimba(note(root - 12), 0.4, soft=0.9), 0.2))
    return master(reverb(mixdown(parts, dur), 0.28, 0.2), 0.72)


def s_coin():
    """Two kalimba notes up a fifth — coins without the cash-register clang."""
    parts = [(0, kalimba(note(12), 0.4), 0.75),
             (0.055, kalimba(note(19), 0.45), 0.6)]
    return master(reverb(mixdown(parts, 0.5), 0.22, 0.2), 0.6)


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
          shake=None, reverb_mix=0.34, cut=1600, mel_oct=12):
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
        add(at * beat, sig, 0.3, 0.5 + 0.1 * math.sin(at * 1.7))

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
    return music('music_earth', 82, 8, chords, mel, pad_gain=0.2,
                 arp=(0, 2, 1, 2), arp_gain=0.15, shake=[1, 3], reverb_mix=0.3)


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
    return music('music_luna', 64, 8, chords, mel, pad_gain=0.26, lead='kalimba',
                 arp=(0, None, 2, None), arp_gain=0.12, arp_oct=24,
                 shake=None, reverb_mix=0.46, cut=1300)


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
    return music('music_cindra', 76, 8, chords, mel, pad_gain=0.22,
                 arp=(0, 1, 2, 1), arp_gain=0.15, shake=[2], reverb_mix=0.34, cut=1450)


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
    return music('music_nerith', 62, 8, chords, mel, pad_gain=0.27, lead='kalimba',
                 arp=(0, None, 2, 1), arp_gain=0.13, arp_oct=12,
                 shake=None, reverb_mix=0.48, cut=1250)


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
    return music('music_vela', 70, 8, chords, mel, pad_gain=0.25, lead='kalimba',
                 arp=(0, 2, 3, 2), arp_gain=0.14, arp_oct=24,
                 shake=[1.5, 3.5], reverb_mix=0.44, cut=1700)


# --------------------------------------------------------------------- main
def main():
    sfx = {
        'tap': s_tap(),
        'pop': s_pop(1.0),
        'pop_hi': s_pop(1.25),
        'merge1': s_merge(1), 'merge2': s_merge(2), 'merge3': s_merge(3),
        'merge4': s_merge(4), 'merge5': s_merge(5),
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
    }
    total = 0
    for name, buf in sfx.items():
        size = write(name, buf, quality='1')
        total += size
        print(f'  sfx  {name:<10} {len(buf)/SR:5.2f}s  {size/1024:6.1f} kB')

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
