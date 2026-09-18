/* Pixi-rendered merge board.
   The game logic never touches sprites: it calls sync()/anim*() and reads cell
   geometry. Art comes from the existing SVG set, rasterised once into textures. */
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import gsap from 'gsap';
import { ART } from './art';
import { ITEMS } from './content';

export type Cell = { b?: number; p?: string; id?: string; ch?: number; at?: number } | null;

export type Hooks = {
  onTap: (i: number) => void;
  onDrop: (from: number, to: number) => void;
  dropKind: (from: number, to: number) => 'merge' | 'move' | null;
  canDrag: (i: number) => boolean;
};

const THEME = {
  earth: { tile: 0xfff6e0, tileLo: 0xf3e1bd, lock: 0xd0a469, lockLo: 0xb98f52, txt: 0x9a7a4e },
  luna: { tile: 0xf3f0ff, tileLo: 0xdcd5f2, lock: 0x9a92bd, lockLo: 0x827aa6, txt: 0x5a4f86 },
  cindra: { tile: 0xfff0e2, tileLo: 0xf2d6bd, lock: 0xa8654a, lockLo: 0x8a4a33, txt: 0x8a4a2a },
};

const TEX = 168;                              // texture resolution per tile art

type Slot = {
  key: string;
  art?: Sprite;
  badge?: Container;
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
  slots: Slot[] = [];
  theme: keyof typeof THEME = 'earth';
  private tex: Record<string, Texture> = {};
  private drag: any = null;
  private ready = false;
  private laying = false;

  async init(host: HTMLElement, cols: number, rows: number, hooks: Hooks) {
    this.host = host; this.cols = cols; this.rows = rows; this.hooks = hooks;
    this.app = new Application();
    await this.app.init({
      resizeTo: host, backgroundAlpha: 0, antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2.5), autoDensity: true,
    });
    host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';
    this.root.addChild(this.lTile, this.lItem, this.lFx, this.lDrag);
    this.app.stage.addChild(this.root);

    for (let i = 0; i < cols * rows; i++) {
      const g = new Graphics();
      this.lTile.addChild(g);
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
    const add = (key: string, svg: string) => {
      if (this.tex[key]) return;
      jobs.push(this.rasterise(svg).then(t => { this.tex[key] = t; }));
    };
    itemIds.forEach(id => add('i:' + id, ART.item(id)));
    producerArts.forEach(a => add('p:' + a, ART.producer(a)));
    ['earth', 'luna', 'cindra'].forEach(w => add('w:' + w, ART.weed(w)));
    add('coin', ART.icon('coin'));
    await Promise.all(jobs);
  }
  private texture(key: string): Texture {
    return this.tex[key] || Texture.EMPTY;
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
    const c = this.center(i);
    return { x: r.left + c.x, y: r.top + c.y };
  }
  private cellAt(gx: number, gy: number): number {
    const step = this.cell + this.gap;
    const c = Math.floor((gx - this.ox) / step), r = Math.floor((gy - this.oy) / step);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    // ignore taps that land in the gutter between tiles
    const lx = gx - this.ox - c * step, ly = gy - this.oy - r * step;
    if (lx > this.cell + 2 || ly > this.cell + 2) return -1;
    return r * this.cols + c;
  }

  setTheme(t: keyof typeof THEME) { this.theme = t; this.layout(); }

  /** how precious the thing on this tile is: 0 none, 1 good, 2 rare, 3 legendary */
  private rarity(i: number): number {
    const k = this.slots[i]?.key;
    if (!k || !k.startsWith('i')) return 0;
    const d = ITEMS[k.slice(1)];
    if (!d) return 0;
    if (d.chain === 'relic' || d.chain === 'wild') return 3;
    if (d.tier >= 5) return 3;
    if (d.tier === 4) return 2;
    if (d.tier === 3) return 1;
    return 0;
  }
  private drawTile(i: number) {
    const g = this.tiles[i], p = this.pos(i), c = this.cell, th = THEME[this.theme];
    const locked = this.slots[i] && this.slots[i].key.startsWith('b');
    const r = locked ? 0 : this.rarity(i);
    const R = c * 0.24;
    g.clear();
    // seated shadow, so tiles read as pressed into the board rather than painted on
    g.roundRect(p.x + c * 0.03, p.y + c * 0.07, c * 0.94, c * 0.96, R)
      .fill({ color: 0x000000, alpha: 0.12 });
    g.roundRect(p.x, p.y, c, c, R).fill({ color: locked ? th.lock : th.tile });
    // inset floor + a soft top light
    g.roundRect(p.x + c * 0.07, p.y + c * 0.58, c * 0.86, c * 0.34, c * 0.18)
      .fill({ color: locked ? th.lockLo : th.tileLo, alpha: 0.7 });
    g.roundRect(p.x + c * 0.1, p.y + c * 0.07, c * 0.8, c * 0.26, c * 0.13)
      .fill({ color: 0xffffff, alpha: locked ? 0.1 : 0.45 });
    g.roundRect(p.x, p.y, c, c, R).stroke({ color: 0xffffff, alpha: locked ? 0.18 : 0.6, width: 2 });
    if (r) {
      // rarity frame: quietly gold for good, hot for legendary
      const col = r === 3 ? 0xffb02e : r === 2 ? 0xc78cff : 0x8fd6ff;
      g.roundRect(p.x + 1, p.y + 1, c - 2, c - 2, R - 1)
        .stroke({ color: col, alpha: r === 3 ? 0.95 : 0.65, width: r === 3 ? 3 : 2.2 });
    }
  }

  /* ---------------------------------------------------------------- sync */
  private keyOf(c: Cell) { return !c ? 'e' : c.b ? 'b' + c.b : c.p ? 'p' + c.p : 'i' + c.id; }

  sync(cells: Cell[]) {
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
    if (c.b) {
      s.art = this.sprite('w:' + this.theme, i, 0.78);
      const t = new Text({ text: String(c.b), style: { fontFamily: 'Fredoka, sans-serif', fontSize: this.cell * 0.26, fontWeight: '700', fill: 0xffffff } });
      t.anchor.set(0.5);
      const p = this.center(i);
      t.position.set(p.x + this.cell * 0.28, p.y + this.cell * 0.3);
      this.lItem.addChild(t);
      s.timer = t;
    } else if (c.p) {
      s.art = this.sprite('p:' + c.p, i, 0.96);
      this.idleBob(i);
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
    [s.art, s.timer, s.badge, s.ring, s.readyRing, s.aura, s.spin].forEach((o: any) => {
      if (o) { gsap.killTweensOf(o); gsap.killTweensOf(o.scale); o.destroy({ children: true }); }
    });
    s.art = s.timer = undefined; s.badge = undefined; s.ring = undefined;
    s.aura = undefined; s.spin = undefined;
    s.readyRing = null; s.hinting = false;
  }
  private placeSlot(i: number) {
    const s = this.slots[i] as any;
    if (s.aura) { const q = this.center(i); s.aura.position.set(q.x, q.y); }
    if (s.spin) { const q = this.center(i); s.spin.position.set(q.x, q.y); }
    if (!s.art) return;
    const p = this.center(i);
    const scale = s.key.startsWith('p') ? 0.96 : s.key.startsWith('b') ? 0.78 : 0.92;
    s.art.position.set(p.x, p.y);
    s.art.width = s.art.height = this.cell * scale;
    if (s.timer && s.key.startsWith('b')) s.timer.position.set(p.x + this.cell * 0.28, p.y + this.cell * 0.3);
  }
  private idleBob(i: number) {
    const s = this.slots[i]; if (!s.art) return;
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
    const scale = s.key.startsWith('p') ? 0.96 : s.key.startsWith('b') ? 0.78 : 0.92;
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
    if (flyer) {
      this.lDrag.addChild(flyer);
      gsap.killTweensOf(flyer); gsap.killTweensOf(flyer.scale);
      gsap.to(flyer, { x: target.x, y: target.y, duration: 0.16, ease: 'power2.in' });
      gsap.to(flyer.scale, { x: 0.02, y: 0.02, duration: 0.16, ease: 'power2.in', onComplete: () => flyer.destroy() });
    }
    if (b.art) { gsap.killTweensOf(b.art); gsap.killTweensOf(b.art.scale); }
    b.pending = gsap.delayedCall(0.15, () => {
      this.slots[to].pending = undefined;
      this.fill(to, { id: newId }, 'i' + newId);
      const s = this.slots[to]; if (!s.art) return;
      if (s.idle) { s.idle.kill(); s.idle = undefined; }
      const sc = this.spriteScale(to);
      gsap.fromTo(s.art.scale, { x: sc * 0.25, y: sc * 0.25 }, { x: sc, y: sc, duration: 0.5, ease: 'elastic.out(1,0.5)', onComplete: () => this.idleBob(to) });
      gsap.fromTo(s.art, { rotation: -0.3 }, { rotation: 0, duration: 0.45, ease: 'back.out(3)' });
      this.ringPulse(to, 0xffe9a0);
      this.burst(to, 0xffd45e, 12);
    });
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
    const sp = new Sprite(this.texture('i:scrap'));
    sp.anchor.set(0.5);
    sp.width = sp.height = this.cell * 1.2;
    sp.position.set(this.app.screen.width + 60, -60);
    this.lDrag.addChild(sp);
    const trail = new Graphics();
    this.lFx.addChild(trail);
    const tl = gsap.timeline({
      onUpdate: () => {
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
      .to(sp, { rotation: 6, duration: 0.85, ease: 'none' }, 0);
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
      const p = this.center(i), g = new Graphics();
      g.roundRect(-this.cell / 2 - 2, -this.cell / 2 - 2, this.cell + 4, this.cell + 4, this.cell * 0.26)
        .stroke({ color: 0x6ee04a, width: 4 });
      g.position.set(p.x, p.y);
      this.lFx.addChild(g);
      (s as any).readyRing = g;
      gsap.to(g, { alpha: 0.35, duration: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    } else if (!on && has) {
      const g = (s as any).readyRing; gsap.killTweensOf(g); g.destroy(); (s as any).readyRing = null;
    }
  }
  /** charge count + countdown under a timer producer */
  setBadge(i: number, charges: number, label: string) {
    const s = this.slots[i]; if (!s.art) return;
    const p = this.center(i);
    if (!s.badge) {
      const c = new Container();
      const g = new Graphics();
      g.circle(0, 0, this.cell * 0.17).fill({ color: 0x4fb63a }).stroke({ color: 0xffffff, width: 2 });
      const t = new Text({ text: '', style: { fontFamily: 'Fredoka, sans-serif', fontSize: this.cell * 0.22, fontWeight: '700', fill: 0xffffff } });
      t.anchor.set(0.5); t.label = 'n';
      c.addChild(g, t);
      c.position.set(p.x + this.cell * 0.34, p.y - this.cell * 0.34);
      this.lItem.addChild(c);
      s.badge = c;
    }
    s.badge.visible = charges > 0;
    const nt = s.badge.children.find(ch => (ch as any).label === 'n') as Text;
    if (nt && nt.text !== String(charges)) {
      nt.text = String(charges);
      gsap.fromTo(s.badge.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(3)' });
    }
    if (!s.timer) {
      const t = new Text({ text: '', style: { fontFamily: 'Fredoka, sans-serif', fontSize: this.cell * 0.2, fontWeight: '700', fill: THEME[this.theme].txt } });
      t.anchor.set(0.5);
      t.position.set(p.x, p.y + this.cell * 0.4);
      this.lItem.addChild(t);
      s.timer = t;
    }
    s.timer.text = label;
  }

  /* --------------------------------------------------------------- input */
  private down = (e: any) => {
    const i = this.cellAt(e.global.x, e.global.y);
    if (i < 0) { this.hooks.onTap(-1); return; }
    this.drag = { i, x: e.global.x, y: e.global.y, moved: false };
  };
  private move = (e: any) => {
    const d = this.drag; if (!d) return;
    const dx = e.global.x - d.x, dy = e.global.y - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 7) return;
      if (!this.hooks.canDrag(d.i)) { this.drag = null; return; }
      const s = this.slots[d.i];
      if (!s.art) { this.drag = null; return; }
      d.moved = true;
      d.sprite = s.art;
      if (s.idle) { s.idle.kill(); s.idle = undefined; }
      gsap.killTweensOf(d.sprite); gsap.killTweensOf(d.sprite.scale);
      this.lDrag.addChild(d.sprite);
      const sc = this.spriteScale(d.i);
      gsap.to(d.sprite.scale, { x: sc * 1.2, y: sc * 1.2, duration: 0.14, ease: 'back.out(2)' });
      d.ghostRing = null;
    }
    d.sprite.position.set(e.global.x, e.global.y - this.cell * 0.22);
    const over = this.cellAt(e.global.x, e.global.y);
    if (over !== d.over) {
      d.over = over;
      this.highlightDrop(d.i, over);
    }
  };
  private up = (e: any) => {
    const d = this.drag; this.drag = null;
    if (!d) return;
    this.clearDropHighlight();
    if (!d.moved) { this.hooks.onTap(d.i); return; }
    const to = this.cellAt(e.global.x, e.global.y);
    const home = this.center(d.i);
    const kind = to >= 0 && to !== d.i ? this.hooks.dropKind(d.i, to) : null;
    const sc = this.spriteScale(d.i);
    if (!kind) {                                   // snap back
      gsap.to(d.sprite, { x: home.x, y: home.y, duration: 0.25, ease: 'back.out(2)' });
      gsap.to(d.sprite.scale, { x: sc, y: sc, duration: 0.2, onComplete: () => { this.lItem.addChild(d.sprite); this.idleBob(d.i); } });
      return;
    }
    this.lItem.addChild(d.sprite);
    gsap.to(d.sprite.scale, { x: sc, y: sc, duration: 0.12 });
    this.hooks.onDrop(d.i, to);                    // game decides what happens
  };
  private dropRing: Graphics | null = null;
  private highlightDrop(from: number, to: number) {
    this.clearDropHighlight();
    if (to < 0 || to === from) return;
    const kind = this.hooks.dropKind(from, to);
    if (!kind) return;
    const p = this.center(to), g = new Graphics();
    g.roundRect(-this.cell / 2, -this.cell / 2, this.cell, this.cell, this.cell * 0.24)
      .stroke({ color: kind === 'merge' ? 0x6ee04a : 0x8fd9ff, width: 4 });
    g.position.set(p.x, p.y);
    this.lFx.addChild(g);
    gsap.fromTo(g.scale, { x: 0.9, y: 0.9 }, { x: 1, y: 1, duration: 0.18, ease: 'back.out(3)' });
    this.dropRing = g;
  }
  private clearDropHighlight() {
    if (this.dropRing) { gsap.killTweensOf(this.dropRing); this.dropRing.destroy(); this.dropRing = null; }
  }

  /** snap a sprite back home after the game refuses a drop */
  settle(i: number) {
    const s = this.slots[i]; if (!s.art) return;
    const p = this.center(i);
    gsap.to(s.art, { x: p.x, y: p.y, duration: 0.2, ease: 'back.out(2)' });
  }
}

export const board = new PixiBoard();
