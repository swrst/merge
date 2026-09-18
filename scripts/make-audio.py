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
    body = sine(720, 0.06) * env(int(SR * 0.06), 0.001, 0.05)
    click = lowpass_fast(noise(0.02), 5000) * expdecay(int(SR * 0.02), 0.006)
    return master(mixdown([(0, body, 0.5), (0, click, 0.35)], 0.09), 0.6)


def s_pop(pitch=1.0):
    f = 540 * pitch
    n = int(SR * 0.16)
    sweep = np.sin(2 * np.pi * np.cumsum(np.linspace(f * 0.75, f * 1.5, n)) / SR)
    body = sweep * env(n, 0.004, 0.14)
    air = lowpass_fast(noise(0.05), 3000) * expdecay(int(SR * 0.05), 0.02)
    return master(mixdown([(0, body, 0.8), (0, air, 0.18)], 0.2), 0.75)


def s_merge(tier):
    """Two notes up a fourth, brighter and higher for each tier you climb."""
    base = note(-5 + tier * 2)
    dur = 0.45
    parts = []
    for k, (off, tt) in enumerate([(0, 0.0), (5, 0.055)]):
        f = base * (SEMI ** off)
        body = harm(f, 0.3, (1.0, 0.5, 0.25, 0.1)) * env(int(SR * 0.3), 0.004, 0.09, 0.32, 0.16, 0.03)
        bell = fm_bell(f * 2, 0.3, ratio=1.41, index=3.2, tau=0.14)
        parts.append((tt, body, 0.55))
        parts.append((tt, bell, 0.22))
    spark = lowpass_fast(noise(0.18), 9000) * expdecay(int(SR * 0.18), 0.05)
    parts.append((0.05, highpass_fast(spark, 2500), 0.12))
    return master(reverb(mixdown(parts, dur), 0.22, 0.18), 0.85)


def s_coin():
    parts = []
    for i, f in enumerate([note(12), note(19)]):
        parts.append((i * 0.045, fm_bell(f, 0.32, ratio=3.1, index=4.0, tau=0.12), 0.7))
    return master(reverb(mixdown(parts, 0.4), 0.2, 0.2), 0.7)


def s_sell():
    parts = [(0, fm_bell(note(14), 0.3, 3.1, 4, 0.1), 0.6),
             (0.05, fm_bell(note(7), 0.3, 3.1, 4, 0.12), 0.5)]
    swish = highpass_fast(noise(0.25), 1800) * expdecay(int(SR * 0.25), 0.07)
    parts.append((0, swish, 0.12))
    return master(mixdown(parts, 0.36), 0.7)


def s_levelup():
    """Major arpeggio with a shimmer on top — the big 'well done'."""
    parts = []
    for i, off in enumerate([0, 4, 7, 12, 16, 19]):
        f = note(off)
        parts.append((i * 0.075, harm(f, 0.7, (1, .45, .22, .1)) * env(int(SR * .7), .004, .12, .38, .3, .12), 0.4))
        parts.append((i * 0.075, fm_bell(f * 2, 0.6, 2.0, 3.0, 0.2), 0.16))
    shimmer = highpass_fast(noise(0.9), 5000) * np.concatenate(
        [np.linspace(0, 1, int(SR * .25)), expdecay(int(SR * .65), 0.3)])
    parts.append((0.15, shimmer, 0.09))
    return master(reverb(mixdown(parts, 1.5), 0.45, 0.3), 0.92)


def s_discover():
    """Rising magical glissando — a recipe cracked."""
    parts = []
    scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]
    for i, off in enumerate(scale):
        parts.append((i * 0.045, fm_bell(note(off + 7), 0.5, 2.4, 4.5, 0.18), 0.32))
    pad = harm(note(7), 1.2, (1, .5, .3)) * env(int(SR * 1.2), .2, .3, .5, .6, .1)
    parts.append((0.1, pad, 0.2))
    return master(reverb(mixdown(parts, 1.6), 0.5, 0.34), 0.9)


def s_install():
    """Metal plate seating into place, with a servo whine."""
    n = int(SR * 0.5)
    clunk = lowpass_fast(noise(0.5), 900) * expdecay(n, 0.05)
    thud = sine(90, 0.5) * expdecay(n, 0.09)
    ring = fm_bell(440, 0.5, 1.7, 5, 0.16)
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
    parts = []
    for i in range(3):
        n = int(SR * 0.22)
        hit = (lowpass_fast(noise(0.22), 1400) * expdecay(n, 0.035) * 0.8
               + sine(180 - i * 20, 0.22) * expdecay(n, 0.05))
        parts.append((i * 0.17, hit, 0.8))
    for i, off in enumerate([12, 16, 19, 24]):
        parts.append((0.55 + i * 0.06, fm_bell(note(off), 0.6, 2.2, 4, 0.2), 0.3))
    return master(reverb(mixdown(parts, 1.4), 0.4, 0.28), 0.9)


def s_streak(step=0):
    f = note(7 + step * 2)
    return master(mixdown([(0, fm_bell(f * 2, 0.25, 2.0, 3.0, 0.09), 0.8)], 0.3), 0.6)


def s_bag():
    zip_ = highpass_fast(noise(0.18), 2000) * expdecay(int(SR * 0.18), 0.05)
    thump = sine(150, 0.15) * expdecay(int(SR * 0.15), 0.04)
    return master(mixdown([(0, zip_, 0.4), (0.02, thump, 0.5)], 0.25), 0.6)


def s_boost():
    n = int(SR * 0.7)
    rise = np.sin(2 * np.pi * np.cumsum(np.linspace(300, 1500, n)) / SR) * env(n, 0.02, 0.2, 0.5, 0.3, 0.1)
    spark = highpass_fast(noise(0.7), 4000) * expdecay(n, 0.18)
    bell = fm_bell(note(19), 0.7, 2.4, 5, 0.22)
    return master(reverb(mixdown([(0, rise, 0.4), (0, spark, 0.2), (0.25, bell, 0.5)], 0.9), 0.35, 0.25), 0.85)


# -------------------------------------------------------------------- music
def music(name, bpm, bars, chords, lead, bass_oct=-24, pad_gain=0.18,
          lead_inst='pluck', drum=None, swing=0.0, reverb_mix=0.3):
    """Build a loopable stereo bed: pad chords, a bass note per bar, a melody."""
    beat = 60.0 / bpm
    dur = beat * 4 * bars
    L, R = [], []

    def add(side, start, sig, gain):
        side.append((start, sig, gain))

    for b in range(bars):
        ch = chords[b % len(chords)]
        t0 = b * beat * 4
        # pad: the chord held across the bar, slightly detuned between channels
        for i, off in enumerate(ch):
            f = note(off)
            p = harm(f, beat * 4, (1, .5, .28, .12)) * env(int(SR * beat * 4), .35, .5, .6, .6, beat * 2)
            add(L, t0, p, pad_gain * (1.0 if i % 2 == 0 else 0.8))
            p2 = harm(f * 1.003, beat * 4, (1, .5, .28, .12)) * env(int(SR * beat * 4), .38, .5, .6, .6, beat * 2)
            add(R, t0, p2, pad_gain * (0.8 if i % 2 == 0 else 1.0))
        # bass
        bf = note(ch[0] + bass_oct)
        bs = harm(bf, beat * 1.6, (1, .3, .12)) * env(int(SR * beat * 1.6), .01, .3, .4, .4, .2)
        add(L, t0, bs, 0.3); add(R, t0, bs, 0.3)
        add(L, t0 + beat * 2, bs, 0.2); add(R, t0 + beat * 2, bs, 0.2)
        if drum:
            for d in drum:
                n = int(SR * 0.16)
                k = lowpass_fast(noise(0.16), 220) * expdecay(n, 0.05) + sine(70, 0.16) * expdecay(n, 0.07)
                add(L, t0 + d * beat, k, 0.28); add(R, t0 + d * beat, k, 0.28)

    for (start, off, ln, gain) in lead:
        f = note(off)
        if lead_inst == 'pluck':
            sig = pluck(f, ln, damp=0.55, bright=0.35) * env(int(SR * ln), .003, .1, .5, .35, ln * 0.4)
        elif lead_inst == 'bell':
            sig = fm_bell(f, ln, 2.0, 3.0, ln * 0.4)
        else:
            sig = harm(f, ln, (1, .4, .2)) * env(int(SR * ln), .02, .15, .5, .3, ln * 0.4)
        pan = 0.5 + 0.18 * math.sin(start * 1.7)
        add(L, start * beat, sig, gain * (1 - pan) * 2 * 0.5)
        add(R, start * beat, sig, gain * pan * 2 * 0.5)

    left = reverb(mixdown(L, dur), 0.55, reverb_mix)
    right = reverb(mixdown(R, dur), 0.6, reverb_mix)
    # wrap the reverb tail back to the head so the loop has no seam
    wrap = int(SR * 0.9)
    for side in (left, right):
        side[:wrap] += side[-wrap:] * np.linspace(1, 0, wrap) * 0.55
    peak = max(np.max(np.abs(left)), np.max(np.abs(right)), 1e-9)
    left = np.tanh(left / peak * 0.85) * 0.82
    right = np.tanh(right / peak * 0.85) * 0.82
    return name, left, right


def earth_theme():
    # bouncy, major, ukulele-ish — a sunny meadow
    chords = [[0, 4, 7], [-3, 2, 5], [-5, -1, 2], [-1, 3, 7]]
    mel = [0, 4, 7, 4, 9, 7, 4, 2, 0, 4, 7, 12, 9, 7, 4, 7]
    lead = []
    for i, off in enumerate(mel):
        lead.append((i * 1.0 + (0.5 if i % 4 == 3 else 0), off + 12, 0.55, 0.30))
    return music('music_earth', 104, 4, chords, lead, pad_gain=0.15,
                 lead_inst='pluck', drum=[0, 2.5], reverb_mix=0.26)


def luna_theme():
    # weightless, modal, bells — the moon
    chords = [[-3, 2, 7, 11], [-5, 0, 5, 9], [-8, -1, 4, 7], [-3, 2, 6, 11]]
    mel = [11, 9, 7, 9, 11, 14, 11, 9, 7, 4, 7, 9, 11, 9, 7, 4]
    lead = [(i * 1.0, off + 12, 1.1, 0.22) for i, off in enumerate(mel)]
    return music('music_luna', 76, 4, chords, lead, pad_gain=0.22,
                 lead_inst='bell', drum=None, reverb_mix=0.42)


def cindra_theme():
    # hot, driving, minor — the volcano world
    chords = [[-5, -1, 2, 7], [-7, -3, 0, 5], [-10, -5, -1, 2], [-5, -1, 3, 7]]
    mel = [7, 5, 3, 5, 7, 10, 7, 5, 3, 2, 3, 5, 7, 10, 12, 10]
    lead = [(i * 1.0, off + 12, 0.6, 0.26) for i, off in enumerate(mel)]
    return music('music_cindra', 122, 4, chords, lead, pad_gain=0.17,
                 lead_inst='pluck', drum=[0, 1.5, 2, 3.5], reverb_mix=0.3)


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

    for maker in (earth_theme, luna_theme, cindra_theme):
        name, l, r = maker()
        size = write(name, l, stereo=r, quality='2')
        total += size
        print(f'  mus  {name:<12} {len(l)/SR:5.2f}s  {size/1024:6.1f} kB')

    print(f'\ntotal {total/1024:.0f} kB in {OUT}')


if __name__ == '__main__':
    if subprocess.run(['which', 'ffmpeg'], capture_output=True).returncode != 0:
        sys.exit('ffmpeg is required to encode the .ogg files')
    main()
