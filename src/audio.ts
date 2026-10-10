/* AUDIO — a small WebAudio mixer over the generated .ogg pack in src/audio/.

   Everything is one-shot buffers plus two music beds on their own gain nodes, so
   effects and music can be muted independently. Files are produced by
   `python3 scripts/make-sound.py`; see that script for how each sound is made.

   The engine never throws at a call site: if the context cannot start (autoplay
   policy, decode failure, a browser without WebAudio) every method is a no-op
   and the game plays on in silence. */

/** music sits well under the effects: it is a bed, not a soundtrack */
const MUSIC_VOL = 0.3;
/** the ambience bed sits under the music, and alone in the quiet stretches */
const AMB_VOL = 0.32;

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
        this.musicBus = this.ctx!.createGain(); this.musicBus.gain.value = this.musicOn ? MUSIC_VOL : 0;
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
    const names = Object.keys(SRC).filter(n => !n.startsWith('music_') && !n.startsWith('amb_'));
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
  private lastAt: Record<string, number> = {};
  play(name: string, o: Opts = {}) {
    if (this.broken || !this.sfxOn) return;
    // a menu button already clicked; the screen's own tap on top of it is just mud
    const now = performance.now();
    if ((name === 'tap' || name === 'click') && now - (this.lastAt.click || -1e9) < 90) return;
    this.lastAt[name] = now;
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

  /* ------------------------------------------------------------ the music
     A world has four phrases (music_<w>_1..4) and an ambience loop (amb_<w>).
     The director plays a phrase, sometimes a second one, then lets the
     ambience carry alone for a while, then picks a different phrase. Nothing
     repeats back to back, and the quiet stretches are what stop it grating.
     Older single-loop beds (music_<w>) still work if that is all there is. */
  private world: string | null = null;
  private amb: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private phraseTimer: any = 0;
  private lastPhrase = '';
  private tail: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private runLeft = 0;
  playMusic(name: string | null) {
    this.wanted = name;
    if (this.broken || !name) { if (!name) this.stopMusic(); return; }
    if (!this.ctx) return;                       // starts on the first gesture
    const w = name.replace(/^music_/, '');
    if (this.world === w) return;
    this.stopMusic();
    this.world = w;
    const phrases = Object.keys(SRC).filter(n => n.startsWith('music_' + w + '_'));
    if (!phrases.length && SRC[name]) { this.loopOne(name); return; }
    this.startAmb('amb_' + w);
    this.runLeft = 1 + (Math.random() < 0.5 ? 1 : 0);
    clearTimeout(this.phraseTimer);
    this.phraseTimer = setTimeout(() => this.nextPhrase(w, phrases), 2500);
  }
  private nextPhrase(w: string, phrases: string[]) {
    if (this.world !== w || !this.ctx) return;
    const pool = phrases.filter(p => p !== this.lastPhrase);
    const pick = pool[Math.floor(Math.random() * pool.length)] || phrases[0];
    this.lastPhrase = pick;
    this.buffer(pick).then(buf => {
      if (!buf || !this.ctx || this.world !== w) return;
      const now = this.ctx.currentTime, src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      // phrases fade in and out on their own, so they overlap into one long drift
      src.buffer = buf; g.gain.setValueAtTime(1, now);
      src.connect(g); g.connect(this.musicBus); src.start(now);
      this.tail = this.current;
      const prev = this.tail;
      if (prev) setTimeout(() => { try { prev.src.disconnect(); } catch { } if (this.tail === prev) this.tail = null; }, 9000);
      this.current = { name: pick, src, gain: g };
      // after this phrase: another one (crossfaded), or a quiet stretch with just the ambience
      this.runLeft--;
      const rest = this.runLeft > 0 ? -6000 : 4000 + Math.random() * 8000;
      if (this.runLeft <= 0) this.runLeft = 2 + (Math.random() < 0.5 ? 1 : 0);
      clearTimeout(this.phraseTimer);
      this.phraseTimer = setTimeout(() => this.nextPhrase(w, phrases), buf.duration * 1000 + rest);
    });
    // the next one loads in the background while this one plays
    phrases.forEach(p => this.buffer(p));
  }
  private startAmb(name: string) {
    if (!SRC[name]) return;
    this.buffer(name).then(buf => {
      if (!buf || !this.ctx || 'amb_' + this.world !== name) return;
      const now = this.ctx.currentTime, src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = buf; src.loop = true;
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(AMB_VOL, now + 3);
      src.connect(g); g.connect(this.musicBus); src.start(now);
      this.amb = { src, gain: g };
    });
  }
  private loopOne(name: string) {
    this.buffer(name).then(buf => {
      if (!buf || !this.ctx || this.wanted !== name) return;
      const now = this.ctx.currentTime, src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = buf; src.loop = true;
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + 1.4);
      src.connect(g); g.connect(this.musicBus); src.start(now);
      this.current = { name, src, gain: g };
    });
  }

  stopMusic() {
    clearTimeout(this.phraseTimer);
    this.world = null;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [this.current, this.amb, this.tail].forEach(o => {
      if (!o) return;
      o.gain.gain.cancelScheduledValues(now);
      o.gain.gain.setValueAtTime(o.gain.gain.value, now);
      o.gain.gain.linearRampToValueAtTime(0, now + 0.8);
      try { o.src.stop(now + 0.9); } catch { }
    });
    this.current = null; this.amb = null; this.tail = null;
  }

  /** Dip the music for a moment so a big effect lands. */
  duck(seconds = 1.4, to = 0.22) {
    if (!this.ctx || !this.musicOn) return;
    const now = this.ctx.currentTime, g = this.musicBus.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(MUSIC_VOL * to, now + 0.12);
    g.linearRampToValueAtTime(MUSIC_VOL, now + seconds);
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.value = on ? 1 : 0;
  }
  setMusic(on: boolean) {
    this.musicOn = on;
    if (!this.ctx) return;
    this.musicBus.gain.value = on ? MUSIC_VOL : 0;
    if (on && this.wanted && !this.world) this.playMusic(this.wanted);
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
