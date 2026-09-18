/* AUDIO — a small WebAudio mixer over the generated .ogg pack in src/audio/.

   Everything is one-shot buffers plus two music beds on their own gain nodes, so
   effects and music can be muted independently. Files are produced by
   `python3 scripts/make-audio.py`; see that script for how each sound is made.

   The engine never throws at a call site: if the context cannot start (autoplay
   policy, decode failure, a browser without WebAudio) every method is a no-op
   and the game plays on in silence. */

const urls = import.meta.glob('./audio/*.ogg', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

const SRC: Record<string, string> = {};
for (const path in urls) {
  const name = path.split('/').pop()!.replace('.ogg', '');
  SRC[name] = urls[path];
}

type Opts = { rate?: number; gain?: number; delay?: number };

class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private buffers: Record<string, AudioBuffer> = {};
  private loading: Record<string, Promise<AudioBuffer | null>> = {};
  private current: { name: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wanted: string | null = null;     // the bed that should be playing once we can
  private broken = false;
  sfxOn = true;
  musicOn = true;

  /** Safe to call as often as you like — only the first gesture does anything. */
  unlock() {
    if (this.broken) return;
    if (!this.ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) { this.broken = true; return; }
      try {
        this.ctx = new AC();
        this.master = this.ctx!.createGain(); this.master.gain.value = 0.9;
        this.sfxBus = this.ctx!.createGain(); this.sfxBus.gain.value = this.sfxOn ? 1 : 0;
        this.musicBus = this.ctx!.createGain(); this.musicBus.gain.value = this.musicOn ? 0.5 : 0;
        this.sfxBus.connect(this.master); this.musicBus.connect(this.master);
        this.master.connect(this.ctx!.destination);
      } catch { this.broken = true; return; }
      this.warm();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { });
    if (this.wanted) this.playMusic(this.wanted);
  }

  /** Pull every effect into memory in the background; music waits until asked. */
  private warm() {
    const names = Object.keys(SRC).filter(n => !n.startsWith('music_'));
    let i = 0;
    const step = () => {
      if (i >= names.length) return;
      this.buffer(names[i++]).then(() => setTimeout(step, 16));
    };
    step();
  }

  private async buffer(name: string): Promise<AudioBuffer | null> {
    if (this.buffers[name]) return this.buffers[name];
    if (!this.ctx || !SRC[name]) return null;
    if (!this.loading[name]) {
      this.loading[name] = (async () => {
        try {
          const res = await fetch(SRC[name]);
          const raw = await res.arrayBuffer();
          const buf = await this.ctx!.decodeAudioData(raw);
          this.buffers[name] = buf;
          return buf;
        } catch { return null; }
      })();
    }
    return this.loading[name];
  }

  /** Fire an effect. Unknown names, muted state and a dead context are all no-ops. */
  play(name: string, o: Opts = {}) {
    if (this.broken || !this.sfxOn) return;
    if (!this.ctx) { this.unlock(); if (!this.ctx) return; }
    const go = (buf: AudioBuffer | null) => {
      if (!buf || !this.ctx || !this.sfxOn) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = o.rate ?? 1;
      const g = this.ctx.createGain();
      g.gain.value = o.gain ?? 1;
      src.connect(g); g.connect(this.sfxBus);
      src.start(this.ctx.currentTime + (o.delay ?? 0));
      src.onended = () => { try { src.disconnect(); g.disconnect(); } catch { } };
    };
    const ready = this.buffers[name];
    if (ready) go(ready); else this.buffer(name).then(go);
  }

  /** Same sound, a touch of pitch drift so repeats never sound like a machine gun. */
  playVary(name: string, spread = 0.06, gain = 1) {
    this.play(name, { rate: 1 + (Math.random() * 2 - 1) * spread, gain });
  }

  /** Swap the music bed, crossfading out whatever is playing. Idempotent. */
  playMusic(name: string | null) {
    this.wanted = name;
    if (this.broken || !name) { if (!name) this.stopMusic(); return; }
    if (!this.ctx) return;                       // starts on the first gesture
    if (this.current && this.current.name === name) return;
    this.buffer(name).then(buf => {
      if (!buf || !this.ctx || this.wanted !== name) return;
      const now = this.ctx.currentTime;
      if (this.current) {
        const old = this.current;
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value, now);
        old.gain.gain.linearRampToValueAtTime(0, now + 1.1);
        try { old.src.stop(now + 1.2); } catch { }
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(1, now + 1.4);
      src.connect(g); g.connect(this.musicBus);
      src.start(now);
      this.current = { name, src, gain: g };
    });
  }

  stopMusic() {
    if (!this.ctx || !this.current) return;
    const now = this.ctx.currentTime, old = this.current;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.linearRampToValueAtTime(0, now + 0.6);
    try { old.src.stop(now + 0.7); } catch { }
    this.current = null;
  }

  /** Dip the music for a moment so a big effect lands. */
  duck(seconds = 1.4, to = 0.22) {
    if (!this.ctx || !this.musicOn) return;
    const now = this.ctx.currentTime, g = this.musicBus.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.5 * to, now + 0.12);
    g.linearRampToValueAtTime(0.5, now + seconds);
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.value = on ? 1 : 0;
  }
  setMusic(on: boolean) {
    this.musicOn = on;
    if (!this.ctx) return;
    this.musicBus.gain.value = on ? 0.5 : 0;
    if (on && this.wanted && !this.current) this.playMusic(this.wanted);
  }
}

export const audio = new Audio();

if (import.meta.env.DEV) (window as any).__audio = audio;   // test hook, dev builds only

/* The browser only lets an AudioContext start inside a gesture, and it suspends
   the context when the tab is hidden — both handled here so no call site has to. */
if (typeof window !== 'undefined') {
  const kick = () => audio.unlock();
  ['pointerdown', 'touchstart', 'keydown'].forEach(e =>
    window.addEventListener(e, kick, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) audio.unlock();
  });
}
