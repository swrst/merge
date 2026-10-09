/* Pixi-rendered merge board.
   The game logic never touches sprites: it calls sync()/anim*() and reads cell
   geometry. Art comes from the existing SVG set, rasterised once into textures. */
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import gsap from 'gsap';
import { ART } from './art';
import { ITEMS, CHAINS, PRODUCERS } from './content';

export type Cell = { f?: string; b?: number; p?: string; id?: string; ch?: number; at?: number; bub?: string; until?: number; tmp?: number; pr?: number } | null;

export type Hooks = {
  onTap: (i: number) => void;
  onDrop: (from: number, to: number) => void;
  dropKind: (from: number, to: number) => 'merge' | 'move' | 'swap' | null;
  canDrag: (i: number) => boolean;
  /** every tile the dragged item could merge with, so they can glow */
  matches?: (from: number) => number[];
  /** the item left the board under the finger */
  onLift?: (i: number) => void;
  /** the finger moved over a new drop target */
  onHover?: (kind: 'merge' | 'move' | 'swap' | null) => void;
};

/* Two tile colours per world, laid out as a checkerboard the way every game in
   this genre does it — it reads as a surface you put things on rather than a
   grid of separate buttons. */
const THEME: Record<string, { tile: number; tileLo: number; lock: number; lockLo: number; txt: number }> = {
  earth: { tile: 0xf7e2b6, tileLo: 0xe9cd97, lock: 0xd8bc8b, lockLo: 0xccad7b, txt: 0x8a6a3c },
  luna: { tile: 0xe6e0f7, tileLo: 0xd0c7e8, lock: 0xbfb6da, lockLo: 0xb0a6cf, txt: 0x5a4f86 },
  cindra: { tile: 0xf5d8b2, tileLo: 0xe6c094, lock: 0xd5a178, lockLo: 0xc79167, txt: 0x8a4a2a },
  nerith: { tile: 0xd8f0f7, tileLo: 0xbfe2ed, lock: 0xa3cedb, lockLo: 0x92c2d1, txt: 0x2f6e80 },
  vela: { tile: 0xe9ddfa, tileLo: 0xd5c6f0, lock: 0xbdaade, lockLo: 0xae9bd4, txt: 0x5b4b95 },
};
/** an unknown world falls back to Earth rather than throwing mid-landing */
const themeOf = (k: string) => THEME[k] || THEME.earth;

const TEX = 168;                              // texture resolution per tile art

type Slot = {
  key: string;
  art?: Sprite;
  badge?: Container;
  /** the charge battery under a producer, and the numbers it was last drawn for */
  bar?: Container;
  barW?: number;
  barFrac?: number;
  timer?: Text;
  ring?: Graphics;
  idle?: gsap.core.Tween;
  /** a merge landing that has not happened yet — killed if the slot is cleared first,
   *  otherwise it would repaint a tile the game has already emptied (rocket parts, fuel) */
  pending?: gsap.core.Tween | { kill(): void };
  /** halo and orbiting motes behind a rare item */
  aura?: Graphics;
  spin?: Graphics;
};

class PixiBoard {
  app!: Application;
  host!: HTMLElement;
  hooks!: Hooks;
  cols = 6; rows = 8; cell = 50; gap = 5;
  ox = 0; oy = 0;                              // grid origin inside the canvas
  root = new Container();
  lTile = new Container();
  lItem = new Container();
  lFx = new Container();
  lDrag = new Container();
  tiles: Graphics[] = [];
  tileArt: Sprite[] = [];                      // painted tiles (ui/tile_*.png), when there are any
  slots: Slot[] = [];
  theme: string = 'earth';
  private tex: Record<string, Texture> = {};
  private drag: any = null;
  private ready = false;
  private laying = false;

  async init(host: HTMLElement, cols: number, rows: number, hooks: Hooks) {
    this.host = host; this.cols = cols; this.rows = rows; this.hooks = hooks;
    this.app = new Application();
    await this.app.init({
      resizeTo: host, backgroundAlpha: 0, antialias: true,
      resolution: Math.min((window.devicePixelRatio || 1) * ((window as any).__zk || 1), 3.5), autoDensity: true,
    });
    host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';
    this.root.addChild(this.lTile, this.lItem, this.lFx, this.lDrag);
    this.app.stage.addChild(this.root);

    for (let i = 0; i < cols * rows; i++) {
      const art = new Sprite(Texture.EMPTY);
      art.visible = false;
      const g = new Graphics();
      this.lTile.addChild(art, g);
      this.tileArt.push(art);
      this.tiles.push(g);
      this.slots.push({ key: '' });
    }
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerdown', this.down);
    this.app.stage.on('pointermove', this.move);
    this.app.stage.on('pointerup', this.up);
    this.app.stage.on('pointerupoutside', this.up);
    this.app.renderer.on('resize', () => this.layout());
    if ('ResizeObserver' in window) new ResizeObserver(() => this.layout()).observe(host);
    this.ready = true;
    this.layout();
    if (import.meta.env.DEV) (window as any).__board = this;   // test hook, dev builds only
  }

  /* ------------------------------------------------------------ textures */
  /** a painted sprite: load the file itself, no rasterising involved */
  private fromUrl(url: string): Promise<Texture> {
    return new Promise(res => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      // Redraw at the same size as the generated art. The pop and bob tweens
      // animate scale towards 1, which assumes every texture is TEX wide; a
      // 512px painted file left as-is would balloon to 512px on the board.
      img.onload = () => {
        try {
          const n = TEX;
          const cv = document.createElement('canvas');
          cv.width = cv.height = n;
          const ctx = cv.getContext('2d');
          if (!ctx) return res(Texture.EMPTY);
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, n, n);
          res(Texture.from(cv));
        } catch { res(Texture.EMPTY); }
      };
      img.onerror = () => res(Texture.EMPTY);
      img.src = url;
    });
  }
  private rasterise(svg: string): Promise<Texture> {
    return new Promise(res => {
      // inline SVG in the DOM inherits its namespace; a data: URL does not, so add it
      const sized = svg.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${TEX}" height="${TEX}" `);
      const img = new Image();
      img.onload = () => {
        try {
          const cv = document.createElement('canvas');
          cv.width = cv.height = TEX;
          const ctx = cv.getContext('2d');
          if (!ctx) return res(Texture.EMPTY);
          ctx.drawImage(img, 0, 0, TEX, TEX);
          res(Texture.from(cv));
        } catch (e) { res(Texture.EMPTY); }
      };
      img.onerror = () => res(Texture.EMPTY);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
    });
  }
  async preload(itemIds: string[], producerArts: string[]) {
    const jobs: Promise<void>[] = [];
    // a painted file loads as itself; everything else is drawn from its spec
    const add = (key: string, svg: string, url?: string) => {
      if (this.tex[key]) return;
      jobs.push((url ? this.fromUrl(url) : this.rasterise(svg)).then(t => { this.tex[key] = t; }));
    };
    itemIds.forEach(id => add('i:' + id, ART.item(id), ART.spriteItem(id)));
    producerArts.forEach(a => add('p:' + a, ART.producer(a), ART.spriteProducer(a)));
    ['earth', 'luna', 'cindra'].forEach(w => add('w:' + w, ART.weed(w)));
    add('coin', ART.iconSvg('coin'), ART.spriteUi('icon_coin') || undefined);
    // shared tiles, plus each world's own set when it has been painted (tile_light_luna …)
    const tiles = ['tile_light', 'tile_dark', 'tile_locked'];
    [...tiles, 'bubble_film', 'meteor', 'ic_star_tag', ...Object.keys(THEME).flatMap(w => tiles.map(t => t + '_' + w))].forEach(k => {
      const url = ART.spriteUi(k); if (url) add('ui:' + k, '', url);
    });
    await Promise.all(jobs);
  }
  /** Load the rest a few at a time, only when the browser is idle, so the
   *  first minutes of play (and the intro's animations) never stutter. */
  async preloadIdle(itemIds: string[], producerArts: string[]) {
    const jobs: [string, string, string?][] = [];
    itemIds.forEach(id => { if (!this.tex['i:' + id]) jobs.push(['i:' + id, ART.item(id), ART.spriteItem(id) || undefined]); });
    producerArts.forEach(a => { if (!this.tex['p:' + a]) jobs.push(['p:' + a, ART.producer(a), ART.spriteProducer(a) || undefined]); });
    const idle = () => new Promise<void>(res => {
      const w = window as any;
      if (w.requestIdleCallback) w.requestIdleCallback(() => res(), { timeout: 400 }); else setTimeout(res, 40);
    });
    for (let k = 0; k < jobs.length; k += 4) {
      await idle();
      await Promise.all(jobs.slice(k, k + 4).map(([key, svg, url]) => {
        if (this.tex[key]) return null;
        return (url ? this.fromUrl(url) : this.rasterise(svg)).then(t => { this.tex[key] = t; });
      }));
    }
  }
  /** forget any slot drawn before its texture had loaded, so the next sync()
   *  draws it again with the real one */
  unstale() {
    this.slots.forEach(s => { if (s.art && (s.art as any).texture === Texture.EMPTY) s.key = ''; });
  }
  private texture(key: string): Texture {
    if (!this.tex[key]) this.need(key);
    return this.tex[key] || Texture.EMPTY;
  }
  /* Something landed on the board before the idle loader got to its art (an
     event visitor, a fresh chain): fetch that one now, then redraw whatever was
     drawn blank. Without this a producer could sit there invisible for a minute. */
  private wanting = new Set<string>();
  private lastCells: Cell[] | null = null;
  private need(key: string) {
    if (this.wanting.has(key)) return;
    const [kind, id] = [key.slice(0, 2), key.slice(2)];
    let job: Promise<Texture> | null = null;
    if (kind === 'i:') { const u = ART.spriteItem(id); job = u ? this.fromUrl(u) : this.rasterise(ART.item(id)); }
    else if (kind === 'p:') { const u = ART.spriteProducer(id); job = u ? this.fromUrl(u) : this.rasterise(ART.producer(id)); }
    if (!job) return;
    this.wanting.add(key);
    job.then(t => {
      this.wanting.delete(key);
      if (this.tex[key]) return;
      this.tex[key] = t;
      if (t === Texture.EMPTY) return;
      this.unstale();
      if (this.lastCells) this.sync(this.lastCells);
    });
  }

  /* A blank board is the worst bug this game can have, and there are two ways
     to get one: a shake tween killed half-way through leaves the whole grid
     parked off-screen, and a canvas that was measured while its panel had no
     height stays that size until the next resize event that may never come.
     The game ticks this twice a second; it costs nothing and it cannot get
     stuck. */
  heal() {
    if (!this.ready) return;
    const r = this.root as any;
    if (!gsap.isTweening(r) && (r.x !== 0 || r.y !== 0)) { r.x = 0; r.y = 0; }
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (w > 60 && h > 60
      && (Math.abs(this.app.screen.width - w) > 2 || Math.abs(this.app.screen.height - h) > 2)) this.layout();
  }

  /* -------------------------------------------------------------- layout */
  layout() {
    if (!this.ready || this.laying) return;
    this.laying = true;
    const gap = this.gap;
    // The host is a flex child, so CSS has already worked out how much room is
    // left after the HUD, the order row and the dock. Measure it and take the
    // smaller of the two fits — the grid then cannot spill past the panel, and
    // no arithmetic here has to know what else is on screen.
    const w = Math.max(120, this.host.clientWidth);
    const h = Math.max(120, this.host.clientHeight);
    const cellW = Math.floor((w - gap * (this.cols - 1)) / this.cols);
    const cellH = Math.floor((h - gap * (this.rows - 1)) / this.rows);
    this.cell = Math.max(18, Math.min(cellW, cellH));
    const gw = this.cols * this.cell + gap * (this.cols - 1);
    const gh = this.rows * this.cell + gap * (this.rows - 1);
    if (Math.abs(this.app.screen.width - w) > 1 || Math.abs(this.app.screen.height - h) > 1) {
      this.app.renderer.resize(w, h);           // Pixi only self-measures on window resize
    }
    this.ox = Math.round((w - gw) / 2);
    this.oy = Math.round((h - gh) / 2);
    for (let i = 0; i < this.tiles.length; i++) this.drawTile(i);
    for (let i = 0; i < this.slots.length; i++) this.placeSlot(i);
    this.placeTags();
    this.laying = false;
  }
  pos(i: number) {
    const c = i % this.cols, r = Math.floor(i / this.cols);
    return { x: this.ox + c * (this.cell + this.gap), y: this.oy + r * (this.cell + this.gap) };
  }
  center(i: number) {
    const p = this.pos(i);
    return { x: p.x + this.cell / 2, y: p.y + this.cell / 2 };
  }
  /** cell centre in page coordinates, for DOM effects */
  clientCenter(i: number) {
    const r = this.app.canvas.getBoundingClientRect();
    const c = this.center(i), k = this.zoom(r);
    return { x: r.left + c.x * k, y: r.top + c.y * k };
  }
  /** the page is CSS-zoomed to fit the device: page pixels per canvas pixel */
  zoom(r: DOMRect) { const w = this.app.canvas.clientWidth; return w ? r.width / w : 1; }
  setTheme(t: string) { this.theme = THEME[t] ? t : 'earth'; this.layout(); }
  /** the on-canvas size of one tile, for anything that has to draw over us */
  cellSize() { return this.cell; }

  /** how precious the thing on this tile is: 0 none, 1 good, 2 rare, 3 legendary */
  private rarity(i: number): number {
    const k = this.slots[i]?.key;
    if (!k || !k.startsWith('i')) return 0;
    const d = ITEMS[k.slice(1)];
    if (!d) return 0;
    if (d.chain === 'relic' || d.chain === 'wild') return 3;
    // Relative to the chain, not an absolute tier: chains run 4 to 8 steps, and
    // the painted art already shows its own climb. Only the crown and the step
    // below it get a frame, so a busy board still reads calm.
    const len = (CHAINS[d.chain]?.items.length) || 7;
    if (d.tier >= len) return 3;
    if (d.tier === len - 1 && len >= 5) return 2;
    return 0;
  }
  private drawTile(i: number) {
    const g = this.tiles[i], p = this.pos(i), c = this.cell, th = THEME[this.theme];
    const locked = this.slots[i] && (this.slots[i].key.startsWith('b') || this.slots[i].key.startsWith('f'));
    const r = locked ? 0 : this.rarity(i);
    const R = c * 0.16;
    // a checkerboard, not a grid of buttons: the two tones alternate and the
    // tiles touch, so the board reads as one warm surface
    const dark = ((i % this.cols) + ((i / this.cols) | 0)) % 2 === 1;
    g.clear();
    const art = this.tileArt[i];
    const kind = locked ? 'tile_locked' : dark ? 'tile_dark' : 'tile_light';
    const paint = this.tex['ui:' + kind + '_' + this.theme] || this.tex['ui:' + kind]
      || (locked ? undefined : this.tex['ui:tile_light_' + this.theme] || this.tex['ui:tile_light']);
    if (art) art.visible = !!paint;
    if (paint && art) {
      // a painted tile carries its own light and shade; only the rarity frame is drawn over it
      art.texture = paint; art.position.set(p.x, p.y); art.width = c; art.height = c;
      if (this.slots[i] && this.slots[i].key.startsWith('u')) g.roundRect(p.x + 2, p.y + 2, c - 4, c - 4, R).fill({ color: 0x7cc8ff, alpha: 0.35 });
      if (this.wanted.has(i)) g.roundRect(p.x + 2, p.y + 2, c - 4, c - 4, R).fill({ color: 0xffd75e, alpha: 0.55 }).stroke({ color: 0xff9f1c, width: 3, alpha: 1 });
      if (r) {
        const col = r === 3 ? 0xffb02e : r === 2 ? 0xc78cff : 0x8fd6ff;
        g.roundRect(p.x + 1, p.y + 1, c - 2, c - 2, R - 1)
          .stroke({ color: col, alpha: r === 3 ? 0.95 : 0.65, width: r === 3 ? 3 : 2.2 });
      }
      return;
    }
    g.roundRect(p.x, p.y, c, c, R)
      .fill({ color: locked ? (dark ? th.lockLo : th.lock) : (dark ? th.tileLo : th.tile) });
    if (this.slots[i] && this.slots[i].key.startsWith('u')) g.roundRect(p.x + 2, p.y + 2, c - 4, c - 4, R).fill({ color: 0x7cc8ff, alpha: 0.35 });
    if (this.wanted.has(i)) g.roundRect(p.x + 2, p.y + 2, c - 4, c - 4, R).fill({ color: 0xffd75e, alpha: 0.55 }).stroke({ color: 0xff9f1c, width: 3, alpha: 1 });
    if (!locked) {
      // one soft light from the top, one soft shade at the foot
      g.roundRect(p.x + c * 0.06, p.y + c * 0.05, c * 0.88, c * 0.2, c * 0.1)
        .fill({ color: 0xffffff, alpha: 0.28 });
      g.roundRect(p.x + c * 0.06, p.y + c * 0.76, c * 0.88, c * 0.18, c * 0.09)
        .fill({ color: 0x000000, alpha: 0.05 });
    } else {
      g.roundRect(p.x + c * 0.06, p.y + c * 0.06, c * 0.88, c * 0.88, R * 0.8)
        .fill({ color: 0x000000, alpha: 0.07 });
    }
    if (r) {
      // rarity frame: quietly gold for good, hot for legendary
      const col = r === 3 ? 0xffb02e : r === 2 ? 0xc78cff : 0x8fd6ff;
      g.roundRect(p.x + 1, p.y + 1, c - 2, c - 2, R - 1)
        .stroke({ color: col, alpha: r === 3 ? 0.95 : 0.65, width: r === 3 ? 3 : 2.2 });
    }
  }

  /* ---------------------------------------------------------------- sync */
  private keyOf(c: Cell) { return !c ? 'e' : c.f ? 'f' + c.f : c.b ? 'b' + c.b : c.bub ? 'u' + c.bub : c.p ? 'p' + c.p + (c.tmp ? '*' : '') : 'i' + c.id; }

  sync(cells: Cell[]) {
    if (this.slots.length < cells.length) return;       // not built yet: the first sync after init draws it
    this.lastCells = cells;
    for (let i = 0; i < cells.length; i++) {
      const key = this.keyOf(cells[i]);
      if (this.slots[i].key === key) continue;
      this.fill(i, cells[i], key);
    }
    for (let i = 0; i < cells.length; i++) this.drawTile(i);
  }
  /** replace a slot's contents immediately (no transition) */
  private fill(i: number, c: Cell, key?: string) {
    const s = this.slots[i];
    this.clearSlot(i);
    s.key = key ?? this.keyOf(c);
    if (!c) return;
    if (c.f) {
      // a sealed tile: the item sits inside, dimmed, waiting for its twin
      s.art = this.sprite('i:' + c.f, i, 0.72);
      s.art.alpha = 0.95; (s.art as any).tint = 0x6c7398;   // dark and dull until it is opened
      const p = this.center(i), g = new Graphics(), r = this.cell * 0.15;
      g.circle(0, 0, r).fill({ color: 0x2a3f8f }).stroke({ color: 0xffffff, width: 2 });
      g.roundRect(-r * 0.45, -r * 0.1, r * 0.9, r * 0.7, 2).fill({ color: 0xffe07a });
      g.arc(0, -r * 0.1, r * 0.32, Math.PI, 0).stroke({ color: 0xffe07a, width: 2 });
      g.position.set(p.x + this.cell * 0.3, p.y + this.cell * 0.3);
      this.lItem.addChild(g); s.timer = g as any;
      return;
    }
    if (c.b) {
      // a painted overgrown tile already carries its weeds
      s.art = this.sprite('w:' + this.theme, i, 0.78);
      s.art.alpha = 0; s.art.visible = false;   // every world has a painted locked tile now: no extra weeds on top
      const t = new Text({ text: 'lv' + c.b, style: { fontFamily: 'Fredoka, sans-serif', fontSize: this.cell * 0.22, fontWeight: '700', fill: 0xffffff, stroke: { color: 0x4b2a86, width: Math.max(2, this.cell * 0.05) } } });
      t.anchor.set(0.5);
      const p = this.center(i);
      t.position.set(p.x + this.cell * 0.28, p.y + this.cell * 0.3);
      this.lItem.addChild(t);
      s.timer = t;
    } else if (c.bub) {
      /* A bubble has to read as "not yours yet" from across the board: the
         item sits small and pale inside a bright soap film drawn ON TOP of it,
         the tile goes blue, and a gold price tag hangs off the bottom. */
      const p = this.center(i), R = this.cell * 0.46;
      s.art = this.sprite('i:' + c.bub, i, 0.66);
      s.art.alpha = 1;
      const film = new Container();
      const g = new Graphics();
      if (this.tex['ui:bubble_film']) {
        const fs = new Sprite(this.tex['ui:bubble_film']); fs.anchor.set(0.5); fs.width = fs.height = R * 2.15; fs.alpha = 0.85; film.addChild(fs);
      } else {
      g.circle(0, 0, R).fill({ color: 0x9fdcff, alpha: 0.3 });
      g.circle(0, 0, R).stroke({ color: 0x58b8f0, alpha: 1, width: 3.5 });
      g.circle(0, 0, R - 3.5).stroke({ color: 0xffffff, alpha: 0.75, width: 1.6 });
      g.arc(0, 0, R * 0.78, Math.PI * 1.05, Math.PI * 1.45).stroke({ color: 0xffffff, alpha: 0.9, width: R * 0.12, cap: 'round' });
      g.circle(R * 0.42, R * 0.45, R * 0.08).fill({ color: 0xffffff, alpha: 0.7 });
      g.arc(0, 0, R * 0.9, Math.PI * 0.1, Math.PI * 0.45).stroke({ color: 0xff9fe0, alpha: 0.45, width: 2 });
      }
      film.addChild(g);
      if (c.pr) {
        const tag = new Container();
        const t = new Text({ text: '🪙' + c.pr, style: { fontFamily: 'Fredoka, sans-serif', fontSize: this.cell * 0.19, fontWeight: '700', fill: 0x6b4206 } });
        t.anchor.set(0.5);
        const w = t.width + this.cell * 0.14, h = this.cell * 0.26;
        const bg = new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: 0xffd34d }).stroke({ color: 0xffffff, width: 2 });
        tag.addChild(bg, t);
        tag.position.set(0, R * 0.92);
        film.addChild(tag);
      }
      film.position.set(p.x, p.y);
      this.lFx.addChild(film);
      (s as any).ring = film;
      gsap.to(film.scale, { x: 1.05, y: 0.96, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.to(s.art, { y: p.y - this.cell * 0.04, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    } else if (c.p) {
      s.art = this.sprite('p:' + (PRODUCERS[c.p]?.art || c.p), i, 0.96);
      this.idleBob(i);
      if (c.tmp) {
        // a visitor's producer: a little clock badge says it will not stay
        const p = this.center(i), t = new Text({ text: '⏳', style: { fontSize: this.cell * 0.26 } });
        t.anchor.set(0.5); t.position.set(p.x - this.cell * 0.3, p.y - this.cell * 0.3);
        this.lItem.addChild(t); (s as any).clock = t;
      }
    } else if (c.id) {
      s.art = this.sprite('i:' + c.id, i, 0.92);
      this.addAura(i);
      this.idleBob(i);
    }
    this.drawTile(i);
  }
  /** a soft halo behind anything rare, so the good stuff reads at a glance */
  private addAura(i: number) {
    const r = this.rarity(i);
    if (r < 2) return;
    const s = this.slots[i] as any;
    const p = this.center(i);
    const col = r === 3 ? 0xffcf5e : 0xc78cff;
    const g = new Graphics();
    for (let k = 3; k >= 1; k--) {
      g.circle(0, 0, this.cell * (0.22 + k * 0.1)).fill({ color: col, alpha: 0.07 * (4 - k) });
    }
    g.position.set(p.x, p.y);
    this.lItem.addChildAt(g, 0);
    s.aura = g;
    gsap.to(g.scale, { x: 1.12, y: 1.12, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    if (r === 3) {
      const spin = new Graphics();
      for (let k = 0; k < 3; k++) {
        const a2 = (k / 3) * Math.PI * 2;
        spin.circle(Math.cos(a2) * this.cell * 0.44, Math.sin(a2) * this.cell * 0.44, this.cell * 0.045)
          .fill({ color: 0xfff6c8, alpha: 0.9 });
      }
      spin.position.set(p.x, p.y);
      this.lFx.addChild(spin);
      s.spin = spin;
      gsap.to(spin, { rotation: Math.PI * 2, duration: 6, repeat: -1, ease: 'none' });
    }
  }

  private sprite(texKey: string, i: number, scale: number) {
    const sp = new Sprite(this.texture(texKey));
    sp.anchor.set(0.5);
    const p = this.center(i);
    sp.position.set(p.x, p.y);
    sp.width = sp.height = this.cell * scale;
    this.lItem.addChild(sp);
    return sp;
  }
  private clearSlot(i: number) {
    const s = this.slots[i] as any;
    if (s.pending) { s.pending.kill(); s.pending = undefined; }
    if (s.idle) { s.idle.kill(); s.idle = undefined; }
    [s.art, s.timer, s.badge, s.bar, s.cost, s.ring, s.readyRing, s.aura, s.spin, s.clock].forEach((o: any) => {
      if (o) { gsap.killTweensOf(o); gsap.killTweensOf(o.scale); o.destroy({ children: true }); }
    });
    s.art = s.timer = undefined; s.badge = undefined; s.ring = undefined;
    s.bar = undefined; s.barW = undefined; s.barFrac = undefined;
    s.aura = undefined; s.spin = undefined; s.cost = undefined; s.clock = undefined;
    s.readyRing = null; s.hinting = false;
  }
  /** Re-seat everything on tile `i` after the grid has moved or resized.
   *  Rings, badges and running tweens all hold coordinates from the layout they
   *  were made in, so leaving them alone leaves sprites and highlights sitting
   *  a tile away from the board they belong to. */
  private placeSlot(i: number) {
    const s = this.slots[i] as any;
    const p = this.center(i);
    if (s.aura) s.aura.position.set(p.x, p.y);
    if (s.spin) s.spin.position.set(p.x, p.y);
    // highlights are cheap and redrawn every tick, so throw the stale ones away
    ['ring', 'readyRing'].forEach(k => {
      if (s[k]) { gsap.killTweensOf(s[k]); gsap.killTweensOf(s[k].scale); s[k].destroy(); s[k] = k === 'readyRing' ? null : undefined; }
    });
    if (s.badge) { gsap.killTweensOf(s.badge); s.badge.destroy({ children: true }); s.badge = undefined; }
    // the battery bar is drawn against the old cell size — throw it away and let
    // the next tick redraw it, the same as the rings above
    if (s.bar) { s.bar.destroy({ children: true }); s.bar = undefined; s.barW = undefined; s.barFrac = undefined; }
    if (s.cost) { gsap.killTweensOf(s.cost); s.cost.destroy({ children: true }); s.cost = undefined; s.costW = undefined; }
    if (!s.art) return;
    if (s.timer && s.key.startsWith('b')) {
      s.timer.style.fontSize = this.cell * 0.22;
      s.timer.position.set(p.x + this.cell * 0.28, p.y + this.cell * 0.3);
    } else if (s.timer && s.key.startsWith('f')) {
      s.timer.position.set(p.x + this.cell * 0.3, p.y + this.cell * 0.3);
    } else if (s.timer) {
      s.timer.destroy(); s.timer = undefined;
    }
    // a tween started under the old geometry would drag the sprite back off its
    // tile on the next frame, so it goes too and the idle bob starts afresh
    if (s.idle) { s.idle.kill(); s.idle = undefined; }
    s.hinting = false;
    if (s.art.parent !== this.lItem) this.lItem.addChild(s.art);
    gsap.killTweensOf(s.art);
    gsap.killTweensOf(s.art.scale);
    const scale = s.key.startsWith('p') ? 1.02 : s.key.startsWith('b') ? 0.82 : 1.0;
    s.art.position.set(p.x, p.y);
    s.art.width = s.art.height = this.cell * scale;
    s.art.alpha = 1;
    s.art.rotation = 0;
    if (!s.key.startsWith('b')) this.idleBob(i);
  }
  private idleBob(i: number) {
    const s = this.slots[i]; if (!s.art || s.art.destroyed) return;
    s.idle = gsap.to(s.art, {
      y: '+=' + (this.cell * 0.035), duration: 1.6 + Math.random() * 0.8,
      repeat: -1, yoyo: true, ease: 'sine.inOut', delay: Math.random(),
    });
  }

  /* ---------------------------------------------------------- animations */
  /** item pops out of a producer and arcs into its tile */
  animSpawn(i: number, id: string, fromIdx: number) {
    this.fill(i, { id }, 'i' + id);
    const s = this.slots[i]; if (!s.art) return;
    if (s.idle) { s.idle.kill(); s.idle = undefined; }
    const a = this.center(fromIdx), b = this.center(i);
    const sp = s.art;
    sp.position.set(a.x, a.y);
    sp.scale.set(0.2);
    sp.alpha = 0;
    const peak = Math.min(a.y, b.y) - this.cell * 0.55;
    gsap.to(sp, { alpha: 1, duration: 0.12 });
    gsap.to(sp, { x: b.x, duration: 0.42, ease: 'sine.out' });
    gsap.to(sp, { y: peak, duration: 0.21, ease: 'sine.out' });
    gsap.to(sp, { y: b.y, duration: 0.21, delay: 0.21, ease: 'bounce.out', onComplete: () => this.idleBob(i) });
    gsap.fromTo(sp.scale, { x: 0.25, y: 0.25 }, { x: this.spriteScale(i), y: this.spriteScale(i), duration: 0.42, ease: 'back.out(2)' });
    this.bump(fromIdx);
  }
  private spriteScale(i: number) {
    const s = this.slots[i];
    const scale = s.key.startsWith('p') ? 1.02 : s.key.startsWith('b') ? 0.82 : 1.0;
    return (this.cell * scale) / TEX;
  }
  /** producer squash when used */
  bump(i: number) {
    const s = this.slots[i]; if (!s.art) return;
    const base = this.spriteScale(i);
    gsap.killTweensOf(s.art.scale);
    gsap.timeline()
      .to(s.art.scale, { x: base * 1.16, y: base * 0.84, duration: 0.09, ease: 'power2.out' })
      .to(s.art.scale, { x: base * 0.9, y: base * 1.12, duration: 0.11 })
      .to(s.art.scale, { x: base, y: base, duration: 0.22, ease: 'elastic.out(1,0.45)' });
  }
  /** dragged item flies into the target, pops into the next tier */
  animMerge(from: number, to: number, newId: string) {
    const a = this.slots[from] as any, b = this.slots[to];
    const target = this.center(to);
    const flyer = a.art;
    a.art = undefined;
    if (a.idle) { a.idle.kill(); a.idle = undefined; }
    // the sprite flies away by hand here, so its halo has to go with it —
    // otherwise a rare item leaves a glow sitting on an empty tile
    [a.aura, a.spin].forEach((o: any) => { if (o) { gsap.killTweensOf(o); gsap.killTweensOf(o.scale); o.destroy(); } });
    a.aura = a.spin = undefined;
    a.key = 'e';
    this.drawTile(from);
    const tier = ITEMS[newId]?.tier || 1;
    if (flyer) {
      this.lDrag.addChild(flyer);
      gsap.killTweensOf(flyer); gsap.killTweensOf(flyer.scale);
      gsap.to(flyer, { x: target.x, y: target.y, rotation: 0, duration: 0.13, ease: 'power2.in' });
      gsap.to(flyer.scale, { x: flyer.scale.x * 0.5, y: flyer.scale.y * 0.5, duration: 0.13, ease: 'power2.in', onComplete: () => flyer.destroy() });
    }
    // the partner squashes to take the hit
    if (b.art && !b.art.destroyed) {
      if (b.idle) { b.idle.kill(); b.idle = undefined; }
      gsap.killTweensOf(b.art); gsap.killTweensOf(b.art.scale);
      const sc = this.spriteScale(to);
      gsap.to(b.art.scale, { x: sc * 1.25, y: sc * 0.8, duration: 0.12, ease: 'power2.out' });
    }
    b.pending = gsap.delayedCall(0.13, () => {
      this.slots[to].pending = undefined;
      this.fill(to, { id: newId }, 'i' + newId);
      const s = this.slots[to]; if (!s.art) return;
      if (s.idle) { s.idle.kill(); s.idle = undefined; }
      const sc = this.spriteScale(to);
      gsap.fromTo(s.art.scale, { x: sc * 0.35, y: sc * 0.35 }, { x: sc, y: sc, duration: 0.55, ease: 'elastic.out(1.1,0.45)', onComplete: () => this.idleBob(to) });
      gsap.fromTo(s.art, { rotation: -0.25 }, { rotation: 0, duration: 0.45, ease: 'back.out(3)' });
      this.flash(to, tier);
      this.ringPulse(to, 0xffe9a0);
      this.stars(to, 5 + Math.min(tier, 8));
      this.burst(to, 0xffd45e, 6 + tier);
      if (tier >= 6) this.shake(0.25);
    });
  }
  /** a soft white flash where two things became one */
  flash(i: number, tier = 1) {
    const p = this.center(i), g = new Graphics();
    g.circle(0, 0, this.cell * 0.42).fill({ color: 0xffffff, alpha: 0.9 });
    g.circle(0, 0, this.cell * 0.6).fill({ color: 0xfff1b8, alpha: 0.35 });
    g.position.set(p.x, p.y);
    this.lFx.addChild(g);
    const big = 1.2 + Math.min(tier, 8) * 0.06;
    gsap.fromTo(g.scale, { x: 0.4, y: 0.4 }, { x: big, y: big, duration: 0.3, ease: 'power2.out' });
    gsap.to(g, { alpha: 0, duration: 0.32, ease: 'power1.in', onComplete: () => g.destroy() });
    // rays for the good ones
    if (tier >= 4) {
      const r = new Graphics();
      for (let k = 0; k < 8; k++) {
        const an = (k / 8) * Math.PI * 2, w = 0.12;
        r.moveTo(0, 0)
          .lineTo(Math.cos(an - w) * this.cell, Math.sin(an - w) * this.cell)
          .lineTo(Math.cos(an + w) * this.cell, Math.sin(an + w) * this.cell)
          .closePath().fill({ color: 0xfff3b0, alpha: 0.5 });
      }
      r.position.set(p.x, p.y);
      this.lTile.addChild(r);
      gsap.fromTo(r.scale, { x: 0.3, y: 0.3 }, { x: 1.3, y: 1.3, duration: 0.6, ease: 'power2.out' });
      gsap.to(r, { rotation: 0.6, alpha: 0, duration: 0.7, ease: 'power1.in', onComplete: () => r.destroy() });
    }
  }
  /** little five-point stars thrown out of a merge */
  stars(i: number, n = 7) {
    const p = this.center(i);
    const cols = [0xffe066, 0xffffff, 0xffb84d, 0xfff3b0];
    for (let k = 0; k < n; k++) {
      const g = new Graphics(), R = this.cell * (0.07 + Math.random() * 0.05);
      const pts: number[] = [];
      for (let j = 0; j < 10; j++) {
        const an = -Math.PI / 2 + j * Math.PI / 5, rr = j % 2 ? R * 0.45 : R;
        pts.push(Math.cos(an) * rr, Math.sin(an) * rr);
      }
      g.poly(pts).fill({ color: cols[k % cols.length] }).stroke({ color: 0xc98a1c, width: 1, alpha: 0.6 });
      g.position.set(p.x, p.y);
      this.lFx.addChild(g);
      const an = (k / n) * Math.PI * 2 + Math.random() * 0.5, dist = this.cell * (0.6 + Math.random() * 0.5);
      const tl = gsap.timeline({ onComplete: () => g.destroy() });
      tl.to(g, { x: p.x + Math.cos(an) * dist, y: p.y + Math.sin(an) * dist - this.cell * 0.2, duration: 0.5, ease: 'power3.out' })
        .to(g, { y: '+=' + this.cell * 0.3, alpha: 0, duration: 0.35, ease: 'power1.in' });
      gsap.to(g, { rotation: (Math.random() - 0.5) * 6, duration: 0.85 });
      gsap.fromTo(g.scale, { x: 0.3, y: 0.3 }, { x: 1, y: 1, duration: 0.25, ease: 'back.out(3)' });
    }
  }
  /** the item the game just took off the board (a rocket part, a can of fuel)
   *  appears for a beat and flies away, so it never just blinks out */
  consume(i: number, id: string) {
    const p = this.center(i);
    const sp = new Sprite(this.texture('i:' + id));
    sp.anchor.set(0.5);
    sp.position.set(p.x, p.y);
    sp.width = sp.height = this.cell * 0.92;
    this.lDrag.addChild(sp);
    const tl = gsap.timeline({ onComplete: () => sp.destroy() });
    tl.to(sp.scale, { x: sp.scale.x * 1.35, y: sp.scale.y * 1.35, duration: 0.18, ease: 'back.out(3)' })
      .to(sp, { y: -this.cell, alpha: 0, duration: 0.5, ease: 'power2.in' })
      .to(sp.scale, { x: 0.02, y: 0.02, duration: 0.5, ease: 'power2.in' }, '<')
      .to(sp, { rotation: 0.6, duration: 0.68, ease: 'none' }, 0);
    this.ringPulse(i, 0xbff0ff);
  }

  /** expanding ring, used for merges and installs */
  ringPulse(i: number, color: number) {
    const p = this.center(i);
    const g = new Graphics();
    g.circle(0, 0, this.cell * 0.34).stroke({ color, width: 4, alpha: 0.95 });
    g.position.set(p.x, p.y);
    this.lFx.addChild(g);
    gsap.to(g.scale, { x: 2.1, y: 2.1, duration: 0.5, ease: 'power2.out' });
    gsap.to(g, { alpha: 0, duration: 0.5, ease: 'power1.out', onComplete: () => g.destroy() });
  }
  burst(i: number, color = 0xffd45e, n = 12) {
    const p = this.center(i);
    for (let k = 0; k < n; k++) {
      const g = new Graphics();
      const r = this.cell * (0.05 + Math.random() * 0.06);
      g.circle(0, 0, r).fill({ color });
      g.position.set(p.x, p.y);
      this.lFx.addChild(g);
      const ang = Math.random() * Math.PI * 2, dist = this.cell * (0.4 + Math.random() * 0.75);
      gsap.to(g, {
        x: p.x + Math.cos(ang) * dist, y: p.y + Math.sin(ang) * dist,
        alpha: 0, duration: 0.45 + Math.random() * 0.25, ease: 'power2.out',
        onComplete: () => g.destroy(),
      });
      gsap.to(g.scale, { x: 0.2, y: 0.2, duration: 0.5 });
    }
  }
  floatText(i: number, txt: string, color = 0xffffff) {
    const p = this.center(i);
    const t = new Text({
      text: txt, style: {
        fontFamily: 'Fredoka, sans-serif', fontSize: Math.max(13, this.cell * 0.30), fontWeight: '700',
        fill: color, stroke: { color: 0x6b4a20, width: 4, join: 'round' },
      },
    });
    t.anchor.set(0.5);
    t.position.set(p.x, p.y - this.cell * 0.1);
    this.lFx.addChild(t);
    gsap.fromTo(t.scale, { x: 0.6, y: 0.6 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)' });
    gsap.to(t, { y: p.y - this.cell * 1.05, alpha: 0, duration: 0.95, ease: 'power1.out', onComplete: () => t.destroy() });
  }
  shake(power = 1) {
    const r = this.root;
    gsap.killTweensOf(r);
    const t = gsap.timeline();
    for (let k = 0; k < 5; k++) {
      t.to(r, { x: (Math.random() - 0.5) * 16 * power, y: (Math.random() - 0.5) * 12 * power, duration: 0.05 });
    }
    t.to(r, { x: 0, y: 0, duration: 0.12, ease: 'power2.out' });
  }
  /** meteor streaks in from the top-right and slams into a tile */
  meteor(i: number, onHit: () => void) {
    const p = this.center(i);
    // a painted meteor (ui/meteor.png, trail included) when there is one
    const painted = !!this.tex['ui:meteor'];
    const sp = new Sprite(this.tex['ui:meteor'] || this.texture('i:scrap'));
    sp.anchor.set(0.5);
    sp.width = sp.height = this.cell * (this.tex['ui:meteor'] ? 1.8 : 1.2);
    sp.position.set(this.app.screen.width + 60, -60);
    this.lDrag.addChild(sp);
    const trail = new Graphics();
    this.lFx.addChild(trail);
    const tl = gsap.timeline({
      onUpdate: () => {
        if (painted) return;                       // the painting carries its own fire trail
        trail.clear();
        trail.moveTo(sp.x + 40, sp.y - 40).lineTo(sp.x, sp.y).stroke({ color: 0xffb03c, width: this.cell * 0.22, alpha: 0.5 });
      },
      onComplete: () => {
        trail.destroy(); sp.destroy();
        this.shake(1.6); this.burst(i, 0xffc06a, 26); this.ringPulse(i, 0xffa53c);
        onHit();
      },
    });
    tl.to(sp, { x: p.x, y: p.y, duration: 0.85, ease: 'power2.in' })
      .to(sp, { rotation: painted ? 0.15 : 6, duration: 0.85, ease: 'none' }, 0);
  }

  /* ----------------------------------------------------------- highlights */
  setSelected(i: number | null) {
    this.slots.forEach((s, k) => {
      const on = k === i;
      if (on && !s.ring && s.art) {
        const p = this.center(k), g = new Graphics();
        g.roundRect(-this.cell / 2, -this.cell / 2, this.cell, this.cell, this.cell * 0.24)
          .stroke({ color: 0xffcb3d, width: 4 });
        g.position.set(p.x, p.y);
        this.lFx.addChild(g); s.ring = g;
      } else if (!on && s.ring) { s.ring.destroy(); s.ring = undefined; }
    });
  }
  /** items a ready contract or chapter is about to take: their tiles glow green */
  private wanted = new Set<number>();
  /* Something a customer can take right now is told apart three ways, none of
     them the green a producer uses: its tile turns gold, the item does a little
     "pick me!" wiggle every couple of seconds, and a gift tag sits on its corner. */
  private wantTags: Record<number, Container> = {};
  private wantTick = false;
  setWanted(list: number[]) {
    const nw = new Set(list);
    if (nw.size === this.wanted.size && list.every(k => this.wanted.has(k))) return;
    const old = this.wanted; this.wanted = nw;
    old.forEach(k => { if (!nw.has(k)) { this.drawTile(k); this.dropTag(k); const a = this.slots[k] && this.slots[k].art; if (a) a.rotation = 0; } });
    nw.forEach(k => { if (!old.has(k)) this.drawTile(k); });
    this.placeTags();
    if (!this.wantTick) {
      this.wantTick = true;
      this.app.ticker.add(() => {
        const t = performance.now() / 1000;
        this.wanted.forEach(k => {
          const a = this.slots[k] && this.slots[k].art; if (!a || (this.drag && this.drag.moved && this.drag.i === k)) return;
          const ph = (t + k * 0.13) % 2.2;                 // wiggle for 0.5 s, rest the rest
          a.rotation = ph < 0.5 ? Math.sin(ph / 0.5 * Math.PI * 4) * 0.13 * (1 - ph / 0.5) : 0;
          const tag = this.wantTags[k];
          if (tag) tag.scale.set(1 + 0.12 * Math.max(0, Math.sin(t * 4 + k)));
        });
      });
    }
  }
  private dropTag(k: number) { const tg = this.wantTags[k]; if (tg) { tg.destroy({ children: true }); delete this.wantTags[k]; } }
  private placeTags() {
    Object.keys(this.wantTags).forEach(k => { if (!this.wanted.has(+k)) this.dropTag(+k); });
    this.wanted.forEach(k => {
      if (!this.slots[k] || !this.slots[k].key) { this.dropTag(k); return; }
      let tg = this.wantTags[k];
      const r = Math.max(7, this.cell * 0.15);
      if (!tg) {
        tg = new Container();
        const pt = this.tex['ui:ic_star_tag'];
        if (pt) {
          // the painted star tag
          const sp = new Sprite(pt); sp.anchor.set(0.5); sp.width = sp.height = r * 2.4; tg.addChild(sp);
        } else {
          const g = new Graphics();
          g.circle(0, 0, r).fill({ color: 0xff7a1a }).stroke({ color: 0xffffff, width: 2.5 });
          const tx = new Text({ text: '★', style: { fontSize: r * 1.3, fill: 0xffffff, fontWeight: '700' } });
          tx.anchor.set(0.5, 0.55);
          tg.addChild(g, tx);
        }
        this.lFx.addChild(tg);
        this.wantTags[k] = tg;
      }
      const p = this.pos(k);
      tg.position.set(p.x + this.cell - r * 0.7, p.y + r * 0.7);
    });
  }
  setHint(list: number[] | null) {
    this.slots.forEach((s, k) => {
      const on = !!list && list.indexOf(k) >= 0;
      if (!s.art) return;
      if (on) {
        if (!s.idle || !(s as any).hinting) {
          (s as any).hinting = true;
          if (s.idle) s.idle.kill();
          const sc = this.spriteScale(k);
          s.idle = gsap.to(s.art.scale, { x: sc * 1.16, y: sc * 1.16, duration: 0.34, repeat: -1, yoyo: true, ease: 'sine.inOut' });
          this.ringPulse(k, 0xffcb3d);
        }
      } else if ((s as any).hinting) {
        (s as any).hinting = false;
        if (s.idle) s.idle.kill();
        const sc = this.spriteScale(k);
        gsap.to(s.art.scale, { x: sc, y: sc, duration: 0.2, onComplete: () => this.idleBob(k) });
      }
    });
  }
  /** green "collect me" ring on producers that are ready */
  setReady(i: number, on: boolean) {
    const s = this.slots[i];
    const has = !!(s as any).readyRing;
    if (on && !has && s.art) {
      // a little twinkling star in the corner, not a border round the tile
      const p = this.center(i), g = new Graphics(), r = this.cell * 0.13, q = r * 0.32;
      g.poly([0, -r, q, -q, r, 0, q, q, 0, r, -q, q, -r, 0, -q, -q]).fill({ color: 0xffe066 }).stroke({ color: 0xffffff, width: 2 });
      g.circle(0, 0, r * 0.28).fill({ color: 0xffffff });
      g.position.set(p.x + this.cell * 0.33, p.y - this.cell * 0.33);
      this.lFx.addChild(g);
      (s as any).readyRing = g;
      gsap.to(g.scale, { x: 1.35, y: 1.35, duration: 0.6, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to(g, { rotation: Math.PI / 2, duration: 2.4, repeat: -1, ease: 'none' });
    } else if (!on && has) {
      const g = (s as any).readyRing; gsap.killTweensOf(g); gsap.killTweensOf(g.scale); g.destroy(); (s as any).readyRing = null;
    }
  }
  /** charge battery under a producer: a bar you can watch empty, and the count */
  setCharge(i: number, charges: number, cap: number, label: string) {
    const s = this.slots[i] as any; if (!s.art) return;
    const p = this.center(i), w = this.cell * 0.74, h = this.cell * 0.115;
    if (!s.bar) {
      const c = new Container();
      const back = new Graphics(); back.label = 'back';
      const fill = new Graphics(); fill.label = 'fill';
      c.addChild(back, fill);
      this.lItem.addChild(c);
      s.bar = c;
    }
    s.bar.position.set(p.x - w / 2, p.y + this.cell * 0.31);
    const back = s.bar.children[0] as Graphics, fill = s.bar.children[1] as Graphics;
    const frac = cap > 0 ? Math.max(0, Math.min(1, charges / cap)) : 0;
    if (s.barW !== w) {
      back.clear().roundRect(0, 0, w, h, h / 2).fill({ color: 0x2e1f10, alpha: 0.38 });
      s.barW = w;
    }
    if (s.barFrac !== frac) {
      const col = frac > 0.5 ? 0x6ee04a : frac > 0.2 ? 0xffc23d : 0xff7a5e;
      fill.clear();
      if (frac > 0) fill.roundRect(1, 1, Math.max(h - 2, (w - 2) * frac), h - 2, (h - 2) / 2).fill({ color: col });
      s.barFrac = frac;
    }
    if (!s.badge) {
      const c = new Container();
      const g = new Graphics();
      g.roundRect(-this.cell * 0.2, -this.cell * 0.13, this.cell * 0.4, this.cell * 0.26, this.cell * 0.13)
        .fill({ color: 0x4fb63a }).stroke({ color: 0xffffff, width: 2 });
      const t = new Text({ text: '', style: { fontFamily: 'Fredoka, sans-serif', fontSize: this.cell * 0.19, fontWeight: '700', fill: 0xffffff } });
      t.anchor.set(0.5); t.label = 'n';
      c.addChild(g, t);
      this.lItem.addChild(c);
      s.badge = c;
    }
    s.badge.position.set(p.x + this.cell * 0.3, p.y - this.cell * 0.34);
    const nt = s.badge.children.find((ch: any) => ch.label === 'n') as Text;
    if (nt && nt.text !== String(charges)) {
      nt.text = String(charges);
      gsap.fromTo(s.badge.scale, { x: 1.35, y: 1.35 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)' });
    }
    (s.badge.children[0] as Graphics).tint = charges > 0 ? 0xffffff : 0xbfb6a6;
    if (!s.timer) {
      const t = new Text({ text: '', style: { fontFamily: 'Fredoka, sans-serif', fontSize: this.cell * 0.17, fontWeight: '700', fill: themeOf(this.theme).txt } });
      t.anchor.set(0.5);
      this.lItem.addChild(t);
      s.timer = t;
    }
    s.timer.position.set(p.x, p.y + this.cell * 0.47);
    s.timer.visible = !!label;
    s.timer.text = label;
  }

  /** an energy producer taps for ever; what it shows is the price of a tap */
  setCost(i: number, cost: number, enough: boolean) {
    const s = this.slots[i] as any; if (!s.art) return;
    const p = this.center(i);
    if (!s.cost) {
      const c = new Container();
      const g = new Graphics(); g.label = 'pill';
      const t = new Text({ text: '', style: { fontFamily: 'Fredoka, sans-serif', fontWeight: '700', fill: 0xffffff } });
      t.anchor.set(0.5); t.label = 'n';
      c.addChild(g, t);
      this.lItem.addChild(c);
      s.cost = c;
    }
    const w = this.cell * 0.42, h = this.cell * 0.25;
    const g = s.cost.children[0] as Graphics, t = s.cost.children[1] as Text;
    if (s.costW !== w) {
      g.clear().roundRect(-w / 2, -h / 2, w, h, h / 2)
        .fill({ color: 0x2f9ed6 }).stroke({ color: 0xffffff, width: 2 });
      t.style.fontSize = this.cell * 0.18;
      s.costW = w;
    }
    const txt = '⚡' + cost;
    if (t.text !== txt) {
      t.text = txt;
      gsap.fromTo(s.cost.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.28, ease: 'back.out(3)' });
    }
    g.tint = enough ? 0xffffff : 0x8d8d8d;
    s.cost.alpha = enough ? 1 : 0.75;
    s.cost.position.set(p.x, p.y + this.cell * 0.38);
  }

  /* --------------------------------------------------------------- input */
  /** the tile under a point, with no dead gutters: the gap between two tiles
   *  belongs to whichever centre is closer */
  private nearCell(gx: number, gy: number): number {
    const step = this.cell + this.gap;
    const c = Math.floor((gx - this.ox + this.gap / 2) / step), r = Math.floor((gy - this.oy + this.gap / 2) / step);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }
  /** Where a drop should land. A finger is a blunt tool: when it ends up beside
   *  a tile that would merge, and nowhere useful itself, the item is pulled the
   *  rest of the way — the "magnet" every good merge game has. */
  private target(from: number, gx: number, gy: number): { to: number; kind: 'merge' | 'move' | 'swap' | null } {
    const at = this.nearCell(gx, gy);
    const kindAt = at >= 0 && at !== from ? this.hooks.dropKind(from, at) : null;
    if (kindAt === 'merge') return { to: at, kind: kindAt };
    // over an empty tile the pull is weak (you may want it beside its twin);
    // over something it cannot go on, the twin next door wins easily
    let best = -1, bestD = this.cell * (kindAt === 'move' ? 0.62 : 0.95);
    const c0 = at >= 0 ? at % this.cols : -1, r0 = at >= 0 ? Math.floor(at / this.cols) : -1;
    if (at >= 0) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const c = c0 + dc, r = r0 + dr;
      if ((!dc && !dr) || c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
      const k = r * this.cols + c;
      if (k === from || this.hooks.dropKind(from, k) !== 'merge') continue;
      const p = this.center(k), d = Math.hypot(p.x - gx, p.y - gy);
      if (d < bestD) { bestD = d; best = k; }
    }
    if (best >= 0) return { to: best, kind: 'merge' };
    return { to: at, kind: kindAt };
  }
  private down = (e: any) => {
    const i = this.nearCell(e.global.x, e.global.y);
    if (i < 0) { this.hooks.onTap(-1); return; }
    this.drag = { i, x: e.global.x, y: e.global.y, moved: false, vx: 0, lx: e.global.x };
  };
  private move = (e: any) => {
    const d = this.drag; if (!d) return;
    const dx = e.global.x - d.x, dy = e.global.y - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      if (!this.hooks.canDrag(d.i)) { this.drag = null; return; }
      const s = this.slots[d.i];
      if (!s.art) { this.drag = null; return; }
      d.moved = true;
      d.sprite = s.art;
      if (s.idle) { s.idle.kill(); s.idle = undefined; }
      gsap.killTweensOf(d.sprite); gsap.killTweensOf(d.sprite.scale);
      this.lDrag.addChild(d.sprite);
      const sc = this.spriteScale(d.i);
      gsap.to(d.sprite.scale, { x: sc * 1.22, y: sc * 1.22, duration: 0.16, ease: 'back.out(2.4)' });
      // lift the halo off the empty tile with it
      const slot = this.slots[d.i] as any;
      [slot.aura, slot.spin].forEach((o: any) => { if (o) o.visible = false; });
      this.showMatches(d.i);
      this.hooks.onLift?.(d.i);
    }
    // the item rides a little above the finger, so the finger never hides it,
    // and leans into the direction it is being pulled
    d.sprite.position.set(e.global.x, e.global.y - this.cell * 0.32);
    d.vx = d.vx * 0.6 + (e.global.x - d.lx) * 0.4; d.lx = e.global.x;
    const lean = Math.max(-0.28, Math.min(0.28, d.vx * 0.025));
    gsap.to(d.sprite, { rotation: lean, duration: 0.18, overwrite: 'auto' });
    const t = this.target(d.i, e.global.x, e.global.y);
    if (t.to !== d.over || t.kind !== d.overKind) {
      d.over = t.to; d.overKind = t.kind;
      this.highlightDrop(d.i, t.to, t.kind);
      if (t.to !== d.i) this.hooks.onHover?.(t.kind);
    }
  };
  private up = (e: any) => {
    const d = this.drag; this.drag = null;
    if (!d) return;
    this.clearDropHighlight();
    this.hideMatches();
    if (!d.moved) { this.hooks.onTap(d.i); return; }
    const slot = this.slots[d.i] as any;
    [slot.aura, slot.spin].forEach((o: any) => { if (o && !o.destroyed) o.visible = true; });
    const t = this.target(d.i, e.global.x, e.global.y);
    const to = t.to, kind = to >= 0 && to !== d.i ? t.kind : null;
    const home = this.center(d.i);
    const sc = this.spriteScale(d.i);
    this.lastDrop = { x: d.sprite.x, y: d.sprite.y };
    gsap.to(d.sprite, { rotation: 0, duration: 0.15, overwrite: 'auto' });
    if (!kind) {                                   // snap back
      // Re-home the sprite NOW, not when the tween ends: while it sat in the
      // drag layer it floated above every tile, and a sync() landing in that
      // window destroyed it out from under the tween — which is how an item
      // could overlap its neighbour and then vanish.
      this.lItem.addChild(d.sprite);
      gsap.to(d.sprite, { x: home.x, y: home.y, duration: 0.28, ease: 'back.out(2)' });
      gsap.to(d.sprite.scale, {
        x: sc, y: sc, duration: 0.22,
        onComplete: () => { if (!d.sprite.destroyed) this.idleBob(d.i); },
      });
      return;
    }
    this.lItem.addChild(d.sprite);
    gsap.to(d.sprite.scale, { x: sc, y: sc, duration: 0.12 });
    this.hooks.onDrop(d.i, to);                    // game decides what happens
  };
  /** where the last drag was let go, so a move can glide from there */
  private lastDrop: { x: number; y: number } | null = null;
  private dropRing: Graphics | null = null;
  private dropLift: number | null = null;
  private highlightDrop(from: number, to: number, kind: 'merge' | 'move' | 'swap' | null) {
    this.clearDropHighlight();
    if (to < 0 || to === from || !kind) return;
    const p = this.center(to), g = new Graphics();
    const col = kind === 'merge' ? 0x6ee04a : kind === 'swap' ? 0xffcb3d : 0x8fd9ff;
    if (kind === 'merge') g.roundRect(-this.cell / 2, -this.cell / 2, this.cell, this.cell, this.cell * 0.24).fill({ color: 0x8ce46a, alpha: 0.28 });
    g.roundRect(-this.cell / 2, -this.cell / 2, this.cell, this.cell, this.cell * 0.24).stroke({ color: col, width: 4 });
    g.position.set(p.x, p.y);
    this.lFx.addChild(g);
    gsap.fromTo(g.scale, { x: 0.86, y: 0.86 }, { x: 1, y: 1, duration: 0.2, ease: 'back.out(3)' });
    this.dropRing = g;
    // the partner leans in to meet it
    if (kind === 'merge') {
      const s = this.slots[to];
      if (s.art && !s.art.destroyed) {
        if (s.idle) { s.idle.kill(); s.idle = undefined; }
        const sc = this.spriteScale(to);
        gsap.to(s.art.scale, { x: sc * 1.14, y: sc * 1.14, duration: 0.16, ease: 'back.out(3)', overwrite: 'auto' });
        this.dropLift = to;
      }
    }
  }
  private clearDropHighlight() {
    if (this.dropRing) { gsap.killTweensOf(this.dropRing); gsap.killTweensOf(this.dropRing.scale); this.dropRing.destroy(); this.dropRing = null; }
    if (this.dropLift !== null) {
      const k = this.dropLift, s = this.slots[k]; this.dropLift = null;
      if (s.art && !s.art.destroyed && !(s as any).matchGlow) {
        const sc = this.spriteScale(k);
        gsap.to(s.art.scale, { x: sc, y: sc, duration: 0.15, overwrite: 'auto', onComplete: () => { if (!s.idle && s.art && !s.art.destroyed) this.idleBob(k); } });
      } else if (s.art && !s.art.destroyed) {
        const sc = this.spriteScale(k);
        gsap.to(s.art.scale, { x: sc * 1.06, y: sc * 1.06, duration: 0.15, overwrite: 'auto' });
      }
    }
  }
  /** while dragging, every tile it could merge with breathes and glows */
  private glows: Graphics[] = [];
  private showMatches(from: number) {
    this.hideMatches();
    const list = this.hooks.matches ? this.hooks.matches(from) : [];
    list.forEach(k => {
      const s = this.slots[k] as any; if (!s.art || s.art.destroyed) return;
      const p = this.center(k), g = new Graphics();
      const h = this.cell / 2 - 2;
      g.roundRect(-h, -h, h * 2, h * 2, this.cell * 0.2).fill({ color: 0xfff1a8, alpha: 0.55 })
        .stroke({ color: 0xffc83d, width: 3, alpha: 0.95 });
      g.circle(0, 0, this.cell * 0.34).fill({ color: 0xffffff, alpha: 0.35 });
      g.position.set(p.x, p.y);
      this.lTile.addChild(g);
      gsap.fromTo(g, { alpha: 0.55 }, { alpha: 1, duration: 0.45, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      this.glows.push(g);
      s.matchGlow = true;
      if (s.idle) { s.idle.kill(); s.idle = undefined; }
      const sc = this.spriteScale(k);
      s.idle = gsap.to(s.art.scale, { x: sc * 1.06, y: sc * 1.06, duration: 0.45, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    });
  }
  private hideMatches() {
    this.glows.forEach(g => { gsap.killTweensOf(g); g.destroy(); });
    this.glows = [];
    this.slots.forEach((s: any, k) => {
      if (!s.matchGlow) return;
      s.matchGlow = false;
      if (s.idle) { s.idle.kill(); s.idle = undefined; }
      if (s.art && !s.art.destroyed) {
        const sc = this.spriteScale(k);
        gsap.to(s.art.scale, { x: sc, y: sc, duration: 0.15, overwrite: 'auto', onComplete: () => { if (!s.idle && s.art && !s.art.destroyed) this.idleBob(k); } });
      }
    });
  }

  /** a moved item glides from where it was let go and settles with a squash */
  land(i: number, from?: { x: number; y: number } | null) {
    const s = this.slots[i]; if (!s.art || s.art.destroyed) return;
    const src = from === undefined ? this.lastDrop : from;
    const p = this.center(i), sc = this.spriteScale(i);
    if (s.idle) { s.idle.kill(); s.idle = undefined; }
    gsap.killTweensOf(s.art); gsap.killTweensOf(s.art.scale);
    if (src) s.art.position.set(src.x, src.y);
    gsap.to(s.art, { x: p.x, y: p.y, duration: 0.2, ease: 'power2.out' });
    const art = s.art;
    gsap.timeline({ onComplete: () => { if (s.art === art && !art.destroyed && !s.idle) this.idleBob(i); } })
      .to(s.art.scale, { x: sc * 1.12, y: sc * 0.88, duration: 0.08, delay: 0.14 })
      .to(s.art.scale, { x: sc * 0.95, y: sc * 1.06, duration: 0.09 })
      .to(s.art.scale, { x: sc, y: sc, duration: 0.18, ease: 'elastic.out(1,0.5)' });
  }
  /** two items trade places: the dragged one lands, the other hops across */
  swapLand(a: number, b: number) {
    this.land(b);
    this.land(a, this.center(b));
  }
  /** the page position of the last drop, for effects drawn in the DOM */
  pointToClient(x: number, y: number) {
    const r = this.app.canvas.getBoundingClientRect(), k = this.zoom(r);
    return { x: r.left + x * k, y: r.top + y * k };
  }

  /** snap a sprite back home after the game refuses a drop */
  settle(i: number) {
    const s = this.slots[i]; if (!s.art || s.art.destroyed) return;
    if (s.art.parent !== this.lItem) this.lItem.addChild(s.art);
    const p = this.center(i);
    gsap.to(s.art, { x: p.x, y: p.y, rotation: 0, duration: 0.25, ease: 'back.out(2)' });
    // a little head-shake: that drop was not allowed
    gsap.fromTo(s.art, { rotation: 0.18 }, { rotation: 0, duration: 0.4, ease: 'elastic.out(1,0.3)', delay: 0.05 });
  }
}

export const board = new PixiBoard();
