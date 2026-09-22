/* MERGE ROCKET - core game loop. Earth -> rebuild a rocket -> new worlds. */
import { ART } from './art';
// the painted backdrops the camp and the lab stand on
import campEarthBg from './scenes/camp_earth.webp';
import labRoomBg from './scenes/lab.webp';
import { haptic } from './native';
import { board } from './board';
import { ads } from './ads';
import { audio } from './audio';
import {
  ITEMS, CHAINS, PRODUCERS as PRODS, WORLDS, CHARACTERS as CHARS, MISSIONS, CONFIG,
  RECIPES, SHOP, STORY, ITEM_IDS, PRODUCER_ARTS, nextOf, validateContent,
} from './content';

export async function startGame() {
  const $ = (s: string): any => document.querySelector(s);
  const el = (t: string, c?: string) => { const e = document.createElement(t); if (c) e.className = c; return e; };
  const rnd = (a: any[]) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const COLS = CONFIG.board.cols, ROWS = CONFIG.board.rows, N = COLS * ROWS;

  /* Content lives in src/content/*.json — see content/index.ts */
  /* The curve is quadratic: early levels fly by, later ones are a real climb. */
  const xpNeed = (l: number) =>
    Math.round(CONFIG.xp.base + (l - 1) * CONFIG.xp.perLevel + CONFIG.xp.growth * (l - 1) * (l - 1));

  /* ------------------------------------------------------- world progress
     Every world has its OWN level. Land somewhere new and you start small: two
     chains, two producers, a cramped board — then it opens up as you play there.
     The account level (S.lvl) still drives energy, order tiers and the shop, so
     a veteran is not punished, they just get a fresh little world to unwrap. */
  const WMAX = 8;
  const wNeed = (l: number) => Math.round(CONFIG.world.base + (l - 1) * CONFIG.world.perLevel
    + CONFIG.world.growth * (l - 1) * (l - 1));
  const wlv = (w?: string) => (S.wlv && S.wlv[w || S.world]) || 1;
  const wxp = (w?: string) => (S.wxp && S.wxp[w || S.world]) || 0;
  /* ------------------------------------------------- one thing at a time
     A world does not hand you its whole catalogue. It gives you two producers,
     and the next plot only fills once every producer you already have is fully
     grown. Contracts pay for the growing, so the loop is: fill contracts, grow
     what you have, and the world gives you something new to grow. */
  /** the producers this world has revealed so far (they stay listed if one retires) */
  const plots = (w?: string): string[] => {
    const k = w || S.world;
    if (!S.plots) S.plots = {};
    if (!S.plots[k]) S.plots[k] = WORLDS[k].start.map(s2 => s2.producer);
    return S.plots[k];
  };
  /** the chains those producers feed — this is what "unlocked" means now */
  const liveChains = (w?: string) => {
    const k = w || S.world, set: Record<string, 1> = {};
    plots(k).forEach(pk => {
      const p = PRODS[pk]; if (!p) return;
      p.drops.forEach(d => { if (ITEMS[d]) set[ITEMS[d].chain] = 1; });
    });
    return WORLDS[k].chains.filter(c => set[c]);
  };
  const lockedChains = (w?: string) => {
    const live = liveChains(w);
    return WORLDS[w || S.world].chains.filter(c => live.indexOf(c) < 0);
  };
  /** every producer standing in this world is at max level */
  const allMaxed = () => {
    const on = B().filter((c: any) => c && c.p && PRODS[c.p].mode !== 'once');
    return on.length > 0 && on.every((c: any) => plv(c) >= PMAX);
  };
  /** the next producer this world is holding back, in its own order */
  function nextProducer(): string | null {
    const have = plots();
    const g = (W().grow || []).find(x => have.indexOf(x.producer) < 0);
    return g ? g.producer : null;
  }

  /* ------------------------------------------------- shop upgrade effects */
  const upLv = (id: string) => (typeof S !== 'undefined' && S && S.up && S.up[id]) || 0;
  const upPrice = (u: any) => u.basePrice + u.step * upLv(u.id);
  const maxEnergy = () =>
    CONFIG.energy.base + (S.lvl - 1) * CONFIG.energy.perLevel + upLv('energy') * CONFIG.upgrades.energyPerStep;
  const orderSlots = () => CONFIG.orders.slots + upLv('orders') * CONFIG.upgrades.ordersPerStep + vaultLv('crowd');
  const snackAmt = () => CONFIG.energy.snack.amount + upLv('snack') * CONFIG.upgrades.snackPerStep;
  /** a timer producer's refill time, sped up by the Fertiliser upgrade */
  const everyOf = (p: any) =>
    Math.max(3000, Math.round(p.every * Math.max(0.25, 1 - upLv('speed') * CONFIG.upgrades.speedPerStep)
      * (starPerk('seed') ? 0.8 : 1)));
  /* Relic Vault perks feed straight into the numbers the rest of the game reads,
     so a perk is bought once and then never has to be remembered again. */
  const vaultLv = (id: string) => (typeof S !== 'undefined' && S && S.vault && S.vault[id]) || 0;
  const coinMult = () => 1 + vaultLv('rich') * 0.15 + (starPerk('plough') ? 0.1 : 0);
  const xpMult = () => 1 + vaultLv('wise') * 0.25;
  const regenMs = () => Math.round(CONFIG.energy.regenMs / (1 + vaultLv('brisk') * 0.2));
  const meteorScale = () => 1 - vaultLv('comet') * 0.3;
  const shopOpen = () => S.lvl >= CONFIG.unlocks.shopAtLevel;
  /* The lab is a building, not a level reward: it stays invisible until Bloop
     has a rocket to cannibalise and the player pays for the build. */
  const labOpen = () => !!(S.lab && S.lab.built);
  const labOffered = () => !!(S.met && allParts());

  /* =============================================================== STATE */
  const SAVE = 'mergeRocket_v2';   // key kept; the shape is versioned inside (S.v)
  let S: any, cells: any[] = [], view = 'board', drag: any = null, sel: number | null = null,
    hintPair: number[] | null = null, lastAct = Date.now(), meteorTimer = 0;

  function freshBoard(world: string) {
    const w = WORLDS[world], b = new Array(N).fill(null);
    for (const k in w.locks) if (w.locks[k] > 1) b[k] = { b: w.locks[k] };
    w.start.forEach(s => { b[s.cell] = mkProd(s.producer); });
    // a few starter items so the board isn't bare
    const open = w.chains.filter(c => (CHAINS[c].unlock || 1) <= 1);
    const c0 = CHAINS[open[0]].items[0], c1 = CHAINS[open[1] || open[0]].items[0];
    [13, 16, 25, 28].forEach((i, k) => { if (!b[i]) b[i] = { id: k % 2 ? c1 : c0 }; });
    return b;
  }
  function mkProd(k: string) {
    const p = PRODS[k], o: any = { p: k, lv: 1 };
    // a new producer arrives charged: nothing about a fresh thing should be a wait
    if (p.mode === 'battery') { o.ch = capOf(p, 1); o.at = Date.now(); }
    if (p.uses) o.u = p.uses;
    return o;
  }
  function fresh() {
    return {
      v: 6, world: 'earth', lvl: 1, xp: 0, coins: CONFIG.start.coins, energy: CONFIG.start.energy, eAt: Date.now(),
      boards: { earth: freshBoard('earth') },
      orders: [], seen: { twig: 1, pebble: 1 }, parts: { hull: 0, engine: 0, nav: 0, tank: 0 },
      fuel: 0, mp: {}, met: 0, unlocked: {}, snackAt: 0, sound: 1, music: 1, tut: 0,
      /* v3: coin sinks */
      up: {},                                   // upgrade id -> level bought
      shop: { stock: null, at: 0 },             // rotating supply shelf
      lab: { disc: {}, clue: {}, slots: [null, null], tries: 0, made: 0 },
      made: {},                                 // item id -> how many you have ever owned
      /* v4: bag, boosters, dailies, streaks, the cargo ship */
      bag: [],                                  // items stashed off the board
      boost: {},                                // booster id -> how many you hold
      daily: { key: 0, day: 0 },                // login calendar
      streak: 0, streakAt: 0,                   // merge combo
      ship: null, shipAt: 0,                    // the timed cargo event
      /* v5: relic vault, star forge, tasks, world events */
      vault: {},                                // permanent perk id -> level
      tasks: [], tasksAt: 0, tc: {},            // the rotating goal board + counters
      perkAt: 0, ordersAt: 0,
      /* v6: per-world progress, the Seed Vault story, minigames */
      wlv: { earth: 1 }, wxp: { earth: 0 },   // each world levels on its own
      fed: {}, stage: {},                     // Bloom value delivered / stages woken
      story: {},                              // story beats already played
      mini: {}, stars: {},                    // minigame cooldowns, lit constellations
      plots: {},                              // producers each world has revealed
      firsts: {},                             // chains whose finale you have made
    };
  }
  /** Old saves keep their progress — missing fields are simply filled in. */
  function migrate(p: any) {
    p.up = p.up || {};
    p.shop = p.shop || { stock: null, at: 0 };
    p.lab = p.lab || { disc: {}, clue: {}, slots: [null, null], tries: 0, made: 0 };
    p.lab.disc = p.lab.disc || {}; p.lab.clue = p.lab.clue || {};
    if (!Array.isArray(p.lab.slots) || p.lab.slots.length !== 2) p.lab.slots = [null, null];
    p.made = p.made || {};
    if (p.music === undefined) p.music = 1;
    if (!Array.isArray(p.bag)) p.bag = [];
    p.boost = p.boost || {};
    p.daily = p.daily || { key: 0, day: 0 };
    p.streak = p.streak || 0; p.streakAt = p.streakAt || 0;
    if (p.ship === undefined) p.ship = null;
    p.shipAt = p.shipAt || 0;
    p.vault = p.vault || {};
    if (!Array.isArray(p.tasks)) p.tasks = [];
    p.tasksAt = p.tasksAt || 0; p.tc = p.tc || {};
    p.perkAt = p.perkAt || 0; p.ordersAt = p.ordersAt || 0;
    p.wlv = p.wlv || {}; p.wxp = p.wxp || {};
    p.fed = p.fed || {}; p.stage = p.stage || {};
    p.story = p.story || {}; p.mini = p.mini || {}; p.stars = p.stars || {};
    p.plots = p.plots || {};
    p.firsts = p.firsts || {};
    // A pre-v6 save had one global level. Seed each visited world from it so
    // nobody who already flew to Cindra lands back on a beginner board — but cap
    // it low enough that there is still something left to unlock. Dropping a
    // world level never re-blocks a cell: only onWorldLevel() touches locks, and
    // it only ever clears them.
    Object.keys(p.boards || {}).forEach(w => {
      if (!p.boards[w]) return;
      if (!p.wlv[w]) p.wlv[w] = clamp(p.lvl || 1, 1, 4);
      if (p.wxp[w] === undefined) p.wxp[w] = 0;
    });
    if (!p.wlv[p.world]) p.wlv[p.world] = 1;
    // The catalogue was rewritten between v5 and v6, so an old board can be
    // holding an item id that no longer exists. Sweep those out rather than
    // crashing the first time something asks for their sell price.
    Object.keys(p.boards || {}).forEach(w => {
      const b = p.boards[w]; if (!Array.isArray(b)) return;
      for (let i = 0; i < b.length; i++) {
        const c = b[i]; if (!c) continue;
        if (c.id && !ITEMS[c.id]) b[i] = null;
        else if (c.p && !PRODS[c.p]) b[i] = null;
      }
    });
    if (Array.isArray(p.bag)) p.bag = p.bag.filter((id: string) => !!ITEMS[id]);
    if (Array.isArray(p.lab && p.lab.slots)) p.lab.slots = p.lab.slots.map((id: any) => (id && ITEMS[id]) ? id : null);
    p.v = 6;
    return p;
  }
  function load() {
    try {
      const r = localStorage.getItem(SAVE);
      if (r) { const p = JSON.parse(r); if (p && p.v >= 2 && p.v <= 6 && p.boards) return migrate(p); }
    } catch (e) { }
    return fresh();
  }
  function save() { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) { } }
  const B = () => S.boards[S.world];
  const W = () => WORLDS[S.world];

  /* ================================================================ AUDIO */
  /* Real recorded-quality effects and music beds live in src/audio (generated by
     scripts/make-audio.py). This layer only decides *which* sound an event makes;
     src/audio.ts owns the mixer, and every call is safe before the first gesture. */
  const sfx = {
    tap: () => audio.playVary('tap', 0.08, 0.5),
    pop: () => audio.playVary('pop', 0.08),
    popHi: () => audio.playVary('pop_hi', 0.08),
    /** merge sounds climb with the tier you just made */
    merge: (tier = 1) => audio.playVary('merge' + clamp(tier, 1, 5), 0.04),
    big: () => audio.play('levelup'),
    coin: () => audio.playVary('coin', 0.05),
    sell: () => audio.playVary('sell', 0.05),
    boom: () => { audio.play('meteor'); audio.duck(2.4, 0.18); },
    no: () => audio.play('error', { gain: 0.8 }),
    install: () => { audio.play('install'); audio.duck(1.2); },
    fuel: () => audio.play('fuel'),
    dig: () => audio.playVary('dig', 0.1),
    whoosh: () => audio.playVary('whoosh', 0.1, 0.7),
    discover: () => { audio.play('discover'); audio.duck(2, 0.15); },
    build: () => { audio.play('build'); audio.duck(1.6); },
    launch: () => { audio.play('launch'); audio.duck(3, 0.1); },
    boost: () => audio.play('boost'),
    bag: () => audio.playVary('bag', 0.08, 0.8),
    streak: (n: number) => audio.play('streak' + clamp(n, 1, 5)),
  };
  /** the music bed a world plays */
  /** every world has its own bed now (see scripts/make-audio.py) */
  const worldMusic = (w: string) => 'music_' + (WORLDS[w] ? w : 'earth');

  /* ==================================================================== FX */
  let toastT: any = 0;
  function toast(msg: string) {
    const t = $('#toast'); t.innerHTML = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2100);
  }
  const hex = (c?: string) => c ? parseInt(c.replace('#', ''), 16) : undefined;
  function floatText(i: number, txt: string, color?: string) { board.floatText(i, txt, hex(color) ?? 0xffffff); }
  function sparkle(i: number, n?: number, color?: string) { board.burst(i, hex(color) ?? 0xffd45e, n || 12); }
  function confetti() {
    const host = $('#fx'), cols = ['#ffcb3d', '#ff7fb6', '#6ed156', '#56bcff', '#a77bff'];
    for (let i = 0; i < 26; i++) {
      const c = el('div', 'confetti');
      c.style.cssText = `left:${10 + Math.random() * 80}%;top:-20px;background:${rnd(cols)};animation-delay:${Math.random() * .4}s`;
      host.appendChild(c); setTimeout(() => c.remove(), 2200);
    }
  }
  function shake() { board.shake(); }
  /* Screens are DOM, not Pixi, so spending coins there needs its own float —
     without it a purchase just silently changes a number in the header. */
  let lastClick: HTMLElement | null = null;
  document.addEventListener('pointerdown', (e: any) => {
    lastClick = (e.target && e.target.closest) ? e.target.closest('button') : null;
  }, true);
  function floatOn(target: HTMLElement | null, txt: string, color?: string) {
    const host = $('#app'); if (!host) return;
    const t = target && document.body.contains(target) ? target : $('#chipCoins');
    if (!t) return;
    const a = host.getBoundingClientRect(), r = t.getBoundingClientRect();
    const d = el('div', 'domFloat');
    d.textContent = txt;
    if (color) d.style.color = color;
    d.style.left = (r.left - a.left + r.width / 2) + 'px';
    d.style.top = (r.top - a.top - 6) + 'px';
    host.appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }
  /** pay coins, and make the payment visible wherever the player pressed */
  function spend(n: number) {
    S.coins -= n; bumpChip('#chipCoins');
    floatOn(lastClick, '−' + n + ' 🪙', '#ffd45e');
  }

  /* ================================================================ RENDER */
  async function buildBoard() {
    await board.init($('#board'), COLS, ROWS, {
      onTap: (i: number) => { if (i < 0) { sel = null; hideInfo(); board.setSelected(null); } else tap(i); },
      onDrop: (from: number, to: number) => onDrop(from, to),
      dropKind: (from: number, to: number) => {
        const b = B(), a = b[from], c = b[to];
        if (!a || a.b) return null;
        if (!c) return 'move';
        if (mergeResult(a.id, c.id)) return 'merge';
        return null;
      },
      canDrag: (i: number) => { const c = B()[i]; return !!c && !c.b; },
    });
    await board.preload(ITEM_IDS, PRODUCER_ARTS);
    board.setTheme(S.world);
  }

  function onDrop(from: number, to: number) {
    const b = B(), a = b[from], c = b[to];
    lastAct = Date.now();
    sel = null; board.setSelected(null); hideInfo();
    if (!a) return;
    if (c && mergeResult(a.id, c.id)) { tryMerge(from, to); return; }
    if (!c) { b[to] = a; b[from] = null; board.sync(b); sfx.pop(); save(); return; }
    board.settle(from);
  }
  function paintCell(_i?: number, _anim?: string) { board.sync(B()); }
  function paintBoard() { board.sync(B()); board.setSelected(sel); board.setHint(hintPair); }

  function tickProducers() {
    const now = Date.now();
    for (let i = 0; i < N; i++) {
      const c = B()[i]; if (!c || !c.p) continue;
      const p = PRODS[c.p];
      if (p.mode === 'energy') {
        const cost = ecost(p, plv(c));
        board.setCost(i, cost, S.energy >= cost);
        board.setReady(i, S.energy >= cost);
        continue;
      }
      if (p.mode !== 'battery') { board.setReady(i, true); continue; }
      const cap = capOf(p, plv(c)), ev = everyOf(p);
      if (c.ch === undefined) { c.ch = cap; c.at = now; }
      while (c.ch < cap && now - c.at >= ev) { c.at += ev; c.ch++; }
      if (c.ch >= cap) c.at = now;
      // the countdown is only interesting when the battery is nearly out —
      // a ticking clock under a full tree is just noise
      const low = c.ch === 0 || c.ch <= cap * 0.2;
      board.setCharge(i, c.ch, cap, low && c.ch < cap ? mmss(ev - (now - c.at)) : '');
      board.setReady(i, c.ch > 0);
    }
  }

  function renderHUD() {
    $('#coins').textContent = S.coins;
    $('#energy').textContent = S.energy + '/' + maxEnergy();
    $('#lvl').textContent = S.lvl;
    $('#xpTxt').textContent = S.xp + '/' + xpNeed(S.lvl);
    $('#xpFill').style.width = clamp(S.xp / xpNeed(S.lvl) * 100, 0, 100) + '%';
    const app = $('#app');
    WORLD_ORDER.forEach(w => app.classList.toggle(w, S.world === w));
    $('#worldName').textContent = W().name;
    $('#worldIcon').innerHTML = ART.planet(W().planet);
    const m = curMission();
    $('#guideFace').innerHTML = ART.char(S.met ? 'bloop' : 'pip');
    $('#guideTxt').innerHTML = m ? m.hint : '<b>Nice!</b> Keep merging, trading and exploring — more worlds are waiting.';
    $('#tabRocket').classList.toggle('locked', false);
    $('#tabMap').classList.toggle('locked', false);
    const essence = B().some((c: any) => c && c.id && bloomValue(c.id) > 0);
    $('#dotWorld').style.display = essence && !worldAwake() ? '' : 'none';
    $('#tabShop').classList.toggle('locked', !shopOpen());
    $('#tabLab').classList.toggle('hide', !labOpen());
    $('#dotRocket').style.display = tasksDone() > 0 ? '' : 'none';
    const cur = curMission();
    $('#questTxt').textContent = cur ? cur.text : 'All done!';
    $('#dotQuest').style.display = cur && (S.mp[cur.id] || 0) >= cur.need ? '' : 'none';
    $('#dotShop').style.display = (shopNews() || (labOffered() && !S.lab.built)) ? '' : 'none';
    renderTools();
    if (view === 'shop') $('#shopCoins').textContent = S.coins;
    if (view === 'lab') $('#labCoins').textContent = S.coins;
  }
  function curMission() { return MISSIONS.find(m => (S.mp[m.id] || 0) < m.need); }
  function readyParts() { return !allParts() && Object.keys(S.parts).some(k => !S.parts[k]); }
  const allParts = () => S.parts.hull && S.parts.engine && S.parts.nav && S.parts.tank;

  function countItem(id: string) { let n = 0; const b = B(); for (let i = 0; i < N; i++) if (b[i] && b[i].id === id) n++; return n; }
  /** What two tiles make when dropped together — null if they do not combine.
   *  A Rainbow Gem stands in for whatever it lands on, which is the whole point
   *  of it, so every merge check in the game goes through here. */
  function mergeResult(x?: string, y?: string): string | null {
    if (!x || !y) return null;
    if (x === y) return x === 'rainbow' ? null : nextOf(x);
    if (x === 'rainbow') return nextOf(y);
    if (y === 'rainbow') return nextOf(x);
    return null;
  }

  /** everything the player owns right now, id -> count (for the lab picker) */
  function inventory() {
    const inv: Record<string, number> = {}, b = B();
    for (let i = 0; i < N; i++) if (b[i] && b[i].id) inv[b[i].id] = (inv[b[i].id] || 0) + 1;
    return inv;
  }
  /** record an item the player has just obtained — feeds the Guide catalogue */
  function gotItem(id: string) { S.seen[id] = 1; S.made[id] = (S.made[id] || 0) + 1; }
  /** drop an item onto the board near `from`; returns the cell or -1 if the board is full */
  function giveItem(id: string, from?: number) {
    const anchored = from !== undefined && from >= 0;
    const spot = anchored ? nearFree(from as number) : (freeCells()[0] ?? -1);
    if (spot < 0) return -1;
    B()[spot] = { id }; gotItem(id);
    // with no origin, arc it in from a couple of rows up so it reads as a delivery
    const src = anchored ? (from as number) : (spot >= COLS * 2 ? spot - COLS * 2 : spot);
    board.animSpawn(spot, id, src);
    return spot;
  }

  /* --------------------------------------------------- rocket part helpers */
  const PART_KEYS = ['hull', 'engine', 'nav', 'tank'];
  const partsLeft = () => PART_KEYS.filter(k => !S.parts[k]);
  /** how far along a part chain the loose pieces on the board add up to (a part needs 4) */
  function partProgress(k: string) {
    const ids = CHAINS[k].items, b = B(); let score = 0;
    for (let i = 0; i < N; i++) {
      const c = b[i]; if (!c || !c.id) continue;
      const n = ids.indexOf(c.id);
      if (n >= 0) score += Math.pow(2, n);
    }
    return score;
  }
  /** the part chain that most needs help right now */
  function neediestPart() {
    const left = partsLeft(); if (!left.length) return null;
    const ranked = left.map(k => ({ k, s: partProgress(k) })).sort((a, c) => a.s - c.s);
    const low = ranked[0].s;
    return rnd(ranked.filter(x => x.s <= low + 1)).k;
  }
  /** a piece for the part you are furthest from finishing — never a wasted drop */
  function partPiece(biasHigh?: boolean) {
    const k = neediestPart(); if (!k) return null;
    const ids = CHAINS[k].items;
    return Math.random() < (biasHigh ? 0.5 : 0.28) ? ids[1] : ids[0];
  }

  function renderOrders(newIds?: string[]) {
    const host = $('#orders'); host.innerHTML = '';
    if (S.ship) host.appendChild(shipCard());
    // Two customers can want the same thing. Claim stock card by card so one
    // item never lights up two cards as ready — delivering the first used to
    // leave the second showing GIVE IT with nothing behind it.
    const stock = inventory();
    const claim: Record<string, number> = {};
    const held = (id: string) => Math.max(0, (stock[id] || 0) - (claim[id] || 0));
    S.orders.forEach(o => {
      const ready = o.needs.every(nd => held(nd.id) >= nd.qty);
      if (ready) o.needs.forEach(nd => { claim[nd.id] = (claim[nd.id] || 0) + nd.qty; });
      const card = el('div', 'order' + (ready ? ' ready' : '') + (newIds && newIds.indexOf(o.id) >= 0 ? ' newin' : ''));
      const ch = CHARS[o.char];
      card.innerHTML =
        `<div class="oTop">
           <div class="oFig">${ART.figure(o.char)}</div>
           <div class="oWho"><div class="oName">${ch.name}</div><div class="oSay">${o.say}</div>
             <div class="oRews"><span class="oRew">${ART.icon('coin')}${o.coins}</span><span class="oRew">${ART.icon('star')}${o.xp}</span>
             ${o.give ? `<span class="oRew gift" title="Gift: ${ITEMS[o.give].name}">${ART.item(o.give)}</span>` : ''}</div>
           </div>
         </div>
         <div class="oNeeds">${o.needs.map(nd => {
          const have = Math.min(ready ? nd.qty : held(nd.id), nd.qty);
          return `<div class="oNeed${have >= nd.qty ? ' done' : ''}" data-need="${nd.id}">${ART.item(nd.id)}<b>${have}/${nd.qty}</b></div>`;
        }).join('')}</div>
         <button class="btnDeliver${ready ? ' on' : ''}">${ready ? 'GIVE IT!' : 'FIND IT'}</button>`;
      (card.querySelector('.btnDeliver') as HTMLElement).onclick = (ev: Event) => { ev.stopPropagation(); ready ? deliver(o.id) : findFor(o); };
      // tapping the thing they want explains where it comes from, which is the
      // question a new player actually has
      card.querySelectorAll('[data-need]').forEach((n: any) => n.onclick = (ev: Event) => {
        ev.stopPropagation(); chainPanel(n.dataset.need);
      });
      card.onclick = () => findFor(o);
      host.appendChild(card);
    });
    orderArrows();
    // the order row is the tallest variable block above the board; once it has
    // settled the board re-measures so its last row never hides under the dock
    board.layout();
  }
  /** show the side arrows only when the contract row actually overflows */
  function orderArrows() {
    const row = $('#orders'), L = $('#oLeft'), R = $('#oRight');
    if (!row || !L || !R) return;
    const over = row.scrollWidth - row.clientWidth > 8;
    L.classList.toggle('on', over && row.scrollLeft > 4);
    R.classList.toggle('on', over && row.scrollLeft < row.scrollWidth - row.clientWidth - 4);
  }
  function scrollOrders(dir: number) {
    const row = $('#orders');
    row.scrollBy({ left: dir * 160, behavior: 'smooth' });
    sfx.tap();
    setTimeout(orderArrows, 360);
  }
  function shipCard() {
    const sh = S.ship;
    const ready = sh.needs.every((nd: any) => countItem(nd.id) >= nd.qty);
    const left = Math.max(0, sh.endsAt - Date.now());
    const card = el('div', 'order ship' + (ready ? ' ready' : ''));
    card.innerHTML =
      `<div class="shipTop">${ART.icon('ship')}
         <div style="flex:1"><div class="shipName">Cargo Ship</div>
           <div class="shipTime" id="shipTime">${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}</div></div>
         <div class="oRew">${ART.icon('coin')}${sh.coins}</div></div>
       <div class="oNeeds">${sh.needs.map((nd: any) => {
        const have = Math.min(countItem(nd.id), nd.qty);
        return `<div class="oNeed${have >= nd.qty ? ' done' : ''}">${ART.item(nd.id)}<b>${have}/${nd.qty}</b></div>`;
      }).join('')}</div>
       <button class="btnDeliver${ready ? ' on' : ''}">${ready ? 'LOAD IT!' : 'FILL THE HOLD'}</button>`;
    (card.querySelector('.btnDeliver') as HTMLElement).onclick = (ev: Event) => { ev.stopPropagation(); deliverShip(); };
    return card;
  }

  /* ---------------------------------------------------- "where do I get one?"
     Tapping the item on a contract opens its whole chain, marks how many of
     each you are holding, and points at the thing on your board that makes the
     first one. It is the single question a new player has, every time. */
  function chainPanel(id: string) {
    const d = ITEMS[id]; if (!d) return;
    tutFire('chain');
    const ch = CHAINS[d.chain], inv = inventory();
    const src = producerFor(id);
    const steps = ch.items.map((x, n) => {
      const have = inv[x] || 0, known = S.seen[x];
      return `<div class="chStep${x === id ? ' want' : ''}${n + 1 > d.tier ? ' above' : ''}">
        <div class="chArt${known ? '' : ' unk'}">${known ? ART.item(x) : '?'}</div>
        <div class="chLab">${known ? ITEMS[x].name : '???'}</div>
        <span class="chHave${have ? ' on' : ''}">×${have}</span></div>`
        + (n < ch.items.length - 1 ? '<div class="chArrow">+</div>' : '');
    }).join('');
    const where = d.chain === 'relic' ? `Relics are not grown — invent them in the 🔬 <b>Research Lab</b>.`
      : d.chain === 'bloom' ? `Bloom Essence comes from finishing a merge chain for the first time.`
        : src ? `Start with <b>${ITEMS[ch.items[0]].name}</b> from the <b>${PRODS[src.k].name}</b>${src.on ? ' on your board' : ' — you do not have one here yet'}, then merge two of each into the next.`
          : `Merge two of the one before it. ${ITEMS[ch.items[0]].name} is the bottom of this chain.`;
    modal(S.met ? 'bloop' : 'pip', ITEMS[id].name,
      `<div class="chainWrap">${steps}</div>
       <div class="noteLine" style="text-align:left">${where}</div>
       ${src && src.on ? `<div class="srcBox">${ART.producer(PRODS[src.k].art)}
          <div><b>${PRODS[src.k].name}</b><i>${(B()[src.i].ch ?? 0)}/${capOf(PRODS[src.k], plv(B()[src.i]))} charges</i></div></div>
         <button class="big" id="showSrc">Show me on the board</button>` : ''}`,
      'Got it');
    setTimeout(() => {
      const b2 = $('#showSrc');
      if (b2 && src && src.on) b2.onclick = () => {
        closeModal(); setView('board');
        hintPair = [src.i]; board.setHint(hintPair);
        setTimeout(() => { hintPair = null; board.setHint(null); }, 2600);
      };
    }, 30);
  }
  /** the producer that starts this item's chain, and whether one is on the board */
  function producerFor(id: string) {
    const base = CHAINS[ITEMS[id].chain].items[0];
    for (const k in PRODS) {
      if (PRODS[k].drops.indexOf(base) < 0) continue;
      const b = B();
      for (let i = 0; i < N; i++) if (b[i] && b[i].p === k) return { k, i, on: true };
      return { k, i: -1, on: false };
    }
    return null;
  }

  function findFor(o: any) {
    const need = o.needs.find(nd => countItem(nd.id) < nd.qty) || o.needs[0];
    const b = B(); let at = -1;
    for (let i = 0; i < N; i++) if (b[i] && b[i].id === need.id) { at = i; break; }
    if (at >= 0) { hintPair = [at]; board.setHint(hintPair); setTimeout(() => { hintPair = null; board.setHint(null); }, 1800); toast('Here it is! ' + ITEMS[need.id].name); }
    else {
      const src = sourceHint(need.id);
      toast('Need <b>' + ITEMS[need.id].name + '</b> — ' + src);
    }
  }
  function sourceHint(id: string) {
    const d = ITEMS[id], ids = CHAINS[d.chain].items, base = ids[0];
    if (d.chain === 'relic') return 'invent it in the 🔬 Lab';
    for (const k in PRODS) if (PRODS[k].drops.indexOf(base) >= 0) {
      const on = B().some(c => c && c.p === k);
      return (on ? 'tap the ' : 'find the ') + PRODS[k].name + (d.tier > 1 ? ' and merge up' : '');
    }
    return 'merge smaller ones together';
  }

  /* ================================================================ ORDERS */
  let oid = 1;
  function rollOrder() {
    const w = W(), maxT = clamp(1 + Math.floor(S.lvl / CONFIG.orders.maxTierAtLevel), 1, 5);
    // only ask for things the player can actually make right now: a chain counts
    // if one of its producers is sitting on the board
    const live: Record<string, boolean> = {};
    B().forEach(c => {
      if (!c || !c.p) return;
      PRODS[c.p].drops.forEach((d: string) => { live[ITEMS[d].chain] = true; });
    });
    let pool: string[] = [];
    const open = liveChains();
    open.forEach(c => { if (live[c]) CHAINS[c].items.forEach(id => { if (ITEMS[id].tier <= maxT) pool.push(id); }); });
    if (!pool.length) open.forEach(c => CHAINS[c].items.forEach(id => { if (ITEMS[id].tier <= maxT) pool.push(id); }));
    if (S.seen.scrap && Math.random() < 0.15) pool.push('scrap');
    if (S.met && !allParts() && Math.random() < 0.12) pool.push(rnd(['bolt', 'spring', 'wire', 'glass']));
    // collectors start asking for relics once you have made one
    if (S.seen.relic1 && Math.random() < 0.14) pool.push('relic1');
    const pick = rnd(pool), d = ITEMS[pick];
    const needs = [{ id: pick, qty: d.tier >= 3 ? 1 : 1 + Math.floor(Math.random() * 2) }];
    if (S.lvl >= 4 && Math.random() < 0.3) {
      const p2 = rnd(pool.filter(x => x !== pick));
      if (p2) needs.push({ id: p2, qty: 1 });
    }
    const worth = needs.reduce((a, nd) => a + ITEMS[nd.id].sell * nd.qty, 0);
    const folks = W().folks.concat(S.met ? ['bloop'] : []);
    const char = rnd(folks);
    // Orders are the steady drip that keeps the rocket build moving: while parts
    // are missing, most customers pay you back with a piece you still need.
    let give: string | null = null;
    if (S.met && !allParts() && Math.random() < CONFIG.orders.partRewardChance) give = partPiece(true);
    else if (Math.random() < CONFIG.orders.itemRewardChance) {
      const bonus = pool.filter(x => ITEMS[x].tier >= 2 && ITEMS[x].tier <= Math.max(2, maxT));
      if (bonus.length) give = rnd(bonus);
    }
    return {
      id: 'o' + (oid++), char, say: rnd(CHARS[char].lines), give,
      needs,
      coins: Math.round((Math.round(worth * (2 + Math.random())) + 8) * coinMult()),
      xp: Math.round((CONFIG.xp.orderBase + needs.reduce((a, nd) => a + ITEMS[nd.id].tier * 2 + nd.qty, 0)) * xpMult()),
    };
  }
  /** How many contracts are on offer right now. It drifts between a floor and
   *  the cap so the row is not always the same three cards. */
  function orderTarget() {
    const cap = orderSlots(), min = Math.min(CONFIG.orders.minSlots, cap);
    if (S.orderCap === undefined || S.orderCap > cap || S.orderCap < min) {
      S.orderCap = min + Math.floor(Math.random() * (cap - min + 1));
    }
    return S.orderCap;
  }
  function fillOrders(all?: boolean) {
    const want = all ? orderSlots() : orderTarget();
    let guard = 0;
    while (S.orders.length < want && guard++ < 40) {
      const o = rollOrder();
      if (S.orders.some(x => x.char === o.char) && guard < 30) continue;
      S.orders.push(o);
    }
  }
  /** a new contract drifts in every so often rather than the instant one leaves */
  function orderTick(now: number) {
    if (!S.ordersAt) { S.ordersAt = now + CONFIG.orders.refillMs; return; }
    if (now < S.ordersAt) return;
    S.ordersAt = now + CONFIG.orders.refillMs;
    S.orderCap = undefined;
    if (S.orders.length >= orderTarget()) return;
    const before = S.orders.length;
    fillOrders();
    if (S.orders.length > before) { renderOrders([S.orders[S.orders.length - 1].id]); sfx.tap(); save(); }
  }
  function deliver(id: string) {
    const o = S.orders.find(x => x.id === id); if (!o) return;
    const b = B();
    // Never pay out for goods that are not there: check first, then take.
    const short = o.needs.filter(nd => countItem(nd.id) < nd.qty);
    if (short.length) {
      sfx.no();
      toast('You need ' + short.map(nd => `${nd.qty}× <b>${ITEMS[nd.id].name}</b>`).join(' and ') + ' first.');
      renderOrders();
      return;
    }
    o.needs.forEach(nd => { let left = nd.qty; for (let i = 0; i < N && left; i++) if (b[i] && b[i].id === nd.id) { b[i] = null; left--; sparkle(i, 8, '#ffe9a8'); } });
    S.coins += o.coins; bumpChip('#chipCoins');
    const idx = S.orders.findIndex(x => x.id === id);
    S.orders.splice(idx, 1);
    S.orderCap = undefined;
    // keep at least the floor filled straight away; the rest drift in on the timer
    if (S.orders.length < Math.min(CONFIG.orders.minSlots, orderSlots())) fillOrders();
    S.ordersAt = Date.now() + CONFIG.orders.refillMs * 0.6;
    sfx.coin(); toast(`${CHARS[o.char].name}: thank you! +${o.coins} coins`);
    if (o.give) {
      const at = giveItem(o.give);
      if (at >= 0) setTimeout(() => toast(`🎁 ${CHARS[o.char].name} threw in a <b>${ITEMS[o.give].name}</b>!`), 1300);
      else setTimeout(() => toast(`${CHARS[o.char].name} had a gift but your board is full!`), 1300);
    }
    prog('deliver', 1); tally('deliver');
    addXp(o.xp);
    paintBoard(); tutFire('deliver');
    renderOrders(); renderHUD(); save();
  }
  function bumpChip(sel2: string) { const c = $(sel2); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }

  /* ============================================================ PROGRESSION */
  function addXp(n: number) {
    S.xp += n; let up = false;
    while (S.xp >= xpNeed(S.lvl)) { S.xp -= xpNeed(S.lvl); S.lvl++; up = true; onLevel(); }
    if (up) { levelBanner(); prog('level', 0, S.lvl); }
    addWorldXp(n);
    renderHUD();
  }
  /** XP earned here also grows *this world*, which is what opens its content */
  function addWorldXp(n: number) {
    const w = S.world;
    if (wlv(w) >= WMAX) return;
    S.wxp[w] = wxp(w) + n;
    while (wlv(w) < WMAX && S.wxp[w] >= wNeed(wlv(w))) {
      S.wxp[w] -= wNeed(wlv(w));
      S.wlv[w] = wlv(w) + 1;
      onWorldLevel();
    }
  }
  function onLevel() {
    S.energy = maxEnergy();
    if (S.lvl === CONFIG.unlocks.shopAtLevel) setTimeout(() => modal('pip', 'The Trading Post!',
      'A trader rolled into the meadow! Tap 🛒 to spend your coins on materials, salvage crates, and <b>permanent upgrades</b> — a bigger energy backpack, faster plants, an extra order slot. Coins are for spending!',
      'Take my coins!'), 2300);
    paintBoard();
  }
  /** the good bit: a world level is what actually hands you new things to merge */
  function onWorldLevel() {
    const lv = wlv(), b = B(), locks = W().locks;
    for (const k in locks) if (locks[k] <= lv && b[k] && b[k].b) b[k] = null;
    const opened: string[] = [];         // chains come from producers now, not levels
    paintBoard();
    if (opened.length) {
      const names = opened.map(c => CHAINS[c].name);
      setTimeout(() => {
        sfx.discover(); confetti();
        modal(W().folks[0] || 'bloop', 'Something new is growing!',
          `The ${W().name} remembers a little more of itself. <b>${names.join('</b> and <b>')}</b> ${names.length > 1 ? 'have' : 'has'} come back — look for the new patch on your board.`,
          'Show me!');
      }, 900);
    } else {
      setTimeout(() => toast('🌍 <b>' + W().name + '</b> reached world level ' + lv + '!'), 700);
    }
    checkStory();
    renderHUD();
  }
  function levelBanner() {
    sfx.big(); haptic('medium'); confetti();
    const lu = $('#levelup');
    $('#luTxt').textContent = 'LEVEL ' + S.lvl + '!';
    $('#luSub').textContent = 'Energy refilled • weeds cleared';
    lu.classList.remove('show'); void lu.offsetWidth; lu.classList.add('show');
    setTimeout(() => lu.classList.remove('show'), 2100);
    if (S.lvl >= CONFIG.meteor.firstAtLevel && !S.met) setTimeout(meteorStory, 1800);
  }
  function prog(id: string, add?: number, setTo?: number) {
    const m = MISSIONS.find(x => x.id === id); if (!m) return;
    const was = S.mp[id] || 0; if (was >= m.need) return;
    S.mp[id] = setTo !== undefined ? setTo : was + add;
    if (S.mp[id] >= m.need) {
      S.coins += m.coins; bumpChip('#chipCoins'); sfx.coin();
      setTimeout(() => toast('✅ ' + m.text + ' — +' + m.coins + ' coins!'), 600);
    }
    renderHUD(); renderRocket();
  }

  /* ============================================================== ACTIONS */
  function freeCells() { const b = B(), o = []; for (let i = 0; i < N; i++) if (!b[i]) o.push(i); return o; }
  function firstFree(list: number[]) { const b = B(); for (const i of list) if (!b[i]) return i; return freeCells()[0] ?? -1; }
  function nearFree(from: number) {
    const free = freeCells(); if (!free.length) return -1;
    const fx = from % COLS, fy = (from / COLS) | 0;
    free.sort((a, c) => (Math.abs(a % COLS - fx) + Math.abs(((a / COLS) | 0) - fy)) - (Math.abs(c % COLS - fx) + Math.abs(((c / COLS) | 0) - fy)));
    return free[0];
  }
  function useProducer(i: number) {
    const b = B(), c = b[i]; if (!c || !c.p) return;
    const p = PRODS[c.p];
    const spot = nearFree(i);
    if (spot < 0) { sfx.no(); toast('No space! Merge some items first.'); return; }
    if (p.mode === 'battery') {
      if (!c.ch) { sfx.no(); offerRecharge(i); return; }
      const cap = capOf(p, plv(c));
      if (c.ch >= cap) c.at = Date.now();          // start the clock on the first tap
      c.ch--;
    } else if (p.mode === 'energy') {
      const cost = ecost(p, plv(c));
      if (S.energy < cost) {
        sfx.no(); bumpChip('#chipEnergy');
        toast(`Out of energy — ${p.name} costs <b>${cost} ⚡</b> a tap. It comes back on its own, or take a 🍪 Snack Break.`);
        return;
      }
      S.energy -= cost; S.eAt = S.eAt || Date.now();
      bumpChip('#chipEnergy'); floatText(i, '-' + cost + ' ⚡', '#9be8ff');
    }
    // The wreck is not a slot machine: it hands out pieces for the part you are
    // furthest from finishing, so the rocket always creeps forward.
    const id = (c.p === 'wreck' && !allParts() ? partPiece() : null) || rnd(dropsOf(p, plv(c)));
    b[spot] = { id }; gotItem(id);
    (c.p === 'crater' || c.p === 'wreck' ? sfx.dig : sfx.pop)();
    haptic('light'); board.animSpawn(spot, id, i);
    if (c.p === 'tree') prog('spawn', 1);
    tutFire('spawn');
    tally(c.p === 'crater' ? 'dig' : 'spawn');
    if (plv(c) >= PMAX) retireTick(i);
    // producers that run out (meteor craters) count down and then collapse
    if (p.uses) {
      c.u = (c.u === undefined ? p.uses : c.u) - 1;
      if (c.u <= 0) {
        b[i] = null;
        setTimeout(() => { sparkle(i, 16, '#c9a678'); toast('The crater is empty now — wait for the next meteor.'); paintBoard(); }, 420);
      } else {
        floatText(i, c.u + ' left', '#ffe9a8');
      }
      paintBoard();
    }
    lastAct = Date.now(); renderHUD(); renderOrders(); save();
  }
  function tryMerge(from: number, to: number) {
    const b = B(), a = b[from], c = b[to];
    if (!a || !c || !a.id || !c.id) return false;
    const nx = mergeResult(a.id, c.id);
    if (!nx) {
      if (a.id === c.id) toast(ITEMS[a.id].name + ' is already the best in its chain!');
      return false;
    }
    b[from] = null; b[to] = { id: nx }; gotItem(nx);
    board.animMerge(from, to, nx);
    sfx.merge(ITEMS[nx].tier); haptic('light'); floatText(to, ITEMS[nx].name, '#fff');
    addXp(CONFIG.xp.perMerge); prog('merge', 1); tally('merge'); tutFire('merge');
    if (ITEMS[nx].tier >= 4) tally('tier4');
    lunaBounce(a.id, to);
    bumpStreak(Date.now(), to);
    const d = ITEMS[nx];
    if (d.part) installPart(to, d.part);
    else if (d.fuel) addFuel(to);
    else checkChainFinale(nx, to);
    lastAct = Date.now(); renderOrders(); save();
    return true;
  }
  function installPart(i: number, part: string) {
    const b = B(); if (!b[i] || !ITEMS[b[i].id] || ITEMS[b[i].id].part !== part) return;
    const madeId = b[i].id;
    b[i] = null; S.parts[part] = 1;
    paintCell(i); board.consume(i, madeId); sparkle(i, 20, '#bff0ff'); sfx.install(); haptic('heavy'); confetti();
    const names = { hull: 'HULL', engine: 'ENGINE', nav: 'NAV DISH', tank: 'FUEL TANK' };
    toast('🚀 ' + names[part] + ' installed on the rocket!');
    prog('part', 1);
    renderRocket(); renderHUD(); save();
    if (allParts()) setTimeout(rocketDone, 900);
  }
  /** The rocket is a one-time build. Once it stands up, the wreck has nothing
   *  left to give: it goes away, leftover bits are cashed in, and the part
   *  chains stop showing up in orders and in the shop. */
  function rocketDone() {
    const b = B();
    let refund = 0, cleared = 0;
    for (let i = 0; i < N; i++) {
      const c = b[i]; if (!c) continue;
      if (c.p === 'wreck') { b[i] = null; sparkle(i, 22, '#cfe4ff'); cleared++; continue; }
      if (c.id && PART_KEYS.indexOf(ITEMS[c.id]?.chain) >= 0) {
        refund += ITEMS[c.id].sell; b[i] = null; sparkle(i, 8, '#ffe9a8');
      }
    }
    if (refund) S.coins += refund;
    paintBoard(); confetti(); sfx.big();
    modal('bloop', 'THE ROCKET IS WHOLE!',
      `Blorp! She flies again — and the old wreck is picked clean, so it is gone${refund ? ` (I sold the leftovers: <b>+${refund} coins</b>)` : ''}. Now we need <b>FUEL</b>, and fuel ore only falls from the sky. Watch for <b>meteors</b>: each one leaves a crater you can dig. Three Rocket Fuel and we go visit my moon!`,
      'Bring on the meteors!');
    renderRocket(); renderHUD(); save();
  }
  function addFuel(i: number) {
    const b = B(); if (!b[i] || b[i].id !== 'rocketfuel') return;
    b[i] = null; S.fuel++;
    paintCell(i); board.consume(i, 'rocketfuel'); sparkle(i, 16, '#b6ffd2'); sfx.fuel(); haptic('medium');
    toast('⛽ Rocket Fuel loaded! ' + S.fuel + '/' + CONFIG.rocket.fuelToLaunch);
    prog('fuelm', 1);
    if (S.fuel >= CONFIG.rocket.fuelToLaunch) setTimeout(() => { toast('Tank is FULL! Open 🗺️ Map and launch!'); }, 900);
    renderRocket(); renderHUD(); save();
  }
  function sellItem(i: number) {
    const b = B(), c = b[i]; if (!c || !c.id) return;
    const wanted = S.orders.some(o => o.needs.some(nd => nd.id === c.id));
    if (wanted) { sfx.no(); toast('Someone ordered that! Keep it.'); return; }
    S.coins += ITEMS[c.id].sell; bumpChip('#chipCoins'); sfx.sell();
    floatText(i, '+' + ITEMS[c.id].sell, '#ffe07a');
    b[i] = null; sel = null; tally('sell'); paintCell(i); renderHUD(); renderOrders(); save();
  }

  /* =============================================================== METEOR */
  function flyMeteor(target: number, cb: () => void) {
    board.meteor(target, () => { sfx.boom(); haptic('heavy'); cb(); });
  }
  function meteorStory() {
    if (S.met) return;
    S.met = 1;
    const spot = firstFree([21, 20, 15, 27, 26, 33]);
    toast('☄️ Look out! Something is falling!');
    setTimeout(() => flyMeteor(spot, () => {
      B()[spot] = mkProd('wreck');
      const s2 = nearFree(spot); if (s2 >= 0) { B()[s2] = { id: 'scrap' }; gotItem('scrap'); }
      paintBoard(); prog('meteor', 1);
      modal('bloop', 'Blorp! Hello!', 'My ship hit your meadow — oopsie. I am <b>Bloop</b>. Tap the wreck to dig out broken bits, then merge each pile up into the four rocket parts: <b>Hull, Engine, Nav Dish, Fuel Tank</b>.', 'Deal!');
      checkStory('met');
      renderHUD(); renderRocket(); save();
    }), 700);
  }
  /* A meteor is an event, not background noise: it is rare, it is announced, and
     it leaves a crater you dig for the two things nothing else gives you —
     Star Scrap for the lab and Fuel Ore for the rocket. Craters run dry. */
  function randomMeteor() {
    if (!S.met || view !== 'board') return false;
    if (B().some(c => c && c.p === 'crater')) return false;   // one crater at a time
    const free = freeCells(); if (free.length < 3) return false;
    const spot = rnd(free);
    toast('☄️ <b>METEOR INCOMING!</b> Take cover!');
    flyMeteor(spot, () => {
      B()[spot] = mkProd('crater');
      paintBoard();
      const uses = PRODS.crater.uses;
      toast(`💥 A <b>crater</b>! Dig it ${uses} times for Star Scrap and Fuel Ore.`);
      if (!S.sawCrater) {
        S.sawCrater = 1;
        setTimeout(() => modal('bloop', 'Dig it! Dig it!',
          `Blorp! That is where the good stuff is. A crater gives <b>Star Scrap</b> (the lab loves it) and <b>Fuel Ore</b> — the <i>only</i> place fuel ore comes from. It is good for ${uses} digs and then it is just a hole. Meteors are rare, so never waste one!`,
          'Digging!'), 900);
      }
      renderHUD(); renderOrders(); save();
    });
    return true;
  }

  /* ================================================================= HINTS */
  function findPair() {
    const b = B(), seenAt: Record<string, number> = {};
    let wild = -1;
    for (let i = 0; i < N; i++) {
      const c = b[i]; if (!c || !c.id) continue;
      if (c.id === 'rainbow') { wild = i; continue; }
      if (!nextOf(c.id)) continue;
      if (seenAt[c.id] !== undefined) return [seenAt[c.id], i];
      seenAt[c.id] = i;
    }
    if (wild >= 0) {
      const any = Object.keys(seenAt)[0];
      if (any !== undefined) return [wild, seenAt[any]];
    }
    return null;
  }
  function showHint(manual?: boolean) {
    const p = findPair();
    if (!p) {
      if (manual) {
        const b = B(), prod = [];
        for (let i = 0; i < N; i++) if (b[i] && b[i].p) prod.push(i);
        hintPair = prod.slice(0, 2); board.setHint(hintPair);
        setTimeout(() => { hintPair = null; board.setHint(null); }, 2200);
        toast('No pairs yet — tap a glowing producer to make more!');
      }
      return;
    }
    hintPair = p; board.setHint(hintPair); if (manual) sfx.tap();
    toast('💡 These two match — drag one onto the other!');
    setTimeout(() => { hintPair = null; board.setHint(null); }, 2400);
  }

  /* ============================================================== SCREENS */
  const SCREENS = ['shop', 'lab', 'rocket', 'book', 'map'];
  function setView(v: string) {
    if (v === 'shop' && !shopOpen()) { sfx.no(); toast('The Trading Post opens at Level ' + CONFIG.unlocks.shopAtLevel + '!'); return; }
    if (v === 'lab' && !labOpen()) { sfx.no(); toast('No lab yet — build one in the 🛒 Shop first.'); return; }
    view = v;
    if (v === 'map') tutFire('world');
    openBag(false);
    if (v !== 'board') sfx.whoosh();
    SCREENS.forEach(k => $('#sc-' + k).classList.toggle('open', v === k));
    // over a painted scene the rail shrinks to little round pips, so it stops
    // standing on the scenery it floats over
    $('#app').classList.toggle('sceneOn', v === 'map' || v === 'lab');
    document.querySelectorAll<HTMLElement>('.tab').forEach(t => t.classList.toggle('on', t.dataset.v === v));
    if (v === 'rocket') renderRocket();
    if (v === 'book') renderBook();
    if (v === 'map') renderWorldScreen();
    if (v === 'shop') { S.shop.seenAt = S.shop.at; renderShop(); renderHUD(); }
    if (v === 'lab') renderLab();
  }

  /* ============================================================ TRADING POST
     Coins finally have somewhere to go: a rotating shelf of materials, crates
     that unstick a rocket build, and four permanent upgrades. */
  function rollShop() {
    const pool: string[] = [];
    const cap = clamp(1 + Math.floor(S.lvl / 2), 2, 4);
    liveChains().forEach(c => CHAINS[c].items.forEach(id => {
      const t = ITEMS[id].tier; if (t >= 2 && t <= cap) pool.push(id);
    }));
    partsLeft().forEach(k => { if (S.met) { pool.push(CHAINS[k].items[0]); pool.push(CHAINS[k].items[1]); } });
    if (S.seen.scrap) pool.push('scrap');
    const stock: any[] = [];
    for (let n = 0; n < SHOP.supplyStock && pool.length; n++) {
      const id = rnd(pool);
      for (let k = pool.length - 1; k >= 0; k--) if (pool[k] === id) pool.splice(k, 1);
      stock.push({ id, left: ITEMS[id].tier <= 2 ? 3 : 1 });
    }
    S.shop.stock = stock; S.shop.at = Date.now();
  }
  function shopStock() {
    if (!S.shop.stock || Date.now() - S.shop.at >= SHOP.supplyRestockMs) rollShop();
    return S.shop.stock;
  }
  const supplyPrice = (id: string) => Math.max(12, Math.round(ITEMS[id].sell * SHOP.supplyPriceMultiplier));
  const shopNews = () => shopOpen() && S.shop.at > (S.shop.seenAt || 0);

  function buySupply(k: number) {
    const st = shopStock()[k];
    if (!st || st.left <= 0) return;
    const price = supplyPrice(st.id);
    if (S.coins < price) { sfx.no(); toast('Not enough coins — sell a few spares!'); return; }
    if (!freeCells().length) { sfx.no(); toast('No room on the board! Merge something first.'); return; }
    spend(price); st.left--;
    giveItem(st.id);
    sfx.coin(); haptic('light');
    toast('Bought a <b>' + ITEMS[st.id].name + '</b>!');
    renderShop(); renderHUD(); renderOrders(); save();
  }
  function buyCrate(id: string) {
    const c = SHOP.crates.filter(x => x.id === id)[0]; if (!c) return;
    if (!S.met || allParts()) { sfx.no(); toast('Nothing to salvage — the rocket is done!'); return; }
    if (S.coins < c.price) { sfx.no(); toast('Not enough coins yet.'); return; }
    if (!freeCells().length) { sfx.no(); toast('No room on the board! Merge something first.'); return; }
    if (id === 'blueprint') { pickPartFor(c); return; }
    spend(c.price);
    openCrate(partPiece(true) as string);
  }
  function pickPartFor(c: any) {
    const names: Record<string, string> = { hull: 'Hull', engine: 'Engine', nav: 'Nav Dish', tank: 'Fuel Tank' };
    const left = partsLeft();
    modal('bloop', 'Which part?', `Blorp! Pick the part you want a piece for.
      <div class="pickGrid" style="grid-template-columns:repeat(${left.length},1fr)">${left.map(k =>
      `<button class="pickCell" data-part="${k}">${ART.item(CHAINS[k].items[2])}<b>${names[k]}</b></button>`).join('')}</div>`, 'Cancel');
    setTimeout(() => {
      document.querySelectorAll<HTMLElement>('[data-part]').forEach(btn => btn.onclick = () => {
        const k = btn.dataset.part as string;
        $('#modal').classList.remove('open');
        if (S.coins < c.price) return;
        spend(c.price);
        openCrate(CHAINS[k].items[1]);
      });
    }, 30);
  }
  function openCrate(piece: string) {
    const at = giveItem(piece);
    sfx.boost(); haptic('medium'); confetti();
    if (at >= 0) sparkle(at, 18, '#bff0ff');
    toast('📦 Crate opened — <b>' + ITEMS[piece].name + '</b>!');
    renderShop(); renderHUD(); renderOrders(); save();
  }
  /* Once the rocket stands up, part crates are dead weight — the depot takes
     their place and keeps the shop worth opening for the rest of the game. */
  const DEPOT = [
    { id: 'fuelore', mult: 5, note: 'Impatient? Skip a meteor.' },
    { id: 'fuelcan', mult: 4.5, note: 'Half a tank of ore in one go.' },
  ];
  const depotPrice = (d: any) => Math.round(ITEMS[d.id].sell * d.mult);
  function buyDepot(k: number) {
    const d = DEPOT[k], price = depotPrice(d);
    if (S.coins < price) { sfx.no(); toast('Fuel is expensive — that costs ' + price + '.'); return; }
    if (!freeCells().length) { sfx.no(); toast('No room on the board!'); return; }
    spend(price); giveItem(d.id);
    sfx.coin(); haptic('light');
    toast('⛽ Bought <b>' + ITEMS[d.id].name + '</b>');
    renderShop(); renderHUD(); renderOrders(); save();
  }
  function buildLab() {
    const bd = CONFIG.lab.build;
    if (S.lab.built) return;
    const short: string[] = [];
    const have = countItem(bd.item);
    if (have < bd.qty) short.push(`${bd.qty - have} more <b>${ITEMS[bd.item].name}</b> (dig a meteor crater)`);
    if (S.coins < bd.coins) short.push(`<b>${bd.coins - S.coins}</b> more coins`);
    if (short.length) { sfx.no(); shake(); toast('Still need ' + short.join(' and ') + '.'); return; }
    spend(bd.coins);
    for (let n = 0; n < bd.qty; n++) consumeOne(bd.item);
    S.lab.built = 1;
    sfx.build(); haptic('heavy'); confetti();
    prog('lab', 1);
    toast('🔬 The Research Lab is open!');
    modal('bloop', 'Blorp! A LAB!',
      'Look at her! Now put <b>two things from your board</b> on the bench and hit EXPERIMENT. Most pairs do nothing — but the right pairs make <b>relics</b>, the rarest treasures in the galaxy. Read the rumours for clues.',
      'To science!');
    paintBoard(); renderShop(); renderHUD(); renderOrders(); save();
  }
  function buyBooster(id: string) {
    const bo = SHOP.boosters.filter(x => x.id === id)[0]; if (!bo) return;
    if (S.coins < bo.price) { sfx.no(); toast('Not enough coins — that costs ' + bo.price + '.'); return; }
    spend(bo.price); giveBoost(id);
    sfx.coin(); haptic('light');
    toast('🎁 <b>' + bo.name + '</b> ready above the board!');
    renderShop(); renderHUD(); renderTools(); save();
  }
  function buyUpgrade(id: string) {
    const u = SHOP.upgrades.filter(x => x.id === id)[0]; if (!u) return;
    const lv = upLv(id);
    if (lv >= u.max) { toast(u.name + ' is fully upgraded!'); return; }
    const price = upPrice(u);
    if (S.coins < price) { sfx.no(); toast('Not enough coins — that costs ' + price + '.'); return; }
    spend(price); S.up[id] = lv + 1;
    if (id === 'energy') S.energy = Math.min(maxEnergy(), S.energy + CONFIG.upgrades.energyPerStep);
    if (id === 'orders') { fillOrders(); renderOrders(); }
    if (id === 'bag') { renderTools(); renderBag(); }
    sfx.boost(); haptic('medium'); confetti();
    toast('⭐ <b>' + u.name + '</b> is now level ' + S.up[id] + '!');
    prog('upgrade', 1);
    renderShop(); renderHUD(); save();
  }
  function renderShop() {
    const host = $('#shopBody'); if (!host) return;
    $('#shopCoins').textContent = S.coins;
    const stock = shopStock();
    const mins = Math.max(1, Math.ceil((SHOP.supplyRestockMs - (Date.now() - S.shop.at)) / 60000));
    const coin = ART.icon('coin');
    const anyStock = stock.some((s: any) => s.left > 0);

    let html = `<div class="card"><div class="cardTitle">📦 Today's supplies</div>
      ${stock.map((st: any, k: number) => {
      const price = supplyPrice(st.id), out = st.left <= 0, poor = S.coins < price;
      return `<div class="shopRow">
          <div class="sArt">${ART.item(st.id)}${st.left > 0 ? `<span class="stock">x${st.left}</span>` : ''}</div>
          <div class="sInfo"><div class="sName">${ITEMS[st.id].name}</div>
            <div class="sDesc">${out ? 'Sold out — wait for the restock' : 'Delivered straight to your board'}</div></div>
          <button class="buyBtn" data-buy="${k}" ${out || poor ? 'disabled' : ''}>${out ? 'SOLD' : coin + price}</button>
        </div>`;
    }).join('')}
      <div class="noteLine">${anyStock ? '🔄 Fresh stock in about ' + mins + ' min' : '🔄 Restocking — back in about ' + mins + ' min'}</div></div>`;

    if (labOffered() && !S.lab.built) {
      const bd = CONFIG.lab.build, have = countItem(bd.item), can = have >= bd.qty && S.coins >= bd.coins;
      html += `<div class="card build"><div class="cardTitle">🏗️ Build the Research Lab</div>
        <div class="shopRow"><div class="sArt">${ART.icon('flask')}</div>
          <div class="sInfo"><div class="sName">Bloop's laboratory</div>
            <div class="sDesc">Invent relics that no amount of merging can make.</div>
            <div class="buildNeed"><span class="${have >= bd.qty ? 'ok' : ''}">${ART.item(bd.item)}${have}/${bd.qty}</span>
              <span class="${S.coins >= bd.coins ? 'ok' : ''}">${coin}${bd.coins}</span></div></div>
          <button class="buyBtn green" id="btnBuildLab">BUILD</button></div>
        <div class="noteLine">${can ? 'Everything is ready — put it up!' : 'Star Scrap comes out of meteor craters.'}</div></div>`;
    }

    if (allParts()) {
      html += `<div class="card"><div class="cardTitle">⛽ Fuel depot</div>
        ${DEPOT.map((d, k) => {
        const price = depotPrice(d), poor = S.coins < price;
        return `<div class="shopRow"><div class="sArt">${ART.item(d.id)}</div>
            <div class="sInfo"><div class="sName">${ITEMS[d.id].name}</div><div class="sDesc">${d.note}</div></div>
            <button class="buyBtn green" data-depot="${k}" ${poor ? 'disabled' : ''}>${coin}${price}</button></div>`;
      }).join('')}
        <div class="noteLine">Fuel ore only falls in meteors, so the depot charges what it likes.</div></div>`;
    }

    if (S.met && !allParts()) {
      html += `<div class="card"><div class="cardTitle">🛠️ Salvage crates</div>
        ${SHOP.crates.map(c => {
        const poor = S.coins < c.price;
        return `<div class="shopRow"><div class="sArt">${ART.icon(c.icon)}</div>
            <div class="sInfo"><div class="sName">${c.name}</div><div class="sDesc">${c.desc}</div></div>
            <button class="buyBtn green" data-crate="${c.id}" ${poor ? 'disabled' : ''}>${coin}${c.price}</button></div>`;
      }).join('')}
        <div class="noteLine">Stuck on one rocket part? A crate skips the hunting.</div></div>`;
    }

    if (S.seen.scrap) {
      html += `<div class="card forge"><div class="cardTitle">✨ Star Forge</div>
        <div class="noteLine" style="margin:0 0 4px">Meteor stars are not for selling — they buy favours.</div>
        ${CONFIG.forge.map(f => {
        const have = countItem(f.item), ok = have >= f.qty;
        return `<div class="shopRow"><div class="sArt">${ART.icon(f.icon)}</div>
            <div class="sInfo"><div class="sName">${f.name}</div><div class="sDesc">${f.desc}</div></div>
            <button class="buyBtn" data-forge="${f.id}"><span class="cost${ok ? ' ok' : ''}">${ART.item(f.item)}${f.qty}</span></button></div>`;
      }).join('')}</div>`;
    }

    html += `<div class="card"><div class="cardTitle">🎁 Boosters</div>
      ${SHOP.boosters.map(bo => {
      const poor = S.coins < bo.price;
      return `<div class="shopRow"><div class="sArt">${ART.icon(bo.icon)}${boostN(bo.id) ? `<span class="stock">x${boostN(bo.id)}</span>` : ''}</div>
          <div class="sInfo"><div class="sName">${bo.name}</div><div class="sDesc">${bo.desc}</div></div>
          <button class="buyBtn" data-boost="${bo.id}" ${poor ? 'disabled' : ''}>${coin}${bo.price}</button></div>`;
    }).join('')}
      <div class="noteLine">Boosters wait in the button row above the board until you use them.</div></div>`;

    html += `<div class="card"><div class="cardTitle">⭐ Permanent upgrades</div>
      ${SHOP.upgrades.map(u => {
      const lv = upLv(u.id), maxed = lv >= u.max, price = upPrice(u), poor = S.coins < price;
      return `<div class="shopRow"><div class="sArt">${ART.icon(u.icon)}</div>
          <div class="sInfo"><div class="sName">${u.name}</div><div class="sDesc">${u.desc}</div>
            <div class="pips">${Array.from({ length: u.max }, (_, n) => `<i class="pip${n < lv ? ' on' : ''}"></i>`).join('')}</div></div>
          <button class="buyBtn${maxed ? ' maxed' : ''}" data-up="${u.id}" ${maxed || poor ? 'disabled' : ''}>${maxed ? 'MAX' : coin + price}</button></div>`;
    }).join('')}
      <div class="noteLine">Upgrades are forever — they carry to every world.</div></div>`;

    host.innerHTML = html;
    host.querySelectorAll('[data-buy]').forEach((b: any) => b.onclick = () => buySupply(+b.dataset.buy));
    host.querySelectorAll('[data-crate]').forEach((b: any) => b.onclick = () => buyCrate(b.dataset.crate));
    host.querySelectorAll('[data-up]').forEach((b: any) => b.onclick = () => buyUpgrade(b.dataset.up));
    host.querySelectorAll('[data-depot]').forEach((b: any) => b.onclick = () => buyDepot(+b.dataset.depot));
    host.querySelectorAll('[data-boost]').forEach((b: any) => b.onclick = () => buyBooster(b.dataset.boost));
    host.querySelectorAll('[data-forge]').forEach((b: any) => b.onclick = () => forgeUse(b.dataset.forge));
    const bl = $('#btnBuildLab'); if (bl) bl.onclick = () => buildLab();
  }

  /* ============================================================ RESEARCH LAB
     Two samples off the board plus a pile of coins. Guess a pair right and the
     recipe is yours forever; guess wrong and you are out the bench fee. */
  function recipeFor(a: string, b: string) {
    return RECIPES.filter(r =>
      (r.inputs[0] === a && r.inputs[1] === b) || (r.inputs[0] === b && r.inputs[1] === a))[0] || null;
  }
  function pruneSlots() {
    const inv = inventory(), s = S.lab.slots;
    for (let k = 0; k < 2; k++) if (s[k] && !(inv[s[k]] > 0)) s[k] = null;
    if (s[0] && s[0] === s[1] && (inv[s[0]] || 0) < 2) s[1] = null;
  }
  function consumeOne(id: string) {
    const b = B();
    for (let i = 0; i < N; i++) if (b[i] && b[i].id === id) { b[i] = null; sparkle(i, 8, '#cfe4ff'); return; }
  }
  function giveClue() {
    const blind = RECIPES.filter(r => !S.lab.disc[r.id] && !S.lab.clue[r.id]);
    if (!blind.length) return null;
    const r = rnd(blind); S.lab.clue[r.id] = 1;
    return r;
  }
  function pickForSlot(k: number) {
    const inv = inventory(), other = S.lab.slots[1 - k];
    const ids = Object.keys(inv).filter(id => id !== other || inv[id] >= 2);
    if (!ids.length) { sfx.no(); toast('Nothing on your board to study!'); return; }
    ids.sort((a, b) => ITEMS[a].sell - ITEMS[b].sell);
    modal('bloop', 'Pick a sample', `Anything on your board can go under the microscope.
      <div class="pickGrid">${ids.map(id =>
      `<button class="pickCell" data-pick="${id}">${ART.item(id)}<b>x${inv[id]}</b></button>`).join('')}</div>`, 'Cancel');
    setTimeout(() => {
      document.querySelectorAll<HTMLElement>('[data-pick]').forEach(btn => btn.onclick = () => {
        S.lab.slots[k] = btn.dataset.pick;
        $('#modal').classList.remove('open'); sfx.tap(); renderLab(); save();
      });
    }, 30);
  }
  function doResearch() {
    pruneSlots();
    const a = S.lab.slots[0], b = S.lab.slots[1];
    if (!a || !b) { sfx.no(); toast('Put a sample in both slots first!'); return; }
    const r = recipeFor(a, b);
    const knew = !!(r && S.lab.disc[r.id]);
    const cost = knew ? r!.coins : CONFIG.lab.failFee;
    if (S.coins < cost) { sfx.no(); toast('That run costs ' + cost + ' coins — sell some spares!'); return; }
    if (!freeCells().length) { sfx.no(); toast('Leave one tile free for the result!'); return; }
    spend(cost);
    if (!r) {
      S.lab.tries = (S.lab.tries || 0) + 1;
      sfx.no(); shake(); haptic('light');
      const clue = (S.lab.tries % CONFIG.lab.clueEvery === 0) ? giveClue() : null;
      toast('💨 Pfft — those two do not react.' + (clue ? ' But Bloop spotted a clue!' : ''));
      renderLab(); renderHUD(); save(); return;
    }
    consumeOne(a); consumeOne(b);
    const at = giveItem(r.result);
    S.lab.disc[r.id] = 1; S.lab.made = (S.lab.made || 0) + 1;
    S.lab.slots = [null, null];
    sfx.discover(); haptic('heavy'); confetti();
    if (at >= 0) { sparkle(at, 24, '#ffe9a8'); floatText(at, ITEMS[r.result].name, '#fff'); }
    addXp(4 + ITEMS[r.result].tier * 3);
    prog('research', 1);
    toast((knew ? '✨ ' : '🎉 DISCOVERY! ') + '<b>' + ITEMS[r.result].name + '</b> created!');
    if (!knew) setTimeout(() => modal('bloop', 'A new recipe!',
      `<b>${ITEMS[r.inputs[0]].name}</b> + <b>${ITEMS[r.inputs[1]].name}</b> makes a <b>${ITEMS[r.result].name}</b>! It is in your lab book now — you can brew it again any time for ${r.coins} coins.`,
      'Science!'), 700);
    renderLab(); renderHUD(); renderOrders(); paintBoard(); save();
  }
  function buyRecipe(id: string) {
    const r = RECIPES.filter(x => x.id === id)[0]; if (!r || S.lab.disc[id]) return;
    const price = Math.round(r.coins * 1.5);
    if (S.coins < price) { sfx.no(); toast('Bloop wants ' + price + ' coins for that hint.'); return; }
    spend(price); S.lab.disc[id] = 1;
    sfx.coin();
    toast('📘 Recipe bought: <b>' + ITEMS[r.result].name + '</b>');
    renderLab(); renderHUD(); save();
  }
  /* ================================================================= THE LAB
     A room, not a form. The bench slots sit on the painted counter, the book
     lives on the shelf, and the rumours are a pop-up — the same way the camp
     works, so the two painted screens feel like the same game. */
  const LAB_PAD = {
    a: [0.255, 0.545], b: [0.435, 0.552], out: [0.645, 0.545],
    book: [0.275, 0.325], scope: [0.90, 0.50],
  };
  /* an empty bench socket, drawn rather than typed, so it reads on any backdrop */
  const SOCKET = `<svg viewBox="0 0 100 100" class="art"><circle cx="50" cy="52" r="34" fill="#ffffff" opacity=".5"/>
    <circle cx="50" cy="52" r="34" fill="none" stroke="#6b5236" stroke-width="4" stroke-dasharray="9 8" opacity=".55"/>
    <path d="M50 38 v28 M36 52 h28" stroke="#6b5236" stroke-width="6" stroke-linecap="round" opacity=".6"/></svg>`;
  const SOCKET_Q = `<svg viewBox="0 0 100 100" class="art"><circle cx="50" cy="52" r="34" fill="#c7a8ff" opacity=".35"/>
    <circle cx="50" cy="52" r="34" fill="none" stroke="#7b4fd6" stroke-width="4" opacity=".6"/>
    <text x="50" y="68" text-anchor="middle" font-size="42" font-weight="800" fill="#7b4fd6" opacity=".8">?</text></svg>`;
  function labSpot(kind: string, pad: number[], art: string, label: string, sub: string, cls = '') {
    return `<button class="spot ${cls}" data-lab="${kind}" data-fx="${pad[0]}" data-fy="${pad[1]}">
      <span class="spotArt">${art}</span>
      <span class="spotTag"><b>${label}</b>${sub ? `<i>${sub}</i>` : ''}</span></button>`;
  }
  function renderLab() {
    const host = $('#labBody'); if (!host) return;
    $('#labCoins').textContent = S.coins;
    pruneSlots();
    const a = S.lab.slots[0], b = S.lab.slots[1];
    const r = a && b ? recipeFor(a, b) : null;
    const knew = !!(r && S.lab.disc[r.id]);
    const ready = !!(a && b);
    const cost = knew ? r!.coins : CONFIG.lab.failFee;
    const known = RECIPES.filter(r2 => S.lab.disc[r2.id]);
    const blind = RECIPES.filter(r2 => !S.lab.disc[r2.id]);

    host.innerHTML = `<div class="sceneWrap lab">
      <div class="sceneImg"></div><div class="sceneVig"></div>
      <div class="sceneBtns"><button class="sceneBtn" data-labpop="book">📘</button>
        ${blind.length ? `<button class="sceneBtn" data-labpop="rumours">❓</button>` : ''}</div>
      ${labSpot('s0', LAB_PAD.a, a ? ART.item(a) : SOCKET,
        a ? ITEMS[a].name : 'Sample A', a ? 'tap to swap' : 'tap to load', a ? 'filled' : 'empty')}
      ${labSpot('s1', LAB_PAD.b, b ? ART.item(b) : SOCKET,
        b ? ITEMS[b].name : 'Sample B', b ? 'tap to swap' : 'tap to load', b ? 'filled' : 'empty')}
      ${labSpot('out', LAB_PAD.out, knew ? ART.item(r!.result) : SOCKET_Q,
        knew ? ITEMS[r!.result].name : 'Result', knew ? 'known recipe' : 'unknown', knew ? 'ready' : 'empty')}
      ${labSpot('book', LAB_PAD.book, ART.icon('blueprint'), 'Lab book', known.length + '/' + RECIPES.length)}
      <div class="labBar">
        ${a || b ? '<button class="labClear" id="btnClearSlots">Empty</button>' : ''}
        <button class="big${knew ? '' : ' blue'}" id="btnResearch" ${ready ? '' : 'disabled'}>${ready
        ? (knew ? `BREW · ${cost} 🪙` : `EXPERIMENT · ${cost} 🪙`)
        : 'Load two samples'}</button>
      </div>
    </div>`;
    placeSpots('#labBody');
    host.querySelectorAll('[data-lab]').forEach((e: any) => e.onclick = () => {
      const k = e.dataset.lab;
      if (k === 's0') pickForSlot(0);
      else if (k === 's1') pickForSlot(1);
      else if (k === 'book') labBook();
      else if (!ready) { sfx.no(); toast('Load two samples first.'); }
    });
    host.querySelectorAll('[data-labpop]').forEach((e: any) => e.onclick = () =>
      e.dataset.labpop === 'book' ? labBook() : labRumours());
    const rb = $('#btnResearch'); if (rb) rb.onclick = doResearch;
    const cb = $('#btnClearSlots');
    if (cb) cb.onclick = () => { S.lab.slots = [null, null]; sfx.pop(); renderLab(); save(); };
  }

  function labBook() {
    const known = RECIPES.filter(r2 => S.lab.disc[r2.id]);
    const coin = ART.icon('coin');
    modal('bloop', 'Lab book',
      `<div class="noteLine" style="margin-top:0">${known.length}/${RECIPES.length} recipes written down.</div>
       <div class="questList">${known.length ? known.map(r2 => {
        const poor = S.coins < r2.coins;
        return `<div class="rumour known">
          <div class="rLine">
            <div class="rMini">${ART.item(r2.inputs[0])}</div><div class="rArrow">+</div>
            <div class="rMini">${ART.item(r2.inputs[1])}</div><div class="rArrow">➜</div>
            <div class="rMini">${ART.item(r2.result)}</div>
            <div style="flex:1"></div>
            <button class="buyBtn" data-load="${r2.id}" ${poor ? 'disabled' : ''}>${coin}${r2.coins}</button>
          </div></div>`;
      }).join('') : '<div class="noteLine">Nothing yet. Put two odd things on the bench and press EXPERIMENT.</div>'}</div>`,
      'Close');
    setTimeout(() => document.querySelectorAll('[data-load]').forEach((e: any) =>
      e.onclick = () => { closeModal(); loadKnown(e.dataset.load); }), 30);
  }
  /** put a known recipe's two ingredients straight onto the bench */
  function loadKnown(id: string) {
    const r2 = RECIPES.find(x => x.id === id); if (!r2) return;
    const missing = r2.inputs.filter(x => countItem(x) < 1);
    if (missing.length) {
      sfx.no();
      toast('You need ' + missing.map(x => `<b>${ITEMS[x].name}</b>`).join(' and ') + ' on the board.');
      return;
    }
    S.lab.slots = [r2.inputs[0], r2.inputs[1]];
    sfx.pop(); renderLab(); save();
  }

  function labRumours() {
    const blind = RECIPES.filter(r2 => !S.lab.disc[r2.id]);
    const coin = ART.icon('coin');
    modal('nix', 'Rumours',
      `<div class="questList">${blind.map(r2 => {
        const clue = S.lab.clue[r2.id];
        const price = Math.round(r2.coins * 1.5);
        return `<div class="rumour">
          <div class="rNote">“${r2.note}”</div>
          <div class="rLine">
            <div class="rMini">${clue ? ART.item(r2.inputs[0]) : '?'}</div><div class="rArrow">+</div>
            <div class="rMini">?</div><div class="rArrow">➜</div><div class="rMini">?</div>
            <div style="flex:1"></div>
            <button class="buyBtn" data-learn="${r2.id}" ${S.coins < price ? 'disabled' : ''}>${coin}${price}</button>
          </div>${clue ? `<div class="rClue">First ingredient: <b>${ITEMS[r2.inputs[0]].name}</b></div>` : ''}</div>`;
      }).join('')}</div>
      <div class="noteLine">Buy a rumour and Bloop writes the whole recipe down for you.</div>`, 'Close');
    setTimeout(() => document.querySelectorAll('[data-learn]').forEach((e: any) =>
      e.onclick = () => { closeModal(); buyRecipe(e.dataset.learn); }), 30);
  }
  /* ============================================================ VAULT TAB
     What used to be the Rocket tab. The rocket itself now lives in your camp,
     where you can see it being built, so this is the progression drawer: the
     rotating task board, the relic perks and the star favours. */
  function renderRocket() {
    const host = $('#rocketBody'); if (!host) return;
    const coin = ART.icon('coin');
    host.innerHTML =
      `<div class="card"><div class="cardTitle">📋 Tasks<span style="margin-left:auto;font-size:10px;color:#9a7a4e;font-weight:600">refresh as you finish them</span></div>
        ${S.tasks.map((t: any) => {
        const done = t.have >= t.n;
        return `<div class="taskRow${done ? ' done' : ''}">
            <div class="tBar"><i style="width:${Math.round(Math.min(1, t.have / t.n) * 100)}%"></i></div>
            <div class="tTxt">${t.label}<span>${Math.min(t.have, t.n)}/${t.n}</span></div>
            <button class="buyBtn${done ? ' green' : ''}" data-task="${t.id}" ${done ? '' : 'disabled'}>${done ? 'CLAIM' : coin + t.coins}</button>
          </div>`;
      }).join('')}
       </div>
       <div class="card"><div class="cardTitle">🎯 Your quests</div>
        <div class="noteLine" style="margin-top:0">The story so far, and what Bloop wants next.</div>
        <button class="big blue" id="openQuests">📜 Open the quest list</button></div>`
      + vaultCard();
    host.querySelectorAll('[data-task]').forEach((b: any) => b.onclick = () => claimTask(b.dataset.task));
    host.querySelectorAll('[data-vault]').forEach((b: any) => b.onclick = () => vaultBuy(b.dataset.vault));
    const q = $('#openQuests'); if (q) q.onclick = questPanel;
  }

  /* --------------------------------------------------------------- quests
     A list of twenty missions buried three taps deep is a list nobody reads.
     It lives on a button under the contracts now, it shows the one you are on
     first, and every line says what to actually do. */
  const questsLeft = () => MISSIONS.filter(m => (S.mp[m.id] || 0) < m.need).length;
  function questPanel() {
    tutFire('quests');
    const cur = curMission();
    const done = MISSIONS.length - questsLeft();
    const row = (m: any) => {
      const p = S.mp[m.id] || 0, ok = p >= m.need, now = cur && cur.id === m.id;
      return `<div class="questRow${ok ? ' done' : ''}${now ? ' now' : ''}">
        <div class="qBox">${ok ? '✓' : now ? '➤' : ''}</div>
        <div class="qMain"><b>${m.text}</b>
          ${now ? `<i>${m.hint}</i>` : ''}
          ${!ok && m.need > 1 ? `<div class="qBar"><i style="width:${Math.round(Math.min(1, p / m.need) * 100)}%"></i></div>
            <span class="qNum">${Math.min(p, m.need)}/${m.need}</span>` : ''}</div>
        <div class="qRew">${ART.icon('coin')}${m.coins}</div></div>`;
    };
    // the one you are on first, then the rest in order, finished ones at the end
    const open = MISSIONS.filter(m => (S.mp[m.id] || 0) < m.need);
    const shut = MISSIONS.filter(m => (S.mp[m.id] || 0) >= m.need);
    modal(S.met ? 'bloop' : 'pip', 'Quests',
      `<div class="qHead">${done}/${MISSIONS.length} done</div>
       <div class="catBar"><i style="width:${Math.round(done / MISSIONS.length * 100)}%"></i></div>
       <div class="questList">${open.map(row).join('')}${shut.map(row).join('')}</div>`, 'Close');
  }

  /** the relic sink, shown once the player has actually seen a relic */
  function vaultCard() {
    if (!S.seen.relic1 && !labOpen()) return '';
    const coin = ART.icon('coin');
    return `<div class="card vault"><div class="cardTitle">🏛️ Relic Vault</div>
      <div class="noteLine" style="margin:0 0 4px">Relics buy perks that last forever, in every world.</div>
      ${CONFIG.vault.map(v => {
      const lv = vaultLv(v.id), maxed = lv >= v.max, have = countItem(v.item);
      return `<div class="shopRow"><div class="sArt">${ART.icon(v.icon)}</div>
          <div class="sInfo"><div class="sName">${v.name}</div><div class="sDesc">${v.desc}</div>
            <div class="pips">${Array.from({ length: v.max }, (_, n) => `<i class="pip${n < lv ? ' on' : ''}"></i>`).join('')}</div></div>
          <button class="buyBtn${maxed ? ' maxed' : ''}" data-vault="${v.id}" ${maxed ? 'disabled' : ''}>
            ${maxed ? 'MAX' : `<span class="cost${have >= v.qty ? ' ok' : ''}">${ART.item(v.item)}${v.qty}</span>`}</button></div>`;
    }).join('')}</div>`;
  }
  function renderBook() {
    const host = $('#bookBody');
    // Only what you can actually make here, so the guide stops promising berries
    // on the moon. Everything else lives behind the "other worlds" note.
    const groups = Object.keys(CHAINS).filter(k => {
      const w = CHAINS[k].world;
      if (k === 'relic') return !!(S.seen.relic1 || labOpen());
      if (k === 'wild') return !!S.seen.rainbow;
      if (w === 'any') return !!S.seen.scrap;
      if (w === 'ship') return !!S.met && !allParts();
      if (k === 'bloom') return !!S.seen.bloomspark;
      return w === S.world && (CHAINS[k].unlock || 1) <= wlv();
    });
    // the locked ones stay visible as silhouettes: knowing what is coming is
    // half the pull of a collection game
    const soon = lockedChains().map(k => ({ k, at: CHAINS[k].unlock }));
    const elsewhere = Object.keys(CHAINS).filter(k => {
      const w = CHAINS[k].world;
      return w !== 'any' && w !== 'ship' && w !== S.world && WORLDS[w] && CHAINS[k].items.some(id => S.seen[id]);
    });
    const total = ITEM_IDS.length, found = ITEM_IDS.filter(id => S.seen[id]).length;
    const inv = inventory();
    host.innerHTML =
      `<div class="card"><div class="cardTitle">🗂️ Collection <span style="font-size:11px;color:#9a7a4e;font-weight:600">${found}/${total}</span></div>
        <div class="catBar"><i style="width:${Math.round(found / total * 100)}%"></i></div>
        <div class="noteLine">Every new thing you make gets written in here — even the ones you sold.</div></div>` +
      groups.map(k => {
      const ch = CHAINS[k];
      const got = ch.items.filter(id => S.seen[id]).length;
      return `<div class="card"><div class="cardTitle">${ch.name}<span style="font-size:10px;color:#9a7a4e;font-weight:600;margin-left:auto">${got}/${ch.items.length}</span></div><div class="chainRow">${ch.items.map((id, n) => {
        const kn = S.seen[id], have = inv[id] || 0;
        return `<div class="cStep"><div class="cArt${kn ? '' : ' unk'}">${kn ? ART.item(id) : '?'}</div>
          <div class="cLab">${kn ? ITEMS[id].name : '???'}</div>
          ${kn ? `<div class="cSell">${ITEMS[id].sell} 🪙</div><span class="ownTag${have ? ' have' : ''}">×${have}</span>` : ''}</div>`
          + (n < ch.items.length - 1 ? '<div class="arrow">➜</div>' : '');
      }).join('')}</div>
      <div style="font-size:10.5px;color:#9a7a4e;font-weight:600;margin-top:4px">${k === 'relic'
          ? 'Relics are not merged from producers — they are invented in the 🔬 Lab.'
          : 'Drag 2 identical items together to make the next one.'}</div></div>`;
    }).join('') +
      (soon.length ? `<div class="card"><div class="cardTitle">🔒 Still sleeping here</div>
        <div class="soonRow">${soon.map(x => `<div class="soonChain"><div class="soonArt">${CHAINS[x.k].items.map(() => '<i></i>').join('')}</div>
          <div class="soonName">${CHAINS[x.k].name}</div><div class="soonAt">World level ${x.at}</div></div>`).join('')}</div>
        <div class="noteLine">Keep playing in ${W().name} and these come back on their own.</div></div>` : '') +
      `<div class="card"><div class="cardTitle">🏭 Producers</div>${Object.keys(PRODS).filter(k => B().some(c => c && c.p === k) || (k === 'wreck' && S.met)).map(k => {
        const p = PRODS[k];
        return `<div class="mission"><div class="mBox" style="background:#fff;box-shadow:none">${ART.producer(p.art)}</div>
        <div class="mTxt">${p.name}<div style="font-size:10px;color:#9a7a4e;font-weight:600">${p.mode === 'battery' ? `Free taps: holds ${capOf(p, 1)}, a full battery takes ${mmss(everyOf(p) * capOf(p, 1))}`
          : p.mode === 'energy' ? `${ecost(p, 1)} ⚡ a tap, as often as you like`
            : `${p.uses} digs, then it collapses`} · makes ${[...new Set(p.drops as string[])].map(d => ITEMS[d].name).join(', ')}</div></div></div>`;
      }).join('')}</div>` +
      (elsewhere.length ? `<div class="card"><div class="cardTitle">🌍 Other worlds</div>
        <div style="font-size:11.5px;font-weight:600;color:#7a6244">${elsewhere.map(k => `<b>${CHAINS[k].name}</b> (${WORLDS[CHAINS[k].world].name})`).join(', ')} — only on their own planet. Your bag carries things between worlds.</div></div>` : '') +
      `<div class="card"><div class="cardTitle">☄️ Meteors</div><div style="font-size:11.5px;font-weight:600;color:#7a6244">Every now and then a meteor crashes on your board and leaves rare <b>Star Scrap</b>. Keep a few tiles free so it has room to land!</div></div>`;
  }
  /** every world in the content, in order, plus a teaser for what comes next */
  const WORLD_ORDER = ['earth', 'luna', 'cindra', 'nerith', 'vela'];
  const WORLD_BLURB: Record<string, string> = {
    earth: 'Home world · wood, rocks & berries',
    luna: 'Luna · moon rocks & glow gardens',
    cindra: 'Cindra · magma, ash and forges',
    nerith: 'Nerith · a drowned world of reefs',
    vela: 'Vela · no ground, only light',
  };


  /* ============================================================ STORAGE BAG
     The board is the scarce resource in a merge game, so the bag is the release
     valve: items parked here are out of the way but never lost. Capacity is a
     shop upgrade, and with no upgrade the whole feature stays hidden. */
  const bagCap = () => (upLv('bag') + vaultLv('deep')) * CONFIG.upgrades.bagPerStep;
  const bagHas = () => bagCap() > 0;
  function openBag(on?: boolean) {
    const tray = $('#bagTray');
    const want = on === undefined ? !tray.classList.contains('open') : on;
    if (want && !bagHas()) { sfx.no(); toast('No bag yet — buy the Storage Bag in the 🛒 Shop.'); return; }
    tray.classList.toggle('open', want);
    if (want) { sfx.bag(); renderBag(); }
  }
  function renderBag() {
    const host = $('#bagSlots'); if (!host) return;
    const cap = bagCap();
    $('#bagTitle').innerHTML = `🎒 Storage bag <span style="color:#9a7a4e;font-weight:600">${S.bag.length}/${cap}</span>`;
    host.innerHTML = Array.from({ length: cap }, (_, k) => {
      const id = S.bag[k];
      return `<button class="bagSlot${id ? ' full' : ''}" data-bag="${k}">${id ? ART.item(id) : ''}</button>`;
    }).join('');
    host.querySelectorAll('[data-bag]').forEach((b: any) => b.onclick = () => unstash(+b.dataset.bag));
  }
  function stashItem(i: number) {
    const b = B(), c = b[i];
    if (!c || !c.id) return;
    if (!bagHas()) { sfx.no(); toast('No bag yet — buy the Storage Bag in the 🛒 Shop.'); return; }
    if (S.bag.length >= bagCap()) { sfx.no(); toast('The bag is full! Take something out first.'); return; }
    S.bag.push(c.id); tally('stash');
    b[i] = null; sel = null;
    sfx.bag(); haptic('light'); board.consume(i, c.id);
    paintCell(i); hideInfo(); renderBag(); renderOrders(); renderHUD(); save();
  }
  function unstash(k: number) {
    const id = S.bag[k]; if (!id) return;
    const spot = freeCells()[0];
    if (spot === undefined) { sfx.no(); toast('No room on the board!'); return; }
    S.bag.splice(k, 1);
    B()[spot] = { id };
    board.animSpawn(spot, id, spot >= COLS * 2 ? spot - COLS * 2 : spot);
    sfx.bag(); haptic('light');
    renderBag(); renderOrders(); renderHUD(); save();
  }

  /* ============================================================== BOOSTERS
     Three one-shot helpers, bought with coins. They exist to rescue a clogged
     board and to give coins a use that is felt immediately. */
  const boostN = (id: string) => (S.boost && S.boost[id]) || 0;
  function giveBoost(id: string, n = 1) { S.boost[id] = boostN(id) + n; renderTools(); }
  function useBoost(id: string) {
    if (boostN(id) <= 0) { sfx.no(); toast('None left — buy more in the 🛒 Shop.'); return; }
    const before = S.coins;
    let ok = false;
    if (id === 'wand') ok = wandSweep();
    else if (id === 'bomb') ok = tidyBomb();
    else if (id === 'rainbow') ok = dropRainbow();
    if (!ok) return;
    S.boost[id]--;
    sfx.boost(); haptic('heavy');
    if (S.coins !== before) bumpChip('#chipCoins');
    paintBoard(); renderHUD(); renderOrders(); renderTools(); save();
  }
  /** merge every matching pair on the board, once, lowest tier first */
  function wandSweep() {
    let merged = 0, guard = 0;
    while (guard++ < 60) {
      const pair = findPair();
      if (!pair) break;
      if (!tryMerge(pair[0], pair[1])) break;
      merged++;
    }
    if (!merged) { sfx.no(); toast('Nothing to merge right now!'); return false; }
    toast('✨ The wand merged <b>' + merged + '</b> pair' + (merged > 1 ? 's' : '') + '!');
    return true;
  }
  /** sell every tier-1 leftover nobody has ordered */
  function tidyBomb() {
    const b = B();
    const wanted = new Set<string>();
    S.orders.forEach(o => o.needs.forEach(nd => wanted.add(nd.id)));
    if (S.ship) S.ship.needs.forEach(nd => wanted.add(nd.id));
    let coins = 0, n = 0;
    for (let i = 0; i < N; i++) {
      const c = b[i];
      if (!c || !c.id || ITEMS[c.id].tier > 1 || wanted.has(c.id)) continue;
      coins += ITEMS[c.id].sell; n++;
      sparkle(i, 6, '#ffe9a8'); b[i] = null;
    }
    if (!n) { sfx.no(); toast('No spare clutter to clear!'); return false; }
    S.coins += coins; shake();
    toast('💥 Cleared <b>' + n + '</b> bits for <b>' + coins + '</b> coins!');
    return true;
  }
  function dropRainbow() {
    const spot = freeCells()[0];
    if (spot === undefined) { sfx.no(); toast('No room on the board!'); return false; }
    giveItem('rainbow');
    toast('🌈 A <b>Rainbow Gem</b> — drop it on anything to merge it!');
    return true;
  }
  /** the little button row above the board: snack, hint, bag, boosters */
  function renderTools() {
    const host = $('#tools'); if (!host) return;
    const keep = ['btnSnack', 'btnHint'].map(id => $('#' + id));
    host.querySelectorAll('.toolBtn').forEach((e: any) => e.remove());
    if (bagHas()) {
      const bg = el('button', 'toolBtn');
      bg.innerHTML = ART.icon('bag') + (S.bag.length ? `<span class="n">${S.bag.length}</span>` : '');
      bg.onclick = () => openBag();
      host.appendChild(bg);
    }
    SHOP.boosters.forEach(bo => {
      if (boostN(bo.id) <= 0) return;
      const btn = el('button', 'toolBtn');
      btn.innerHTML = ART.icon(bo.icon) + `<span class="n">${boostN(bo.id)}</span>`;
      btn.title = bo.name;
      btn.onclick = () => useBoost(bo.id);
      host.appendChild(btn);
    });
    keep.forEach(k => k && host.appendChild(k));
  }

  /* =============================================================== STREAKS
     Fast consecutive merges pay a bonus. It costs nothing to ignore and turns a
     tidy-up burst into a small celebration. */
  function bumpStreak(at: number, cell: number) {
    const cfg = CONFIG.streak;
    S.streak = (S.streakAt && at - S.streakAt < cfg.windowMs) ? (S.streak || 0) + 1 : 1;
    S.streakAt = at;
    if (S.streak < cfg.minFor) return;
    const step = Math.min(S.streak - cfg.minFor + 1, cfg.maxStep);
    const coins = cfg.coinPerStep * step;
    S.coins += coins; bumpChip('#chipCoins');
    sfx.streak(Math.min(step, 5));
    floatText(cell, 'COMBO ×' + S.streak + '  +' + coins, '#ffe07a');
    board.ringPulse(cell, 0xffd45e);
  }

  /* ========================================================= DAILY REWARDS */
  const dayKey = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  function dailyReward(r: any) {
    if (r.kind === 'coins') { S.coins += r.n; bumpChip('#chipCoins'); }
    else if (r.kind === 'energy') { S.energy = Math.min(maxEnergy(), S.energy + r.n); bumpChip('#chipEnergy'); }
    else if (r.kind === 'booster') giveBoost(r.id, r.n);
  }
  function rewardArt(r: any) {
    if (r.kind === 'coins') return ART.icon('coin');
    if (r.kind === 'energy') return ART.icon('energy');
    const bo = SHOP.boosters.filter(x => x.id === r.id)[0];
    return ART.icon(bo ? bo.icon : 'gift');
  }
  function checkDaily() {
    const today = dayKey(new Date());
    if (S.daily.key === today) return;
    const list = CONFIG.daily.rewards;
    const yesterday = dayKey(new Date(Date.now() - 86400000));
    S.daily.day = S.daily.key === yesterday ? (S.daily.day % list.length) + 1 : 1;
    S.daily.key = today;
    const r = list[S.daily.day - 1];
    dailyReward(r);
    sfx.coin(); confetti();
    modal('pip', 'Welcome back!',
      `Day <b>${S.daily.day}</b> of your streak — here is <b>${r.label}</b>!
       <div class="dayGrid">${list.map((x: any, k: number) => `
         <div class="dayCell${k + 1 < S.daily.day ? ' done' : ''}${k + 1 === S.daily.day ? ' today' : ''}">
           <div class="dn">Day ${k + 1}</div>${rewardArt(x)}<b>${x.label}</b></div>`).join('')}</div>`,
      'Thanks!');
    renderHUD(); renderTools(); save();
  }

  /* ============================================================ CARGO SHIP
     A timed manifest that turns up every so often: big payout, real deadline,
     and a reason to keep a stock of mid-tier goods rather than selling them. */
  function newShip(now: number) {
    const w = W(), maxT = clamp(1 + Math.floor(S.lvl / CONFIG.orders.maxTierAtLevel), 2, 5);
    const live: Record<string, boolean> = {};
    B().forEach(c => { if (c && c.p) PRODS[c.p].drops.forEach((d: string) => { live[ITEMS[d].chain] = true; }); });
    const pool: string[] = [];
    const gather = (filter: boolean) => liveChains().forEach(c => {
      if (filter && !live[c]) return;
      CHAINS[c].items.forEach(id => { const t = ITEMS[id].tier; if (t >= 2 && t <= maxT) pool.push(id); });
    });
    gather(true);
    if (pool.length < CONFIG.ship.slots) gather(false);
    if (pool.length < CONFIG.ship.slots) return;
    const needs: any[] = [];
    for (let k = 0; k < CONFIG.ship.slots && pool.length; k++) {
      const id = rnd(pool);
      for (let j = pool.length - 1; j >= 0; j--) if (pool[j] === id) pool.splice(j, 1);
      needs.push({ id, qty: ITEMS[id].tier >= 4 ? 1 : 2 });
    }
    const worth = needs.reduce((a, nd) => a + ITEMS[nd.id].sell * nd.qty, 0);
    S.ship = {
      needs, endsAt: now + CONFIG.ship.windowMs,
      coins: Math.round(worth * CONFIG.ship.coinMult),
      xp: Math.round(needs.reduce((a: number, nd: any) => a + ITEMS[nd.id].tier * nd.qty, 0) * CONFIG.ship.xpMult),
    };
    sfx.whoosh();
    toast('⛴️ A <b>cargo ship</b> docked! Fill the manifest before it leaves.');
    renderOrders();
  }
  function shipTick(now: number) {
    if (S.lvl < CONFIG.ship.firstAtLevel) return;
    if (S.ship) {
      if (now > S.ship.endsAt) {
        S.ship = null; S.shipAt = now + CONFIG.ship.everyMs;
        toast('⛴️ The cargo ship sailed without you.');
        renderOrders(); save();
        return;
      }
      const el2 = $('#shipTime');
      if (el2) {
        const left = Math.max(0, S.ship.endsAt - now);
        el2.textContent = Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0');
        el2.classList.toggle('low', left < 60000);
      }
      return;
    }
    if (!S.shipAt) S.shipAt = now + CONFIG.ship.everyMs * 0.35;
    if (now >= S.shipAt) { newShip(now); S.shipAt = now + CONFIG.ship.everyMs; }
  }
  function deliverShip() {
    const sh = S.ship; if (!sh) return;
    const short = sh.needs.filter((nd: any) => countItem(nd.id) < nd.qty);
    if (short.length) {
      sfx.no();
      toast('The manifest still needs ' + short.map((nd: any) => `${nd.qty}× <b>${ITEMS[nd.id].name}</b>`).join(', '));
      return;
    }
    const b = B();
    sh.needs.forEach((nd: any) => { let left = nd.qty; for (let i = 0; i < N && left; i++) if (b[i] && b[i].id === nd.id) { b[i] = null; left--; sparkle(i, 10, '#ffe9a8'); } });
    S.coins += sh.coins; bumpChip('#chipCoins');
    giveBoost(rnd(['wand', 'bomb', 'rainbow']));
    S.ship = null; S.shipAt = Date.now() + CONFIG.ship.everyMs;
    sfx.big(); haptic('heavy'); confetti(); audio.duck(2, 0.2);
    toast('⛴️ Manifest complete! <b>+' + sh.coins + '</b> coins and a booster!');
    addXp(sh.xp);
    prog('ship', 1);
    paintBoard(); renderOrders(); renderHUD(); renderTools(); save();
  }

  /* ========================================================== ANTI-SOFTLOCK
     A full board with no possible merge is the one state a merge game must
     never leave a player in. Bloop turns up and clears the cheap clutter. */
  let rescueAt = 0;
  function boardStuck() {
    if (freeCells().length) return false;
    if (findPair()) return false;
    if (S.bag.length && bagCap() > S.bag.length) return false;
    return true;
  }
  function rescue() {
    const b = B();
    const wanted = new Set<string>();
    S.orders.forEach(o => o.needs.forEach(nd => wanted.add(nd.id)));
    const idx: number[] = [];
    for (let i = 0; i < N; i++) if (b[i] && b[i].id && !wanted.has(b[i].id)) idx.push(i);
    if (!idx.length) for (let i = 0; i < N; i++) if (b[i] && b[i].id) idx.push(i);
    idx.sort((x, y) => ITEMS[b[x].id].sell - ITEMS[b[y].id].sell);
    const take = Math.max(4, Math.ceil(idx.length * 0.3));
    let coins = 0;
    idx.slice(0, take).forEach(i => { coins += ITEMS[b[i].id].sell; sparkle(i, 8, '#ffe9a8'); b[i] = null; });
    S.coins += coins; bumpChip('#chipCoins'); sfx.boost(); confetti();
    toast('🧹 Bloop cleared ' + take + ' bits and left you <b>' + coins + '</b> coins.');
    paintBoard(); renderHUD(); renderOrders(); save();
  }
  function checkStuck(now: number) {
    if (view !== 'board' || now < rescueAt) return;
    // never stack a modal on top of one the player is still reading
    if ($('#modal').classList.contains('open')) return;
    if (!boardStuck()) return;
    rescueAt = now + 45000;
    modal('bloop', 'Blorp — no room!',
      'Your board is full and nothing matches. Sit tight, I will sweep the small stuff into my pockets and pay you for it.',
      'Please do!');
    const btn = $('#mBtn');
    if (btn) btn.onclick = () => { $('#modal').classList.remove('open'); btn.onclick = closeModal; rescue(); };
  }


  /** Luna's low gravity: a merge sometimes bounces one of the inputs back */
  function lunaBounce(inputId: string, at: number) {
    if (W().perk !== 'gravity' || !inputId || inputId === 'rainbow') return;
    if (Math.random() >= CONFIG.perk.gravityChance) return;
    const spot = giveItem(inputId, at);
    if (spot < 0) return;
    floatText(spot, 'Low gravity!', '#cfe4ff');
    sfx.popHi();
  }

  /* ============================================================ WORLD FLAVOUR
     Each world costs a different amount of energy to work and has one event of
     its own, so landing somewhere new changes how you play, not just the palette. */
  /* ==================================================== PRODUCER BATTERIES
     Producers are not on a drip. Each one is a battery you can empty as fast as
     you can tap, which then refills on its own over about half an hour — while
     you merge, and while the game is closed. Waiting fifteen seconds between
     two berries was the single worst thing about playing this. */
  const PMAX = 4;                                   // upgrade levels per producer
  const plv = (c: any) => (c && c.lv) || 1;
  /** what one tap on an energy producer costs. It climbs, but gently: one more
   *  every two levels, so a maxed producer is twice the price and several tiers
   *  better. Anything steeper and upgrading feels like a punishment. */
  const ecost = (p: any, lv: number) =>
    Math.max(1, (p.cost || 1) + Math.floor((lv - 1) / 2) - (starPerk('lantern') ? 0 : 0));
  /** charges at this level; the Lantern constellation makes every battery bigger */
  const capOf = (p: any, lv: number) =>
    Math.round(((p.cap || 12) + (lv - 1) * 5) * (starPerk('lantern') ? 1.2 : 1));
  /** an upgraded producer keeps its old drops and adds the next tier of every
   *  chain it feeds — the reason to spend coins on it is rarer stuff, not more */
  function dropsOf(p: any, lv: number): string[] {
    if (lv <= 1) return p.drops;
    const out = p.drops.slice();
    // start from the best thing it already drops, so every level really does
    // hand you something you have not had out of it before
    const top: Record<string, number> = {};
    p.drops.forEach((d: string) => {
      const it = ITEMS[d]; if (!it) return;
      top[it.chain] = Math.max(top[it.chain] || 0, it.tier);
    });
    for (let step = 1; step < lv; step++) {
      Object.keys(top).forEach(ch => {
        const ids = CHAINS[ch].items;
        const id = ids[Math.min(top[ch] - 1 + step, ids.length - 1)];
        if (id) out.push(id);
      });
    }
    return out;
  }
  const upCost = (p: any, lv: number) => Math.round((p.upCost || 350) * Math.pow(2.1, lv - 1) / 10) * 10;
  /** how long a producer at max level keeps going before it goes to seed */
  const RETIRE_AT = 45;

  /** out of charges — offer the impatient player a way through, for energy */
  function offerRecharge(i: number) {
    const c = B()[i], p = PRODS[c.p], cap = capOf(p, plv(c));
    const per = Math.max(1, Math.round(cap / 4));         // a quarter tank
    const cost = 12;
    const full = mmss(everyOf(p) * cap);
    modal(W().folks[0] || 'bloop', p.name + ' is empty',
      `It refills on its own — a full battery takes about <b>${full}</b>, and it keeps filling while the game is shut.`
      + `<div class="rechargeBox">In a hurry? Spend <b>${cost} ⚡</b> for <b>${per}</b> charges right now.</div>`
      + `<button class="big blue" id="rechargeBtn"${S.energy >= cost ? '' : ' disabled'}>Recharge (${cost} ⚡)</button>`,
      'I can wait');
    setTimeout(() => {
      const b2 = $('#rechargeBtn');
      if (b2) b2.onclick = () => {
        if (S.energy < cost) return;
        S.energy -= cost; bumpChip('#chipEnergy');
        const cc = B()[i];
        if (cc && cc.p) { cc.ch = Math.min(capOf(PRODS[cc.p], plv(cc)), (cc.ch || 0) + per); cc.at = Date.now(); }
        sfx.boost(); floatText(i, '+' + per, '#8fe86d'); sparkle(i, 14, '#8fe86d');
        closeModal(); renderHUD(); save();
      };
    }, 30);
  }

  /* ------------------------------------------------------ growing a producer
     Coins finally buy something you can feel every single tap: a bigger battery
     and rarer drops. A Big Tree at level 4 hands out Lumber Piles. */
  function upgradeProducer(i: number) {
    const c = B()[i]; if (!c || !c.p) return;
    const p = PRODS[c.p], lv = plv(c);
    if (lv >= PMAX) { sfx.no(); toast(p.name + ' is as good as it gets.'); return; }
    const price = upCost(p, lv);
    if (S.coins < price) { sfx.no(); toast('Needs ' + price + ' 🪙 — you have ' + S.coins + '.'); return; }
    spend(price);
    c.lv = lv + 1;
    c.ch = capOf(p, c.lv);                                  // a fresh battery, on the house
    c.at = Date.now();
    sfx.build(); haptic('medium'); confetti();
    sparkle(i, 22, '#ffd45e'); floatText(i, 'LEVEL ' + c.lv, '#ffd45e');
    const added = dropsOf(p, c.lv).filter(d => dropsOf(p, lv).indexOf(d) < 0);
    toast('🌟 <b>' + p.name + '</b> is now level ' + c.lv
      + (added.length ? ' — it can drop <b>' + [...new Set(added)].map(d => ITEMS[d].name).join('</b>, <b>') + '</b> now!' : ''));
    prog('grow', 1); tally('grow');
    paintBoard(); renderHUD(); renderWorldScreen(); save();
    setTimeout(growProducers, 900);      // was that the last one? then the plot fills
  }

  /* A producer at max level does not last forever: it gives what it has and then
     goes to seed, and something else takes root in its place. Keeps a late board
     from settling into the same four taps for good. */
  function retireTick(i: number) {
    const c = B()[i]; if (!c || !c.p) return;
    c.spent = (c.spent || 0) + 1;
    const left = RETIRE_AT - c.spent;
    if (left === 10 || left === 3) floatText(i, left + ' left', '#ffb8a0');
    if (left > 0) return;
    const old = PRODS[c.p];
    // prefer something this world has unlocked that is not already on the board
    const here = B().filter((x: any) => x && x.p).map((x: any) => x.p);
    const pool = (W().grow || []).filter(g => wlv() >= g.atLevel).map(g => g.producer)
      .concat(W().start.map(s2 => s2.producer))
      .filter(k => here.indexOf(k) < 0);
    const next = pool.length ? rnd(pool) : null;
    const payout = 400 * PMAX;
    S.coins += payout; bumpChip('#chipCoins');
    B()[i] = next ? mkProd(next) : mkProd(c.p);
    sfx.discover(); sparkle(i, 24, '#8fe86d'); paintBoard(); renderHUD(); save();
    setTimeout(() => modal(W().folks[0] || 'bloop', old.name + ' has gone to seed',
      `It gave everything it had. ${next
        ? `A <b>${PRODS[next].name}</b> has taken root in its place.`
        : `A young <b>${old.name}</b> is already coming up in its place.`}`
      + `<div class="rewardLine">+${payout} 🪙 from the last harvest</div>`, 'Lovely'), 500);
  }

  /** producers that appear as you level, listed per world in worlds.json */
  function growProducers() {
    const b = B(), nxt = nextProducer();
    if (!nxt || !allMaxed()) return;
    if (b.some(c => c && c.p === nxt)) return;
    const g = (W().grow || []).find(x => x.producer === nxt);
    const i = firstFree(g ? g.cells : []);
    if (i < 0) return;
    b[i] = mkProd(nxt);
    plots().push(nxt);
    const p = PRODS[nxt];
    const chains = [...new Set(p.drops.map(d => CHAINS[ITEMS[d].chain].name))];
    sfx.discover(); confetti(); paintBoard(); renderHUD(); save();
    setTimeout(() => modal(W().folks[0] || 'bloop', 'Something new took root',
      `Everything you had is fully grown, so the meadow gave you a <b>${p.name}</b>.`
      + `<div class="noteLine">It starts the <b>${chains.join('</b> and <b>')}</b> chain${chains.length > 1 ? 's' : ''}.</div>`,
      'Show me'), 700);
  }

  function worldEvent(now: number) {
    if (view !== 'board') return;
    if (!S.perkAt) { S.perkAt = now + CONFIG.perk.everyMs; return; }
    if (now < S.perkAt) return;
    S.perkAt = now + CONFIG.perk.everyMs + Math.random() * CONFIG.perk.spreadMs;
    const perk = W().perk;
    if (perk === 'rain') {
      const b = B(); let n = 0;
      for (let i = 0; i < N; i++) {
        const c = b[i]; if (!c || !c.p) continue;
        const p = PRODS[c.p]; if (p.mode !== 'battery') continue;
        const cap = capOf(p, plv(c));
        if (c.ch < cap) { c.ch = cap; c.at = now; n++; }
      }
      if (!n) return;
      rainBurst();
      sfx.whoosh();
      toast('🌧️ A shower rolled through — every plant is full!');
    } else if (perk === 'eruption') {
      const free = freeCells(); if (free.length < 3) return;
      const drops = CHAINS.magma.items.slice(0, 2);
      let n = 0;
      for (let k = 0; k < CONFIG.perk.eruptionItems && k < free.length; k++) {
        const id = rnd(drops);
        B()[free[k]] = { id }; gotItem(id);
        board.animSpawn(free[k], id, free[k] >= COLS ? free[k] - COLS : free[k]);
        n++;
      }
      if (!n) return;
      shake(); sfx.dig();
      toast('🌋 The vents erupted — <b>' + n + '</b> hot rocks landed!');
    }
    // luna's low gravity is handled inside tryMerge, not on a timer
    renderOrders(); save();
  }
  function rainBurst() {
    const host = $('#fx');
    for (let i = 0; i < 26; i++) {
      const d = el('div', 'rain');
      d.style.cssText = `left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.6}s`;
      host.appendChild(d);
      setTimeout(() => d.remove(), 1800);
    }
  }

  /* ============================================================ RELIC VAULT
     Relics were pretty and useless. Here they buy permanent perks, which is the
     only sink big enough to make the lab worth running for hours. */
  function vaultBuy(id: string) {
    const v = CONFIG.vault.filter(x => x.id === id)[0]; if (!v) return;
    const lv = vaultLv(id);
    if (lv >= v.max) { toast(v.name + ' is fully upgraded!'); return; }
    if (countItem(v.item) < v.qty) {
      sfx.no();
      toast('Needs ' + v.qty + ' × <b>' + ITEMS[v.item].name + '</b> on your board — make them in the 🔬 Lab.');
      return;
    }
    for (let n = 0; n < v.qty; n++) consumeOne(v.item);
    S.vault[id] = lv + 1;
    sfx.discover(); haptic('heavy'); confetti(); audio.duck(1.8, 0.2);
    toast('🏛️ <b>' + v.name + '</b> is now level ' + S.vault[id] + '!');
    if (id === 'crowd') fillOrders();
    paintBoard(); renderRocket(); renderHUD(); renderOrders(); renderTools(); save();
  }

  /* ============================================================= STAR FORGE
     Star Scrap and Star Cores pile up from meteors with nothing to do. Now they
     are the currency for the impatient: instant energy, instant refills, rerolls. */
  function forgeUse(id: string) {
    const f = CONFIG.forge.filter(x => x.id === id)[0]; if (!f) return;
    if (countItem(f.item) < f.qty) {
      sfx.no();
      toast('Needs ' + f.qty + ' × <b>' + ITEMS[f.item].name + '</b> on your board.');
      return;
    }
    let done = true;
    if (id === 'charge') { S.energy = maxEnergy(); bumpChip('#chipEnergy'); toast('⚡ Energy full!'); }
    else if (id === 'rush') {
      const b = B(), now = Date.now(); let n = 0;
      for (let i = 0; i < N; i++) {
        const c = b[i]; if (!c || !c.p) continue;
        const p = PRODS[c.p]; if (p.mode !== 'battery' || c.ch >= capOf(p, plv(c))) continue;
        c.ch = capOf(p, plv(c)); c.at = now; n++;
      }
      if (!n) { toast('Nothing is waiting to refill.'); return; }
      toast('⏩ <b>' + n + '</b> producer' + (n > 1 ? 's' : '') + ' topped right up!');
    } else if (id === 'reroll') {
      S.orders = []; fillOrders(true);
      toast('📜 A fresh set of contracts!');
    } else if (id === 'call') {
      if (!S.met) { toast('Nothing to call down yet.'); return; }
      meteorTimer = 0; S.perkAt = Date.now();
      if (!randomMeteor()) { toast('No room for a crater — clear a few tiles first.'); return; }
    } else done = false;
    if (!done) return;
    for (let n = 0; n < f.qty; n++) consumeOne(f.item);
    sfx.boost(); haptic('medium');
    paintBoard(); renderHUD(); renderOrders(); renderShop(); renderTools(); save();
  }

  /* ================================================================ TASKS
     Three small goals at a time. They exist to give the next ten minutes a
     shape when the story beats are far apart. */
  function rollTask() {
    const t = rnd(CONFIG.tasks.pool);
    const n = t.min + Math.floor(Math.random() * (t.max - t.min + 1));
    return { kind: t.kind, n, have: 0, coins: Math.round(t.coins * n * coinMult()),
             label: t.label.replace('{n}', String(n)), id: 't' + (tid++) };
  }
  let tid = 1;
  function fillTasks() {
    let guard = 0;
    while (S.tasks.length < CONFIG.tasks.slots && guard++ < 30) {
      const t = rollTask();
      if (S.tasks.some((x: any) => x.kind === t.kind) && guard < 20) continue;
      S.tasks.push(t);
    }
  }
  /** every scoring action in the game funnels through here */
  function tally(kind: string, n = 1) {
    if (!S.tasks || !S.tasks.length) return;
    let done = false;
    S.tasks.forEach((t: any) => {
      if (t.kind !== kind || t.have >= t.n) return;
      t.have = Math.min(t.n, t.have + n);
      if (t.have >= t.n) done = true;
    });
    if (done) {
      sfx.coin();
      toast('✅ Task done! Collect it in the 🚀 tab.');
      renderHUD();
    }
  }
  function claimTask(id: string) {
    const i = S.tasks.findIndex((t: any) => t.id === id);
    if (i < 0) return;
    const t = S.tasks[i];
    if (t.have < t.n) { sfx.no(); toast('Not finished yet — ' + t.have + '/' + t.n); return; }
    S.coins += t.coins; bumpChip('#chipCoins');
    // a Star Scrap on top, so tasks feed the forge as well as the purse
    const at = giveItem('scrap');
    S.tasks.splice(i, 1);
    fillTasks();
    sfx.big(); haptic('medium'); confetti();
    if (at >= 0) sparkle(at, 14, '#ffe9a8');
    toast('🎉 <b>+' + t.coins + '</b> coins' + (at >= 0 ? ' and a Star Scrap!' : '!'));
    renderRocket(); renderHUD(); renderOrders(); save();
  }
  const tasksDone = () => S.tasks.filter((t: any) => t.have >= t.n).length;

  /* =============================================================== TRAVEL */
  function travelTo(w: string) {
    if (S.fuel < CONFIG.rocket.fuelToLaunch || !allParts()) return;
    S.fuel -= CONFIG.rocket.fuelToLaunch;
    const cut = $('#cut'); $('#cutRocket').innerHTML = ART.rocket({ hull: 1, engine: 1, nav: 1, tank: 1 }, { flame: true });
    $('#cutTitle').textContent = 'Blasting off!';
    $('#cutSub').textContent = 'Destination: ' + WORLDS[w].name;
    const warpHost = $('#warps'); warpHost.innerHTML = '';
    for (let i = 0; i < 22; i++) { const s = el('div', 'warp'); s.style.cssText = `left:${Math.random() * 100}%;height:${30 + Math.random() * 90}px;animation-delay:${-Math.random()}s`; warpHost.appendChild(s); }
    cut.classList.add('show'); sfx.launch();
    setTimeout(() => {
      if (!S.boards[w]) S.boards[w] = freshBoard(w);
      S.world = w; S.unlocked[w] = 1; sel = null;
      // you arrive standing in the new camp, not looking at the star chart
      worldTab = 'camp';
      if (!S.wlv[w]) { S.wlv[w] = 1; S.wxp[w] = 0; }
      applyBloomSkin(); applyScene();
      // the shelf, the ship and the contract board all belong to a world
      S.orders = []; S.orderCap = undefined; S.ordersAt = 0; fillOrders(true);
      S.shop.stock = null; S.shop.at = 0;
      S.ship = null; S.shipAt = Date.now() + CONFIG.ship.everyMs * 0.5;
      S.perkAt = 0;
      growProducers();
      prog('travel', 1);
      board.setTheme(w);
      audio.playMusic(worldMusic(w));
      paintBoard(); renderHUD(); renderOrders(); setView('board');
      if (w === 'cindra') prog('cindra', 1);
      if (w === 'nerith') prog('nerith', 1);
      if (w === 'vela') prog('vela', 1);
      setTimeout(() => {
        cut.classList.remove('show');
        const face = WORLDS[w].folks[0] || 'bloop';
        const chains = liveChains(w).map(c => CHAINS[c].name).join(' and ');
        const asleep = WORLDS[w].chains.length - liveChains(w).length;
        if (!checkStory()) modal(face, WORLDS[w].name,
          `${WORLDS[w].intro}<br><br><b>${chains}</b> ${asleep ? `are awake here — ${asleep} more are still sleeping and come back as you play.` : 'grow here.'}`,
          'Begin');
      }, 900);
      save();
    }, 2100);
  }

  /* ============================================================ THE STORY
     Merge Rocket has a spine: the Bloom — the living network that linked every
     world — collapsed, and your rocket is the last Seed Vault. Beats fire off
     world levels and one-off flags, and each one is a single modal. */
  function checkStory(flag?: string) {
    const beat = STORY.find(b => {
      if (S.story[b.id]) return false;
      const at = b.at || {};
      if (at.flag) return at.flag === flag;
      if (at.world && at.world !== S.world) return false;
      return !at.lvl || wlv() >= at.lvl;
    });
    if (!beat) return false;
    S.story[beat.id] = 1; save();
    setTimeout(() => modal(beat.who, beat.title, beat.text, 'Go on…'), 600);
    return true;
  }

  /* ============================================================= THE HEART
     Every world has a dormant Heart. Feed it Bloom Essence and the world wakes
     in stages — this is the long goal behind all the merging, and the reason
     finishing a chain matters beyond the coins. */
  const BLOOM = () => CHAINS.bloom.items as string[];
  /** what an essence item is worth to a Heart: 1, 2, 4, 8 up the chain */
  function bloomValue(id: string) {
    const i = BLOOM().indexOf(id);
    return i < 0 ? 0 : Math.pow(2, i);
  }
  const fed = (w?: string) => (S.fed && S.fed[w || S.world]) || 0;
  const stage = (w?: string) => (S.stage && S.stage[w || S.world]) || 0;
  const bloomGoal = (w?: string) => {
    const st = WORLDS[w || S.world].bloom, i = stage(w);
    return i >= st.length ? st[st.length - 1].need : st[i].need;
  };
  const worldAwake = (w?: string) => stage(w) >= WORLDS[w || S.world].bloom.length;

  /** completing a chain for the first time is what produces Bloom Essence */
  function checkChainFinale(id: string, at: number) {
    const d = ITEMS[id], ch = CHAINS[d.chain];
    if (!ch || ch.world === 'ship' || ch.world === 'any') return;
    if (ch.items[ch.items.length - 1] !== id) return;
    if (S.firsts[d.chain]) return;
    S.firsts[d.chain] = 1;
    prog('chain', 1);
    tally('chain');
    setTimeout(() => {
      const spot = giveItem('bloomspark', at);
      if (spot >= 0) sparkle(spot, 20, '#9ef5d8');
      sfx.discover();
      toast('🌱 <b>' + ch.name + '</b> complete! The Vault remembers — a <b>Bloom Spark</b> for the Heart.');
    }, 700);
  }

  /** hand every essence tile on the board to the Heart */
  function feedHeart() {
    const b = B(), taken: number[] = [];
    let value = 0;
    for (let i = 0; i < N; i++) {
      const c = b[i]; if (!c || !c.id) continue;
      const v = bloomValue(c.id);
      if (v) { value += v; taken.push(i); }
    }
    if (!value) { sfx.no(); toast('No Bloom Essence on the board — finish a chain to earn a Spark.'); return; }
    taken.forEach(i => { board.consume(i, b[i].id); b[i] = null; });
    S.fed[S.world] = fed() + value * (starPerk('vault') ? 2 : 1);
    sfx.build(); haptic('medium'); confetti();
    paintBoard();
    toast('🌱 The ' + W().heart + ' takes <b>' + value + '</b> Bloom.');
    tally('bloom', value);
    let woke = false;
    while (stage() < W().bloom.length && fed() >= W().bloom[stage()].need) {
      S.stage[S.world] = stage() + 1;
      woke = true;
      wakeStage(W().bloom[stage() - 1]);
    }
    if (!woke) renderWorldScreen();
    save();
  }
  function wakeStage(st: any) {
    const r = CONFIG.bloom.reward;
    prog('bloom', 1);
    prog('allbloom', 0, WORLD_ORDER.filter(w => worldAwake(w)).length);
    S.coins += r.coins; S.energy = Math.min(maxEnergy(), S.energy + r.energy);
    applyBloomSkin();
    sfx.big(); confetti();
    setTimeout(() => {
      modal(W().folks[0] || 'bloop', st.title,
        st.text + `<div class="rewardLine">+${r.coins} 🪙 · +${r.energy} ⚡</div>`, 'Beautiful');
    }, 500);
    if (WORLD_ORDER.every(w => worldAwake(w))) checkStory('allHearts');
    renderHUD(); renderWorldScreen();
  }
  /** the world you are standing in, painted: its own picture if one was dropped
   *  into public/sprites/scenes, otherwise the meadow */
  function applyScene() {
    const url = ART.spriteScene(S.world) || campEarthBg;
    $('#app').style.setProperty('--camp', `url(${url})`);
  }

  /** the board and the backdrop visibly come back to life, stage by stage */
  function applyBloomSkin() {
    const app = $('#app'); if (!app) return;
    app.classList.remove('bloom1', 'bloom2', 'bloom3');
    const st = stage();
    if (st) app.classList.add('bloom' + Math.min(st, 3));
  }

  /* ============================================================= SIDE GAMES
     Four small games, each a different verb: press your luck (Dig), timing
     (Brew), a gamble with information (Market) and a permanent-progress puzzle
     (Constellations). They share one overlay and one cooldown table. */
  const miniCfg = (k: string) => CONFIG.mini[k];
  const miniLeft = (k: string) => Math.max(0, ((S.mini && S.mini[k]) || 0) - Date.now());
  const setCooldown = (k: string) => { S.mini[k] = Date.now() + miniCfg(k).cooldownMs; };
  let miniState: any = null;

  function openMini(title: string, sub: string) {
    $('#miniTitle').innerHTML = title;
    $('#miniSub').innerHTML = sub;
    $('#miniBody').innerHTML = '';
    $('#miniFoot').innerHTML = '';
    $('#mini').classList.add('open');
  }
  function closeMini() {
    $('#mini').classList.remove('open');
    if (miniState && miniState.raf) cancelAnimationFrame(miniState.raf);
    if (miniState && miniState.timer) clearInterval(miniState.timer);
    miniState = null;
    renderWorldScreen(); renderHUD(); save();
  }
  /** everything a side game can hand out lands on the board the same way */
  function payout(list: { id?: string; coins?: number; energy?: number }[]) {
    let coins = 0, energy = 0;
    const items: string[] = [];
    list.forEach(r => {
      if (r.coins) coins += r.coins;
      if (r.energy) energy += r.energy;
      if (r.id) items.push(r.id);
    });
    if (coins) { S.coins += coins; bumpChip('#chipCoins'); sfx.coin(); }
    if (energy) { S.energy = Math.min(maxEnergy(), S.energy + energy); bumpChip('#chipEnergy'); }
    let placed = 0;
    items.forEach(id => { if (giveItem(id) >= 0) placed++; });
    paintBoard(); renderHUD(); save();
    const missed = items.length - placed;
    return { coins, energy, placed, missed };
  }
  function payoutLine(p: { coins: number; energy: number; placed: number; missed: number }) {
    const bits = [];
    if (p.coins) bits.push('+' + p.coins + ' 🪙');
    if (p.energy) bits.push('+' + p.energy + ' ⚡');
    if (p.placed) bits.push(p.placed + ' item' + (p.placed > 1 ? 's' : '') + ' on the board');
    if (p.missed) bits.push('<span style="color:#d4643a">' + p.missed + ' lost — board was full</span>');
    return bits.join(' · ') || 'nothing this time';
  }
  /** a believable low-tier prize from the chains that actually grow here */
  function miniItem(maxTier = 3, minTier = 1) {
    const pool: string[] = [];
    liveChains().forEach(c => CHAINS[c].items.forEach(id => {
      const t = ITEMS[id].tier; if (t >= minTier && t <= maxTier) pool.push(id);
    }));
    return pool.length ? rnd(pool) : 'pebble';
  }
  function canPlay(k: string) {
    const c = miniCfg(k);
    if (miniLeft(k) > 0) { sfx.no(); toast('That one needs a rest — ' + mmss(miniLeft(k)) + ' to go.'); return false; }
    if (S.energy < c.cost) { sfx.no(); toast('Needs ' + c.cost + ' ⚡.'); return false; }
    prog('mini', 1); tally('mini');
    return true;
  }
  const mmss = (ms: number) => {
    const t = Math.ceil(ms / 1000);
    return t >= 60 ? Math.floor(t / 60) + 'm ' + (t % 60) + 's' : t + 's';
  };

  /* --------------------------------------------------------- 1. Crater Dig
     Press-your-luck: six digs, and one of the tiles is a cave-in. Stop early
     and keep the pile, or go one more and risk it. */
  function playDig() {
    if (!canPlay('dig')) return;
    const c = miniCfg('dig');
    S.energy -= c.cost; bumpChip('#chipEnergy'); setCooldown('dig'); renderHUD();
    const n = c.grid || 20, digs = c.digs || 6;
    const cells: any[] = [];
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      cells.push(r < 0.12 ? { kind: 'cavein' }
        : r < 0.2 ? { kind: 'coins', coins: 60 + Math.floor(Math.random() * 140) }
          : r < 0.26 ? { kind: 'item', id: 'scrap' }
            : r < 0.29 ? { kind: 'item', id: 'bloomspark' }
              : r < 0.34 ? { kind: 'item', id: 'fuelore' }
                : { kind: 'item', id: miniItem(3) });
    }
    miniState = { cells, left: digs, bank: [] as any[], done: false };
    openMini('⛏️ Crater Dig', 'Six digs. Every tile pays — except the cave-ins. Cash out whenever you like.');
    drawDig();
  }
  function drawDig() {
    const st = miniState;
    $('#miniBody').innerHTML = `<div class="digGrid">${st.cells.map((c: any, i: number) =>
      `<button class="digCell${c.open ? ' open' : ''}${c.open && c.kind === 'cavein' ? ' bad' : ''}" data-d="${i}"${c.open || st.done ? ' disabled' : ''}>`
      + (c.open ? (c.kind === 'cavein' ? '💥' : c.kind === 'coins' ? '🪙' : ART.item(c.id)) : '') + '</button>').join('')}</div>`;
    const total = st.bank.reduce((a: number, r: any) => a + (r.coins || 0), 0);
    $('#miniFoot').innerHTML = st.done
      ? `<button class="big" id="digOut">Collect</button>`
      : `<div class="miniStat">Digs left <b>${st.left}</b> · in the pile <b>${st.bank.length}</b>${total ? ' + ' + total + ' 🪙' : ''}</div>
         <button class="big alt" id="digOut"${st.bank.length ? '' : ' disabled'}>Cash out</button>`;
    $('#miniBody').querySelectorAll('[data-d]').forEach((b: any) => b.onclick = () => dig(+b.dataset.d));
    const out = $('#digOut'); if (out) out.onclick = () => endDig();
  }
  function dig(i: number) {
    const st = miniState, c = st.cells[i];
    if (!st || st.done || c.open || !st.left) return;
    c.open = 1; st.left--;
    if (c.kind === 'cavein') {
      st.done = true; st.bank = []; sfx.boom(); shake(); haptic('heavy');
      drawDig();
      $('#miniSub').innerHTML = '<b style="color:#d4643a">Cave-in!</b> The pile is buried. Next time, quit while you are ahead.';
      return;
    }
    st.bank.push(c.kind === 'coins' ? { coins: c.coins } : { id: c.id });
    sfx.dig();
    if (!st.left) { st.done = true; $('#miniSub').innerHTML = 'Out of digs — and out in one piece. Take it all.'; }
    drawDig();
  }
  function endDig() {
    const st = miniState; if (!st) return;
    const p = payout(st.bank);
    closeMini();
    if (st.bank.length) { confetti(); toast('⛏️ ' + payoutLine(p)); }
  }

  /* ------------------------------------------------------- 2. Fuel Brewing
     Pure timing. A needle sweeps the bar; stop it in the green. Five rounds,
     and the green shrinks each time — the only way to a full brew is nerve. */
  function playBrew() {
    if (!canPlay('brew')) return;
    const c = miniCfg('brew');
    S.energy -= c.cost; bumpChip('#chipEnergy'); setCooldown('brew'); renderHUD();
    miniState = { round: 0, hits: 0, rounds: c.rounds || 5, pos: 0, dir: 1, raf: 0, live: true };
    openMini('⚗️ Fuel Brewing', 'Stop the needle in the green band. Five stirs — the band gets meaner.');
    $('#miniBody').innerHTML = `<div class="brewWrap">
        <div class="brewBar"><i class="brewZone" id="brewZone"></i><i class="brewPin" id="brewPin"></i></div>
        <div class="brewPips" id="brewPips"></div></div>`;
    $('#miniFoot').innerHTML = '<button class="big" id="brewTap">Stir!</button>';
    $('#brewTap').onclick = brewTap;
    nextBrew();
  }
  function nextBrew() {
    const st = miniState; if (!st) return;
    const tight = st.round;                             // 0..4, band shrinks with it
    st.w = Math.max(9, 30 - tight * 5);                 // % width of the green zone
    st.zone = 12 + Math.random() * (76 - st.w);
    st.speed = 0.85 + tight * 0.28;
    st.pos = 0; st.dir = 1;
    const z = $('#brewZone');
    z.style.left = st.zone + '%'; z.style.width = st.w + '%';
    $('#brewPips').innerHTML = Array.from({ length: st.rounds }, (_, i) =>
      `<i class="${i < st.round ? (st.marks && st.marks[i] ? 'hit' : 'miss') : ''}"></i>`).join('');
    const step = () => {
      if (!miniState || !st.live) return;
      st.pos += st.dir * st.speed;
      if (st.pos >= 100) { st.pos = 100; st.dir = -1; }
      if (st.pos <= 0) { st.pos = 0; st.dir = 1; }
      const pin = $('#brewPin'); if (pin) pin.style.left = st.pos + '%';
      st.raf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(step);
  }
  function brewTap() {
    const st = miniState; if (!st || !st.live) return;
    const hit = st.pos >= st.zone && st.pos <= st.zone + st.w;
    st.marks = st.marks || [];
    st.marks[st.round] = hit ? 1 : 0;
    if (hit) { st.hits++; sfx.popHi(); haptic('light'); } else { sfx.no(); }
    st.round++;
    if (st.round >= st.rounds) { st.live = false; cancelAnimationFrame(st.raf); endBrew(); return; }
    nextBrew();
  }
  function endBrew() {
    const st = miniState, hits = st.hits;
    const rewards: any[] = [];
    for (let i = 0; i < hits; i++) rewards.push({ id: 'fuelore' });
    if (hits >= 3) rewards.push({ coins: 150 });
    if (hits === st.rounds) rewards.push({ id: 'fuelcan' });
    $('#brewPips').innerHTML = Array.from({ length: st.rounds }, (_, i) =>
      `<i class="${st.marks[i] ? 'hit' : 'miss'}"></i>`).join('');
    const p = payout(rewards);
    $('#miniSub').innerHTML = hits === st.rounds
      ? '<b>Perfect brew!</b> Bloop is quietly impressed, which is rare.'
      : hits ? `<b>${hits} of ${st.rounds}.</b> Serviceable.` : 'Not a drop. Steadier hands next time.';
    $('#miniFoot').innerHTML = `<div class="miniStat">${payoutLine(p)}</div><button class="big" id="brewDone">Done</button>`;
    $('#brewDone').onclick = closeMini;
    if (hits === st.rounds) { confetti(); sfx.big(); }
  }

  /* ------------------------------------------------------- 3. Alien Market
     A gamble about information: three crates, you may look inside two, and you
     keep exactly one. Then Zib offers to sweeten it — for coins. */
  function playMarket() {
    if (!canPlay('market')) return;
    setCooldown('market');
    const crates = [0, 1, 2].map(() => Math.random() < 0.22
      ? { coins: 120 + Math.floor(Math.random() * 260) }
      : { id: miniItem(4, 2) });
    miniState = { crates, flips: 0, kept: -1 };
    openMini('🛸 Alien Market', 'Zib lets you peek inside <b>two</b> crates. You walk away with <b>one</b>.');
    drawMarket();
  }
  function drawMarket() {
    const st = miniState;
    $('#miniBody').innerHTML = `<div class="mktRow">${st.crates.map((c: any, i: number) =>
      `<button class="mktCrate${c.open ? ' open' : ''}${st.kept === i ? ' kept' : ''}" data-m="${i}">`
      + (c.open ? `<div class="mktArt">${c.coins ? '🪙' : ART.item(c.id)}</div>
           <div class="mktLab">${c.coins ? c.coins + ' coins' : ITEMS[c.id].name}</div>`
        : '<div class="mktArt">📦</div><div class="mktLab">?</div>') + '</button>').join('')}</div>`;
    $('#miniFoot').innerHTML = st.kept >= 0 ? '' :
      `<div class="miniStat">${st.flips < 2 ? `Peeks left: <b>${2 - st.flips}</b>` : 'Now choose one to keep.'}</div>`;
    $('#miniBody').querySelectorAll('[data-m]').forEach((b: any) => b.onclick = () => market(+b.dataset.m));
  }
  function market(i: number) {
    const st = miniState; if (!st || st.kept >= 0) return;
    const c = st.crates[i];
    if (!c.open && st.flips < 2) { c.open = 1; st.flips++; sfx.pop(); drawMarket(); return; }
    // picking is always allowed — an unopened crate is the whole gamble
    st.kept = i; c.open = 1;
    sfx.bag(); drawMarket();
    const up = c.id && nextOf(c.id);
    const price = c.coins ? 0 : 60 + ITEMS[c.id].sell * 3;
    $('#miniFoot').innerHTML = (up
      ? `<div class="miniStat">Zib will trade it up to a <b>${ITEMS[up].name}</b> for <b>${price} 🪙</b>.</div>
         <button class="big alt" id="mktUp"${S.coins >= price ? '' : ' disabled'}>Haggle (${price} 🪙)</button>` : '')
      + '<button class="big" id="mktTake">Take it</button>';
    const u = $('#mktUp');
    if (u) u.onclick = () => {
      if (S.coins < price) return;
      spend(price); st.crates[st.kept] = { id: up, open: 1 };
      sfx.discover(); drawMarket();
      $('#miniFoot').innerHTML = '<button class="big" id="mktTake">Take it</button>';
      $('#mktTake').onclick = takeMarket;
      renderHUD();
    };
    $('#mktTake').onclick = takeMarket;
  }
  function takeMarket() {
    const st = miniState; if (!st || st.kept < 0) return;
    const p = payout([st.crates[st.kept]]);
    closeMini();
    toast('🛸 ' + payoutLine(p));
  }

  /* ----------------------------------------------------- 4. Constellations
     The permanent one, and the sink the Star Cores needed. Trace a shape by
     tapping its stars in order; light it and keep the bonus for good. */
  const CONSTS = [
    { id: 'plough', name: 'The Plough', cost: 2, perk: '+10% coins from every sale and contract', pts: [[18, 70], [34, 58], [50, 52], [66, 46], [74, 30], [58, 22], [44, 30]] },
    { id: 'lantern', name: 'The Lantern', cost: 3, perk: 'Every producer holds 20% more charges', pts: [[30, 26], [70, 26], [78, 52], [50, 76], [22, 52]] },
    { id: 'seed', name: 'The Seed', cost: 4, perk: 'Producers recharge 20% faster', pts: [[50, 18], [72, 36], [64, 66], [36, 66], [28, 36], [50, 44]] },
    { id: 'vault', name: 'The Vault', cost: 6, perk: 'Every Bloom Essence you feed a Heart counts double', pts: [[24, 34], [50, 22], [76, 34], [76, 64], [50, 78], [24, 64], [50, 50]] },
  ];
  const lit = (id: string) => !!(typeof S !== 'undefined' && S && S.stars && S.stars[id]);
  const starPerk = (id: string) => lit(id);
  function playStars(id: string) {
    const co = CONSTS.find(c => c.id === id); if (!co) return;
    if (lit(id)) { toast('⭐ ' + co.name + ' is already lit — ' + co.perk + '.'); return; }
    const have = countItem('starcore');
    if (have < co.cost) { sfx.no(); toast('Needs <b>' + co.cost + ' Star Cores</b> on the board — you have ' + have + '.'); return; }
    miniState = { co, next: 0 };
    openMini('✨ ' + co.name, 'Tap the stars <b>in order</b>, starting from the brightest. One slip and the line breaks.');
    drawStars();
  }
  function drawStars() {
    const st = miniState, co = st.co;
    const line = co.pts.slice(0, st.next).map((p: number[], i: number) =>
      i ? `L${p[0]} ${p[1]}` : `M${p[0]} ${p[1]}`).join(' ');
    const ghost = co.pts.map((p: number[], i: number) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
    // a star, not a dot — and the order is printed, because a guessing game with
    // a full reset on every wrong tap is a chore, while tracing one is a pleasure
    const star = (x: number, y: number, r: number) => {
      let d = '';
      for (let k = 0; k < 10; k++) {
        const ang = (Math.PI / 5) * k - Math.PI / 2, rr = k % 2 ? r * 0.42 : r;
        d += (k ? 'L' : 'M') + (x + Math.cos(ang) * rr).toFixed(2) + ' ' + (y + Math.sin(ang) * rr).toFixed(2);
      }
      return d + 'Z';
    };
    const dust = st.dust || (st.dust = Array.from({ length: 34 }, () => [
      +(Math.random() * 100).toFixed(1), +(Math.random() * 100).toFixed(1), +(0.4 + Math.random() * 0.8).toFixed(2)]));
    $('#miniBody').innerHTML = `<div class="skyBox">
      <svg viewBox="0 0 100 100" class="sky">
        ${dust.map((d: number[]) => `<circle cx="${d[0]}" cy="${d[1]}" r="${d[2]}" fill="#fff" opacity=".35"/>`).join('')}
        <path d="${ghost}" fill="none" stroke="#7d84b8" stroke-width="0.8" stroke-dasharray="2 2.6" opacity=".7"/>
        <path d="${line}" fill="none" stroke="#ffe9a8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        ${co.pts.map((p: number[], i: number) => {
      const on = i < st.next, nextUp = i === st.next;
      return `<g class="skyPt"><path class="skyStar${on ? ' on' : ''}${nextUp ? ' first' : ''}"
            d="${star(p[0], p[1], nextUp ? 5.2 : 4.2)}"/>
          <text class="skyNum${on ? ' on' : ''}" x="${p[0]}" y="${p[1] - 6.4}" text-anchor="middle">${i + 1}</text>
          <circle cx="${p[0]}" cy="${p[1]}" r="7" fill="transparent" data-s="${i}"/></g>`;
    }).join('')}
      </svg></div>`;
    $('#miniFoot').innerHTML = `<div class="miniStat">${st.next}/${co.pts.length} · costs <b>${co.cost} ⭐ Star Cores</b><br>${co.perk}</div>`;
    $('#miniBody').querySelectorAll('[data-s]').forEach((c: any) => c.onclick = () => starTap(+c.dataset.s));
  }
  function starTap(i: number) {
    const st = miniState; if (!st) return;
    if (i !== st.next) { sfx.no(); shake(); st.next = 0; drawStars(); return; }
    st.next++; sfx.popHi();
    if (st.next >= st.co.pts.length) {
      // pay only on success — a failed trace costs nothing but pride
      for (let k = 0; k < st.co.cost; k++) {
        const at = B().findIndex((c: any) => c && c.id === 'starcore');
        if (at >= 0) { board.consume(at, 'starcore'); B()[at] = null; }
      }
      S.stars[st.co.id] = 1;
      prog('star', 1);
      paintBoard(); sfx.big(); confetti(); haptic('medium');
      drawStars();
      $('#miniSub').innerHTML = '<b>Lit.</b> ' + st.co.perk + ' — for good.';
      $('#miniFoot').innerHTML = '<button class="big" id="skyDone">Wonderful</button>';
      $('#skyDone').onclick = closeMini;
      save();
      return;
    }
    drawStars();
  }

  /* ============================================================ WORLD SCREEN
     Not a list of cards — a painted place you tap. The camp is the world you
     are standing in, with your rocket on the big pad, the lab beside it, the
     Heart on the far plinth and every producer on a stone of its own. The
     galaxy is the map between worlds. Everything else pops up over the top. */
  let worldTab: 'camp' | 'galaxy' = 'camp';

  /* Anchors measured off the painted background, as a fraction of the scene.
     Each one is the *top of a plinth*, and a spot is drawn standing on it. */
  const PAD = {
    rocket: [0.355, 0.435], lab: [0.545, 0.545], heart: [0.788, 0.472],
  };
  const PROD_PADS = [
    [0.265, 0.742], [0.512, 0.742], [0.788, 0.738],
    [0.36, 0.90], [0.64, 0.90], [0.15, 0.605],
  ];

  function spot(kind: string, pad: number[], art: string, label: string, sub: string, cls = '', badge = '') {
    return `<button class="spot ${cls}" data-ent="${kind}" data-fx="${pad[0]}" data-fy="${pad[1]}">
      ${badge ? `<span class="spotBadge">${badge}</span>` : ''}
      <span class="spotArt">${art}</span>
      <span class="spotTag"><b>${label}</b>${sub ? `<i>${sub}</i>` : ''}</span></button>`;
  }

  function campHTML() {
    const w = W(), b = B();
    const prods: { i: number; k: string }[] = [];
    for (let i = 0; i < N; i++) if (b[i] && b[i].p && PRODS[b[i].p].mode !== 'once') prods.push({ i, k: b[i].p });

    const built = Object.keys(S.parts).filter(k => S.parts[k]).length;
    let ents = spot('rocket', PAD.rocket,
      S.met ? ART.rocket(S.parts) : '<div class="spotGhost">🚀</div>',
      S.met ? 'Rocket' : '???',
      S.met ? (allParts() ? 'Ready · ⛽' + S.fuel + '/3' : built + '/4 parts') : 'nothing here yet',
      'ship' + (S.met && allParts() && S.fuel >= CONFIG.rocket.fuelToLaunch ? ' ready' : ''));
    if (labOpen()) ents += spot('lab', PAD.lab, ART.icon('flask'), 'Lab', 'Invent relics', 'lab');
    ents += spot('heart', PAD.heart, ART.item(worldAwake() ? 'bloomheart' : 'bloomcore'),
      w.heart, worldAwake() ? 'Awake' : fed() + '/' + bloomGoal() + ' Bloom', 'heart');

    prods.slice(0, PROD_PADS.length).forEach((pr, n) => {
      const p = PRODS[pr.k], c = b[pr.i], lv = plv(c), cap = capOf(p, lv);
      const can = lv < PMAX && S.coins >= upCost(p, lv);
      ents += spot('p' + pr.i, PROD_PADS[n], ART.producer(p.art), p.name,
        can ? 'GROW · ' + upCost(p, lv) + ' 🪙'
          : p.mode === 'energy' ? ecost(p, lv) + ' ⚡ a tap' : (c.ch ?? cap) + '/' + cap,
        can ? 'ready' : '', lv > 1 ? 'Lv' + lv : '');
    });
    // the next plinth stands empty until you have grown everything on this one
    const nxt = nextProducer();
    if (nxt && prods.length < PROD_PADS.length) {
      ents += spot('next', PROD_PADS[prods.length], '<div class="spotGhost">➕</div>',
        'Empty plot', allMaxed() ? 'ready to plant' : 'grow them all first', 'empty');
    }

    return `<div class="sceneWrap camp">
      <div class="sceneImg"></div><div class="sceneVig"></div>
      <div class="sceneName">${w.name}<i>lv ${wlv()}</i></div>
      <div class="sceneBtns">
        <button class="sceneBtn" data-pop="games">🎲</button>
        <button class="sceneBtn" data-pop="stars">✨</button>
        <button class="sceneBtn" data-pop="galaxy">🌌</button>
      </div>
      ${ents}
    </div>`;
  }

  function galaxyHTML() {
    const fuelOk = S.fuel >= CONFIG.rocket.fuelToLaunch;
    const spots = [[50, 80], [22, 60], [74, 54], [34, 30], [66, 14]];
    const nodes = WORLD_ORDER.map((k, i) => {
      const ww = WORLDS[k], here = k === S.world;
      const reached = k === 'earth' || S.unlocked[k] || S.unlocked[WORLD_ORDER[i - 1]] || WORLD_ORDER[i - 1] === S.world;
      const can = !here && reached && allParts() && fuelOk;
      const sp = spots[i] || [50, 50];
      const state = here ? 'here' : reached ? (can ? 'go' : 'wait') : 'locked';
      return `<button class="galNode ${state}" data-world="${k}" style="left:${sp[0]}%;top:${sp[1]}%">
        <span class="galArt">${reached ? ART.planet(ww.planet) : ART.planet('mystery')}</span>
        <span class="galName">${reached ? ww.name : '???'}</span>
        <span class="galSub">${here ? 'You are here'
          : !reached ? '🔒 Locked'
            : can ? 'LAUNCH 🚀' : worldAwake(k) ? '🌱 Awake' : 'Need ⛽' + CONFIG.rocket.fuelToLaunch}</span>
        ${reached && worldAwake(k) ? '<span class="galBloom">🌱</span>' : ''}</button>`;
    }).join('');
    const lines = WORLD_ORDER.slice(1).map((k, i) => {
      const a = spots[i], c = spots[i + 1];
      if (!a || !c) return '';
      const len = Math.hypot((c[0] - a[0]) * 3.2, (c[1] - a[1]) * 4.4);
      return `<i class="galLink${S.unlocked[k] ? ' on' : ''}" style="left:${a[0]}%;top:${a[1]}%;width:${len}%;
        transform:rotate(${Math.atan2((c[1] - a[1]) * 4.4, (c[0] - a[0]) * 3.2) * 180 / Math.PI}deg)"></i>`;
    }).join('');
    return `<div class="galaxy">${lines}${nodes}
      <button class="sceneBtn back" data-pop="camp">↩</button>
      <div class="galFoot">Each trip costs <b>${CONFIG.rocket.fuelToLaunch} ⛽</b> · you have <b>${S.fuel}</b></div></div>`;
  }

  function renderWorldScreen() {
    const host = $('#mapBody'); if (!host) return;
    $('#mapTitle').textContent = worldTab === 'camp' ? '🌍 ' + W().name : '🌌 Galaxy';
    host.innerHTML = worldTab === 'camp' ? campHTML() : galaxyHTML();
    placeSpots();
    host.querySelectorAll('[data-world]').forEach((b: any) => b.onclick = () => galaxyTap(b.dataset.world));
    host.querySelectorAll('[data-ent]').forEach((b: any) => b.onclick = () => campTap(b.dataset.ent));
    host.querySelectorAll('[data-pop]').forEach((b: any) => b.onclick = () => {
      const k = b.dataset.pop;
      sfx.tap();
      if (k === 'games') gamesPanel();
      else if (k === 'stars') starsPanel();
      else { worldTab = k === 'camp' ? 'camp' : 'galaxy'; renderWorldScreen(); }
    });
  }

  /* The picture is drawn `cover`, so it is cropped differently on every phone.
     Work out that crop and put each spot where its plinth actually landed. */
  function placeSpots(sel = '#mapBody') {
    const host = $(sel); if (!host) return;
    const wrap = host.querySelector('.sceneWrap') as HTMLElement;
    if (!wrap) return;
    const W2 = wrap.clientWidth, H = wrap.clientHeight;
    if (!W2 || !H) return;
    const iw = 1086, ih = 1448;
    const sc = Math.max(W2 / iw, H / ih);
    const dw = iw * sc, dh = ih * sc;
    const ox = (W2 - dw) / 2, oy = (H - dh) / 2;
    host.querySelectorAll('[data-fx]').forEach((e: any) => {
      // a tall phone crops the painting hard at the sides, so keep the label
      // chips on screen even when their plinth has been cropped half away
      const x = ox + +e.dataset.fx * dw;
      e.style.left = Math.max(48, Math.min(W2 - 48, x)) + 'px';
      e.style.top = Math.max(70, Math.min(H - 42, oy + +e.dataset.fy * dh)) + 'px';
    });
  }
  window.addEventListener('resize', () => {
    if (view === 'map') placeSpots();
    if (view === 'lab') placeSpots('#labBody');
  });

  function gamesPanel() {
    modal(W().folks[0] || 'bloop', 'Things to do',
      `<div class="gameGrid">
        ${gameBtn('dig', '⛏️', 'Crater Dig', 'Six digs, one cave-in')}
        ${gameBtn('brew', '⚗️', 'Fuel Brewing', 'Stop the needle in the green')}
        ${gameBtn('market', '🛸', 'Alien Market', 'Peek in two, keep one')}
      </div>`, 'Close');
    setTimeout(() => document.querySelectorAll('[data-game]').forEach((b: any) => b.onclick = () => {
      const k = b.dataset.game; closeModal();
      if (k === 'dig') playDig(); else if (k === 'brew') playBrew(); else playMarket();
    }), 30);
  }
  function starsPanel() {
    modal('nix', 'Constellations',
      `<div class="noteLine" style="margin-top:0">This is what Star Cores are for. Trace one and its blessing is permanent, in every world.</div>
       ${CONSTS.map(c => `<button class="constRow${lit(c.id) ? ' lit' : ''}" data-c="${c.id}">
        <span class="constIc">${lit(c.id) ? '✦' : '✧'}</span>
        <span class="constTxt"><b>${c.name}</b><i>${c.perk}</i></span>
        <span class="constCost">${lit(c.id) ? 'Lit' : c.cost + ' ⭐'}</span></button>`).join('')}`, 'Close');
    setTimeout(() => document.querySelectorAll('[data-c]').forEach((b: any) => b.onclick = () => {
      closeModal(); playStars(b.dataset.c);
    }), 30);
  }

  function galaxyTap(k: string) {
    if (k === S.world) { worldTab = 'camp'; sfx.tap(); renderWorldScreen(); return; }
    const i = WORLD_ORDER.indexOf(k);
    const reached = S.unlocked[k] || S.unlocked[WORLD_ORDER[i - 1]] || WORLD_ORDER[i - 1] === S.world;
    if (!reached) { sfx.no(); toast('🔒 Fly to ' + WORLDS[WORLD_ORDER[i - 1]].name + ' first.'); return; }
    if (!allParts()) { sfx.no(); toast('The rocket is not finished — tap it in your camp.'); return; }
    if (S.fuel < CONFIG.rocket.fuelToLaunch) {
      sfx.no();
      toast('Needs <b>' + CONFIG.rocket.fuelToLaunch + ' Rocket Fuel</b> — you have ' + S.fuel + '.');
      return;
    }
    travelTo(k);
  }

  /** tapping something in the camp opens the panel for that thing */
  function campTap(kind: string) {
    sfx.tap();
    if (kind === 'rocket') { rocketPanel(); return; }
    if (kind === 'lab') { setView('lab'); return; }
    if (kind === 'heart') { heartPanel(); return; }
    if (kind === 'next') { nextPlotPanel(); return; }
    if (kind[0] === 'p') producerPanel(+kind.slice(1));
  }

  function nextPlotPanel() {
    const nxt = nextProducer();
    const ok = allMaxed();
    modal(W().folks[0] || 'bloop', ok ? 'Something wants to grow here' : 'An empty plot',
      ok
        ? `The soil is ready. <b>${nxt ? PRODS[nxt].name : 'Something new'}</b> will take root on its own the moment you look away.`
        : `Nothing new takes root while the ones you have are still half-grown. Get <b>every producer to level ${PMAX}</b> and the plot fills itself.`
        + `<div class="noteLine">${B().filter((c: any) => c && c.p && PRODS[c.p].mode !== 'once')
          .map((c: any) => `${PRODS[c.p].name} — level ${plv(c)}/${PMAX}`).join('<br>')}</div>`,
      'Right');
  }

  function rocketPanel() {
    if (!S.met) {
      modal('pip', 'Nothing there yet',
        'Just meadow, for now. Keep merging — something is going to fall out of that sky, and when it does this is where it lands.', 'OK');
      return;
    }
    const parts = [['hull', 'Hull', 'hullplate'], ['engine', 'Engine', 'enginecore'], ['nav', 'Nav Dish', 'navdish'], ['tank', 'Fuel Tank', 'fueltank']];
    modal('bloop', allParts() ? 'Your rocket' : 'Building the rocket',
      `<div class="rocketWrap">${ART.rocket(S.parts)}</div>
       <div class="partGrid">${parts.map(p => `<div class="part${S.parts[p[0]] ? ' on' : ''}">${ART.item(p[2])}<div class="pl">${p[1]}</div></div>`).join('')}</div>
       <div class="fuelRow"><div style="font-size:12px;font-weight:700">Fuel</div>
         <div class="fuelDots">${[0, 1, 2].map(k => `<div class="fuelDot${S.fuel > k ? ' on' : ''}">${ART.icon('fuel')}</div>`).join('')}</div>
         <div style="font-size:11px;color:#9a7a4e;font-weight:600">${S.fuel}/3</div></div>
       <div class="noteLine">${allParts()
        ? 'She flies. Open the galaxy and pick somewhere to go.'
        : 'Tap the <b>wreck</b> on your board for parts, then merge each pile up three times.'}</div>
       ${allParts() ? `<button class="big" id="toGalaxy">🌌 Open the galaxy</button>` : ''}`, 'Close');
    setTimeout(() => {
      const g = $('#toGalaxy');
      if (g) g.onclick = () => { closeModal(); worldTab = 'galaxy'; setView('map'); renderWorldScreen(); };
    }, 30);
  }

  function heartPanel() {
    const w = W(), st = stage(), done = worldAwake();
    const onBoard = B().reduce((a: number, c: any) => a + (c && c.id ? bloomValue(c.id) : 0), 0);
    modal(w.folks[0] || 'bloop', w.heart,
      `<div class="noteLine" style="margin-top:0">${done ? 'Awake, and beating on its own.'
        : `<b>${w.bloom[st].title}</b> — ${fed()}/${bloomGoal()} Bloom`}</div>
       <div class="catBar"><i style="width:${done ? 100 : clamp(fed() / bloomGoal() * 100, 0, 100)}%"></i></div>
       <div class="stageList">${w.bloom.map((b: any, i: number) =>
        `<div class="stageRow${i < st ? ' done' : ''}"><b>${i < st ? '✓' : b.need}</b><span>${b.title}</span></div>`).join('')}</div>
       <div class="noteLine">Finish a merge chain anywhere in ${w.name} and the Vault pays a <b>Bloom Spark</b>. Sparks merge into bigger essence, worth more.</div>
       <button class="big" id="feed2"${onBoard ? '' : ' disabled'}>${onBoard ? 'Feed it (' + onBoard + ' Bloom)' : 'No essence on the board'}</button>`,
      'Close');
    setTimeout(() => { const f = $('#feed2'); if (f) f.onclick = () => { closeModal(); feedHeart(); }; }, 30);
  }


  function producerPanel(cell: number) {
    tutFire('prodpanel');
    const c = B()[cell];
    if (!c || !c.p) { renderWorldScreen(); return; }
    const p = PRODS[c.p], lv = plv(c), cap = capOf(p, lv);
    const price = lv < PMAX ? upCost(p, lv) : 0;
    const now = dropsOf(p, lv), next = lv < PMAX ? dropsOf(p, lv + 1) : now;
    const added = [...new Set(next.filter(d => now.indexOf(d) < 0))];
    const uniq = [...new Set(now)];
    modal(W().folks[0] || 'bloop', p.name,
      `<div class="prodHead">${ART.producer(p.art)}</div>
       <div class="pipsRow">${Array.from({ length: PMAX }, (_, i) => `<i class="pip${i < lv ? ' on' : ''}"></i>`).join('')}
         <span>Level ${lv}${lv >= PMAX ? ' · max' : ''}</span></div>
       ${p.mode === 'energy'
        ? `<div class="chargeLine"><b>${ecost(p, lv)} ⚡</b> a tap<i>taps for ever — energy is the only brake</i></div>`
        : `<div class="chargeLine"><b>${c.ch ?? cap}/${cap}</b> charges<i>${c.ch >= cap ? 'full · free taps' : 'free taps · a full battery takes ' + mmss(everyOf(p) * cap)}</i></div>`}
       <div class="dropRow">${uniq.map(d => `<span class="dropChip">${ART.item(d)}<b>${ITEMS[d].name}</b></span>`).join('')}</div>
       ${lv >= PMAX
        ? `<div class="noteLine">Fully grown. It will keep going for a while yet, then go to seed and let something else take root.</div>`
        : `<div class="noteLine">Level ${lv + 1}: ${p.mode === 'energy'
          ? (ecost(p, lv + 1) > ecost(p, lv) ? `<b>${ecost(p, lv + 1)} ⚡</b> a tap` : `still <b>${ecost(p, lv)} ⚡</b> a tap`)
          : '<b>+5</b> charges'}${added.length
          ? ` and it starts dropping <b>${added.map(d => ITEMS[d].name).join('</b>, <b>')}</b>`
          : ' and better odds on the rarer drops'}.</div>
           <button class="big gold" id="upProd"${S.coins >= price ? '' : ' disabled'}>Grow it — ${price} 🪙</button>`}`,
      'Close');
    setTimeout(() => {
      const u = $('#upProd');
      if (u) u.onclick = () => { upgradeProducer(cell); closeModal(); };
    }, 30);
  }

  function gameBtn(k: string, icon: string, name: string, blurb: string) {
    const c = miniCfg(k), left = miniLeft(k);
    const ok = !left && S.energy >= c.cost;
    return `<button class="gameBtn${ok ? '' : ' cool'}" data-game="${k}"${left ? ' disabled' : ''}>
      <span class="gIc">${icon}</span><b>${name}</b><i>${blurb}</i>
      <span class="gCost">${left ? mmss(left) : c.cost ? c.cost + ' ⚡' : 'Free'}</span></button>`;
  }

  /* ============================================================ GUIDED INTRO
     A merge game is obvious once you have played one and baffling if you have
     not. This walks the first ten minutes: it dims everything except the one
     thing to press, says why in the story's voice, and waits for you to
     actually do it rather than for a timer. Every step is skippable, and the
     whole thing runs once. */
  type TutStep = {
    id: string;
    who?: string;
    say: string;
    /** what to light up: a board cell (or several), a CSS selector, or nothing */
    at?: () => number | number[] | string | null;
    /** the event that finishes this step; absent means "press Got it" */
    on?: string;
    /** how many of that event */
    need?: number;
    /** skip the step entirely if this is false */
    when?: () => boolean;
  };

  const cellWith = (fn: (c: any) => boolean) => {
    const b = B();
    for (let i = 0; i < N; i++) if (b[i] && fn(b[i])) return i;
    return null;
  };
  /** every cell matching — the merge step has to light up both twigs */
  const cellsWith = (fn: (c: any) => boolean, max = 2) => {
    const b = B(), out: number[] = [];
    for (let i = 0; i < N && out.length < max; i++) if (b[i] && fn(b[i])) out.push(i);
    return out.length ? out : null;
  };
  const TUT: TutStep[] = [
    { id: 'hello', who: 'pip', say: "Oh — hello! I'm <b>Pip</b>. You picked a quiet morning to arrive. Nothing much grows here any more, but the old meadow still remembers how. Let me show you." },
    {
      id: 'tap', who: 'pip', say: "That's the <b>Big Tree</b>. Give it a tap and it drops a twig.",
      at: () => cellWith(c => c.p === 'tree'), on: 'spawn',
    },
    {
      id: 'tap2', who: 'pip', say: "Again! You want <b>two</b> of a thing before anything interesting happens.",
      at: () => cellWith(c => c.p === 'tree'), on: 'spawn',
    },
    {
      id: 'merge', who: 'pip', say: "Now <b>drag one twig onto the other</b>. Two of the same thing always make the next thing up.",
      at: () => cellsWith(c => c.id === 'twig'), on: 'merge',
    },
    { id: 'merged', who: 'pip', say: "A <b>Branch</b>! That is the whole game, really. Two twigs make a branch, two branches make a log, and it keeps going — seven steps in this chain alone." },
    {
      id: 'order', who: 'pip', say: "See the cards up top? Those are your neighbours asking for things. Tap the <b>picture</b> on one to find out where it comes from.",
      at: () => '#orders [data-need]', on: 'chain',
    },
    {
      id: 'deliver', who: 'pip', say: "When a card turns green you have what they want. <b>Give it</b> — contracts are where the coins and the XP come from.",
      at: () => '#orders .order.ready .btnDeliver', on: 'deliver',
      when: () => S.orders.some((o: any) => o.needs.every((nd: any) => countItem(nd.id) >= nd.qty)),
    },
    {
      id: 'battery', who: 'pip', say: "Most things here run on <b>energy</b> — the little ⚡ price under them. Energy comes back on its own, so tap away. A few patches, like the berry bush, hand out <b>free</b> taps instead and then need a rest.",
      at: () => cellWith(c => c.p === 'tree'),
    },
    {
      id: 'quests', who: 'pip', say: "Lost? This button always says the one thing to do next. Give it a tap.",
      at: () => '#btnQuests', on: 'quests',
    },
    {
      id: 'world', who: 'pip', say: "And this is your <b>camp</b> — the meadow itself. Your tree, your rocks, and a few things that are not here yet.",
      at: () => '[data-v="map"]', on: 'world',
    },
    {
      id: 'grow', who: 'pip', say: "Tap anything in the camp to look after it. Coins make a producer <b>bigger and rarer</b> — that is what they are for.",
      at: () => '.spot[data-ent^="p"]', on: 'prodpanel',
    },
    { id: 'done', who: 'pip', say: "That's everything. Merge, fill contracts, grow the meadow. And keep an eye on the sky — something is going to fall out of it, and it is going to change your week." },
  ];

  let tutAt = -1, tutHave = 0, tutTimer: any = 0;
  const tutOn = () => tutAt >= 0 && tutAt < TUT.length;

  function tutStart() {
    if (S.tut) return;
    tutAt = -1; tutNext();
  }
  function tutNext() {
    tutHave = 0;
    do { tutAt++; } while (tutAt < TUT.length && TUT[tutAt].when && !TUT[tutAt].when!());
    if (tutAt >= TUT.length) { tutEnd(); return; }
    tutShow();
  }
  function tutEnd() {
    const wasOn = tutAt >= 0;
    tutAt = -1;
    S.tut = 1; save();
    // the daily calendar and the story beats queue up behind the intro rather
    // than popping a modal over the one button you were told to press
    if (wasOn) setTimeout(() => { checkDaily(); setTimeout(() => checkStory(), 900); }, 700);
    $('#tut').classList.remove('on');
    setTimeout(() => { if (!tutOn()) $('#tut').style.display = 'none'; }, 300);
    clearInterval(tutTimer); tutTimer = 0;
  }
  /** where on screen the current step points, in page pixels */
  function tutRect(): { x: number; y: number; w: number; h: number } | null {
    const st = TUT[tutAt]; if (!st.at) return null;
    const target = st.at();
    if (target === null || target === undefined) return null;
    const app = $('#app').getBoundingClientRect();
    const cells = typeof target === 'number' ? [target] : Array.isArray(target) ? target : null;
    if (cells) {
      const cv = $('#board canvas'); if (!cv) return null;
      const r = cv.getBoundingClientRect(), s = board.cellSize();
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      cells.forEach(i => {
        const c = board.center(i);
        x0 = Math.min(x0, c.x - s / 2); y0 = Math.min(y0, c.y - s / 2);
        x1 = Math.max(x1, c.x + s / 2); y1 = Math.max(y1, c.y + s / 2);
      });
      return { x: r.left - app.left + x0, y: r.top - app.top + y0, w: x1 - x0, h: y1 - y0 };
    }
    const e = document.querySelector(target as string) as HTMLElement;
    if (!e || !e.offsetParent) return null;
    const r = e.getBoundingClientRect();
    return { x: r.left - app.left, y: r.top - app.top, w: r.width, h: r.height };
  }
  function tutShow() {
    const st = TUT[tutAt], host = $('#tut');
    host.style.display = '';
    void host.offsetWidth;
    host.classList.add('on');
    $('#tFace').innerHTML = ART.char(st.who || 'pip');
    $('#tSay').innerHTML = st.say;
    $('#tNext').classList.toggle('hide', !!st.on);
    tutPlace();
    clearInterval(tutTimer);
    // the board relays out, screens open, cards move — keep the hole on target
    tutTimer = setInterval(() => { if (tutOn()) tutPlace(); }, 260);
  }
  function tutPlace() {
    const host = $('#tut'), app = $('#app').getBoundingClientRect();
    const r = tutRect();
    const pad = 7;
    const set = (id: string, x: number, y: number, w: number, h: number) => {
      const e = $(id);
      e.style.left = Math.max(0, x) + 'px'; e.style.top = Math.max(0, y) + 'px';
      e.style.width = Math.max(0, w) + 'px'; e.style.height = Math.max(0, h) + 'px';
    };
    host.classList.toggle('noHole', !r);
    if (!r) {
      set('#tTop', 0, 0, app.width, app.height);
      set('#tBot', 0, 0, 0, 0); set('#tLeft', 0, 0, 0, 0); set('#tRight', 0, 0, 0, 0);
      $('#tRing').style.opacity = '0'; $('#tHand').style.opacity = '0';
      $('#tBubble').style.top = (app.height * 0.32) + 'px';
      return;
    }
    const x = r.x - pad, y = r.y - pad, w = r.w + pad * 2, h = r.h + pad * 2;
    set('#tTop', 0, 0, app.width, y);
    set('#tBot', 0, y + h, app.width, app.height - y - h);
    set('#tLeft', 0, y, x, h);
    set('#tRight', x + w, y, app.width - x - w, h);
    const ring = $('#tRing');
    ring.style.opacity = '1';
    ring.style.left = x + 'px'; ring.style.top = y + 'px';
    ring.style.width = w + 'px'; ring.style.height = h + 'px';
    const hand = $('#tHand');
    hand.style.opacity = '1';
    hand.style.left = (x + w / 2) + 'px';
    hand.style.top = (y + h + 4) + 'px';
    // put the bubble on whichever side has room
    // sit the bubble wherever there is more room, and never on top of the target
    const bub = $('#tBubble');
    const bh = bub.offsetHeight || 190;
    const roomBelow = app.height - (y + h) - 64;
    const roomAbove = y - 34;
    bub.style.top = (roomBelow >= bh || roomBelow >= roomAbove
      ? Math.min(app.height - bh - 66, y + h + 52)
      : Math.max(36, y - bh - 26)) + 'px';
  }
  /** the game tells the tutorial what just happened */
  function tutFire(ev: string) {
    if (!tutOn()) return;
    const st = TUT[tutAt];
    if (st.on !== ev) return;
    tutHave++;
    if (tutHave >= (st.need || 1)) setTimeout(tutNext, 420);
  }

  /* ================================================================ MODALS */
  function modal(face: string, title: string, body: string, btn?: string) {
    $('#mFace').innerHTML = ART.char(face);
    $('#mTitle').textContent = title;
    $('#mBody').innerHTML = body;
    $('#mBtn').textContent = btn || 'OK';
    $('#modal').classList.add('open');
  }
  const closeModal = () => $('#modal').classList.remove('open');
  $('#mBtn') && ($('#mBtn').onclick = closeModal);

  /* ================================================================ INPUT */
  /* Pointer handling lives in board.ts (Pixi hit-testing): it calls back into
     tap() / onDrop() above. Nothing here touches the DOM. */

  function tap(i: number) {
    const c = B()[i];
    lastAct = Date.now();
    audio.unlock();                                   // the first gesture starts the mixer
    const pick = (k: number | null) => { sel = k; board.setSelected(k); };
    if (!c) { pick(null); hideInfo(); return; }
    if (c.b) {
      sfx.no(); pick(null); hideInfo();
      // this is the *world* level, not your own — every world starts at 1, and
      // saying "Level 3" to someone who is account level 7 reads like a bug
      toast(`Overgrown — it clears at <b>${W().name} level ${c.b}</b> (you are on ${wlv()}). Fill contracts here to raise it.`);
      return;
    }
    if (c.p) { pick(null); hideInfo(); useProducer(i); return; }
    if (sel === null) { pick(i); showInfo(i); return; }
    if (sel === i) { pick(null); hideInfo(); return; }
    const a = B()[sel];
    if (a && mergeResult(a.id, c.id)) { const f = sel; pick(null); hideInfo(); tryMerge(f, i); return; }
    pick(i); showInfo(i);
  }
  function hideInfo() { $('#infoBar').classList.remove('on'); }
  function showInfo(i: number) {
    const c = B()[i]; if (!c || !c.id) return;
    const d = ITEMS[c.id], nx = nextOf(c.id);
    $('#infoBar').classList.add('on');
    $('#infoTxt').innerHTML = `<b>${d.name}</b> · sells for ${d.sell} 🪙${nx ? ` · 2 make a ${ITEMS[nx].name}` : ' · top tier!'}`;
    $('#btnSell').onclick = () => { sellItem(i); $('#infoBar').classList.remove('on'); };
    const st = $('#btnStash');
    st.style.display = bagHas() ? '' : 'none';
    st.onclick = () => stashItem(i);
  }

  /* ================================================================== LOOP */
  function tick() {
    const now = Date.now();
    // energy regen
    const per = regenMs();
    while (S.energy < maxEnergy() && now - S.eAt >= per) { S.eAt += per; S.energy++; renderHUD(); }
    if (S.energy >= maxEnergy()) S.eAt = now;
    tickProducers();
    board.heal();
    sweepSpecials();
    // snack cooldown
    const cd = Math.max(0, CONFIG.energy.snack.cooldownMs - (now - S.snackAt));
    const sb = $('#btnSnack'); sb.disabled = cd > 0 || S.energy >= maxEnergy();
    sb.textContent = cd > 0 ? Math.ceil(cd / 1000) + 's' : '🍪 +' + snackAmt();
    // idle hint
    if (view === 'board' && now - lastAct > CONFIG.hint.idleMs && !hintPair) { showHint(false); lastAct = now; }
    shipTick(now);
    orderTick(now);
    worldEvent(now);
    checkStuck(now);
    // the shelf restocks on its own so the 🛒 badge can nag you
    if (shopOpen()) {
      const before = S.shop.at;
      shopStock();
      if (S.shop.at !== before) { renderHUD(); if (view === 'shop') renderShop(); }
    }
    // random meteors
    // a meteor the player could not receive (wrong screen, no room, crater still
    // open) is retried shortly instead of burning a whole rare cycle
    if (S.met && now > meteorTimer) {
      const fell = Math.random() < CONFIG.meteor.chance ? randomMeteor() : true;
      meteorTimer = fell
        ? now + (CONFIG.meteor.everyMinMs + Math.random() * CONFIG.meteor.everyRandomMs) * meteorScale()
        : now + 20000;
    }
  }

  function sweepSpecials() {
    const b = B();
    for (let i = 0; i < N; i++) {
      const c = b[i]; if (!c || !c.id) continue;
      const d = ITEMS[c.id]; if (!d) continue;
      if (d.part && !S.parts[d.part]) installPart(i, d.part);
      else if (d.fuel) addFuel(i);
    }
  }

  /* ================================================================== INIT */
  function scenery() {
    const sc = $('#scene');
    for (let i = 0; i < 4; i++) {
      const c = el('div', 'cloud'), w = 60 + Math.random() * 60, h = w * 0.42;
      c.style.cssText = `width:${w}px;height:${h}px;top:${20 + Math.random() * 130}px;left:-160px;animation-duration:${26 + Math.random() * 24}s;animation-delay:${-Math.random() * 30}s`;
      sc.appendChild(c);
    }
    // Cindra breathes embers; they sit idle behind the other skies until you land
    for (let i = 0; i < 14; i++) {
      const e = el('div', 'ember');
      e.style.cssText = `left:${Math.random() * 100}%;width:${3 + Math.random() * 4}px;height:${3 + Math.random() * 4}px;`
        + `animation-duration:${7 + Math.random() * 9}s;animation-delay:${-Math.random() * 14}s`;
      sc.appendChild(e);
    }
  }
  async function boot() {
    if (import.meta.env.DEV) {
      const problems = validateContent();
      if (problems.length) console.error('[content]\n' + problems.join('\n'));
    }
    S = load();
    // a save that names a world it never built a board for would land on nothing
    if (!WORLDS[S.world]) S.world = CONFIG.start.world;
    if (!S.boards[S.world]) S.boards[S.world] = freshBoard(S.world);
    if (!S.wlv[S.world]) { S.wlv[S.world] = 1; S.wxp[S.world] = 0; }
    // never greet someone with a contract for a thing that does not grow here
    if (Array.isArray(S.orders)) {
      const live = liveChains();
      S.orders = S.orders.filter((o: any) => o.needs.every((n: any) => {
        const ch = ITEMS[n.id] && ITEMS[n.id].chain;
        return ch && (CHAINS[ch].world === 'any' || CHAINS[ch].world === 'ship' || live.indexOf(ch) >= 0);
      }));
    }
    if (!S.orders || !S.orders.length) { S.orders = []; fillOrders(); }
    if (!S.tasks.length) fillTasks();
    growProducers();
    oid = S.orders.length + 1;
    scenery();
    audio.setSfx(!!S.sound); audio.setMusic(!!S.music);
    audio.playMusic(worldMusic(S.world));
    await buildBoard();
    paintBoard(); renderHUD(); renderOrders(); renderRocket();
    meteorTimer = Date.now() + 40000;

    document.querySelectorAll<HTMLElement>('.tab').forEach(t => t.onclick = () => setView(t.dataset.v as string));
    document.querySelectorAll<HTMLElement>('.scClose').forEach(b => b.onclick = () => setView('board'));
    $('#btnHint').onclick = () => { showHint(true); lastAct = Date.now(); };
    $('#btnSnack').onclick = async () => {
      if (S.energy >= maxEnergy()) { toast('Energy is already full!'); return; }
      // once an ad network is wired up this becomes "watch to refill"; until then
      // ads.rewarded() resolves false and the snack is simply free
      const watched = ads.available ? await ads.rewarded('energy') : false;
      if (ads.available && !watched) { toast('No snack right now — try again in a moment.'); return; }
      S.snackAt = Date.now(); S.energy = Math.min(maxEnergy(), S.energy + snackAmt());
      bumpChip('#chipEnergy'); sfx.coin(); toast('🍪 Yum! +' + snackAmt() + ' energy'); renderHUD(); save();
    };
    $('#btnGear').onclick = () => {
      modal('pip', 'Settings', `<button class="big blue" id="sndBtn" style="margin-top:2px">${S.sound ? '🔊 Sound effects: ON' : '🔇 Sound effects: OFF'}</button>
        <button class="big blue" id="musBtn">${S.music ? '🎵 Music: ON' : '🎵 Music: OFF'}</button>
        <button class="big gold" id="resetBtn">Start a new game</button>`, 'Close');
      setTimeout(() => {
        const sb2 = $('#sndBtn'), mb = $('#musBtn'), rb = $('#resetBtn');
        if (sb2) sb2.onclick = () => {
          S.sound = S.sound ? 0 : 1; audio.setSfx(!!S.sound); save();
          sb2.textContent = S.sound ? '🔊 Sound effects: ON' : '🔇 Sound effects: OFF';
          if (S.sound) sfx.tap();
        };
        if (mb) mb.onclick = () => {
          S.music = S.music ? 0 : 1; audio.setMusic(!!S.music); save();
          mb.textContent = S.music ? '🎵 Music: ON' : '🎵 Music: OFF';
        };
        if (rb) rb.onclick = () => { localStorage.removeItem(SAVE); location.reload(); };
      }, 30);
    };
    $('#infoClose').onclick = () => { $('#infoBar').classList.remove('on'); sel = null; paintBoard(); };
    $('#bagClose').onclick = () => openBag(false);
    $('#oLeft').onclick = () => scrollOrders(-1);
    $('#oRight').onclick = () => scrollOrders(1);
    $('#orders').addEventListener('scroll', orderArrows, { passive: true });
    renderTools();
    if (bagHas()) renderBag();
    // the painted backdrops, handed to CSS as variables
    applyScene();
    $('#app').style.setProperty('--labbg', `url(${ART.spriteScene('lab') || labRoomBg})`);
    $('#miniClose').onclick = closeMini;
    $('#btnQuests').onclick = questPanel;
    applyBloomSkin();

    if (import.meta.env.DEV) (window as any).__game = {
      state: () => S, cells: () => B(),
      prods: PRODS, items: ITEMS, chains: CHAINS, config: CONFIG, recipes: RECIPES, shop: SHOP,
      hud: () => renderHUD(), world: () => renderWorldScreen(), wlv, bloomValue,
      grow: () => { growProducers(); paintBoard(); }, capOf, plv, dropsOf, liveChains, allMaxed, ecost,
      roll: () => rollOrder(), xpNeed, maxEnergy, orderSlots,
    };
    setInterval(tick, 500);
    setInterval(save, 8000);
    // the shell asks for a save when the app goes to the background
    window.addEventListener('mr:save', () => save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

    $('#tNext').onclick = () => { sfx.tap(); tutNext(); };
    $('#tSkip').onclick = () => { sfx.tap(); tutEnd(); toast('Intro skipped — the 📜 button always says what to do next.'); };
    if (!S.tut) {
      setTimeout(tutStart, 700);
    } else {
      $('#tut').style.display = 'none';
      setTimeout(checkDaily, 1200);
      setTimeout(() => checkStory(), 1800);
    }
  }
  await boot();
}
