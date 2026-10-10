/* GALAXY ADVENTURE - core game loop. Earth -> rebuild a rocket -> new worlds. */
import { ART } from './art';
// the painted backdrops the camp and the lab stand on
import SCENE_ANCHORS from './sprites/scenes/anchors.json';
import { haptic } from './native';
import { board } from './board';
import { ads, iap, PRODUCTS, analytics, store, notify, games, mockControls, SERVICES } from './services';
import { isNative } from './native';
import { audio } from './audio';
import {
  ITEMS, CHAINS, PRODUCERS as PRODS, WORLDS, CHARACTERS as CHARS, MISSIONS, CONFIG,
  RECIPES, SHOP, STORY, ITEM_IDS, PRODUCER_ARTS, nextOf, validateContent,
} from './content';

export async function startGame() {
  const $ = (s: string): any => document.querySelector(s);
  const el = (t: string, c?: string) => { const e = document.createElement(t); if (c) e.className = c; return e; };
  const rnd = (a: any[]) => a[Math.floor(Math.random() * a.length)];
  /** 1234 → 1.2K, 25000 → 25K: short numbers for small labels */
const kN = (n: number) => n >= 10000 ? Math.round(n / 1000) + 'K' : n >= 1000 ? (Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, '') + 'K' : String(Math.round(n));
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
  const WMAX = 12;                                   // chains unlock up to world level 12
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
    const k = w || S.world, set: Record<string, 1> = {}, gone: string[] = (S.retired && S.retired[k]) || [];
    plots(k).filter(pk => !gone.includes(pk)).forEach(pk => {
      const p = PRODS[pk]; if (!p) return;
      p.drops.forEach(d => { if (ITEMS[d]) set[ITEMS[d].chain] = 1; });
    });
    return WORLDS[k].chains.filter(c => set[c]);
  };
  /** the chains you are actually playing: a producer for them stands on this board or waits in storage */
  const playChains = (): string[] => {
    const here = new Set<string>();
    const add = (k: string) => { if (PRODS[k]) PRODS[k].drops.forEach((d: string) => { if (ITEMS[d]) here.add(ITEMS[d].chain); }); };
    (S.boards[S.world] || []).forEach((x: any) => { if (x && x.p && !x.tmp) add(x.p); });
    ((S.store && S.store[S.world]) || []).forEach((x: any) => add(x.p));
    return [...here].filter(c => CHAINS[c]);
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
  /** a Lab research level (bought with Science) */
  const res = (id: string) => (typeof S !== 'undefined' && S && S.res && S.res[id]) || 0;
  const maxEnergy = () =>
    CONFIG.energy.base + (S.lvl - 1) * CONFIG.energy.perLevel + upLv('energy') * CONFIG.upgrades.energyPerStep + res('battery') * 8;
  const orderSlots = () => CONFIG.orders.slots + upLv('orders') * CONFIG.upgrades.ordersPerStep + vaultLv('crowd');
  const snackAmt = () => CONFIG.energy.snack.amount + upLv('snack') * CONFIG.upgrades.snackPerStep;
  /** a timer producer's refill time, sped up by the Fertiliser upgrade */
  const everyOf = (p: any) =>
    Math.max(3000, Math.round(p.every * Math.max(0.25, 1 - upLv('speed') * CONFIG.upgrades.speedPerStep)
      * (starPerk('seed') ? 0.8 : 1) * (1 - res('patch') * 0.15)));
  /** A battery producer's first refill is quick (about five minutes) so a new
   *  player sees it come back; every refill after that takes about two hours,
   *  which is the reason to come back later. */
  const evOf = (p: any, c: any) => {
    if (p.mode !== 'battery' || !c || c.tmp) return everyOf(p);
    const full = (c.rf || 0) < 1 ? 5 * 60000 : 120 * 60000;
    return Math.max(3000, Math.round(full / capOf(p, plv(c)) * everyOf(p) / p.every));
  };
  /* Relic Vault perks feed straight into the numbers the rest of the game reads,
     so a perk is bought once and then never has to be remembered again. */
  const vaultLv = (id: string) => (typeof S !== 'undefined' && S && S.vault && S.vault[id]) || 0;
  const coinMult = () => 1 + vaultLv('rich') * 0.15 + (starPerk('plough') ? 0.1 : 0) + petCoins();
  const xpMult = () => 1 + vaultLv('wise') * 0.25;
  const regenMs = () => Math.round(CONFIG.energy.regenMs / (1 + vaultLv('brisk') * 0.2 + res('solar') * 0.12 + petRegen()));
  const meteorScale = () => 1 - vaultLv('comet') * 0.3;
  const shopOpen = () => S.lvl >= CONFIG.unlocks.shopAtLevel;
  /* The lab is a building, not a level reward: it stays invisible until Dr. Zonk
     has a rocket to cannibalise and the player pays for the build. */
  const labOpen = () => !!(S.lab && S.lab.built);
  const labOffered = () => !!(S.lab && S.lab.offered) && !labOpen();   // chapter 5 gives the plans; you pay to build it

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
    // sealed tiles: things from further along, some from producers you do not have yet
    Object.entries(w.sealed || {}).forEach(([i, id]) => { if (!b[+i] && ITEMS[id as string]) b[+i] = { f: id }; });
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
      mini: {}, stars: {}, wal: {},                  // minigame cooldowns, lit constellations
      plots: {},                              // producers each world has revealed
      firsts: {},                             // chains whose finale you have made
      /* v7: restoration projects, daily tasks, contract milestones, visitors */
      proj: {}, dt: null, om: { n: 0, step: 0 }, vis: null, visAt: 0,
      /* v9: Science and research, the accelerator, story talk, live events, the wheel */
      sci: 0, res: {}, acc: null, talked: {}, coach: {}, disc: [], stats: {}, ach: {}, gems: CFG.gems.start, adc: { day: 0, n: {} }, bought: {}, adfree: 0, store: {}, ev: { key: '', pts: 0, got: 0 }, spin: { day: 0, tok: 0 }, fr: {},
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
    p.story = p.story || {}; p.mini = p.mini || {}; p.stars = p.stars || {}; p.wal = p.wal || {};
    p.plots = p.plots || {};
    p.firsts = p.firsts || {};
    p.proj = p.proj || {}; p.om = p.om || { n: 0, step: 0 }; if (p.vis === undefined) p.vis = null; p.visAt = p.visAt || 0;
    p.coach = p.coach || {}; p.disc = p.disc || []; p.stats = p.stats || {}; p.ach = p.ach || {}; if (p.gems === undefined) p.gems = CFG.gems.start; p.adc = p.adc || { day: 0, n: {} }; p.bought = p.bought || {}; p.store = p.store || {}; p.sci = p.sci || 0; p.res = p.res || {}; if (p.acc === undefined) p.acc = null; p.talked = p.talked || {};
    p.ev = p.ev || { key: '', pts: 0, got: 0 }; p.spin = p.spin || { day: 0, tok: 0 }; p.fr = p.fr || {};
    if (!p.lab.built && (p.proj.earth || 0) >= 5) p.lab.offered = 1;
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
  function save() { S.seenAt = Date.now(); try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) { } }
  /* The app is going to the background: save, back the save up to the player's
     account, and leave a couple of friendly reminders on the phone. */
  /* Coming back after a while: say what happened while you were gone, so the
     first thing you see is "your stuff is ready", not a board that looks the same. */
  function welcomeBack(): string {
    const at = S.seenAt; if (!at || !S.tut) return '';
    const gone = Date.now() - at; if (gone < 20 * 60000) return '';
    const e = Math.min(maxEnergy() - S.energy, Math.floor(gone / regenMs()));
    const b = (S.boards && S.boards[S.world]) || [];
    const full = b.filter((c: any) => c && c.p && PRODS[c.p] && PRODS[c.p].mode === 'battery' && (c.ch || 0) < capOf(PRODS[c.p], plv(c))).length;
    const bits = [e > 0 ? `+${e} ⚡` : '', full ? `${full} producer${full > 1 ? 's' : ''} refilled` : ''].filter(Boolean);
    analytics.track('return', { minutes: Math.round(gone / 60000) });
    return bits.length ? `👋 Welcome back! While you were away (${dhm(gone)}): ${bits.join(' · ')}` : '';
  }
  /** dev builds only: drive the mocked store, ads and services from Settings */
  function devPanel() {
    const ev = analytics.recent.slice(0, 6).map(e => `<li><b>${e.name}</b> ${e.props ? JSON.stringify(e.props).slice(0, 60) : ''}</li>`).join('');
    const notes = notify.pending.map(n => `<li>${new Date(n.at).toLocaleString()} — ${n.title}</li>`).join('') || '<li>none (send the app to the background)</li>';
    return `<div class="devBox"><div class="devH">Developer · services (${ads.live ? 'AdMob' : 'mock ads'}, ${iap.live ? 'RevenueCat' : 'mock store'})</div>
      <button class="devBtn" data-dev="ad">Ad result: <b>${mockControls.ad}</b></button>
      <button class="devBtn" data-dev="buy">Purchase result: <b>${mockControls.purchase}</b></button>
      <button class="devBtn" data-dev="review">Test review prompt</button>
      <button class="devBtn" data-dev="signin">Games sign-in: <b>${games.signedIn ? games.player : 'signed out'}</b></button>
      <button class="devBtn" data-dev="away">Simulate going to background</button>
      <div class="devH">Notifications scheduled</div><ul class="devList">${notes}</ul>
      <div class="devH">Last analytics events</div><ul class="devList">${ev || '<li>none yet</li>'}</ul></div>`;
  }
  function goingAway() {
    save();
    try { games.cloudSave(JSON.stringify(S)); } catch { }
    const notes: { id: number; at: number; title: string; body: string }[] = [];
    const missing = maxEnergy() - S.energy;
    if (missing > 5) notes.push({ id: 1, at: Date.now() + missing * regenMs(), title: 'Energy is full! ⚡', body: 'Your producers are ready to tap again.' });
    const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(10, 0, 0, 0);
    notes.push({ id: 2, at: t.getTime(), title: 'A daily gift is waiting 🎁', body: 'Come back to keep your streak going.' });
    notify.schedule(notes);
  }
  const B = () => S.boards[S.world];
  const W = () => WORLDS[S.world];

  /* ================================================================ AUDIO */
  /* Real recorded-quality effects and music beds live in src/audio (generated by
     scripts/make-sound.py). This layer only decides *which* sound an event makes;
     src/audio.ts owns the mixer, and every call is safe before the first gesture. */
  /** which alien voice each character speaks with (anyone missing gets one by name) */
  const VOICE: Record<string, string> = {
    pip: 'squeak', timmy: 'squeak', pim: 'squeak', pup: 'chirp', wren: 'chirp', biscuit: 'chirp', luma: 'chirp',
    player: 'mid', zib: 'mid', bloop: 'mid', marin: 'mid', gigi: 'mid', blorb: 'mid',
    rokk: 'deep', vulk: 'deep', mumbo: 'deep', kelpa: 'deep', grubs: 'deep', grandma: 'deep',
    glimmer: 'robot', halo: 'robot', gloop: 'gloop',
    nix: 'dreamy', oops: 'dreamy', sirra: 'dreamy', zephyr: 'dreamy', ember: 'dreamy',
  };
  const sfx = {
    tap: () => audio.playVary('tap', 0.08, 0.5),
    pop: () => audio.playVary('pop', 0.08),
    popHi: () => audio.playVary('pop_hi', 0.08),
    /** merge sounds climb with the tier you just made */
    // a chord, so keep the pitch drift tiny or it goes out of tune with itself
    merge: (tier = 1) => audio.playVary('merge' + clamp(tier, 1, 8), 0.012),
    crown: () => { audio.play('merge_crown'); audio.duck(1.6, 0.35); },
    big: () => audio.play('levelup'),
    coin: () => audio.playVary('coin', 0.05),
    sell: () => audio.playVary('sell', 0.05),
    boom: () => { audio.play('meteor'); audio.duck(2.4, 0.18); },
    no: () => audio.play('nope', { gain: 0.9 }),
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
    lift: () => audio.playVary('lift', 0.06, 0.7),
    land: () => audio.playVary('land', 0.08, 0.8),
    swap: () => audio.playVary('swap', 0.05, 0.8),
    hover: () => audio.playVary('hover', 0.04, 0.5),
    open: () => audio.playVary('open', 0.04, 0.8),
    close: () => audio.playVary('close', 0.04, 0.7),
    tab: () => audio.playVary('tab', 0.05, 0.7),
    unlock: () => { audio.play('unlock'); audio.duck(1.4, 0.4); },
    ready: () => audio.play('ready', { gain: 0.8 }),
    collect: () => { audio.play('collect'); audio.duck(1.2, 0.4); },
    boing: () => audio.playVary('boing', 0.1, 0.8),
    goo: () => audio.play('goo'),
    unseal: () => { audio.play('unseal'); audio.duck(1, 0.5); },
    chest: () => audio.play('chest'),
    chapter: () => { audio.play('chapter'); audio.duck(3, 0.15); },
    star: () => audio.playVary('star', 0.08, 0.8),
    /** alien chatter: real little syllables in one of seven alien voices
        (scripts/make-sound.py), pitched per character so everyone sounds like
        themselves — Pip squeaks, Rokk rumbles, Glimmer buzzes like a robot */
    voice: (who: string, words = 3, ask = false) => {
      let h = 0; for (const ch of who) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const vt = VOICE[who] || ['mid', 'chirp', 'dreamy', 'squeak'][h % 4];
      const base = 0.9 + (h % 7) * 0.035;            // same type, still a different person
      let at = 0;
      for (let k = 0; k < words; k++) {
        const syl = `voice_${vt}_${1 + ((h >> (k * 2)) + k * 3 + Math.floor(Math.random() * 3)) % 8}`;
        const lift = ask && k === words - 1 ? 1.12 : 1;
        audio.play(syl, { rate: base * lift * (0.95 + Math.random() * 0.1), gain: 0.7, delay: at });
        at += (vt === 'deep' ? 0.17 : vt === 'squeak' ? 0.1 : 0.13) + Math.random() * 0.04;
      }
    },
  };
  /** the music bed a world plays */
  /** every world has its own bed now (see scripts/make-sound.py) */
  const worldMusic = (w: string) => 'music_' + (WORLDS[w] ? w : 'earth');

  /* ==================================================================== FX */
  let toastT: any = 0;
  /* Messages queue up instead of overwriting each other: each one gets at least
     a moment on screen, the same text twice in a row is dropped, and a long
     backlog is trimmed so the player is never reading old news. */
  const toastQ: string[] = [];
  let toastAt = 0, toastCur = '';
  function toast(msg: string) {
    if (msg === toastCur && Date.now() - toastAt < 2100) return;
    if (toastQ[toastQ.length - 1] === msg) return;
    toastQ.push(msg);
    if (toastQ.length > 3) toastQ.splice(0, toastQ.length - 3);
    if (Date.now() - toastAt >= 1500 || !toastCur) toastNext();
  }
  function toastNext() {
    const msg = toastQ.shift(); const t = $('#toast');
    if (!msg) return;
    toastCur = msg; toastAt = Date.now();
    t.innerHTML = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => {
      if (toastQ.length) toastNext();
      else { t.classList.remove('show'); toastCur = ''; }
    }, toastQ.length ? 1600 : 2300);
  }
  const hex = (c?: string) => {
    if (!c) return undefined;
    let h = c.replace('#', '');
    if (h.length === 3) h = h.split('').map(x => x + x).join('');   // '#fff' is white, not 0x000fff
    return parseInt(h, 16);
  };
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
  let lastPointer = 0;
  document.addEventListener('pointerdown', (e: any) => {
    lastClick = (e.target && e.target.closest) ? e.target.closest('button') : null;
    lastPointer = Date.now();
    // every button answers the finger with the same soft tok
    if (lastClick && !(lastClick as HTMLButtonElement).disabled) audio.play('click', { gain: 0.7 });
  }, true);
  /** the shell is CSS-zoomed to fit the device; page pixels → shell pixels */
  const zk = () => { const a = document.getElementById('app'); return a && a.offsetWidth ? a.getBoundingClientRect().width / a.offsetWidth : 1; };
  function floatOn(target: HTMLElement | null, txt: string, color?: string) {
    const host = $('#app'); if (!host) return;
    const t = target && document.body.contains(target) ? target : $('#chipCoins');
    if (!t) return;
    const a = host.getBoundingClientRect(), r = t.getBoundingClientRect();
    const d = el('div', 'domFloat');
    d.textContent = txt;
    if (color) d.style.color = color;
    const k = zk();
    d.style.left = ((r.left - a.left + r.width / 2) / k) + 'px';
    d.style.top = ((r.top - a.top) / k - 6) + 'px';
    host.appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }
  /* Rewards travel. Coins fly from where they were earned into the coin
     counter, items fly off the board into the card that asked for them — the
     player sees where everything went instead of numbers changing on their own. */
  type XY = { x: number; y: number };
  const cellXY = (i: number): XY => board.clientCenter(i);
  const elXY = (e: Element | null): XY | null => {
    if (!e) return null; const r = e.getBoundingClientRect();
    return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };
  function flyTo(from: XY, to: Element | null, html: string, n = 1, opt: { size?: number; onEach?: () => void; delay?: number } = {}) {
    const host = $('#app'), dst = elXY(to); if (!host || !dst) return;
    const a = host.getBoundingClientRect(), size = opt.size || 30, k = zk();
    for (let k = 0; k < n; k++) {
      const d = el('div', 'flyIc'); d.innerHTML = html;
      d.style.width = d.style.height = size + 'px';
      host.appendChild(d);
      const sx = (from.x - a.left) / k + (n > 1 ? (Math.random() - 0.5) * 40 : 0), sy = (from.y - a.top) / k + (n > 1 ? (Math.random() - 0.5) * 30 : 0);
      const ex = (dst.x - a.left) / k, ey = (dst.y - a.top) / k;
      // a little hop out first, then a curved flight into the target
      const hx = sx + (Math.random() - 0.5) * 50, hy = sy - 30 - Math.random() * 30;
      const frames: Keyframe[] = [{ transform: `translate(${sx - size / 2}px,${sy - size / 2}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${hx - size / 2}px,${hy - size / 2}px) scale(1.15)`, opacity: 1, offset: 0.25 }];
      for (let j = 1; j <= 5; j++) {
        const t2 = j / 5, mx = (hx + ex) / 2 + 40, my = Math.min(hy, ey) - 40;
        const x = (1 - t2) * (1 - t2) * hx + 2 * (1 - t2) * t2 * mx + t2 * t2 * ex;
        const y = (1 - t2) * (1 - t2) * hy + 2 * (1 - t2) * t2 * my + t2 * t2 * ey;
        frames.push({ transform: `translate(${x - size / 2}px,${y - size / 2}px) scale(${1.1 - 0.45 * t2})`, opacity: 1, offset: 0.25 + 0.75 * t2 });
      }
      const anim = d.animate(frames, { duration: 720 + k * 25, delay: (opt.delay || 0) + k * 70, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' });
      anim.onfinish = () => {
        d.remove();
        if (to instanceof HTMLElement) { to.classList.remove('bump'); void to.offsetWidth; to.classList.add('bump'); }
        opt.onEach?.();
      };
    }
  }
  const coinHtml = () => ART.icon('coin');
  function flyCoins(from: XY, amount: number, delay = 0) {
    const n = clamp(Math.ceil(amount / 6), 1, 8);
    flyTo(from, $('#chipCoins'), coinHtml(), n, { delay, onEach: () => audio.playVary('coin', 0.08, 0.35) });
  }
  function flyXp(from: XY, delay = 0) { flyTo(from, $('#lvl'), ART.icon('star'), 3, { delay, size: 26 }); }

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
        if (!a || a.b || a.f) return null;
        if (!c) return 'move';
        if (c.f) return a.id === c.f && nextOf(a.id) ? 'merge' : null;
        if (mergeResult(a.id, c.id)) return 'merge';
        // anything else that can move trades places, the way every merge game does it;
        // two of a finished chain just bounce back (there is nothing to make)
        if (c.b || c.bub || (a.id && a.id === c.id)) return null;
        return 'swap';
      },
      canDrag: (i: number) => { const c = B()[i]; return !!c && !c.b && !c.f && !c.bub; },
      matches: (from: number) => {
        const b = B(), a = b[from], out: number[] = [];
        if (!a || !a.id) return out;
        for (let k = 0; k < N; k++) if (k !== from && b[k] && ((b[k].id && !b[k].bub && mergeResult(a.id, b[k].id)) || b[k].f === a.id)) out.push(k);
        return out;
      },
      onLift: () => { sfx.lift(); haptic('light'); hideInfo(); },
      onHover: (kind) => { if (kind === 'merge') { sfx.hover(); haptic('light'); } },
    });
    // Rasterising every item before the first frame grows with the catalogue
    // (500+ now). Wait only for the world you are standing in, plus the shared
    // and rocket chains that can land anywhere; the rest loads behind it.
    const here = (id: string) => [S.world, 'any', 'ship'].indexOf(CHAINS[ITEMS[id].chain].world) >= 0;
    const prodHere = new Set([...WORLDS[S.world].start, ...(WORLDS[S.world].grow || [])]
      .map(x => PRODS[x.producer].art).concat(['scrapwreck', 'crater']));
    await board.preload(ITEM_IDS.filter(here), PRODUCER_ARTS.filter(a => prodHere.has(a)));
    board.preloadIdle(ITEM_IDS, PRODUCER_ARTS).then(() => { board.unstale(); paintBoard(); });
    board.setTheme(S.world);
  }

  function onDrop(from: number, to: number) {
    const b = B(), a = b[from], c = b[to];
    lastAct = Date.now();
    sel = null; board.setSelected(null); hideInfo();
    if (!a) return;
    if (c && c.f && a.id === c.f && nextOf(a.id)) { unseal(from, to); return; }
    if (c && mergeResult(a.id, c.id)) { tryMerge(from, to); return; }
    if (!c) { b[to] = a; b[from] = null; board.sync(b); board.land(to); sfx.land(); updateWanted(); save(); return; }
    if (!c.b && !c.f && !c.bub && !(a.id && a.id === c.id)) {
      b[to] = a; b[from] = c; board.sync(b); board.swapLand(from, to); sfx.swap(); haptic('light'); updateWanted(); save(); return;
    }
    sfx.no(); board.settle(from);
  }
  function paintCell(_i?: number, _anim?: string) { board.sync(B()); }
  function paintBoard() { board.sync(B()); board.setSelected(sel); board.setHint(hintPair); }

  function tickProducers() {
    const now = Date.now();
    // a sealed tile whose twin is loose on the board lights up: "drag it here!"
    const loose = new Set<string>(); B().forEach((c: any) => { if (c && c.id) loose.add(c.id); });
    for (let i = 0; i < N; i++) { const c = B()[i]; if (c && c.f) board.setUnsealable(i, loose.has(c.f)); }
    for (let i = 0; i < N; i++) {
      const c = B()[i]; if (!c || !c.p) continue;
      const p = PRODS[c.p];
      // a visitor's producer: just its free taps left, no refills, no energy
      if (c.tmp) { board.setCharge(i, Math.max(0, c.ch || 0), c.cap || CFG.visitor.taps, ''); board.setReady(i, (c.ch || 0) > 0); continue; }
      if (p.mode === 'energy') {
        const cost = ecost(p, plv(c));
        board.setCost(i, cost, S.energy >= cost);
        board.setReady(i, S.energy >= cost);
        continue;
      }
      if (p.mode !== 'battery') { board.setReady(i, true); continue; }
      const cap = capOf(p, plv(c)), ev = evOf(p, c);
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
    $('#coins').textContent = kN(S.coins);
    $('#gems').textContent = kN(S.gems || 0);
    $('#energy').textContent = S.energy + '/' + maxEnergy();
    $('#lvl').textContent = S.lvl;
    const av = $('#avatar');
    if (av && !av.dataset.on && document.documentElement.classList.contains('has-player')) { av.innerHTML = ART.char('player'); av.dataset.on = '1'; }
    $('#xpTxt').textContent = kN(S.xp) + '/' + kN(xpNeed(S.lvl));
    $('#xpFill').style.width = clamp(S.xp / xpNeed(S.lvl) * 100, 0, 100) + '%';
    const app = $('#app');
    WORLD_ORDER.forEach(w => app.classList.toggle(w, S.world === w));
    const m = curMission();
    $('#tabRocket').classList.toggle('locked', false);
    $('#tabMap').classList.toggle('locked', false);
    $('#tabShop').classList.toggle('locked', !shopOpen());
    $('#tabLab').classList.toggle('hide', !labOpen());
    { const gi = $('#galIc'); if (gi && gi.dataset.w !== S.world) { gi.dataset.w = S.world; gi.innerHTML = ART.uiIcon('ic_galaxy_btn', ART.uiIcon('planet_' + S.world, ART.planet(W().planet))); } }
    { const h = document.querySelector('.hud') as HTMLElement; if (h) app.style.setProperty('--hudH', h.offsetHeight + 'px'); }
    renderStrip();
    claimWatch();
    renderTools(); updateWanted();
    if (view === 'shop') $('#shopCoins').textContent = S.coins;
    if (view === 'lab') $('#labCoins').textContent = String(S.sci);
    renderStore();
  }
  /* ------------------------------------------------ "there is something for you"
     Every claimable thing is listed here once. The dock shows a counted badge
     that pops when the count goes up, and anything NEW slides in as a ribbon
     at the top ("Achievement ready — Claim") with a doorbell sound; tapping it
     goes straight there. Nothing is announced on load, only as it happens. */
  type Claim = { k: string; tab: string; n: number; icon: string; say: string; go: () => void; quiet?: boolean };
  const essenceOnBoard = () => B().reduce((a: number, c: any) => a + (c && c.id ? bloomValue(c.id) : 0), 0);
  function claims(): Claim[] {
    const out: Claim[] = [];
    const add = (k: string, tab: string, n: number, icon: string, say: string, go: () => void, quiet = false) => { if (n > 0) out.push({ k, tab, n, icon, say, go, quiet }); };
    const ar = achReady(), td = tasksDone();
    add('ach', 'Rocket', ar, ART.uiIcon('ic_trophy', '🏆'), ar > 1 ? `${ar} achievements to claim` : 'Achievement ready to claim', () => setView('rocket'));
    add('task', 'Rocket', td, ART.uiIcon('cl_tasks', '✅'), 'Daily task done — reward waiting', () => setView('rocket'));
    add('disc', 'Book', (S.disc || []).length, ART.uiIcon('badge_new', '🆕'), 'New discovery in your Album', () => setView('book'));
    add('shop', 'Shop', shopOpen() && giftReady() ? 1 : 0, ART.uiIcon('cl_gift', '🎁'), 'Free gift in the Star Bazaar', () => setView('shop'));
    // a restocked shelf is news, not a present: a badge, never a "free gift" banner
    add('shopnew', 'Shop', shopOpen() && !giftReady() && S.shop.at > (S.shop.seenAt || 0) ? 1 : 0, ART.uiIcon('ic_shop', '🛒'), 'New stock in the Star Bazaar', () => setView('shop'), true);
    add('labOffer', 'Shop', labOffered() && !S.lab.built ? 1 : 0, ART.uiIcon('ic_microscope', '🔬'), 'The Lab can be built', () => setView('shop'));
    const e = evNow();
    add('event', 'Fun', e && S.ev.join !== (e as any).key ? 1 : 0, ART.uiIcon('ic_event', '🎪'), 'An event has started!', () => setView('fun'));
    add('spin', 'Fun', S.lvl >= SP().unlockLevel ? spinsLeft() : 0, ART.uiIcon('ic_spin', '🎡'), 'Free spin on the Lucky Wheel', () => setView('fun'));
    add('still', 'Lab', S.lab && S.lab.built && !stillLeft() ? 1 : 0, ART.uiIcon('ic_lab', '🧪'), "Gloop's goo is ready", () => setView('lab'), true);
    add('acc', 'Lab', S.acc && !accLeft() ? 1 : 0, ART.uiIcon('cl_timer', '🧪'), 'Lab accelerator is ready', () => setView('lab'));
    add('research', 'Lab', L2().research.filter((r: any) => res(r.id) < r.max && S.sci >= researchCost(r)).length ? 1 : 0, ART.uiIcon('cl_flask', '🧪'), 'You can afford new research', () => setView('lab'));
    // only essence you have not been to the Heart with yet: the dot is news, not a nag
    add('bloom', 'World', !worldAwake() && essenceOnBoard() > (S.bloomSeen || 0) ? 1 : 0, ART.uiIcon('ic_globe', '🌍'), 'Wake the world with your essence', () => setView('map'));
    add('bingo', 'Fun', bingoReady() > 0 ? 1 : 0, ART.uiIcon('ic_event', '🧩'), 'Bingo: something to hand in', () => funPop(), true);
    add('pup', '', petOn() && !pupLeft() ? 1 : 0, pupArt(), 'Your pet fetched a gift!', () => pupPop());
    add('chapter', '', projReady(curProject()) ? 1 : 0, ART.uiIcon('cl_build', '🚀'), 'Chapter ready to build!', () => ($('#btnQuests') as HTMLElement).click());
    return out;
  }
  let claimSeen: Record<string, number> | null = null;
  let hubN: Record<string, number> = {};
  const badgeN: Record<string, number> = {};
  function claimWatch() {
    const list = claims();
    // dock badges: a number, and a pop when it grows
    const per: Record<string, number> = { Rocket: 0, Book: 0, Shop: 0, Fun: 0, Lab: 0, World: 0 };
    list.forEach(c => { if (c.tab) per[c.tab] += c.n; });
    hubN = { book: per.Book, fun: per.Fun, lab: per.Lab };
    { const gw = document.getElementById('tabRocket'); if (gw) gw.classList.toggle('claim', per.Rocket > 0); }
    // Album, games and the lab live on the map now, so the galaxy button carries their news
    per.World += per.Book + per.Fun + per.Lab;
    for (const [tab, n] of Object.entries(per)) {
      const d = document.getElementById('dot' + tab); if (!d) continue;
      d.style.display = n ? '' : 'none';
      if (tab === 'Shop') { const t = document.getElementById('tabShop'); if (t) t.classList.toggle('hot', !!n); }
      d.textContent = n > 1 ? (n > 9 ? '9+' : String(n)) : '';
      if (n > (badgeN[tab] || 0) && claimSeen) { d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump'); }
      badgeN[tab] = n;
    }
    const now: Record<string, number> = {};
    list.forEach(c => { now[c.k] = c.n; });
    if (claimSeen) {
      // the main tutorial owns the screen while it runs
      // only the few things worth a banner; everything else is a badge
      const fresh = !S.tut || tutOn() || jit ? [] : list.filter(c => c.n > (claimSeen![c.k] || 0) && ['chapter', 'pup', 'event'].includes(c.k) && !c.quiet);
      // a banner for something already claimed goes away at once
      const rb = document.getElementById('ribbon');
      if (rb && rb.className === 'show' && ribbonCur && !now[ribbonCur]) rb.className = 'hide';
      fresh.forEach(c => ribbon(c));
    }
    claimSeen = now;
  }
  const ribbonQ: Claim[] = [];
  let ribbonOn = false, ribbonCur = '';
  function ribbon(c: Claim) {
    if (ribbonQ.some(q => q.k === c.k)) return;
    ribbonQ.push(c); if (!ribbonOn) ribbonNext();
  }
  function ribbonNext() {
    if (!ribbonQ.length) { ribbonOn = false; return; }
    ribbonOn = true;
    // only over the board, never on top of a screen, popup or dialog (it would sit on their ✕)
    if (view !== 'board' || popOpen() || $('#modal').classList.contains('open') || $('#talk').classList.contains('open') || jit || placing !== null) {
      setTimeout(ribbonNext, 1500); return;
    }
    const c = ribbonQ.shift()!; ribbonCur = c.k;
    // it may have been claimed meanwhile
    if (!claims().some(x => x.k === c.k)) { ribbonNext(); return; }
    let r = document.getElementById('ribbon');
    if (!r) { r = document.createElement('div'); r.id = 'ribbon'; $('#app').appendChild(r); }
    r.innerHTML = `<span class="rbIc">${c.icon}</span><span class="rbTx">${c.say}</span><span class="rbGo">${c.k === 'chapter' ? 'Build' : c.k === 'event' || c.k === 'bloom' ? 'Go' : 'Claim'}</span>`;
    r.className = 'show';
    sfx.ready(); haptic('light');
    const done = () => { r!.className = 'hide'; clearTimeout(t); setTimeout(ribbonNext, 450); };
    // only the button is live: a ribbon over the contracts must never eat a tap meant for them
    (r.querySelector('.rbGo') as HTMLElement).onclick = (ev) => { ev.stopPropagation(); done(); c.go(); };
    const t = setTimeout(done, 3800);
  }
  (window as any).__claims = () => claims().map(c => c.k);

  /* The chapter strip: the main quest is always on screen, with the things it
     needs, and it lights up the moment you can build it. */
  let stripKey = '';
  function renderStrip() {
    const btn = $('#btnQuests'); if (!btn) return;
    const pj = curProject(), ready = projReady(pj);
    const key = pj ? pj.id + '|' + ready + '|' + cHave() + '|' + S.coins + '|' + pj.needs.map(([id]: [string, number]) => countItem(id)).join(',') + '|' + upNeeds(pj).length : 'done' + S.world;
    if (key === stripKey) return; stripKey = key;
    btn.classList.toggle('ready', !!ready);
    if (!pj) { btn.innerHTML = `<span class="cwFace">${ART.uiIcon('ic_galaxy', '🌌')}</span><b class="cwT">Done!</b>`; const l0 = $('#chapLine'); if (l0) l0.innerHTML = `<b class="clT">🌟 ${W().name} restored — fly on from the 🌌 Galaxy</b>`; return; }
    // one small card: who it is for, how far along, and BUILD when it is time
    const parts = pj.needs.map(([id, q]: [string, number]) => Math.min(1, countItem(id) / q));
    parts.push(Math.min(1, S.coins / Math.max(1, pj.coins || 1)), Math.min(1, cHave() / cNeed(pj)));
    upNeeds(pj).forEach(() => parts.push(0));
    if (pj.rocket) parts.push(PART_KEYS.filter(k => S.parts[k]).length / 4);
    const pct = Math.round(parts.reduce((a: number, x: number) => a + x, 0) / parts.length * 100);
    btn.innerHTML = `<span class="cwFace">${ART.char(pj.who)}</span>
      <b class="cwT">${ready ? 'BUILD!' : 'Ch. ' + (projDone() + 1)}</b>
      <span class="cwBar"><i style="width:${pct}%"></i></span>`;
    // the bottom line spells the chapter out: every need, always on screen
    const line = $('#chapLine');
    if (line) {
      const ups = upNeeds(pj);
      line.classList.toggle('ready', !!ready);
      line.innerHTML = `<b class="clT">${ready ? 'BUILD!' : 'Ch. ' + (projDone() + 1)}</b>`
        + pj.needs.map(([id, q]: [string, number]) => { const h = Math.min(q, countItem(id)); return `<span class="clN${h >= q ? ' ok' : ''}">${ART.item(id)}<em>${h}/${q}</em></span>`; }).join('')
        + (pj.coins ? `<span class="clN${S.coins >= pj.coins ? ' ok' : ''}">${ART.icon('coin')}<em>${pj.coins >= 1000 ? (pj.coins / 1000).toFixed(1) + 'k' : pj.coins}</em></span>` : '')
        + `<span class="clN${cHave() >= cNeed(pj) ? ' ok' : ''}">${ART.uiIcon('ic_scroll', '📜')}<em>${Math.min(cHave(), cNeed(pj))}/${cNeed(pj)}</em></span>`
        + (ups.length ? `<span class="clN up">⬆<em>${ups.length}</em></span>` : '')
        + (pj.rocket ? `<span class="clN${allParts() ? ' ok' : ''}">🚀<em>${PART_KEYS.filter(k => S.parts[k]).length}/4</em></span>` : '');
    }
  }
  /** which board cells a ready contract or a ready chapter is about to take */
  function updateWanted() {
    const b = B(), used = new Set<number>(), take = (id: string, q: number) => {
      for (let i = 0; i < N && q; i++) if (!used.has(i) && b[i] && b[i].id === id) { used.add(i); q--; }
    };
    const stock = inventory(), claim: Record<string, number> = {};
    S.orders.forEach(o => {
      const ok = o.needs.every(nd => (stock[nd.id] || 0) - (claim[nd.id] || 0) >= nd.qty);
      if (ok) o.needs.forEach(nd => { claim[nd.id] = (claim[nd.id] || 0) + nd.qty; take(nd.id, nd.qty); });
    });
    const pj = curProject();
    if (pj && projReady(pj)) pj.needs.forEach(([id, q]: [string, number]) => take(id, q));
    board.setWanted([...used]);
  }
  function curMission() { return MISSIONS.find(m => (S.mp[m.id] || 0) < m.need); }
  function readyParts() { return !allParts() && Object.keys(S.parts).some(k => !S.parts[k]); }
  const allParts = () => S.parts.hull && S.parts.engine && S.parts.nav && S.parts.tank;
  /* The rocket is the end of the Meadow, not the middle of it. Dr. Zonk lands
     early (chapter 4) but his ship only turns up after Stargazing Night, when
     everyone has seen where home is — so rocket pieces stay out of the game
     until then. A save that already started building keeps going. */
  const ROCKET_AFTER = 42;
  const rocketTime = () => !!S.met && (S.world !== 'earth' || ((S.proj && S.proj.earth) || 0) >= ROCKET_AFTER
    || PART_KEYS.some(k => S.parts[k]) || !!S.wreck);
  const building = () => rocketTime() && !allParts();

  /* Star Scrap and Star Cores never sit on the board: they fly into the Star
     Pouch the moment they land, and the Forge, Constellations and the lab spend
     them from there. Counting and spending see the pouch first. */
  const POUCH = ['scrap', 'starcore'];
  const pouch = (id: string) => (S.wal && S.wal[id]) || 0;
  function countItem(id: string) { let n = POUCH.includes(id) ? pouch(id) : 0; const b = B(); for (let i = 0; i < N; i++) if (b[i] && b[i].id === id) n++; return n; }
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
    POUCH.forEach(id => { if (pouch(id)) inv[id] = (inv[id] || 0) + pouch(id); });
    return inv;
  }
  /** record an item the player has just obtained — feeds the Guide catalogue */
  /* The odd things — meteor finds, relics, essence, wildcards, rocket pieces —
     are not obvious. The first time one turns up, someone says what it is for
     and where to take it. Once per kind. */
  const EXPLAIN: Record<string, { who: string; title: string; say: string }> = {
    scrap: { who: 'bloop', title: 'Star Scrap', say: 'goes to your Star Pouch. Spend it in the Shop’s Star Forge.' },
    starcore: { who: 'bloop', title: 'Star Core', say: 'goes to your Star Pouch. Light Constellations with it (Games).' },
    relic: { who: 'bloop', title: 'Relic', say: 'buys a forever perk in the Relic Vault (Goals).' },
    bloom: { who: 'grandma', title: 'Bloom Essence', say: 'merge it up and feed the Heart on the map.' },
    rainbow: { who: 'pip', title: 'Wildcard', say: 'drop it on any item to level it up.' },
    fuel: { who: 'bloop', title: 'Fuel', say: 'merge ore into rocket fuel.' },
    part: { who: 'bloop', title: 'Rocket piece', say: 'merge pieces into a whole part.' },
    junk: { who: 'zib', title: 'Space Junk', say: 'is worth triple 🧪 Science in the Lab recycler — and seven merged up, the Junk Rocket coughs out Fuel Ore every time.' },
  };
  function explainFirst(id: string) {
    const d = ITEMS[id]; if (!d) return;
    const key = EXPLAIN[id] ? id : (d.part || ['hull', 'engine', 'nav', 'tank'].includes(d.chain)) ? 'part' : EXPLAIN[d.chain] ? d.chain : '';
    if (!key || S.tipsOff || (S.told || (S.told = {}))[key]) return;
    S.told[key] = 1;
    const e = EXPLAIN[key];
    setTimeout(() => toast(`<b>${e.title}:</b> ${e.say}`), 700);
  }
  function gotItem(id: string) {
    if (S.tut) explainFirst(id);
    // a first-ever find is a little present waiting in the Album
    if (!S.seen[id] && ITEMS[id].tier >= 2 && !ITEMS[id].part) { (S.disc = S.disc || []).push(id); }
    S.seen[id] = 1; S.made[id] = (S.made[id] || 0) + 1;
  }
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

  let ordersMinH = 0;
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
      const card = el('div', 'order' + ((o as any).vis ? ' visitor' : '') + (ready ? ' ready' : '') + (newIds && newIds.indexOf(o.id) >= 0 ? ' newin' : ''));
      card.dataset.oid = o.id;
      const ch = CHARS[o.char];
      // Travel Town: the customer stands there; what they want sits in a small card at their feet
      card.innerHTML =
        `<div class="oFig">${ART.standing(o.char) || ART.figure(o.char)}</div>
         <div class="oNeeds">${o.needs.map(nd => {
          const have = Math.min(ready ? nd.qty : held(nd.id), nd.qty);
          return `<div class="oNeed${have >= nd.qty ? ' done' : ''}" data-need="${nd.id}">${ART.item(nd.id)}<b>${have}/${nd.qty}</b></div>`;
        }).join('')}</div>
         <div class="oPay"><span>${ART.icon('coin')}${o.coins}</span>${o.give ? `<span class="gift">${ART.item(o.give)}</span>` : ''}${o.nrg ? `<span>${ART.icon('energy')}${o.nrg}</span>` : ''}</div>
         ${ready ? `<button class="btnDeliver on oTick" title="Give">${ART.uiIcon('ic_tick', '✔')}</button>` : ''}`;
      const tick = card.querySelector('.btnDeliver') as HTMLElement | null;
      if (tick) tick.onclick = (ev: Event) => { ev.stopPropagation(); deliver(o.id); };
      // tapping the thing they want explains where it comes from, which is the
      // question a new player actually has
      card.querySelectorAll('[data-need]').forEach((n: any) => n.onclick = (ev: Event) => {
        ev.stopPropagation(); if (ready) deliver(o.id); else contractSheet(o.id);
      });
      // a ready card gives on any tap; otherwise it points at where to get things
      card.onclick = () => ready ? deliver(o.id) : contractSheet(o.id);
      host.appendChild(card);
    });
    orderArrows(); updateWanted(); renderStrip();
    // never let the row collapse between contracts: if it shrinks, the whole
    // board jumps up under the player's finger mid-drag
    if (host.offsetHeight > (ordersMinH || 0) && S.orders.length) { ordersMinH = host.offsetHeight; host.style.minHeight = ordersMinH + 'px'; }
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
    // an alien Star Freighter, flown by the Grub Brothers: same look as a customer, plus a countdown
    card.innerHTML =
      `<div class="oFig">${ART.spriteUi('ufo_freighter') ? `<img class="fig stand ufoFig" src="${ART.spriteUi('ufo_freighter')}" alt="">` : (ART.standing('grubs') || ART.figure('grubs')) + '<span class="ufo">🛸</span>'}</div>
       <div class="shipTime" id="shipTime">${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}</div>
       <div class="oNeeds">${sh.needs.map((nd: any) => {
        const have = Math.min(countItem(nd.id), nd.qty);
        return `<div class="oNeed${have >= nd.qty ? ' done' : ''}">${ART.item(nd.id)}<b>${have}/${nd.qty}</b></div>`;
      }).join('')}</div>
       <div class="oPay"><span>${ART.icon('coin')}${sh.coins}</span><span>${ART.icon('wand')}</span></div>
       ${ready ? `<button class="btnDeliver on oTick" title="Load">${ART.uiIcon('ic_tick', '✔')}</button>` : '<button class="btnDeliver hidden"></button>'}`;
    card.onclick = () => (S.ship && S.ship.needs.every((nd: any) => countItem(nd.id) >= nd.qty)) ? deliverShip() : contractSheet('ship');
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
    const recs = RECIPES.filter(r => r.result === id);
    const where = d.chain === 'relic' ? `Relics are not grown — make them in <b>Dr. Zonk's Lab</b> with an Experiment:`
      + `<div class="recList">${recs.map(r => `<span class="recRow">${ART.item(r.inputs[0])}<b>+</b>${ART.item(r.inputs[1])}<b>→</b>${ART.item(r.result)}</span>`).join('')}</div>`
      + (labOpen() ? '' : `<i>The Lab opens after Meadow chapter 5.</i>`)
      : d.chain === 'bloom' ? `Bloom Essence comes from finishing a merge chain for the first time.`
        : src ? `Start with <b>${ITEMS[ch.items[0]].name}</b> from the <b>${PRODS[src.k].name}</b>${src.on ? ' on your board' : ' — you do not have one here yet'}, then merge two of each into the next.`
          : `Merge two of the one before it. ${ITEMS[ch.items[0]].name} is the bottom of this chain.`;
    // what it is for: who wants it right now, and what it can be spent on
    const uses: string[] = [];
    S.orders.forEach((o: any) => { if (o.needs.some((nd: any) => nd.id === id)) uses.push(`📜 <b>${CHARS[o.char] ? CHARS[o.char].name : 'A customer'}</b> wants one in a contract.`); });
    const cp = curProject(); if (cp && cp.needs.some(([x]: [string, number]) => x === id)) uses.push(`🏗️ Needed for <b>${cp.name}</b> (this chapter).`);
    if (d.chain === 'relic') uses.push('🏛️ Spend it in the <b>Relic Vault</b> (Missions) on perks that last forever.');
    else if (d.chain === 'bloom') uses.push(`💗 Feed it to the <b>${W().heart}</b> in the camp to wake the world.`);
    else if (d.chain === 'junk') uses.push('🧪 Worth triple Science in the Lab recycler; a Junk Rocket gives Fuel Ore.');
    else if (d.fuel || d.chain === 'fuel') uses.push('🚀 Rocket Fuel flies you to new worlds.');
    if (!uses.length) uses.push(`🪙 Sell it for ${sellOf(id)} coins${labOpen() ? ` or recycle it for ${sciOf(id)} 🧪` : ''} — or keep merging: higher steps are worth more.`);
    modal(S.met ? 'bloop' : 'pip', ITEMS[id].name,
      `<div class="chainWrap">${steps}</div>
       <div class="noteLine" style="text-align:left"><b>Where from:</b> ${where}</div>
       <div class="noteLine" style="text-align:left"><b>What for:</b> ${uses.join(' ')}</div>
       ${src && src.on ? `<button class="srcCard" id="showSrc">${ART.producer(PRODS[src.k].art)}
          <span class="srcTxt"><b>${PRODS[src.k].name}</b><i>${(B()[src.i].ch ?? 0)}/${capOf(PRODS[src.k], plv(B()[src.i]))} charges · on your board</i></span>
          <span class="srcGo">Find it</span></button>` : ''}`,
      'Close');
    $('#modal').classList.add('lite');
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

  /* The contract sheet: who wants what, how far along each thing is, and where
     it comes from. Every step of the chain is shown with how many you hold, and
     the source is one tap away — closing the sheet points at it on the board. */
  function contractSheet(oid: string) {
    // the Star Freighter opens the same sheet as any customer
    const o: any = oid === 'ship' && S.ship ? { id: 'ship', char: 'grubs', needs: S.ship.needs, coins: S.ship.coins, xp: S.ship.xp, say: 'Fill our hold before we lift off! One of us is in a hurry.' }
      : S.orders.find(x => x.id === oid); if (!o) return;
    tutFire('chain');
    const inv = inventory(), ch = CHARS[o.char];
    const needRow = (nd: { id: string; qty: number }) => {
      const d = ITEMS[nd.id], ids = CHAINS[d.chain].items.slice(0, d.tier), have = inv[nd.id] || 0, ok = have >= nd.qty;
      const src = producerFor(nd.id);
      return `<div class="csNeed${ok ? ' ok' : ''}">
          <div class="csTop"><span class="csArt">${ART.item(nd.id)}</span>
            <div class="csName"><b>${d.name}</b><i>${ok ? 'Ready ✓' : `You have ${have} of ${nd.qty}`}</i></div>
            ${!ok && src ? `<button class="csGo" data-src="${src.on ? src.i : -1}" data-k="${src.k}">${ART.producer(PRODS[src.k].art)}<span>${src.on ? 'Tap it' : 'Not here yet'}</span></button>` : ''}</div>
          <div class="csPath">${ids.map((x, n) => `<span class="csStep${inv[x] ? ' have' : ''}${x === nd.id ? ' goal' : ''}">${S.seen[x] || x === nd.id ? ART.item(x) : '?'}${inv[x] ? `<em>${inv[x]}</em>` : ''}</span>${n < ids.length - 1 ? '<i>›</i>' : ''}`).join('')}</div></div>`;
    };
    const rew = `<div class="csRew"><span>${ART.icon('coin')}<b>${o.coins}</b></span><span>${ART.icon('star')}<b>${o.xp}</b></span>
      ${o.give ? `<span title="Gift">${ART.item(o.give)}<b>gift</b></span>` : ''}${o.nrg ? `<span>${ART.icon('energy')}<b>${o.nrg}</b></span>` : ''}</div>`;
    pop(ch.name, `<div class="csHead"><span class="csFig">${ART.figure(o.char)}</span><div class="csSay">“${o.say}”${rew}</div></div>
      ${o.needs.map(needRow).join('')}
      <div class="noteLine">Two of a kind merge into the next step. Close this and the things you need will light up on the board.</div>
      <button class="big" id="csOk">Got it</button>`, 'csheet', () => pointFor(o));
    document.querySelectorAll<HTMLElement>('.csGo').forEach(b => b.onclick = () => {
      const i = +(b.dataset.src as string);
      if (i < 0) { toast(`The <b>${PRODS[b.dataset.k as string].name}</b> is not on this board yet — the story brings it.`); return; }
      closePop(); setView('board'); pointAt([i]);
    });
    const ok = document.getElementById('csOk'); if (ok) ok.onclick = () => closePop();
  }
  /** light up everything on the board that helps with this contract: the pieces
   *  of each chain you already hold and the producer that starts it */
  function pointFor(o: any) {
    const b = B(), cells: number[] = [];
    o.needs.forEach((nd: any) => {
      if (countItem(nd.id) >= nd.qty) return;
      const d = ITEMS[nd.id], ids = CHAINS[d.chain].items.slice(0, d.tier);
      for (let i = 0; i < N; i++) if (b[i] && b[i].id && ids.indexOf(b[i].id) >= 0) cells.push(i);
      const src = producerFor(nd.id); if (src && src.on) cells.push(src.i);
    });
    if (cells.length) { setView('board'); pointAt([...new Set(cells)].slice(0, 10)); }
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
    // only ask for things the player can actually make right now: a chain counts
    // if one of its producers is sitting on the board
    const live: Record<string, boolean> = {}, plvOf: Record<string, number> = {};
    B().forEach(c => {
      if (!c || !c.p) return;
      PRODS[c.p].drops.forEach((d: string) => { const ch = ITEMS[d].chain; live[ch] = true; if (!c.tmp) plvOf[ch] = Math.max(plvOf[ch] || 0, plv(c)); });
    });
    const awake = liveChains();
    const open = awake.filter(c => live[c]).length ? awake.filter(c => live[c]) : awake;
    /* How far up a chain a contract reaches: it grows with this world's level
       and a little with the player's, and it never asks for the crown — that
       one is yours to show off (and sells for a fortune). */
    const wl = Math.min(wlv(), S.lvl);   // the world levels faster than you do; asks follow the slower one
    // the first few levels stay gentle so the intro reads; after that a contract
    // asks for real work: tier 3+ and often two or three different things
    const pd = S.world === 'earth' ? projDone('earth') : 99;
    const early = S.lvl < 3 || pd < 6;
    // one step up every four levels: a tier-7 ask at level 8 was an hour of waiting
    // a producer you have upgraded all the way earns harder (better-paid) asks from its chains
    // the first fifteen Meadow chapters never ask past step 3: you are still learning the chains
    const reach = (ck: string) => clamp(Math.min((early ? 2 : 3) + Math.floor((wl - 1) / 5) + ((plvOf[ck] || 0) >= PMAX ? 1 : 0), pd < 15 ? (early ? 2 : 3) : 99), 2,
      Math.max(2, CHAINS[ck].items.length - 1));
    const itemFrom = (ck: string, cap?: number) => {
      const top = Math.min(reach(ck), cap ?? 99), lo = early ? 1 : Math.max(2, top - 1);
      const ids = CHAINS[ck].items.filter(id => ITEMS[id].tier >= lo && ITEMS[id].tier <= top);
      return ids.length ? rnd(ids) : CHAINS[ck].items[0];
    };
    // Who is asking, first — then what they would plausibly want.
    // only people you have already met in the story come to the board with a contract
    const metIn = new Set<string>([W().folks[0], W().folks[1]]);
    projList(S.world).forEach((p: any) => { if (S.talked && S.talked[p.id] && p.talk) p.talk.forEach(([who]: [string, string]) => metIn.add(who)); });
    const metFolks = W().folks.filter(f => metIn.has(f) || (S.proj[S.world] || 0) >= projList(S.world).length);
    const folks = (metFolks.length >= 2 ? metFolks : W().folks).concat(S.met ? ['bloop'] : []);
    const fans = folks.filter(f => (CHARS[f].likes || []).some(c => open.indexOf(c) >= 0));
    const busy = S.orders.map(o => o.char);
    const pickFrom = (fans.length ? fans : folks).filter(f => busy.indexOf(f) < 0);
    // everyday villagers (once painted) mix in, so the board is not three of the same face
    const vils = ['vil1', 'vil2', 'vil3', 'vil4', 'vil5', 'vil6', 'vil7', 'vil8'].filter(v => ART.spriteChar(v + '_full') && busy.indexOf(v) < 0);
    const char = vils.length && (!pickFrom.length || Math.random() < 0.45) ? rnd(vils) : rnd(pickFrom.length ? pickFrom : (fans.length ? fans : folks));
    const theirs = open.filter(c => (CHARS[char].likes || []).indexOf(c) >= 0);
    const chains = theirs.length ? theirs : open;
    let chain = rnd(chains);
    let pick = itemFrom(chain);
    // the odd special request: a relic. Never a rocket piece or star scrap —
    // those get used up elsewhere, and a contract for one could wait forever.
    if (S.seen.relic1 && Math.random() < 0.08) { pick = 'relic1'; chain = 'relic'; }
    const d = ITEMS[pick];
    const needs = [{ id: pick, qty: d.tier >= 4 ? 1 : d.tier === 3 ? (Math.random() < 0.35 ? 2 : 1) : 2 }];
    // more things from other chains the same person cares about (or any awake one)
    const pool = chains.length > 1 ? chains : open;
    const extra = early ? 0 : pd < 15 ? (Math.random() < 0.3 ? 1 : 0) : (Math.random() < Math.min(0.75, 0.35 + S.lvl * 0.03) ? 1 : 0)
      + (S.lvl >= 8 && Math.random() < 0.3 ? 1 : 0);
    for (let k = 0; k < extra; k++) {
      const left = pool.filter(c => c !== chain && !needs.some(nd => ITEMS[nd.id].chain === c));
      if (!left.length) break;
      const other = rnd(left);
      const p2 = itemFrom(other, Math.max(2, reach(other) - 1));
      if (p2 && !needs.some(nd => nd.id === p2)) needs.push({ id: p2, qty: 1 });
    }
    const asks = CHAINS[chain].asks;
    const said = S.orders.map(o => o.say);
    const fresh = (asks || []).filter(x => said.indexOf(x) < 0);
    const say = fresh.length ? rnd(fresh) : asks && asks.length ? rnd(asks) : rnd(CHARS[char].lines);
    const worth = needs.reduce((a, nd) => a + ITEMS[nd.id].sell * nd.qty, 0);
    // Orders are the steady drip that keeps the rocket build moving: while parts
    // are missing, most customers pay you back with a piece you still need.
    let give: string | null = null;
    if (building() && Math.random() < CONFIG.orders.partRewardChance) give = partPiece(true);
    else if (Math.random() < CONFIG.orders.itemRewardChance) {
      const c2 = rnd(chains);
      const bonus = CHAINS[c2].items.filter(x => ITEMS[x].tier >= 2 && ITEMS[x].tier <= reach(c2));
      if (bonus.length) give = rnd(bonus);
    }
    // now and then someone pays in energy instead of a gift — Travel Town does this
    const nrg = !give && Math.random() < 0.08 ? 3 + 3 * Math.floor(Math.random() * 3) : 0;
    return {
      id: 'o' + (oid++), char, say, give, nrg,
      needs,
      // contracts are where coins come from: chapters and producer upgrades are paid from them
      coins: Math.round((Math.round(worth * (1.1 + Math.random() * 0.4)) + 5) * coinMult() * (1 + res('trader') * 0.08)),
      xp: Math.round((CONFIG.xp.orderBase + needs.reduce((a, nd) => a + ITEMS[nd.id].tier + nd.qty, 0)) * xpMult()),
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
    const card = document.querySelector(`.order[data-oid="${id}"]`);
    const cardXY = elXY(card) || elXY($('#orders'));
    o.needs.forEach(nd => { let left = nd.qty; for (let i = 0; i < N && left; i++) if (b[i] && b[i].id === nd.id) {
      flyTo(cellXY(i), card, ART.item(nd.id), 1, { size: 40 });
      b[i] = null; left--; sparkle(i, 8, '#ffe9a8');
    } });
    S.coins += o.coins;
    if (cardXY) { flyCoins(cardXY, o.coins, 380); flyXp(cardXY, 480); }
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
    if (o.nrg) { S.energy += o.nrg; bumpChip('#chipEnergy'); setTimeout(() => toast(`⚡ +${o.nrg} energy from ${CHARS[o.char].name}`), 700); }
    prog('deliver', 1); tally('deliver'); mileTick();
    analytics.track('contract_done', { coins: o.coins, needs: o.needs.length });
    S.cSince = S.cSince || {}; S.cSince[S.world] = (S.cSince[S.world] || 0) + 1;
    befriend(o.char); stat('deliver');
    evPts(CFG.event.points.contract + CFG.event.points.perNeed * o.needs.length);
    addXp(o.xp);
    paintBoard(); tutFire('deliver');
    renderOrders(); renderHUD(); save();
  }
  function bumpChip(sel2: string) { const c = $(sel2); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }

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
    analytics.track('level_up', { level: S.lvl });
    games.submitScore('level', S.lvl);
    addGems(CFG.gems.perLevel + (S.lvl % 5 === 0 ? CFG.gems.everyFiveLevels : 0));
    // a level is a treat, not a free refill: a top-up that never overfills
    S.energy = Math.max(S.energy, Math.min(maxEnergy(), S.energy + (CONFIG.energy.levelUp || 20)));
    if (S.lvl === CONFIG.unlocks.shopAtLevel) setTimeout(() => toast('🛒 The <b>shop</b> is open — top right!'), 2300);
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

    }
    checkStory();
    renderHUD();
  }
  function levelBanner() {
    sfx.big(); haptic('medium'); confetti();
    const lu = $('#levelup');
    $('#luTxt').textContent = 'LEVEL ' + S.lvl + '!';
    $('#luSub').textContent = `+${CONFIG.energy.levelUp || 20} energy • +${CFG.gems.perLevel} 💎`;
    lu.classList.remove('show'); void lu.offsetWidth; lu.classList.add('show');
    setTimeout(() => lu.classList.remove('show'), 2100);
    // on a story world Dr. Zonk arrives with a chapter (Mend the Old Well), not a level
    if (S.lvl >= CONFIG.meteor.firstAtLevel && !S.met && !scripted('earth')) setTimeout(meteorStory, 1800);
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
    // the first tap on a new producer says what it is; from the second tap it works
    S.pinfo = S.pinfo || {};
    if (!S.pinfo[c.p]) {
      S.pinfo[c.p] = 1; save();
      if (S.tut && !c.tmp && p.mode !== 'once' && c.p !== 'wreck') { sfx.tap(); board.bump(i); showProdInfo(i); return; }
    }
    const spot = nearFree(i);
    if (spot < 0) {
      sfx.no(); board.bump(i);
      const pr = findPair();
      toast(pr ? 'Board full! Merge the glowing pair to make room.' : 'Board full! Sell or bag something to make room.');
      if (pr) { hintPair = pr; board.setHint(pr); setTimeout(() => { hintPair = null; board.setHint(null); }, 2400); }
      return;
    }
    if (c.tmp) {
      // a visitor's producer: free taps, no energy, and it leaves when it runs out
      c.ch = (c.ch ?? 0) - 1;
      floatText(i, c.ch + ' left', '#ffe9a8');
    } else if (p.mode === 'battery') {
      if (!c.ch) { sfx.no(); offerRecharge(i); return; }
      // every tap costs energy, battery or not: energy is the pace of the game
      if (S.energy < 1) { sfx.no(); bumpChip('#chipEnergy'); toast(`Out of energy — every tap costs <b>1 ⚡</b>.`); setTimeout(energyPop, 500); return; }
      S.energy -= 1; S.eAt = S.eAt || Date.now(); bumpChip('#chipEnergy'); floatText(i, '-1 ⚡', '#9be8ff');
      const cap = capOf(p, plv(c));
      if (c.ch >= cap) c.at = Date.now();          // start the clock on the first tap
      c.ch--;
      if (c.ch === 0) c.rf = (c.rf || 0) + (c.rfArm ? 1 : 0), c.rfArm = 1;   // the first empty arms the fast refill, later ones count
    } else if (p.mode === 'energy') {
      const cost = ecost(p, plv(c)) * (boostOn() ? 2 : 1);
      if (S.energy < cost) {
        sfx.no(); bumpChip('#chipEnergy');
        toast(`Out of energy — ${p.name} costs <b>${cost} ⚡</b> a tap.`);
        setTimeout(energyPop, 500);
        return;
      }
      S.energy -= cost; S.eAt = S.eAt || Date.now();
      bumpChip('#chipEnergy'); floatText(i, '-' + cost + ' ⚡', '#9be8ff');
    }
    // The wreck is not a slot machine: it hands out pieces for the part you are
    // furthest from finishing, so the rocket always creeps forward.
    let id = (c.p === 'wreck' && !allParts() ? partPiece() : null) || rollDrop(p, plv(c));
    // no rocket yet, so no fuel either — an early crater is all star scrap
    if (c.p === 'crater' && !rocketTime() && id === 'fuelore') id = Math.random() < 0.12 ? 'starcore' : 'scrap';
    // Power ×2: double energy, the drop comes one step up the chain
    if (boostOn() && p.mode === 'energy' && !c.tmp && nextOf(id) && !ITEMS[id].part) id = nextOf(id) as string;
    // Golden Touch: now and then the drop arrives one step up
    if (res('golden') && Math.random() < res('golden') * 0.03 && nextOf(id) && !ITEMS[id].part) { id = nextOf(id) as string; setTimeout(() => floatText(spot, '✨ Golden!', '#ffe07a'), 300); }
    b[spot] = { id }; gotItem(id); setTimeout(() => sealTip(id, spot), 700);
    // Lucky Taps: a second one for free
    if (res('lucky') && Math.random() < res('lucky') * 0.04) {
      const s2 = nearFree(i);
      if (s2 >= 0) { b[s2] = { id }; gotItem(id); setTimeout(() => { board.animSpawn(s2, id, i); floatText(s2, '🍀 Lucky!', '#b9f59b'); }, 160); }
    }
    (c.p === 'crater' || c.p === 'wreck' ? sfx.dig : sfx.pop)();
    haptic('light'); board.animSpawn(spot, id, i);
    if (c.p === 'tree') prog('spawn', 1);
    tutFire('spawn');
    tally(c.p === 'crater' ? 'dig' : 'spawn');
    // (producers used to retire at max level and be swapped for a random one — players read that as their starter vanishing; they stay now)
    if (c.tmp && c.ch <= 0) { b[i] = null; setTimeout(() => { sparkle(i, 16, '#ffe9a8'); paintBoard(); toast('The visitor\'s producer is empty — thanks for the help!'); }, 400); }
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
  /* Sealed tiles (Travel Town fog): an item waits inside, dimmed. Bring its
     twin and merge into it: the tile opens and the next step comes out. */
  function sealTip(id: string, at: number) {
    if (S.sealTip || !S.tut) return;
    const b = B(), k = b.findIndex((c: any) => c && c.f === id); if (k < 0) return;
    S.sealTip = 1; save();
    hintPair = [at, k]; board.setHint(hintPair); setTimeout(() => { hintPair = null; board.setHint(null); }, 6000);
    setTimeout(() => modal('pip', 'A locked tile!',
      `That dimmed <b>${ITEMS[id].name}</b> with the lock is sealed. Drag your <b>${ITEMS[id].name}</b> onto it: they merge and the tile opens. Every locked item opens the same way.`, 'Got it'), 500);
  }
  function unseal(from: number, to: number) {
    const b = B(), a = b[from], c = b[to]; if (!a || !c || !c.f) return;
    const nx = nextOf(c.f) as string;
    b[from] = null; b[to] = { id: nx }; gotItem(nx);
    board.animMerge(from, to, nx);
    sfx.unseal(); haptic('medium'); sparkle(to, 22, '#9ff3ff'); floatText(to, '🔓 ' + ITEMS[nx].name, '#fff');
    stat('merge'); addXp(CONFIG.xp.perMerge + 3); prog('merge', 1); tally('merge'); tally('make:' + nx); tally('unseal');
    lastAct = Date.now(); renderOrders(); save();
  }
  function tryMerge(from: number, to: number) {
    const b = B(), a = b[from], c = b[to];
    if (!a || !c || !a.id || !c.id) return false;
    const nx = mergeResult(a.id, c.id);
    if (!nx) {
      if (a.id === c.id) toast(ITEMS[a.id].name + ' is already the best in its chain!');
      return false;
    }
    b[from] = null; b[to] = { id: nx }; gotItem(nx); setTimeout(() => sealTip(nx, to), 700);
    board.animMerge(from, to, nx);
    const crown = CHAINS[ITEMS[nx].chain].items.slice(-1)[0] === nx && CHAINS[ITEMS[nx].chain].items.length > 2;
    if (crown) { sfx.crown(); haptic('medium'); } else { sfx.merge(ITEMS[nx].tier); haptic('light'); } floatText(to, ITEMS[nx].name, '#fff');
    stat('merge'); addXp(CONFIG.xp.perMerge); prog('merge', 1); tally('merge'); tally('make:' + nx); tutFire('merge');
    if (ITEMS[nx].tier >= 4) tally('tier4');
    if (ITEMS[nx].chain.startsWith('ev_')) evPts(ITEMS[nx].tier * 3, to);
    else if (ITEMS[nx].tier >= CFG.event.points.mergeFromTier) evPts(ITEMS[nx].tier - CFG.event.points.mergeFromTier + 1, to);
    if (!crown) maybeBubble(nx, to);
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
      `Blorp! She flies again — and the old wreck is picked clean, so it is gone${refund ? ` (I sold the leftovers: <b>+${refund} coins</b>)` : ''}. Now we need <b>FUEL</b>, and fuel ore only falls from the sky. Watch for <b>meteors</b>: each one leaves a crater you can dig. ${CONFIG.rocket.fuelToLaunch} Rocket Fuel and we go visit my moon! It is rare stuff, so keep every drop.`,
      'Bring on the meteors!');
    renderRocket(); renderHUD(); save();
  }
  function addFuel(i: number) {
    const b = B(); if (!b[i] || b[i].id !== 'rocketfuel') return;
    b[i] = null; S.fuel++;
    paintCell(i); board.consume(i, 'rocketfuel'); sparkle(i, 16, '#b6ffd2'); sfx.fuel(); haptic('medium');
    toast('⛽ Rocket Fuel loaded! ' + S.fuel + '/' + CONFIG.rocket.fuelToLaunch);
    prog('fuelm', 1);
    if (S.fuel >= CONFIG.rocket.fuelToLaunch) setTimeout(() => { toast(allParts() ? 'Tank is FULL! Open 🗺️ Map and launch!' : 'Tank is FULL! Now finish the rocket.'); }, 900);
    renderRocket(); renderHUD(); save();
  }
  /* The trophy shelf: a crowned item can be retired to the Album. It frees the
     tile, pays a little XP and a gem, and the shelf remembers how many you made. */
  function showcase(i: number) {
    const b = B(), c = b[i]; if (!c || !c.id || nextOf(c.id)) return;
    const d = ITEMS[c.id];
    S.trophy = S.trophy || {}; S.trophy[c.id] = (S.trophy[c.id] || 0) + 1;
    b[i] = null; sel = null; board.setSelected(null); hideInfo();
    flyTo(cellXY(i), $('#tabBook'), ART.item(c.id), 1, { size: 44 });
    addGems(1); addXp(d.tier * 2); sfx.discover(); sparkle(i, 18, '#ffe07a');
    toast(`🏆 <b>${d.name}</b> is on your trophy shelf! +1 💎`);
    paintBoard(); renderHUD(); renderOrders(); save();
  }
  /** selling is a clear-out, not an income: it pays on a square-root curve, so a crown is a few dozen coins, not hundreds */
  const sellOf = (id: string) => Math.max(1, Math.round(Math.sqrt(ITEMS[id].sell) * 2));
  function sellItem(i: number) {
    const b = B(), c = b[i]; if (!c || !c.id) return;
    const wanted = S.orders.some(o => o.needs.some(nd => nd.id === c.id));
    if (wanted) { sfx.no(); toast('Someone ordered that! Keep it.'); return; }
    const got = sellOf(c.id);
    S.coins += got; sfx.sell();
    floatText(i, '+' + got, '#ffe07a'); flyCoins(cellXY(i), got);
    const sold = { i, id: c.id, coins: got, w: S.world };
    b[i] = null; sel = null; tally('sell'); paintCell(i); renderHUD(); renderOrders(); save();
    showUndo(sold);
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
      B()[spot] = mkProd('crater'); S.sawCrater = 1;
      const s2 = nearFree(spot); if (s2 >= 0) { B()[s2] = { id: 'scrap' }; gotItem('scrap'); }
      paintBoard(); prog('meteor', 1);
      modal('bloop', 'Blorp! Hello!', 'That was not a meteor. That was me, Dr. Zonk. I parked badly.<br><b>Dig my crater</b> for Star Scrap!', 'Welcome?');
      checkStory('met');
      renderHUD(); renderRocket(); save();
    }), 700);
  }
  /* A meteor is an event, not background noise: it is rare, it is announced, and
     it leaves a crater you dig for the two things nothing else gives you —
     Star Scrap for the lab and Fuel Ore for the rocket. Craters run dry. */
  /** after Stargazing Night the woods give up Dr. Zonk's ship, in pieces */
  function wreckStory() {
    if (S.wreck || allParts() || S.world !== 'earth') return;
    const spot = firstFree([21, 20, 15, 27, 26, 33]); if (spot < 0) return;
    S.wreck = 1;
    B()[spot] = mkProd('wreck');
    paintBoard(); sparkle(spot, 24, '#cfe4ff'); sfx.big();
    modal('bloop', 'Found it!', 'My ship! Mostly holes. <b>Tap the wreck</b> for parts and we fly to the Moon. Together. I insist.', 'Let’s build!');
    renderHUD(); renderRocket(); save();
  }
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
      toast(`💥 A <b>crater</b>! Dig it ${uses} times for Star Scrap${rocketTime() ? ' and Fuel Ore' : ''}.`);
      if (!S.sawCrater) {
        S.sawCrater = 1;

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
    toast('💡 These two match — drag one onto the other, or double-tap it!');
    setTimeout(() => { hintPair = null; board.setHint(null); }, 2400);
  }

  /* ============================================================== SCREENS */
  const SCREENS = ['shop', 'lab', 'rocket', 'book', 'map'];
  function setView(v: string) {
    if (v !== 'board') { hideInfo(); sel = null; board.setSelected(null); }   // the item bar belongs to the board
    if (v === 'fun') { if (view !== 'board') setView('board'); funPop(); return; }
    if (popOpen()) closePop();
    if (v === 'shop' && !shopOpen()) { sfx.no(); toast('The Star Bazaar opens at Level ' + CONFIG.unlocks.shopAtLevel + '!'); return; }
    if (v === 'lab' && !labOpen()) { sfx.no(); toast('The Lab opens in Meadow chapter 5 — keep restoring!'); return; }
    view = v;
    if (v !== 'board') { const rb = document.getElementById('ribbon'); if (rb && rb.className === 'show') rb.className = 'hide'; }
    if (v === 'map') { tutFire('world'); S.bloomSeen = essenceOnBoard(); }
    openBag(false);
    if (v !== view || v !== 'board') sfx.tab();
    SCREENS.forEach(k => $('#sc-' + k).classList.toggle('open', v === k));
    // over a painted scene the rail shrinks to little round pips, so it stops
    // standing on the scenery it floats over
    $('#app').classList.toggle('sceneOn', v === 'map');
    $('#app').classList.toggle('popOn', v !== 'board' && v !== 'map');
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
    partsLeft().forEach(k => { if (rocketTime()) { pool.push(CHAINS[k].items[0]); pool.push(CHAINS[k].items[1]); } });
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
  const shopNews = () => shopOpen() && (S.shop.at > (S.shop.seenAt || 0) || S.shop.gift !== dayKey(new Date()));

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
    if (!building()) { sfx.no(); toast(allParts() ? 'Nothing to salvage — the rocket is done!' : 'No rocket to salvage for yet.'); return; }
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
    S.lab.built = 1; S.sci += 10;
    sfx.build(); haptic('heavy'); confetti();
    prog('lab', 1);
    toast('🔬 Dr. Zonk\'s Lab is open! +10 🧪');
    setTimeout(() => setView('lab'), 600);
    paintBoard(); renderShop(); renderHUD(); renderOrders(); save();
  }
  function buyBooster(id: string) {
    const bo: any = SHOP.boosters.filter(x => x.id === id)[0]; if (!bo) return;
    if (bo.gems) { if (!spendGems(bo.gems, 'boost')) return; }
    else { if (S.coins < bo.price) { sfx.no(); toast('Not enough coins — that costs ' + bo.price + '.'); return; } spend(bo.price); }
    giveBoost(id);
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
  /* --------------------------------------------------------- feedback
     Testers write a line; the report carries what we need to reproduce it:
     build, device, where they are in the game, and the last errors caught. */
  function feedbackPop() {
    pop('✉️ Feedback', `<div class="fbWrap"><div class="noteLine">What was fun, what was confusing, what broke? One line is plenty.</div>
      <div class="fbMood">${['😍', '🙂', '😐', '🙁', '🐞'].map(m => `<button class="fbM" data-m="${m}">${m}</button>`).join('')}</div>
      <textarea id="fbText" rows="5" placeholder="e.g. I didn't know where to get Rocket Fins"></textarea>
      <button class="big" id="fbSend">${SERVICES.app.supportEmail ? 'Send by email' : 'Copy report'}</button>
      <div class="noteLine">Your game state and device type are attached. Nothing else.</div></div>`, 'fun');
    let mood = '';
    document.querySelectorAll<HTMLElement>('.fbM').forEach(b => b.onclick = () => { mood = b.dataset.m || ''; document.querySelectorAll('.fbM').forEach(x => x.classList.toggle('on', x === b)); sfx.tap(); });
    ($('#fbSend') as HTMLElement).onclick = async () => {
      const txt = (($('#fbText') as HTMLTextAreaElement).value || '').trim();
      const pj = curProject();
      const body = [mood + ' ' + txt, '', '---',
        `build ${SERVICES.app.build} · ${isNative ? 'app' : 'web'} · ${navigator.userAgent}`,
        `screen ${innerWidth}×${innerHeight} @${devicePixelRatio}`,
        `world ${S.world} · level ${S.lvl} · world level ${wlv()} · chapter ${pj ? pj.id + ' ' + pj.name : 'done'}`,
        `energy ${S.energy} · coins ${S.coins} · gems ${S.gems} · played ${Math.round((S.playMs || 0) / 60000)} min`,
        'errors: ' + (errLog().slice(-5).join(' | ') || 'none')].join('\n');
      analytics.track('feedback', { mood });
      if (SERVICES.app.supportEmail) {
        location.href = `mailto:${SERVICES.app.supportEmail}?subject=${encodeURIComponent('Galaxy Adventure feedback ' + mood)}&body=${encodeURIComponent(body)}`;
      } else {
        try { await navigator.clipboard.writeText(body); toast('Report copied — paste it in a message to the developer. Thank you!'); }
        catch { toast('Could not copy — take a screenshot instead. Thank you!'); }
      }
      closePop();
    };
  }
  const errLog = (): string[] => { try { return JSON.parse(localStorage.getItem('mr_err') || '[]'); } catch { return []; } };
  const logErr = (m: string) => { try { const l = errLog(); l.push(new Date().toISOString().slice(5, 16) + ' ' + m.slice(0, 160)); localStorage.setItem('mr_err', JSON.stringify(l.slice(-20))); } catch { } };
  window.addEventListener('error', e => logErr(e.message || String(e)));
  window.addEventListener('unhandledrejection', (e: any) => logErr('promise: ' + (e.reason && e.reason.message || e.reason)));

  /* ------------------------------------------------ shop: gift, energy, chests */
  const today = () => dayKey(new Date());
  const giftReady = () => S.shop.gift !== today();
  const refillsToday = () => (S.shop.refill && S.shop.refill.day === today() ? S.shop.refill.n : 0);
  const refillPrice = () => CFG.shop2.energyRefill.base + CFG.shop2.energyRefill.step * refillsToday();
  function claimGift() {
    if (!giftReady()) { sfx.no(); toast('Come back tomorrow for the next gift!'); return; }
    S.shop.gift = today();
    S.giftAd = today();
    save(); renderShop();
    rewardCard('blorb', 'Daily delivery!', '<b>Postie Blorb:</b> "Parcel! Sign here. Any leg. Phew."',
      { item: 'chest', energy: CFG.shop2.freeGiftEnergy }, () => renderShop());
  }
  function buyRefill() {
    const price = refillPrice();
    if (S.coins < price) { sfx.no(); toast('Not enough coins — that costs ' + price + '.'); return; }
    spend(price);
    S.shop.refill = { day: today(), n: refillsToday() + 1 };
    S.energy += CFG.shop2.energyRefill.amount; bumpChip('#chipEnergy');
    sfx.boost(); haptic('light');
    toast(`⚡ +${CFG.shop2.energyRefill.amount} energy!`);
    renderShop(); renderHUD(); save();
  }
  function buyChest(id: string) {
    const price = CFG.shop2.chestGems[id];
    if (!freeCells().length) { sfx.no(); toast('No room on the board! Merge something first.'); return; }
    if (!spendGems(price, 'chest')) return;
    giveItem(id);
    sfx.coin(); toast(`📦 A <b>${ITEMS[id].name}</b> is on your board — tap it to open!`);
    renderShop(); renderHUD(); save();
  }
  let shopTab = 'deals';
  function renderShop() {
    const host = $('#shopBody'); if (!host) return;
    $('#shopCoins').textContent = S.coins;
    const coin = ART.icon('coin');
    const card = (art: string, name: string, desc: string, btn: string, cls = '') =>
      `<div class="sCard ${cls}"><div class="sCArt">${art}</div><div class="sCName">${name}</div><div class="sCDesc">${desc}</div>${btn}</div>`;
    const tabs = [['deals', '🎁 Deals'], ['gems', '💎 Gems'], ['coins', '🪙 Coins'], ['chests', '📦 Chests'], ['boost', '✨ Boosters'], ['up', '⭐ Upgrades']];
    const rocketBits = (labOffered() && !S.lab.built) || S.seen.scrap;
    if (rocketBits) tabs.push(['rocket', '🚀 Rocket']);
    let html = `<div class="shopTabs">${tabs.map(([k, t]) => `<button class="sTab${shopTab === k ? ' on' : ''}" data-jump="${k}">${t}</button>`).join('')}</div>`;

    // deals: the daily gift, energy, and the rotating shelf
    html += `<div class="sSec" id="sh-deals"><div class="sSecT">${ART.uiIcon('sec_deals', '🎁')} Today's deals</div><div class="shopGrid">`
      + card(ART.spriteUi('chest_closed') ? ART.uiIcon('chest_closed', '') : ART.item('chest'), 'Daily gift', `A Supply Chest and ${CFG.shop2.freeGiftEnergy} ${ART.icon('energy')}`,
        `<button class="buyBtn green" data-gift="1" ${giftReady() ? '' : 'disabled'}>${giftReady() ? 'FREE' : 'Tomorrow'}</button>`, giftReady() ? 'hot' : '')
      + (S.giftAd === today() && S.giftAd2 !== today() ? card(ART.item('chest'), 'Double the gift', 'Watch a video for another chest',
        `<button class="buyBtn green" data-giftad="1">📺 Watch</button>`, 'hot') : '')
      + card(ART.icon('energy'), 'Energy refill', `+${CFG.gems.refill.energy} ⚡ right now`,
        `<button class="buyBtn gem" data-refill="1" ${S.gems < CFG.gems.refill.gems ? 'disabled' : ''}>${ART.icon('gem')}${CFG.gems.refill.gems}</button>`)
      + `</div><div class="noteLine">${ART.uiIcon('offer_timer', '🔄')} The free gift resets every day</div></div>`;

    html += `<div id="sh-gems">${gemsShop()}</div>`;
    html += coinShop();
    html += `<div class="sSec" id="sh-chests"><div class="sSecT">${ART.uiIcon('sec_chests', '📦')} Chests</div><div class="shopGrid">`
      + ['chest', 'bigchest'].map(id => card(ART.item(id), ITEMS[id].name,
        `${CFG.chest[id].items} things from this world${CFG.chest[id].coins ? ' + ' + CFG.chest[id].coins + ' coins' : ''}`,
        `<button class="buyBtn gem" data-chestbuy="${id}" ${S.gems < CFG.shop2.chestGems[id] ? 'disabled' : ''}>${ART.icon('gem')}${CFG.shop2.chestGems[id]}</button>`)).join('')
      + `</div><div class="noteLine">Two Supply Chests merge into a Treasure Chest.</div></div>`;

    html += `<div class="sSec" id="sh-boost"><div class="sSecT">${ART.uiIcon('sec_boost', '✨')} Boosters</div><div class="shopGrid">`
      + SHOP.boosters.map(bo => card(ART.icon(bo.icon) + (boostN(bo.id) ? `<span class="stock">x${boostN(bo.id)}</span>` : ''), bo.name, bo.desc,
        bo.gems ? `<button class="buyBtn gem" data-boost="${bo.id}" ${S.gems < bo.gems ? 'disabled' : ''}>${ART.icon('gem')}${bo.gems}</button>`
          : `<button class="buyBtn" data-boost="${bo.id}" ${S.coins < bo.price ? 'disabled' : ''}>${coin}${bo.price}</button>`)).join('')
      + `</div><div class="noteLine">Boosters wait in the row above the board.</div></div>`;

    html += `<div class="sSec" id="sh-up"><div class="sSecT">${ART.uiIcon('sec_up', '⭐')} Permanent upgrades</div>
      ${SHOP.upgrades.map(u => {
      const lv = upLv(u.id), maxed = lv >= u.max, price = upPrice(u), poor = S.coins < price;
      return `<div class="shopRow"><div class="sArt">${ART.icon(u.icon)}</div>
          <div class="sInfo"><div class="sName">${u.name}</div><div class="sDesc">${u.desc}</div>
            <div class="pips">${Array.from({ length: u.max }, (_, n) => `<i class="pip${n < lv ? ' on' : ''}"></i>`).join('')}</div></div>
          <button class="buyBtn${maxed ? ' maxed' : ''}" data-up="${u.id}" ${maxed || poor ? 'disabled' : ''}>${maxed ? 'MAX' : coin + price}</button></div>`;
    }).join('')}</div>`;

    if (rocketBits) {
      let r = `<div class="sSec" id="sh-rocket"><div class="sSecT">${ART.uiIcon('sec_rocket', '🚀')} Rocket &amp; lab</div>`;
      if (labOffered() && !S.lab.built) {
        const bd = CONFIG.lab.build, have = countItem(bd.item);
        r += `<div class="shopRow"><div class="sArt">${ART.icon('flask')}</div>
          <div class="sInfo"><div class="sName">Build the Research Lab</div>
            <div class="sDesc">Invent relics that no amount of merging can make.</div>
            <div class="buildNeed"><span class="${have >= bd.qty ? 'ok' : ''}">${ART.item(bd.item)}${have}/${bd.qty}</span>
              <span class="${S.coins >= bd.coins ? 'ok' : ''}">${coin}${bd.coins}</span></div></div>
          <button class="buyBtn green" id="btnBuildLab">BUILD</button></div>`;
      }
      if (false) r += DEPOT.map((d, k) => `<div class="shopRow"><div class="sArt">${ART.item(d.id)}</div>
          <div class="sInfo"><div class="sName">${ITEMS[d.id].name}</div><div class="sDesc">${d.note}</div></div>
          <button class="buyBtn green" data-depot="${k}" ${S.coins < depotPrice(d) ? 'disabled' : ''}>${coin}${depotPrice(d)}</button></div>`).join('');
      if (false) r += SHOP.crates.map(c => `<div class="shopRow"><div class="sArt">${ART.icon(c.icon)}</div>
          <div class="sInfo"><div class="sName">${c.name}</div><div class="sDesc">${c.desc}</div></div>
          <button class="buyBtn green" data-crate="${c.id}" ${S.coins < c.price ? 'disabled' : ''}>${coin}${c.price}</button></div>`).join('');
      if (S.seen.scrap) r += `<div class="pouchRow">Star Pouch: ${ART.item('scrap')}<b>${pouch('scrap')}</b> Scrap · ${ART.item('starcore')}<b>${pouch('starcore')}</b> Cores</div>`;
      if (S.seen.scrap) r += CONFIG.forge.map(f => {
        const ok = countItem(f.item) >= f.qty;
        return `<div class="shopRow"><div class="sArt">${ART.icon(f.icon)}</div>
          <div class="sInfo"><div class="sName">${f.name}</div><div class="sDesc">${f.desc}</div></div>
          <button class="buyBtn" data-forge="${f.id}"><span class="cost${ok ? ' ok' : ''}">${ART.item(f.item)}${f.qty}</span></button></div>`;
      }).join('');
      r += '</div>';
      // the lab build is the one thing here you are waiting for, so it goes first
      if (labOffered() && !S.lab.built) { const cut = html.indexOf('<div class="sSec"'); html = html.slice(0, cut) + r + html.slice(cut); }
      else html += r;
    }

    host.innerHTML = html.replace(/(?<=[>\s\d])⚡/g, ART.icon('energy')).replace(/(?<=[>\s\d])💎/g, ART.icon('gem')).replace(/(?<=[>\s\d])🪙/g, ART.icon('coin'));
    host.querySelectorAll('[data-jump]').forEach((b: any) => b.onclick = () => {
      shopTab = b.dataset.jump;
      host.querySelectorAll('.sTab').forEach((t: any) => t.classList.toggle('on', t === b));
      const sec = $('#sh-' + shopTab); if (sec) host.scrollTo({ top: sec.offsetTop - 50, behavior: 'smooth' });
    });
    host.querySelectorAll('[data-gift]').forEach((b: any) => b.onclick = claimGift);
    host.querySelectorAll('[data-giftad]').forEach((b: any) => b.onclick = () => watchAd('gift', () => { S.giftAd2 = today(); giveItem('chest'); sfx.boost(); toast('🎁 Another Supply Chest!'); renderShop(); paintBoard(); save(); }));
    host.querySelectorAll('[data-iap]').forEach((b: any) => b.onclick = () => buyProduct(b.dataset.iap));
    host.querySelectorAll('[data-coingem]').forEach((b: any) => b.onclick = () => buyCoinsGems(+b.dataset.coingem));
    const rs = document.getElementById('iapRestore');
    if (rs) rs.onclick = async () => {
      const ids = await iap.restore();
      let n = 0;
      ids.forEach(id => { const p = PRODUCTS.find(x => x.id === id); if (p && p.once && !S.bought[id]) { S.bought[id] = 1; if (p.adfree) S.adfree = 1; n++; } });
      toast(iap.live ? (n ? `Restored ${n} purchase${n > 1 ? 's' : ''}.` : 'Nothing to restore on this account.') : 'Test mode — there is no store account to restore from yet.');
      renderShop(); save();
    };
    { const gc = $('#gemChest'); if (gc) gc.onclick = () => { if (spendGems(CFG.gems.galaxyChest, 'chest')) { giveItem('bigchest'); giveBoost('wand'); giveBoost('bomb'); sfx.discover(); toast('🌌 Galaxy Chest: a Treasure Chest and 2 boosters!'); paintBoard(); renderShop(); save(); } }; }
    { const gr = $('#gemRefill'); if (gr) gr.onclick = () => { gemRefill(); renderShop(); }; }
    if (shopTab === 'gems') setTimeout(() => { const sec = $('#sh-gems'); if (sec) host.scrollTo({ top: sec.offsetTop - 50 }); }, 50);
    host.querySelectorAll('[data-refill]').forEach((b: any) => b.onclick = () => { gemRefill(); renderShop(); });
    host.querySelectorAll('[data-chestbuy]').forEach((b: any) => b.onclick = () => buyChest(b.dataset.chestbuy));
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
    if (POUCH.includes(id) && pouch(id) > 0) { S.wal[id]--; return; }
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
      toast('💨 Pfft — those two do not react.' + (clue ? ' But Dr. Zonk spotted a clue!' : ''));
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
    if (S.coins < price) { sfx.no(); toast('Dr. Zonk wants ' + price + ' coins for that hint.'); return; }
    spend(price); S.lab.disc[id] = 1;
    sfx.coin();
    toast('📘 Recipe bought: <b>' + ITEMS[r.result].name + '</b>');
    renderLab(); renderHUD(); save();
  }
  /* ================================================================= THE LAB
     A room, not a form. The bench slots sit on the painted counter, the book
     lives on the shelf, and the rumours are a pop-up — the same way the camp
     works, so the two painted screens feel like the same game. */
  const LAB_PAD_DEFAULT = {
    a: [0.255, 0.545], b: [0.435, 0.552], out: [0.645, 0.545],
    book: [0.275, 0.325], scope: [0.90, 0.50],
  };
  /** a painted scene carries its own plinth positions (sprites/scenes/anchors.json);
   *  the built-in backdrop keeps the defaults it was measured for */
  const sceneAnchors = (k: string): any => (ART.spriteScene(k) && (SCENE_ANCHORS as any)[k]) || {};
  const labPad = () => ({ ...LAB_PAD_DEFAULT, ...sceneAnchors('lab') });
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
  function renderFusion() {
    const host = $('#labBody'); if (!host) return;
    pruneSlots();
    const a = S.lab.slots[0], b = S.lab.slots[1];
    const r = a && b ? recipeFor(a, b) : null;
    const knew = !!(r && S.lab.disc[r.id]);
    const ready = !!(a && b);
    const cost = knew ? r!.coins : CONFIG.lab.failFee;
    const known = RECIPES.filter(r2 => S.lab.disc[r2.id]);
    const blind = RECIPES.filter(r2 => !S.lab.disc[r2.id]);

    host.innerHTML = `<div class="sceneWrap lab">
      <div class="sceneBlur"></div><div class="sceneImg"></div><div class="sceneVig"></div>
      <div class="sceneBtns"><button class="sceneBtn" data-labpop="book">📘</button>
        ${blind.length ? `<button class="sceneBtn" data-labpop="rumours">❓</button>` : ''}</div>
      ${labSpot('s0', labPad().a, a ? ART.item(a) : SOCKET,
        a ? ITEMS[a].name : 'Sample A', a ? 'tap to swap' : 'tap to load', a ? 'filled' : 'empty')}
      ${labSpot('s1', labPad().b, b ? ART.item(b) : SOCKET,
        b ? ITEMS[b].name : 'Sample B', b ? 'tap to swap' : 'tap to load', b ? 'filled' : 'empty')}
      ${labSpot('out', labPad().out, knew ? ART.item(r!.result) : SOCKET_Q,
        knew ? ITEMS[r!.result].name : 'Result', knew ? 'known recipe' : 'unknown', knew ? 'ready' : 'empty')}
      ${labSpot('book', labPad().book, ART.icon('blueprint'), 'Lab book', known.length + '/' + RECIPES.length)}
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
      <div class="noteLine">Buy a rumour and Dr. Zonk writes the whole recipe down for you.</div>`, 'Close');
    setTimeout(() => document.querySelectorAll('[data-learn]').forEach((e: any) =>
      e.onclick = () => { closeModal(); buyRecipe(e.dataset.learn); }), 30);
  }
  /* ============================================================ VAULT TAB
     What used to be the Rocket tab. The rocket itself now lives in your camp,
     where you can see it being built, so this is the progression drawer: the
     rotating task board, the relic perks and the star favours. */
  function renderRocket() {
    const host = $('#rocketBody'); if (!host) return;
    const ar = achReady(), ql = questsLeft();
    const tile = (id: string, ic: string, emo: string, t: string, sub: string, hot: boolean) =>
      `<button class="mlTile${hot ? ' hot' : ''}" id="${id}"><span class="mlIc">${ART.uiIcon(ic, emo)}</span><b>${t}</b><i>${sub}</i>${hot ? '<em class="dot"></em>' : ''}</button>`;
    host.innerHTML = projectCard()
      + `<div class="mlTiles">
          ${tile('openAch', 'ic_medals', '🏆', 'Medals', ar ? ar + ' to claim!' : 'long-term goals', !!ar)}
          ${tile('openQuests', 'ic_cadet', '🎯', 'Cadet Training', ql ? (MISSIONS.length - ql) + '/' + MISSIONS.length + ' done' : 'all done ✓', false)}
          ${S.seen.relic1 || labOpen() ? tile('openVault', 'ic_vault', '🏛️', 'Relic Vault', 'perks forever', false) : ''}
        </div>`
      + (projDone('earth') >= 3 ? weeklyCard() : '')
      + dailyCard();
    host.querySelectorAll('[data-wk]').forEach((b: any) => b.onclick = () => wkClaim(+b.dataset.wk));
    { const wb = $('#wkBoard'); if (wb) wb.onclick = wkBoard; }
    host.querySelectorAll('[data-dchest]').forEach((b: any) => b.onclick = () => claimDaily(+b.dataset.dchest));
    host.querySelectorAll('.pNeed[data-need]').forEach((n: any) => n.onclick = () => chainPanel(n.dataset.need));
    const bp = $('#btnProject'); if (bp) bp.onclick = buildProject;
    const bt = $('#btnTalk'); if (bt) bt.onclick = () => chapterIntro(true);
    const q = $('#openQuests'); if (q) q.onclick = questPanel;
    const oa = $('#openAch'); if (oa) oa.onclick = achPop;
    const ov = $('#openVault'); if (ov) ov.onclick = () => {
      pop('🏛️ Relic Vault', vaultCard(), 'vault');
      $('#popBody').querySelectorAll('[data-vault]').forEach((b: any) => b.onclick = () => { vaultBuy(b.dataset.vault); ov.click(); });
    };
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
    return `<div class="card vault"><div class="cardTitle">${ART.uiIcon('sec_vault', '🏛️')} Relic Vault</div>
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
  /* ------------------------------------------------------------ the album
     One tile per chain, not a wall of rows: the best thing you have made so
     far, how many of the steps you have found, and a lock with the level if it
     is still asleep. Tap a tile for the whole chain and where it comes from. */
  let albumWorld = '';
  function renderBook() {
    const host = $('#bookBody');
    if (!albumWorld || !visited(albumWorld)) albumWorld = S.world;
    const total = ITEM_IDS.length, found = ITEM_IDS.filter(id => S.seen[id]).length;
    const worlds = WORLD_ORDER.filter(w => visited(w) || w === S.world);
    const tile = (k: string, locked?: number) => {
      const ch = CHAINS[k], known = ch.items.filter(id => S.seen[id]);
      const best = known.length ? known[known.length - 1] : ch.items[0];
      const done = known.length === ch.items.length;
      return `<button class="aTile${locked ? ' locked' : ''}${done ? ' done' : ''}" data-chain="${k}">
        <span class="aArt${known.length ? '' : ' unk'}">${known.length ? ART.item(best) : '?'}</span>
        <b>${ch.name}</b><i>${locked ? '🔒 lv ' + locked : done ? '★ complete' : known.length + '/' + ch.items.length}</i></button>`;
    };
    const here = Object.keys(CHAINS).filter(k => CHAINS[k].world === albumWorld);
    const awake = albumWorld === S.world ? liveChains() : here.filter(k => CHAINS[k].items.some(id => S.seen[id]));
    const shared = Object.keys(CHAINS).filter(k => {
      const w = CHAINS[k].world;
      if (k === 'relic') return !!(S.seen.relic1 || labOpen());
      if (k === 'wild') return !!S.seen.rainbow;
      if (k === 'bloom') return !!S.seen.bloomspark;
      if (w === 'ship') return rocketTime();
      return w === 'any' && CHAINS[k].items.some(id => S.seen[id]);
    });
    host.innerHTML = discCard() +
      `<div class="card"><div class="cardTitle">${ART.uiIcon('sec_collection', '🗂️')} Collection <span class="pCount">${found}/${total}</span></div>
        <div class="catBar"><i style="width:${Math.round(found / total * 100)}%"></i></div>
        <div class="noteLine">Everything you have ever made is kept here. Tap a chain to see all its steps and where it starts.</div></div>
      ${Object.keys(S.trophy || {}).length ? `<div class="card"><div class="cardTitle">${ART.uiIcon('ic_trophy', '🏆')} Trophy shelf <span class="pCount">${Object.values(S.trophy).reduce((a: number, n: any) => a + n, 0)}</span></div>
        <div class="trophyRow">${Object.entries(S.trophy).map(([id, n]: [string, any]) => `<span class="trophy">${ART.item(id)}${n > 1 ? `<em>×${n}</em>` : ''}</span>`).join('')}</div></div>` : ''}
      <div class="shopTabs">${worlds.map(w => `<button class="sTab${w === albumWorld ? ' on' : ''}" data-aw="${w}">${WORLDS[w].name}</button>`).join('')}</div>
      <div class="aGrid">${here.map(k => tile(k, awake.indexOf(k) < 0 && !CHAINS[k].items.some(id => S.seen[id]) ? CHAINS[k].unlock : 0)).join('')}</div>
      ${shared.length ? `<div class="sSecT" style="margin-top:12px">✨ Everywhere</div><div class="aGrid">${shared.map(k => tile(k)).join('')}</div>` : ''}`;
    const cd = $('#claimDisc'); if (cd) cd.onclick = () => claimDisc();
    const cda = $('#claimDiscAd'); if (cda) cda.onclick = () => watchAd('disc', () => claimDisc(2));
    host.querySelectorAll('[data-aw]').forEach((b: any) => b.onclick = () => { albumWorld = b.dataset.aw; sfx.tap(); renderBook(); });
    host.querySelectorAll('[data-chain]').forEach((b: any) => b.onclick = () => {
      const ch = CHAINS[b.dataset.chain], known = ch.items.filter(id => S.seen[id]);
      sfx.tap(); chainPanel(known.length ? known[known.length - 1] : ch.items[0]);
    });
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
  const bagCap = () => 2 + (upLv('bag') + vaultLv('deep')) * CONFIG.upgrades.bagPerStep + res('pocket') * 2;
  const bagHas = () => bagCap() > 0;
  /** the 📦 button: the bag, and any producers waiting in storage */
  function renderStore() {
    const n = (S.bag || []).length + stored().length, e = $('#storeN');
    if (e) { e.textContent = n ? String(n) : ''; e.style.display = n ? '' : 'none'; }
  }
  function storeTap() {
    if (stored().length && !(S.bag || []).length) { storagePop(); return; }
    openBag();
  }
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
    $('#bagTitle').innerHTML = `📦 Storage <span style="color:#9a7a4e;font-weight:600">${S.bag.length}/${cap}</span>`
      + (stored().length ? ` <button class="buyBtn green trayProd" id="trayProd">${stored().length} starter${stored().length > 1 ? 's' : ''}</button>` : '');
    { const tp = $('#trayProd'); if (tp) tp.onclick = () => { openBag(false); storagePop(); }; }
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
    toast('🧲 The magnet pulled together <b>' + merged + '</b> pair' + (merged > 1 ? 's' : '') + '!');
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
      coins += sellOf(c.id); n++;
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
    // the helpers live in their own column on the right, mirroring the widgets on the left
    const col = $('#sideR'); if (col && host.parentElement !== col) col.appendChild(host);
    const keep = ['btnSnack', 'btnHint'].map(id => $('#' + id));
    host.querySelectorAll('.toolBtn').forEach((e: any) => e.remove());
    // boosters live in one toolbox: each opens with what it does before you use it
    const owned = SHOP.boosters.reduce((a, bo) => a + boostN(bo.id), 0);
    if (owned > 0) {
      const btn = el('button', 'toolBtn toolbox');
      btn.innerHTML = ART.uiIcon('ic_toolbox', ART.icon('wand')) + `<span class="n">${owned}</span>`;
      btn.title = 'Boosters';
      btn.onclick = () => toolsPop();
      host.appendChild(btn);
    }
    keep.forEach(k => k && host.appendChild(k));
  }

  function toolsPop() {
    pop(ART.uiIcon('ic_toolbox', '🧰') + ' Boosters', `<div class="toolList">${SHOP.boosters.map(bo => `<div class="enRow">
        <span class="enIc">${ART.icon(bo.icon)}</span><div><b>${bo.name} ×${boostN(bo.id)}</b><i>${bo.desc}</i></div>
        <button class="buyBtn" data-boost-use="${bo.id}"${boostN(bo.id) ? '' : ' disabled'}>Use</button></div>`).join('')}</div>
      <div class="noteLine">Get more in the 🛒 Shop, the 🎡 wheel and events.</div>`, 'energy');
    document.querySelectorAll<HTMLElement>('[data-boost-use]').forEach(b => b.onclick = () => { closePop(); useBoost(b.dataset.boostUse as string); });
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
    // merging never pays coins — a combo pays XP (and event points while one runs)
    const xp = Math.min(3, (cfg.xpPerStep || 1) * step);
    addXp(xp); flyXp(cellXY(cell), 150);
    sfx.streak(Math.min(step, 5));
    floatText(cell, 'COMBO ×' + S.streak + '  +' + xp + ' XP', '#ffe07a');
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
    toast('🛸 An alien <b>Star Freighter</b> landed! Fill its hold before it lifts off.');
    renderOrders();
  }
  function shipTick(now: number) {
    if (S.lvl < CONFIG.ship.firstAtLevel || (scripted() && projDone() < 6)) return;
    if (S.ship) {
      if (now > S.ship.endsAt) {
        S.ship = null; S.shipAt = now + CONFIG.ship.everyMs;
        toast('🛸 The Star Freighter lifted off without you.');
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
      toast('The freighter still needs ' + short.map((nd: any) => `${nd.qty}× <b>${ITEMS[nd.id].name}</b>`).join(', '));
      return;
    }
    const b = B();
    sh.needs.forEach((nd: any) => { let left = nd.qty; for (let i = 0; i < N && left; i++) if (b[i] && b[i].id === nd.id) { b[i] = null; left--; sparkle(i, 10, '#ffe9a8'); } });
    S.coins += sh.coins; bumpChip('#chipCoins');
    giveBoost(rnd(['wand', 'bomb', 'rainbow']));
    S.ship = null; S.shipAt = Date.now() + CONFIG.ship.everyMs;
    sfx.big(); haptic('heavy'); confetti(); audio.duck(2, 0.2);
    toast('🛸 Hold full! The Grub Brothers pay <b>+' + sh.coins + '</b> coins and a booster!');
    addXp(sh.xp);
    prog('ship', 1);
    paintBoard(); renderOrders(); renderHUD(); renderTools(); save();
  }

  /* ========================================================== ANTI-SOFTLOCK
     A full board with no possible merge is the one state a merge game must
     never leave a player in. Dr. Zonk turns up and clears the cheap clutter. */
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
    toast('🧹 Dr. Zonk cleared ' + take + ' bits and left you <b>' + coins + '</b> coins.');
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
    setAfter(rescue);
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
  const PMAX = 3;                                   // upgrade levels per producer (older saves may hold a 4)
  const plv = (c: any) => (c && c.lv) || 1;
  /** what one tap on an energy producer costs. It climbs, but gently: one more
   *  every two levels, so a maxed producer is twice the price and several tiers
   *  better. Anything steeper and upgrading feels like a punishment. */
  const ecost = (p: any, lv: number) =>
    Math.max(1, (p.cost || 1) + Math.floor((lv - 1) / 2) - (starPerk('lantern') ? 0 : 0));
  /** charges at this level; the Lantern constellation makes every battery bigger */
  const capOf = (p: any, lv: number) =>
    Math.round(((p.cap || 12) + (lv - 1) * 5) * (starPerk('lantern') ? 1.2 : 1));
  /* An upgraded producer mostly drops what it always did. Now and then a drop
     comes one step up its chain (two at the top level, rarely), and never past
     tier 4 or the last two steps of a chain: upgrading means a fuller battery
     and a little luck, not a board full of finished things. */
  const upCapTier = (ch: string, top: number) => Math.max(top, Math.min(4, CHAINS[ch].items.length - 2));
  function rollDrop(p: any, lv: number): string {
    const base = rnd(p.drops) as string;
    if (lv <= 1) return base;
    const it = ITEMS[base]; if (!it || it.part) return base;
    const r = Math.random();
    const up = lv >= 3 ? (r < 0.04 ? 2 : r < 0.18 ? 1 : 0) : (r < 0.1 ? 1 : 0);
    if (!up) return base;
    const ids = CHAINS[it.chain].items, t = Math.min(it.tier + up, upCapTier(it.chain, it.tier));
    return ids[t - 1] || base;
  }
  /** everything a producer can hand out at this level (for the info panels) */
  function dropsOf(p: any, lv: number): string[] {
    const out = p.drops.slice();
    if (lv <= 1) return out;
    const top: Record<string, number> = {};
    p.drops.forEach((d: string) => { const it = ITEMS[d]; if (it && !it.part) top[it.chain] = Math.max(top[it.chain] || 0, it.tier); });
    Object.keys(top).forEach(ch => {
      const ids = CHAINS[ch].items, cap = upCapTier(ch, top[ch]);
      for (let t = top[ch] + 1; t <= Math.min(top[ch] + lv - 1, cap); t++) if (ids[t - 1] && out.indexOf(ids[t - 1]) < 0) out.push(ids[t - 1]);
    });
    return out;
  }
  /** upgrades get dearer the later a producer arrives in the story */
  /** a chapter can hand out several producers at once (a new "wave") */
  const unlocksOf = (pj: any): string[] => pj && pj.unlock ? [].concat(pj.unlock) : [];
  function upBase(p: any) {
    if (p.upCost) return p.upCost;
    for (const w of WORLD_ORDER) {
      const k = projList(w).findIndex((pj: any) => unlocksOf(pj).includes(p.id));
      if (k >= 0) return 60 + 20 * (k + 1);
    }
    return 120;
  }
  const upCost = (p: any, lv: number) => Math.round(upBase(p) * Math.pow(2.1, lv - 1) / 10) * 10;
  /** how long a producer at max level keeps going before it goes to seed */
  const RETIRE_AT = 45;

  /** out of charges — offer the impatient player a way through, for energy */
  function offerRecharge(i: number) {
    const c = B()[i], p = PRODS[c.p], cap = capOf(p, plv(c));
    const per = Math.max(1, Math.round(cap / 4));         // a quarter tank
    const cost = 12;
    const full = mmss(evOf(p, c) * cap);
    void per; void cost;
    // a producer refills by waiting, or now for gems or a video — never coins or energy
    modal(W().folks[0] || 'bloop', p.name + ' is empty',
      `<div class="rcArt">${ART.uiIcon('ic_recharge', '')}</div>Full again in about <b>${full}</b> (it fills while the game is shut, too).`
      + `<button class="big gold" id="rechargeGem">Fill it up · 💎 3</button>` + adBtn('recharge', 'Fill it up', 'rechargeAd'),
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
      const fill = () => { const cc = B()[i]; if (cc && cc.p) { cc.ch = capOf(PRODS[cc.p], plv(cc)); cc.at = Date.now(); sparkle(i, 18, '#8fe86d'); sfx.boost(); } closeModal(); paintBoard(); renderHUD(); save(); };
      const rg = $('#rechargeGem'); if (rg) rg.onclick = () => { if (spendGems(3, 'recharge')) fill(); };
      const ra = $('#rechargeAd'); if (ra) ra.onclick = () => { closeModal(); watchAd('recharge', fill); };
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
  /** the world level the next producer waits for */
  const nextAt = () => { const n = nextProducer(); const g = n && (W().grow || []).find(x => x.producer === n); return g ? g.atLevel : 0; };
  /* A new producer takes root when this world reaches its level — shown on the
     empty plot, so there is always a visible next thing to work towards. */
  function growProducers() {
    const b = B(), nxt = nextProducer();
    if (!nxt || wlv() < nextAt() || scripted()) return;
    if (b.some(c => c && c.p === nxt)) return;
    const g = (W().grow || []).find(x => x.producer === nxt);
    const i = firstFree(g ? g.cells : []);
    if (i < 0) return;
    b[i] = mkProd(nxt);
    plots().push(nxt);
    const p = PRODS[nxt];
    const chains = [...new Set(p.drops.map(d => CHAINS[ITEMS[d].chain].name))];
    paintBoard(); renderHUD(); save();
    producerReveal(nxt, i, 'Something new took root!', `${W().name} reached level ${wlv()}. It starts the <b>${chains.join('</b> and <b>')}</b> chain${chains.length > 1 ? 's' : ''}.`);
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
      perkBanner(ART.producer(PRODS.raincloud ? PRODS.raincloud.art : 'raincloud'), 'Star Shower!', `Glowing rain soaked the Meadow — <b>${n}</b> charge starter${n > 1 ? 's are' : ' is'} full again.`);
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
      perkBanner(ART.item(drops[0]), 'Eruption!', `The vents erupted — <b>${n}</b> hot rocks landed on your board.`);
    }
    // luna's low gravity is handled inside tryMerge, not on a timer
    renderOrders(); save();
  }
  /** a world moment: a card that drops in from the top, says what happened, and goes */
  function perkBanner(art: string, title: string, text: string) {
    let el = document.getElementById('perkBan');
    if (!el) { el = document.createElement('div'); el.id = 'perkBan'; $('#app').appendChild(el); }
    el.innerHTML = `<div class="pbArt">${art}</div><div class="pbTxt"><b>${title}</b><i>${text}</i></div>`;
    el.className = 'on'; haptic('light');
    clearTimeout((el as any)._t); (el as any)._t = setTimeout(() => { el!.className = ''; }, 3800);
    el.onclick = () => { el!.className = ''; };
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
    } else if (id === 'rainbowfuel') {
      giveBoost('rainbow'); toast('🌈 A <b>Rainbow Gem</b> is ready above the board!');
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
  /* ====================================================== V7: THE MAIN LOOP
     Contracts earn coins, coins and items build restoration projects, projects
     wake the world and open the way to the next one. Around that loop: daily
     tasks, visitors with temporary producers, bubbles and chests. */
  const CFG = CONFIG as any;

  /* --------------------------------------------------- restoration projects */
  const projList = (w?: string): any[] => ((WORLDS[w || S.world] as any).projects || []);
  const projDone = (w?: string) => (S.proj && S.proj[w || S.world]) || 0;
  const curProject = (w?: string) => projList(w)[projDone(w)] || null;
  const launchIdx = (w: string) => projList(w).findIndex((p: any) => p.launch);
  /** has this world's way off been repaired? (the last world has none) */
  const launchDone = (w: string) => { const i = launchIdx(w); return i < 0 || projDone(w) > i; };
  /* A chapter is earned, not just assembled: on top of its items it asks for a
     few contracts filled since the last one, rising slowly through the world. */
  /** contracts to deliver before a chapter can be built: the story gets steeper as you go — 3, then 5, 7 and 10 */
  const cNeed = (p?: any) => {
    const k = projDone(), n = projList().length || 50, f = k / n;
    if (p && p.launch) return 10;
    if (k < 2) return k + 1;                       // the first two chapters teach it
    return f < 0.24 ? 3 : f < 0.5 ? 5 : f < 0.8 ? 7 : 10;
  };
  const cHave = () => (S.cSince && S.cSince[S.world]) || 0;
  /* A new producer only comes once the ones you have are grown all the way:
     from chapter 6 on, a chapter that brings a producer asks for every one on
     the board (and in storage) at max level — except those it retires. */
  /* One producer upgrade at a time: every other chapter from chapter 6 asks
     for ONE step up on the oldest producer that is not maxed yet. The ask is
     remembered per chapter, so finishing it never reveals another one. */
  function upNeeds(p: any): { k: string; lv: number }[] {
    if (!p || !scripted()) return [];
    const k = projList().indexOf(p); if (k < 5 || k % 2 === 0) return [];
    S.upAsk = S.upAsk || {};
    const lvOf = (key: string) => { let lv = 0; B().forEach((c: any) => { if (c && c.p === key && !c.tmp) lv = Math.max(lv, plv(c)); }); stored().forEach((c: any) => { if (c.p === key) lv = Math.max(lv, c.lv || 1); }); return lv; };
    let ask = S.upAsk[p.id];
    if (!ask) {
      const order: string[] = [...W().start.map(x => x.producer), ...projList().flatMap(unlocksOf)];
      const cand = order.filter(key => !(p.retire || []).includes(key) && lvOf(key) > 0 && lvOf(key) < PMAX);
      if (!cand.length) return [];
      ask = S.upAsk[p.id] = { k: cand[0], lv: lvOf(cand[0]) + 1 };
    }
    const now = lvOf(ask.k);
    return now > 0 && now < ask.lv ? [{ k: ask.k, lv: now }] : [];
  }
  const projReady = (p: any) => !!p && p.needs.every(([id, q]: [string, number]) => countItem(id) >= q) && S.coins >= p.coins && !upNeeds(p).length
    && (!p.rocket || !!allParts()) && cHave() >= cNeed(p);
  const worldDone = (w?: string) => projList(w).length > 0 && projDone(w) >= projList(w).length;
  /** a world told as a story: its chapters hand out the producers, not its level */
  const scripted = (w?: string) => projList(w).some((p: any) => p.unlock || p.temp) && !worldDone(w);
  /* A new producer is a moment, not a sparkle: it rises in the middle of the
     screen on golden rays with what it makes underneath, then flies down onto
     its tile. Queued, so two at once play one after the other. */
  const revealQ: { k: string; i: number; title: string; line: string }[] = [];
  function producerReveal(k: string, i: number, title: string, line: string) {
    revealQ.push({ k, i, title, line });
    if (!document.getElementById('npw')?.classList.contains('open')) revealNext();
  }
  function revealNext() {
    const r = revealQ.shift(); if (!r) return;
    // wait for any dialog or story scene to finish first
    if (dialogBusy() || $('#talk').classList.contains('open') || document.getElementById('rwc')?.classList.contains('open')) { revealQ.unshift(r); setTimeout(revealNext, 700); return; }
    let el = document.getElementById('npw');
    if (!el) { el = document.createElement('div'); el.id = 'npw'; $('#app').appendChild(el); }
    const p = PRODS[r.k], drops = [...new Set(p.drops as string[])].slice(0, 3);
    el.innerHTML = `<div class="rwcRays"></div><div class="npCard"><div class="npTag">${r.title}</div>
      <div class="npArt" id="npArt">${ART.producer(p.art)}</div><b class="npName">${p.name}</b>
      <div class="npLine">${r.line}</div>
      <div class="npDrops">${drops.map(d => `<span>${ART.item(d)}</span>`).join('<i>·</i>')}</div>
      <button class="big" id="npGo">Place it!</button></div>`;
    el.className = 'open'; sfx.unlock(); haptic('medium');
    setTimeout(() => { const a = document.getElementById('npArt'); if (a) burst(a, 22); }, 350);
    ($('#npGo') as HTMLElement).onclick = () => {
      const art = $('#npArt') as HTMLElement, from = art.getBoundingClientRect(), to = cellXY(r.i);
      const fly = art.cloneNode(true) as HTMLElement; fly.className = 'npFly';
      Object.assign(fly.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
      document.body.appendChild(fly);
      el!.className = 'close';
      requestAnimationFrame(() => {
        const s2 = Math.max(0.2, (board.cellSize ? board.cellSize() : 60) * zk() / from.width);
        fly.style.transform = `translate(${to.x - from.left - from.width / 2}px, ${to.y - from.top - from.height / 2}px) scale(${s2})`;
      });
      sfx.whoosh();
      setTimeout(() => {
        fly.remove(); el!.className = ''; board.bump(r.i); sparkle(r.i, 26, '#ffe9a8'); sfx.build(); haptic('heavy'); confetti();
        setTimeout(revealNext, 500);
      }, 620);
    };
  }

  /** plant a producer the story has just given you, and say so */
  function plantProducer(k: string) {
    const b = B(); if (b.some(c => c && c.p === k) || stored().some((s: any) => s.p === k)) return;
    if (prodCount() >= capProd()) {
      // the story just handed you this one, so it goes on the board: the producer
      // nothing currently asks for steps into storage (📦) to make room
      const want = new Set<string>();
      const pj = curProject(); if (pj) pj.needs.forEach(([id]: [string, number]) => want.add(ITEMS[id].chain));
      S.orders.forEach(o => o.needs.forEach(nd => want.add(ITEMS[nd.id].chain)));
      const b2 = B(), cand: number[] = [];
      for (let j = 0; j < N; j++) if (counted(b2[j]) && b2[j].p !== 'tree') cand.push(j);
      const idle = cand.filter(j => !PRODS[b2[j].p].drops.some((d: string) => want.has(ITEMS[d].chain)));
      const out = (idle.length ? idle : cand)[0];
      if (out === undefined) { stored().push({ p: k, lv: 1 }); save(); renderQuick(); return; }
      const old = b2[out];
      stored().push({ ...old }); b2[out] = mkProd(k);
      if (plots().indexOf(k) < 0) plots().push(k);
      S.pendingPlant = null; paintBoard(); renderQuick(); save();
      producerReveal(k, out, 'New producer!', `Tap it on your board to get its items. The <b>${PRODS[old.p].name}</b> moved to storage (📦 above the board) to make room — swap it back any time.`);
      return;
    }
    const g = (W().grow || []).find(x => x.producer === k);
    let i = firstFree(g ? g.cells : []);
    if (i < 0) i = freeCells()[Math.floor(freeCells().length / 2)] ?? -1;
    if (i < 0) { toast('Make some room — the ' + PRODS[k].name + ' is waiting to be planted!'); S.pendingPlant = k; return; }
    b[i] = mkProd(k);
    if (plots().indexOf(k) < 0) plots().push(k);
    S.pendingPlant = null;
    paintBoard();
    producerReveal(k, i, 'New producer!', `Tap it on your board to get its items.`);
  }
  /** the story is done with these: they leave the board (and storage) with a
   *  thank-you, and nobody asks for their things any more */
  function retireProducers(keys: string[]) {
    const b = B(); let coins = 0; const names: string[] = [];
    for (let i = 0; i < N; i++) {
      const c = b[i];
      if (c && c.p && keys.includes(c.p) && !c.tmp) { coins += 60 * plv(c); names.push(PRODS[c.p].name); b[i] = null; sparkle(i, 18, '#ffe9a8'); }
    }
    const st = stored();
    for (let k = st.length - 1; k >= 0; k--) if (keys.includes(st[k].p)) { coins += 60 * (st[k].lv || 1); names.push(PRODS[st[k].p].name); st.splice(k, 1); }
    // a retired producer's chains stop counting as "in play" (contracts, chests, gifts)
    S.retired = S.retired || {}; S.retired[S.world] = [...new Set([...(S.retired[S.world] || []), ...keys])];
    if (!names.length) return;
    const alive = (o: any) => o.needs.every((nd: any) => { const ch = ITEMS[nd.id].chain; return CHAINS[ch].world === 'any' || B().some((c: any) => c && c.p && PRODS[c.p].drops.some((d: string) => ITEMS[d].chain === ch)); });
    S.orders = S.orders.filter(alive);
    if (S.orders.length < CONFIG.orders.minSlots) fillOrders();
    const swept = sweepOrphans(keys);
    coins += swept.coins;
    S.coins += coins; bumpChip('#chipCoins');
    setTimeout(() => toast(`👋 ${names.join(' and ')} retired${swept.n ? ` and ${swept.n} leftover${swept.n > 1 ? 's' : ''} sold` : ''} — +${coins} 🪙`), 2400);
    paintBoard(); renderOrders(); renderHUD(); save();
  }
  /** once a producer has retired, its items are no use to anyone: they leave the
   *  board (and the bag) and are paid out, unless something still produces
   *  that chain or a later chapter still asks for it */
  function sweepOrphans(gone: string[], w = S.world, useOrders = true): { n: number; coins: number } {
    const b = S.boards[w]; if (!b) return { n: 0, coins: 0 };
    const feeds = (k: string) => new Set<string>((PRODS[k] ? PRODS[k].drops : []).map((d: string) => ITEMS[d].chain));
    const dead = new Set<string>(); gone.forEach(k => feeds(k).forEach(c => dead.add(c)));
    const alive = new Set<string>();
    b.forEach((c: any) => { if (c && c.p && !gone.includes(c.p)) feeds(c.p).forEach(x => alive.add(x)); });
    (S.store[w] || []).forEach((st: any) => { if (!gone.includes(st.p)) feeds(st.p).forEach(x => alive.add(x)); });
    projList(w).slice(projDone(w)).forEach((p: any) => p.needs.forEach(([id]: [string, number]) => alive.add(ITEMS[id].chain)));
    if (useOrders && w === S.world) S.orders.forEach(o => o.needs.forEach(nd => alive.add(ITEMS[nd.id].chain)));
    const orphan = (id: string) => { const it = ITEMS[id]; return !!it && dead.has(it.chain) && !alive.has(it.chain) && CHAINS[it.chain].world !== 'any'; };
    let n = 0, coins = 0;
    for (let i = 0; i < b.length; i++) {
      const c = b[i]; if (!c || !c.id || !orphan(c.id)) continue;
      coins += sellOf(c.id); n++; b[i] = null;
      if (w === S.world) sparkle(i, 8, '#ffe9a8');
    }
    if (w === S.world && Array.isArray(S.bag)) { const keep = S.bag.filter((id: string) => !orphan(id)); n += S.bag.length - keep.length; S.bag.forEach((id: string) => { if (orphan(id)) coins += sellOf(id); }); S.bag = keep; }
    return { n, coins };
  }
  /** a guest producer from the story: free taps for a while, then it moves on */
  function spawnGuest(t: any, who: string) {
    const spot = freeCells()[Math.floor(freeCells().length / 2)];
    if (spot === undefined) { S.guestBack = { ...t, who, at: Date.now() + 30000 }; toast('Make some room — a guest is on the way!'); return; }
    const until = Date.now() + t.mins * 60000;
    B()[spot] = { p: t.p, tmp: until, ch: t.taps, cap: t.taps, lv: 1 };
    S.vis = { w: S.world, p: t.p, char: who, until, from: S.world, story: 1, taps: t.taps, mins: t.mins };
    S.guestBack = null;
    sparkle(spot, 22, '#ffe9a8'); sfx.discover(); paintBoard();
  }
  function buildProject() {
    const p = curProject(); if (!p) return;
    const short = p.needs.filter(([id, q]: [string, number]) => countItem(id) < q)
      .map(([id, q]: [string, number]) => `${q - countItem(id)}× <b>${ITEMS[id].name}</b>`);
    if (S.coins < p.coins) short.push(`<b>${p.coins - S.coins}</b> more coins`);
    if (p.rocket && !allParts()) short.push('the <b>finished rocket</b>');
    if (cHave() < cNeed(p)) short.push(`<b>${cNeed(p) - cHave()}</b> more contract${cNeed(p) - cHave() > 1 ? 's' : ''}`);
    upNeeds(p).forEach(u => short.push(`<b>${PRODS[u.k].name}</b> upgraded to level ${u.lv + 1}`));
    if (short.length) { sfx.no(); toast('Still need ' + short.join(', ') + '.'); return; }
    p.needs.forEach(([id, q]: [string, number]) => { for (let k = 0; k < q; k++) consumeOne(id); });
    spend(p.coins);
    S.proj[S.world] = projDone() + 1;
    weeklyAdd(25);
    analytics.track('chapter_built', { world: S.world, chapter: projDone(), level: S.lvl });
    // ask for a rating once, right after a win, never in the first minutes
    if (!S.reviewAsked && S.world === 'earth' && projDone() >= SERVICES.store.askReviewAfterChapter) { S.reviewAsked = 1; setTimeout(() => store.requestReview(), 4000); }
    S.cSince = S.cSince || {}; S.cSince[S.world] = 0;
    addXp(p.xp);
    let gift = '';
    if (p.gift) { const g = p.gift === 'chest' ? (p.launch ? 'bigchest' : 'chest') : p.gift; if (giveItem(g) >= 0) gift = ITEMS[g].name; }
    sfx.build(); haptic('heavy'); confetti();
    tally('project');
    const nextW = WORLD_ORDER[WORLD_ORDER.indexOf(S.world) + 1];
    if (p.retire) retireProducers(p.retire);
    unlocksOf(p).forEach((u, n) => setTimeout(() => plantProducer(u), 900 + n * 300));
    if (p.temp) setTimeout(() => spawnGuest(p.temp, p.who), 900);
    if (p.event === 'meteor' && !S.met) setTimeout(meteorStory, 3200);
    if (S.world === 'earth' && projDone() >= ROCKET_AFTER && !S.wreck && !allParts()) setTimeout(wreckStory, 3600);
    addGems(p.launch ? 10 : CFG.gems.perChapter);
    if (p.lab && !S.lab.built) S.lab.offered = 1;
    evPts(CFG.event.points.chapter);
    const next = curProject();
    const what = p.unlock ? `<div class="noteLine">🌱 New: <b>${unlocksOf(p).map((u: string) => PRODS[u].name).join(', ')}</b>. ${unlocksOf(p).length > 1 ? 'They stay' : 'It stays'} for the next few chapters.</div>`
      : p.temp ? `<div class="noteLine">⏳ A <b>${PRODS[p.temp.p].name}</b> is visiting: ${p.temp.taps} free taps for ${p.temp.mins} minutes.</div>` : '';
    const labLine = p.lab ? `<div class="noteLine">🔬 Dr. Zonk drew up plans for a <b>Lab</b>. Build it in the camp: ${CONFIG.lab.build.coins} coins and ${CONFIG.lab.build.qty} Star Scrap.</div>` : '';
    setView('board');
    const reward = () => {
      modal(p.who, '✅ ' + p.name,
        `<div class="mSay">${p.text}</div><div class="rewardLine">+${p.xp} XP${gift ? ' · 🎁 ' + gift : ''}</div>` + what + labLine
        + (worldDone() && nextW ? `<div class="noteLine">🚀 ${W().name} is restored! <b>${WORLDS[nextW].name}</b> is now open in the Galaxy.</div>`
          : ''), 'Wonderful');
      setAfter(() => chapterIntro());
    };
    chapterFanfare(p, () => reward());
    paintBoard(); renderRocket(); renderHUD(); renderOrders(); save();
  }
  /* Finishing a chapter is a moment: the things you brought fly into a glowing
     ring around whoever asked, a COMPLETE stamp lands, the journey bar ticks
     one step on and the next chapter's name slides in. Tap to skip. */
  function chapterFanfare(p: any, done: () => void) {
    let el = document.getElementById('chFan');
    if (!el) { el = document.createElement('div'); el.id = 'chFan'; $('#app').appendChild(el); }
    const n = projDone(), list = projList(), next = curProject();
    const items = p.needs.map(([id]: [string, number], k: number, arr: any[]) => {
      const a = (Math.PI * 2 * k) / arr.length - Math.PI / 2;
      return `<span class="cfIt" style="--dx:${Math.round(Math.cos(a) * 130)}px;--dy:${Math.round(Math.sin(a) * 130)}px;animation-delay:${0.15 + k * 0.12}s">${ART.item(id)}</span>`;
    }).join('');
    const strip = `<div class="mlJourney cfStrip">${list.map((_: any, k: number) => `<i class="${k < n - 1 ? 'done' : k === n - 1 ? 'done cfJust' : k === n ? 'now' : ''}"></i>`).join('')}</div>`;
    el.innerHTML = `<div class="cfRays"></div>
      <div class="cfStage"><div class="cfRing"></div><span class="cfFace">${ART.char(p.who)}</span>${items}</div>
      <div class="cfTxt${ART.spriteUi('victory_banner') ? ' ban' : ''}"><i>Chapter ${n}</i><b>${p.name}</b></div>
      ${ART.spriteUi('complete_stamp') ? `<img class="cfStampImg" src="${ART.spriteUi('complete_stamp')}" alt="Complete">` : '<div class="cfStamp">COMPLETE!</div>'}
      ${strip}
      ${next ? `<div class="cfNext">Next up · <b>Chapter ${n + 1}: ${next.name}</b></div>` : `<div class="cfNext"><b>${W().name} is awake!</b></div>`}`;
    el.className = 'open'; sfx.whoosh(); audio.duck(3, 0.25);
    setTimeout(() => { sfx.popHi(); }, 500);
    setTimeout(() => { sfx.chapter(); haptic('heavy'); burst(el!.querySelector('.cfStage') as HTMLElement, 36); }, 1100);
    setTimeout(() => sfx.discover(), 1700);
    let closed = false;
    const finish = () => { if (closed) return; closed = true; el!.className = ''; done(); };
    const tmr = setTimeout(finish, 3600);
    el.onclick = () => { clearTimeout(tmr); finish(); };
  }
  /** the chapter card from the little widget: what it needs, nothing else */
  function chapterSheet() {
    const p = curProject();
    if (!p) { setView('map'); return; }
    const coin = ART.icon('coin'), ok = projReady(p);
    const need = p.needs.map(([id, q]: [string, number]) => {
      const have = Math.min(q, countItem(id));
      return `<span class="pNeed${have >= q ? ' ok' : ''}" data-need="${id}">${ART.item(id)}<b>${have}/${q}</b></span>`;
    }).join('');
    const ups = upNeeds(p).map(u => {
      const at = B().findIndex((c: any) => c && c.p === u.k && !c.tmp), price = upCost(PRODS[u.k], u.lv);
      return `<div class="upRow"><span class="upArt">${ART.producer(PRODS[u.k].art)}</span>
        <span class="upTx"><b>${PRODS[u.k].name}</b><i>Level ${u.lv}/${PMAX}</i></span>
        ${at >= 0 ? `<button class="buyBtn green" data-upg="${at}" ${S.coins < price ? 'disabled' : ''}>⬆ ${price} 🪙</button>`
          : `<button class="buyBtn green" data-upst="${u.k}" ${S.coins < price ? 'disabled' : ''}>⬆ ${price} 🪙</button>`}</div>`;
    }).join('');
    pop(`Ch. ${projDone() + 1} · ${p.name}`, `<div class="chHead"><span class="pFace">${ART.char(p.who)}</span>
        ${p.talk ? '<button class="talkBtn" id="btnTalk" title="Replay the story">💬</button>' : ''}</div>
      <div class="pNeeds">${need}${p.coins ? `<span class="pNeed${S.coins >= p.coins ? ' ok' : ''}">${coin}<b>${p.coins}</b></span>` : ''}
        ${p.rocket ? `<span class="pNeed${allParts() ? ' ok' : ''}">🚀<b>${PART_KEYS.filter(k => S.parts[k]).length}/4</b></span>` : ''}
        <span class="pNeed${cHave() >= cNeed(p) ? ' ok' : ''}">${ART.uiIcon('ic_scroll', '📜')}<b>${Math.min(cHave(), cNeed(p))}/${cNeed(p)}</b></span></div>
      ${ups ? `<div class="upHead">Upgrade this one step first</div>${ups}` : ''}
      ${chapterPrize(p)}
      <button class="big${ok ? '' : ' off'}" id="btnProject">${ok ? 'COMPLETE THE CHAPTER ✨' : 'Not yet'}</button>`, 'chapter');
    const host = $('#popBody');
    host.querySelectorAll('.pNeed[data-need]').forEach((n: any) => n.onclick = () => { closePop(); chainPanel(n.dataset.need); });
    host.querySelectorAll('[data-upg]').forEach((b: any) => b.onclick = () => { upgradeProducer(+b.dataset.upg); chapterSheet(); });
    // one waiting in storage can be grown right there too
    host.querySelectorAll('[data-upst]').forEach((b: any) => b.onclick = () => {
      const st = stored().find((x: any) => x.p === b.dataset.upst); if (!st) return;
      const price = upCost(PRODS[st.p], st.lv || 1);
      if (S.coins < price) { sfx.no(); return; }
      spend(price); st.lv = (st.lv || 1) + 1; sfx.build(); toast(`🌟 <b>${PRODS[st.p].name}</b> is now level ${st.lv}!`);
      renderHUD(); save(); chapterSheet();
    });
    const bp = $('#btnProject'); if (bp) bp.onclick = () => { if (projReady(curProject())) { closePop(); buildProject(); } else { sfx.no(); } };
    const bt = $('#btnTalk'); if (bt) bt.onclick = () => { closePop(); chapterIntro(true); };
  }
  /** what finishing a chapter gives you: the anticipation is half the fun */
  function chapterPrize(p: any) {
    const bits: string[] = [];
    unlocksOf(p).forEach((u: string) => bits.push(`<span class="prz">${ART.producer(PRODS[u].art)}<b>${PRODS[u].name}</b></span>`));
    if (p.temp) bits.push(`<span class="prz">${ART.producer(PRODS[p.temp.p].art)}<b>${PRODS[p.temp.p].name} visits</b></span>`);
    if (p.lab) bits.push(`<span class="prz">${ART.icon('flask')}<b>Dr. Zonk's Lab</b></span>`);
    if (p.gift) { const gi = p.gift === 'chest' ? (p.launch ? 'bigchest' : 'chest') : p.gift; bits.push(`<span class="prz">${ART.item(gi)}<b>${ITEMS[gi].name}</b></span>`); }
    if (p.launch) bits.push(`<span class="prz">🚀<b>A new world</b></span>`);
    return bits.length ? `<div class="przRow"><i>🎁 Unlocks</i>${bits.join('')}</div>` : '';
  }
  function projectCard() {
    const list = projList(), done = projDone(), cur = curProject();
    if (!list.length) return '';
    const coin = ART.icon('coin');
    const strip = `<div class="mlJourney">${list.map((p: any, k: number) =>
      `<i class="${k < done ? 'done' : k === done ? 'now' : ''}${p.launch ? ' launch' : ''}" title="${p.name}"></i>`).join('')}</div>`;
    const head = `<div class="mlHead"><b>${W().name}</b><span>${done}/${list.length} chapters</span></div>${strip}`;
    if (!cur) return `<div class="card mlMission">${head}<div class="noteLine">Every chapter here is done. This world is awake! ✨</div></div>`;
    const p = cur, ok = projReady(p);
    const need = p.needs.map(([id, q]: [string, number]) => {
      const have = Math.min(q, countItem(id));
      return `<span class="pNeed${have >= q ? ' ok' : ''}" data-need="${id}">${ART.item(id)}<b>${have}/${q}</b></span>`;
    }).join('');
    const next = list[done + 1];
    return `<div class="card mlMission">${head}
      <div class="mlNow"><span class="mlFace">${ART.char(p.who)}</span>
        <div class="mlTitle"><i>Chapter ${done + 1}</i><b>${p.name}</b>${p.launch ? '<em>🚀 opens the next world</em>' : ''}</div>
        ${p.talk ? '<button class="talkBtn" id="btnTalk" title="Replay the story">💬</button>' : ''}</div>
      <div class="pNeeds">${need}${p.coins ? `<span class="pNeed${S.coins >= p.coins ? ' ok' : ''}">${coin}<b>${kN(p.coins)}</b></span>` : ''}
        ${p.rocket ? `<span class="pNeed${allParts() ? ' ok' : ''}">🚀<b>${PART_KEYS.filter(k => S.parts[k]).length}/4</b></span>` : ''}
        <span class="pNeed${cHave() >= cNeed(p) ? ' ok' : ''}" title="Contracts filled since the last chapter">${ART.uiIcon('ic_scroll', '📜')}<b>${Math.min(cHave(), cNeed(p))}/${cNeed(p)}</b></span></div>
      ${upNeeds(p).map(u => `<div class="mlUp">${ART.producer(PRODS[u.k].art)}<span>Upgrade <b>${PRODS[u.k].name}</b> to level ${u.lv + 1} — tap it on the board</span></div>`).join('')}
      ${chapterPrize(p)}
      <button class="big${ok ? '' : ' off'}" id="btnProject">${ok ? 'COMPLETE THE CHAPTER ✨' : 'Gather everything above'}</button>
      ${next ? `<div class="mlNext">Next: <b>${next.name}</b></div>` : ''}</div>`;
  }


  /* ------------------------------------------------------------ daily tasks */
  const DAILY_KINDS = [
    { kind: 'merge', label: 'Merge {n} times', n: [15, 30], pts: 15 },
    { kind: 'deliver', label: 'Fill {n} contracts', n: [3, 6], pts: 25 },
    { kind: 'spawn', label: 'Tap producers {n} times', n: [15, 30], pts: 15 },
    { kind: 'tier4', label: 'Make {n} items of tier 4+', n: [2, 4], pts: 20 },
    { kind: 'sell', label: 'Sell {n} spare things', n: [4, 8], pts: 10 },
    { kind: 'chest', label: 'Open {n} chests', n: [1, 2], pts: 20 },
    { kind: 'project', label: 'Finish a chapter', n: [1, 1], pts: 30 },
  ];
  function rollDaily() {
    const list: any[] = [];
    // one "make this" task from what is growing here, so the day has a target
    const chains = liveChains().filter(c => CHAINS[c].items.length >= 4);
    if (chains.length) {
      const ch = CHAINS[rnd(chains)], id = ch.items[Math.min(3, ch.items.length - 2)];
      list.push({ kind: 'make:' + id, label: `Make a ${ITEMS[id].name}`, n: 1, have: 0, pts: 25, id: 'd0' });
    }
    const pool = DAILY_KINDS.filter(k => k.kind !== 'project' || curProject());
    while (list.length < CFG.daily2.count && pool.length) {
      const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const n = k.n[0] + Math.floor(Math.random() * (k.n[1] - k.n[0] + 1));
      list.push({ kind: k.kind, label: k.label.replace('{n}', String(n)), n, have: 0, pts: k.pts, id: 'd' + list.length });
    }
    S.dt = { key: dayKey(new Date()), list, pts: 0, got: [] };
  }
  const dailyOk = () => { if (!S.dt || S.dt.key !== dayKey(new Date())) rollDaily(); return S.dt; };
  /** every scoring action in the game funnels through here */
  function tally(kind: string, n = 1) {
    weeklyTally(kind, n);
    const dt = dailyOk();
    let done = false;
    dt.list.forEach((t: any) => {
      if (t.kind !== kind || t.have >= t.n) return;
      t.have = Math.min(t.n, t.have + n);
      if (t.have >= t.n) { done = true; dt.pts += t.pts; }
    });
    if (done) {
      sfx.coin();
      const ready = CFG.daily2.marks.filter((m: number, k: number) => dt.pts >= m && !dt.got[k]).length;
      toast('✅ Daily task done!' + (ready ? ' A reward chest is waiting in 📜 Goals.' : ''));
      renderHUD();
    }
  }
  const tasksDone = () => { const dt = dailyOk(); return CFG.daily2.marks.filter((m: number, k: number) => dt.pts >= m && !dt.got[k]).length; };
  function claimDaily(k: number) {
    const dt = dailyOk(), mark = CFG.daily2.marks[k];
    if (dt.got[k] || dt.pts < mark) { sfx.no(); toast(`Reach ${mark} points first — you have ${dt.pts}.`); return; }
    dt.got[k] = 1;
    const at = giveItem(k === 0 ? 'chest' : 'bigchest');
    S.energy = Math.min(maxEnergy(), S.energy + 5 + k * 5);
    if (k === 2) { giveBoost('rainbow'); S.coins += 200; }
    sfx.big(); haptic('medium'); confetti();
    if (at >= 0) sparkle(at, 16, '#ffe9a8');
    toast('🎁 Daily reward: ' + (k === 0 ? 'a Supply Chest' : 'a Treasure Chest') + ` and +${15 + k * 10} ⚡` + (k === 2 ? ', a Rainbow Gem and 200 coins!' : '!'));
    renderRocket(); renderHUD(); save();
  }
  function dailyCard() {
    const dt = dailyOk(), max = CFG.daily2.marks[CFG.daily2.marks.length - 1];
    return `<div class="card daily"><div class="cardTitle">${ART.uiIcon('ic_dailylog', '📅')} Daily Log<span class="pCount">${dt.pts} pts</span></div>
      <div class="dTrack"><div class="dFill" style="width:${Math.min(100, dt.pts / max * 100)}%"></div>
        ${CFG.daily2.marks.map((m: number, k: number) => `<button class="dChest${dt.got[k] ? ' got' : dt.pts >= m ? ' ready' : ''}" data-dchest="${k}"
          style="left:${m / max * 100}%">${ART.item(k === 0 ? 'chest' : 'bigchest')}<i>${m}</i></button>`).join('')}</div>
      ${dt.list.map((t: any) => `<div class="taskRow${t.have >= t.n ? ' done' : ''}">
        <div class="tBar"><i style="width:${Math.round(Math.min(1, t.have / t.n) * 100)}%"></i></div>
        <div class="tTxt">${t.label}<span>${Math.min(t.have, t.n)}/${t.n}</span></div>
        <span class="tPts">${t.have >= t.n ? '✓' : '+' + t.pts}</span></div>`).join('')}
      <div class="noteLine">New tasks every day. Points fill the chests above.</div></div>`;
  }

  /* ----------------------------------------------------------------- chests */
  const isChest = (id?: string) => id === 'chest' || id === 'bigchest';
  function openChest(i: number) {
    const b = B(), c = b[i]; if (!c || !isChest(c.id)) return;
    stat('chest');
    const cfg = CFG.chest[c.id];
    /* only what you are playing with right now: chains whose producer stands on
       this board (or waits in storage), and only steps you have already made */
    const pool: string[] = [];
    playChains().forEach(ch => { CHAINS[ch].items.forEach(id => { if (ITEMS[id].tier <= cfg.maxTier && (S.seen[id] || ITEMS[id].tier === 1)) pool.push(id); }); });
    b[i] = null; board.consume(i, c.id);
    let n = 0, coins = cfg.coins || 0, energy = 0;
    for (let k = 0; k < cfg.items; k++) {
      const roll = Math.random();
      // now and then a chest holds coins or a little energy instead of a thing
      if (!pool.length || roll < 0.2) { coins += 15 + Math.floor(Math.random() * 25) * (cfg.maxTier || 1); continue; }
      if (roll < 0.35) { energy += 3 + Math.floor(Math.random() * 4); continue; }
      const spot = nearFree(i); if (spot < 0) { coins += 10; continue; }
      const id = rnd(pool); b[spot] = { id }; gotItem(id); board.animSpawn(spot, id, i); n++;
    }
    if (coins) { S.coins += coins; bumpChip('#chipCoins'); }
    if (energy) { S.energy += energy; bumpChip('#chipEnergy'); }
    sfx.chest(); haptic('medium'); sparkle(i, 20, '#ffe9a8');
    const bits = [n ? `${n} thing${n > 1 ? 's' : ''}` : '', coins ? `${coins} 🪙` : '', energy ? `${energy} ⚡` : ''].filter(Boolean);
    toast(`📦 ${ITEMS[c.id].name} opened — ${bits.join(', ').replace(/, ([^,]*)$/, ' and $1')}!`);
    tally('chest');
    renderHUD(); renderOrders(); save();
  }

  /* ---------------------------------------------------------------- bubbles
     Travel Town's best trick: a good merge sometimes leaves a floating copy of
     the result. Buy it before it pops, or let it go. */
  const bubblePrice = (id: string) => Math.max(CFG.bubble.minPrice, Math.round(ITEMS[id].sell * CFG.bubble.priceMult));
  function maybeBubble(id: string, at: number) {
    const d = ITEMS[id], ch = CHAINS[d.chain];
    if (d.tier < CFG.bubble.minTier || ch.world === 'any' || ch.world === 'ship' || d.part || d.fuel) return;
    if (ch.items[ch.items.length - 1] === id || Math.random() > CFG.bubble.chance) return;
    const spot = nearFree(at); if (spot < 0) return;
    B()[spot] = { bub: id, until: Date.now() + CFG.bubble.lastsMs, pr: bubblePrice(id) };
    setTimeout(() => {
      paintBoard(); floatText(spot, '🫧 Bubble!', '#bff0ff');
      if (!S.story.bubble) { S.story.bubble = 1; toast('🫧 A <b>bubble</b>! Tap it to keep the copy before it pops.'); }
    }, 450);
  }
  function tapBubble(i: number) {
    const c = B()[i]; if (!c || !c.bub) return;
    const id = c.bub, price = bubblePrice(id), secs = Math.max(1, Math.round((c.until - Date.now()) / 1000));
    modal(W().folks[0] || 'bloop', '🫧 A bubble!', `A copy of <b>${ITEMS[id].name}</b> floated up from that merge.
      <div class="bubArt">${ART.item(id)}</div><div class="noteLine">Pops in ${secs}s.</div>
      <button class="big gold" id="btnBubbleGem">Keep it · 💎 ${Math.max(2, ITEMS[id].tier)}</button>${adBtn('bubble', 'Keep it free', 'btnBubbleAd')}`, 'Let it pop');
    const keep = () => { const cc = B()[i]; if (!cc || cc.bub !== id) return; B()[i] = { id }; gotItem(id); sfx.merge(ITEMS[id].tier); sparkle(i, 14, '#bff0ff'); tally('bubble'); paintBoard(); renderHUD(); renderOrders(); save(); };
    setTimeout(() => {
      const bg = $('#btnBubbleGem'); if (bg) bg.onclick = () => { if (spendGems(Math.max(2, ITEMS[id].tier), 'bubble')) { closeModal(); keep(); } };
      const ba = $('#btnBubbleAd'); if (ba) ba.onclick = () => { closeModal(); watchAd('bubble', keep); };
    }, 30);
    setTimeout(() => { const bb = $('#btnBubble'); if (bb) bb.onclick = () => {
      const cc = B()[i];
      if (!cc || cc.bub !== id) { closeModal(); return; }
      if (S.coins < price) { sfx.no(); toast('Not enough coins.'); return; }
      spend(price); B()[i] = { id }; gotItem(id); closeModal();
      sfx.merge(ITEMS[id].tier); sparkle(i, 14, '#bff0ff'); tally('bubble');
      paintBoard(); renderHUD(); renderOrders(); save();
    }; }, 30);
  }

  /* ----------------------------------------------------- contract milestones */
  const mileGoal = () => { const st = CFG.milestone.steps; return st[Math.min((S.om && S.om.step) || 0, st.length - 1)]; };
  function mileTick() {
    if (!S.om) S.om = { n: 0, step: 0 };
    S.om.n++;
    if (S.om.n >= mileGoal()) {
      S.om.n = 0; S.om.step++;
      // once in a while, not every few contracts: a chest every other milestone, a little energy in between
      const chest = S.om.step % 2 === 0, at = chest ? giveItem(S.om.step % 6 === 0 ? 'bigchest' : 'chest') : -1;
      if (!chest) { S.energy += CFG.milestone.energy; bumpChip('#chipEnergy'); }
      setTimeout(() => { sfx.big(); confetti(); if (at >= 0) sparkle(at, 16, '#ffe9a8');
        toast(chest ? '📦 Contract milestone! A Supply Chest landed on your board.' : `📦 Contract milestone! +${CFG.milestone.energy} ⚡`); }, 900);
    }
    renderMile();
  }
  function renderMile() {
    const e = $('#oMile'); if (!e) return;
    const n = (S.om && S.om.n) || 0, g = mileGoal();
    e.innerHTML = `${ART.item('chest')}<i style="width:${Math.round(n / g * 100)}%"></i><b>${n}/${g}</b>`;
    renderQuick();
  }

  /* --------------------------------------------------------------- visitors
     Now and then someone from another world drops by with a producer of their
     own. It gives a handful of free taps and then leaves, and while it is here
     its owner puts up a contract that always pays a chest. */
  const VISITORS = [
    { p: 'bush', from: 'earth' }, { p: 'hive', from: 'earth' },
    { p: 'geyser', from: 'luna' }, { p: 'glowpod', from: 'luna' },
    { p: 'lavavent', from: 'cindra' }, { p: 'shroomlog', from: 'cindra' },
    { p: 'shellbed', from: 'nerith' }, { p: 'kelpbed', from: 'nerith' },
    { p: 'cloudbank', from: 'vela' }, { p: 'auroraloom', from: 'vela' },
  ];
  const visiting = () => !!(S.vis && S.vis.w === S.world && Date.now() < S.vis.until);
  function visitorTick(now: number) {
    const v = S.vis;
    // a producer the story promised, waiting for a free tile
    if (S.pendingPlant && freeCells().length) plantProducer(S.pendingPlant);
    const gone = v && v.w === S.world && (now >= v.until || !B().some((c: any) => c && c.tmp));
    if (gone && (now >= v.until || v.story)) {
      const b = B();
      for (let i = 0; i < N; i++) if (b[i] && b[i].tmp) { b[i] = null; sparkle(i, 16, '#ffe9a8'); }
      S.orders = S.orders.filter((o: any) => !o.vis);
      toast(v.story ? `👋 The ${PRODS[v.p].name} moved on.` : `👋 ${CHARS[v.char].name} packed up and flew home.`);
      // if the chapter you are on still needs what it made, it comes back soon
      const cp = curProject(), chain = ITEMS[PRODS[v.p].drops[0]].chain;
      if (v.story && cp && cp.needs.some(([id]: [string, number]) => ITEMS[id].chain === chain))
        S.guestBack = { p: v.p, taps: v.taps, mins: v.mins, who: v.char, at: now + 90000 };
      S.vis = null; S.visAt = now + CFG.visitor.everyMs;
      paintBoard(); renderOrders(); save();
      return;
    }
    if (v && v.w === S.world) return;
    if (S.guestBack && now >= S.guestBack.at && view === 'board') {
      const g = S.guestBack; spawnGuest(g, g.who);
      if (!S.guestBack) toast(`⏳ The <b>${PRODS[g.p].name}</b> is back for a little while!`);
      return;
    }
    if (scripted()) return;                          // the story brings its own guests
    if (!S.visAt) { S.visAt = now + CFG.visitor.firstMs; return; }
    if (now < S.visAt || view !== 'board' || wlv() < CFG.visitor.firstAtWorldLevel || tutOn()) return;
    const opts = VISITORS.filter(x => x.from !== S.world);
    const pick = rnd(opts), spot = freeCells()[Math.floor(freeCells().length / 2)];
    if (spot === undefined) { S.visAt = now + 60000; return; }
    const char = WORLDS[pick.from].folks[0];
    const until = now + CFG.visitor.lastsMs;
    B()[spot] = { p: pick.p, tmp: until, ch: CFG.visitor.taps, lv: 1 };
    S.vis = { w: S.world, p: pick.p, char, until, from: pick.from };
    // their contract: something from their own chain, and it always pays a chest
    const chain = ITEMS[PRODS[pick.p].drops[0]].chain;
    const ids = CHAINS[chain].items.filter(id => ITEMS[id].tier >= 2 && ITEMS[id].tier <= 4);
    const want = rnd(ids);
    S.orders.unshift({ id: 'o' + (oid++), char, vis: 1, say: `Visiting from ${WORLDS[pick.from].name}!`, give: 'chest',
      needs: [{ id: want, qty: 1 }], coins: Math.round(ITEMS[want].sell * 3 + 20), xp: 6 + ITEMS[want].tier * 3 });
    sfx.discover(); confetti(); paintBoard(); renderOrders(); save();
    setTimeout(() => modal(char, `A visitor from ${WORLDS[pick.from].name}!`,
      `${CHARS[char].name} landed with a <b>${PRODS[pick.p].name}</b>. It gives <b>${CFG.visitor.taps} free taps</b> and stays for about ${Math.round(CFG.visitor.lastsMs / 60000)} minutes.`
      + `<div class="noteLine">Fill ${CHARS[char].name}'s contract before they leave: it pays a Supply Chest.</div>`, 'Welcome!'), 400);
  }

  /* =============================================================== TRAVEL */
  /** somewhere you have already been: flying back costs nothing */
  /** a world counts as reached only once the world before it is restored —
      saves from older versions could have every planet "unlocked" early,
      and those planets showed "Fly back" before you had earned them */
  const visited = (w: string): boolean => {
    if (w === 'earth') return true;
    if (!S.unlocked[w]) return false;
    if (w === S.world) return true;
    // really been there: landed once (S.been), or finished a chapter there in an older save
    if (!(S.been && S.been[w]) && !projDone(w)) return false;
    const prev = WORLD_ORDER[WORLD_ORDER.indexOf(w) - 1];
    return !!prev && visited(prev) && prevOpen(prev);
  };
  const prevOpen = (prev: string) => projList(prev).some((p: any) => p.unlock) ? worldDone(prev) : launchDone(prev);
  /** a new world opens on the map once the previous one's launch project is built */
  /** a world only opens once every item and producer in it is painted — no stand-in art, ever */
  const paintedCache: Record<string, boolean> = {};
  const painted = (w: string) => paintedCache[w] ?? (paintedCache[w] =
    WORLDS[w].chains.every((c: string) => CHAINS[c].items.every(id => !!ART.spriteItem(id)))
    && [...WORLDS[w].start, ...(WORLDS[w].grow || [])].every((x: any) => !!ART.spriteProducer(PRODS[x.producer].art || x.producer)));
  const reachable = (w: string) => {
    const i = WORLD_ORDER.indexOf(w);
    if (!painted(w)) return false;
    if (visited(w)) return true;
    const prev = WORLD_ORDER[i - 1];
    if (i <= 0 || !visited(prev)) return false;
    // a story world opens the next only when it is fully restored
    return prevOpen(prev);
  };
  function travelTo(w: string) {
    const free = visited(w);
    if (!free && (S.fuel < CONFIG.rocket.fuelToLaunch || !allParts())) return;
    if (!free) S.fuel -= CONFIG.rocket.fuelToLaunch;
    const cut = $('#cut'); $('#cutRocket').innerHTML = ART.spriteUi('rocket_3') ? `<img class="rkImg" src="${ART.spriteUi('rocket_3')}">` : ART.rocket({ hull: 1, engine: 1, nav: 1, tank: 1 }, { flame: true });
    $('#cutTitle').textContent = 'Blasting off!';
    $('#cutSub').textContent = 'Destination: ' + WORLDS[w].name;
    const warpHost = $('#warps'); warpHost.innerHTML = '';
    for (let i = 0; i < 22; i++) { const s = el('div', 'warp'); s.style.cssText = `left:${Math.random() * 100}%;height:${30 + Math.random() * 90}px;animation-delay:${-Math.random()}s`; warpHost.appendChild(s); }
    cut.classList.add('show'); sfx.launch();
    setTimeout(() => {
      if (!S.boards[w]) S.boards[w] = freshBoard(w);
      S.world = w; S.unlocked[w] = 1; (S.been = S.been || {})[w] = 1; sel = null;
      // you arrive standing in the new camp, not looking at the star chart
      worldTab = 'camp';
      if (!S.wlv[w]) { S.wlv[w] = 1; S.wxp[w] = 0; }
      applyBloomSkin(); applyScene();
      // this world's art jumps the queue; anything drawn before it lands is redrawn
      board.preload(ITEM_IDS.filter(id => CHAINS[ITEMS[id].chain].world === w),
        [...WORLDS[w].start, ...(WORLDS[w].grow || [])].map(x => PRODS[x.producer].art))
        .then(() => { board.unstale(); paintBoard(); });
      // the shelf, the ship and the contract board all belong to a world
      S.orders = []; S.orderCap = undefined; S.ordersAt = 0; fillOrders(true);
      S.shop.stock = null; S.shop.at = 0;
      S.ship = null; S.shipAt = Date.now() + CONFIG.ship.everyMs * 0.5;
      S.perkAt = 0;
      growProducers();
      prog('travel', 1);
      { const sid = (SERVICES.games as any).achievements['world_' + w]; games.unlock(sid || 'world_' + w); }
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
     Galaxy Adventure has a spine: the Bloom — the living network that linked every
     world — collapsed, and your rocket is the last Seed Vault. Beats fire off
     world levels and one-off flags, and each one is a single modal. */
  function checkStory(flag?: string) {
    const beat = STORY.find(b => {
      if (S.story[b.id]) return false;
      const at = b.at || {};
      if (at.flag) return at.flag === flag;
      if (at.world && at.world !== S.world) return false;
      if (at.world && projList(at.world).some((p: any) => p.talk)) return false;   // its chapters tell it
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
    // space junk is a fuel recycler: a finished Junk Rocket always gives back fuel ore
    if (id === 'junkrocket') {
      setTimeout(() => { const g = giveItem('fuelore', at); if (g >= 0) sparkle(g, 18, '#b6ffd2'); sfx.discover(); toast('🛠️ The Junk Rocket coughs out some <b>Fuel Ore</b>!'); }, 600);
      return;
    }
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
    // before the Lab is built, the camp is painted without it (the ruin sits on bare ground)
    const url = (!labOpen() && ART.spriteScene(S.world + '_nolab')) || ART.spriteScene(S.world) || ART.spriteScene('earth');
    $('#app').style.setProperty('--camp', `url(${url})`);
    document.body.style.setProperty('--camp', `url(${url})`);
  }

  /** the board and the backdrop visibly come back to life, stage by stage */
  function applyBloomSkin() {
    const app = $('#app'); if (!app) return;
    app.classList.remove('bloom1', 'bloom2', 'bloom3');
    const st = stage();
    if (st) app.classList.add('bloom' + Math.min(st, 3));
  }

  /* ================================================================== v9
     Science, the new Lab, story scenes, live events, the wheel and Alien Pairs.
     Everything here pays out through grant(), so a reward reads the same
     wherever it comes from. */

  /* ---------------------------------------------------------- friendship
     Every contract you fill for someone makes you better friends. At each new
     level they come over to say so — in a story scene — with a present. */
  const FR_AT = [3, 10, 25, 50, 100];
  const FR_GIFT: Reward[] = [{ energy: 10, gems: 2 }, { item: 'chest', gems: 3 }, { coins: 200, spin: 1, gems: 5 }, { item: 'bigchest', gems: 8 }, { coins: 600, spin: 2, gems: 15 }];
  const FR_SAY = [
    'You keep turning up when I need you. That means a lot round here.',
    'I told everyone about you. Well — everyone who would listen.',
    'Honestly? This place feels like home again, and that is your doing.',
    'Best friends. No arguments. I have decided.',
    'Whatever you need, whenever you need it. Just ask.'];
  const frLv = (c: string) => { const n = (S.fr && S.fr[c]) || 0; let l = 0; while (l < FR_AT.length && n >= FR_AT[l]) l++; return l; };
  function befriend(c: string) {
    S.fr = S.fr || {};
    const before = frLv(c);
    S.fr[c] = (S.fr[c] || 0) + 1;
    const now = frLv(c);
    if (now <= before) return;
    const gift = FR_GIFT[now - 1];
    setTimeout(() => talkScene([[c, `❤️ <b>Friendship level ${now}!</b> ${FR_SAY[now - 1]}`], [c, `Here — a little thank-you: <b>${rewardText(gift)}</b>.`]],
      () => { grant(gift); confetti(); renderOrders(); }), 900);
  }

  /* ------------------------------------------------------------- rewards */
  type Reward = { energy?: number; coins?: number; item?: string; boost?: string; spin?: number; sci?: number; gems?: number };
  function rewardText(r: Reward) {
    const b: string[] = [];
    if (r.energy) b.push(`+${r.energy} ⚡`);
    if (r.coins) b.push(`+${r.coins} 🪙`);
    if (r.gems) b.push(`+${r.gems} 💎`);
    if (r.sci) b.push(`+${r.sci} 🧪`);
    if (r.spin) b.push(`+${r.spin} 🎡`);
    if (r.boost) b.push((SHOP.boosters.find((x: any) => x.id === r.boost) || { name: r.boost }).name);
    if (r.item) b.push(ITEMS[r.item].name);
    return b.join(' · ');
  }
  function rewardIcon(r: Reward) {
    if (r.item) return ART.item(r.item);
    if (r.gems) return ART.icon('gem');
    if (r.coins) return ART.icon('coin');
    if (r.energy) return ART.icon('energy');
    if (r.boost) return ART.icon(r.boost === 'wand' ? 'wand' : r.boost === 'bomb' ? 'bomb' : 'rainbow');
    if (r.spin) return '<span class="rwEmoji">🎡</span>';
    if (r.sci) return '<span class="rwEmoji">🧪</span>';
    return '';
  }
  /* One reward card for every "you got X" moment: the painted card, who gave
     it, the things themselves big, and a single Collect. It floats above any
     popup, and the reward is only granted on Collect, so it can't be missed. */
  const rwcQ: { who: string; title: string; line: string; r: Reward; after?: () => void }[] = [];
  function rewardCard(who: string, title: string, line: string, r: Reward, after?: () => void) {
    rwcQ.push({ who, title, line, r, after });
    if (!document.getElementById('rwc')?.classList.contains('open')) rewardNext();
  }
  function rewardNext() {
    const c = rwcQ.shift(); if (!c) return;
    let el = document.getElementById('rwc');
    if (!el) { el = document.createElement('div'); el.id = 'rwc'; $('#app').appendChild(el); }
    const parts: string[] = [];
    const one = (icon: string, n: string) => parts.push(`<div class="rwcIt"><span class="rwcArt">${icon}</span><b>${n}</b></div>`);
    if (c.r.item) one(ART.item(c.r.item), ITEMS[c.r.item].name);
    if (c.r.coins) one(ART.icon('coin'), '+' + c.r.coins);
    if (c.r.gems) one(ART.icon('gem'), '+' + c.r.gems);
    if (c.r.energy) one(ART.icon('energy'), '+' + c.r.energy);
    if (c.r.sci) one('<span class="rwEmoji">🧪</span>', '+' + c.r.sci);
    if (c.r.spin) one(ART.uiIcon('ic_spin', '🎡'), '+' + c.r.spin + ' spin');
    if (c.r.boost) one(rewardIcon({ boost: c.r.boost }), (SHOP.boosters.find((x: any) => x.id === c.r.boost) || { name: c.r.boost }).name);
    el.innerHTML = `<div class="rwcRays"></div><div class="rwcCard"><div class="rwcRib">${c.title}</div>
      ${c.who ? `<div class="rwcWho">${c.who.startsWith('<') ? c.who : ART.char(c.who)}</div>` : ART.spriteUi('chest_opening') ? `<div class="rwcWho"><img class="rwcChest" src="${ART.spriteUi('chest_opening')}" alt=""></div>` : ''}
      <div class="rwcLine">${c.line}</div><div class="rwcRow">${parts.join('')}</div>
      <button class="big" id="rwcGo">Collect</button></div>`;
    el.className = 'open';
    sfx.unlock(); if (c.who && !c.who.startsWith('<')) setTimeout(() => sfx.voice(c.who, 3), 250); else if (c.who) setTimeout(sfx.boing, 250);
    ($('#rwcGo') as HTMLElement).onclick = () => {
      grant(c.r); confetti(); haptic('medium');
      el!.className = 'close';
      setTimeout(() => { el!.className = ''; if (c.after) c.after(); rewardNext(); }, 320);
    };
  }
  function grant(r: Reward) {
    if (r.energy) { S.energy += r.energy; bumpChip('#chipEnergy'); }
    if (r.coins) { S.coins += r.coins; bumpChip('#chipCoins'); }
    if (r.gems) addGems(r.gems);
    if (r.sci) S.sci += r.sci;
    if (r.spin) S.spin.tok += r.spin;
    if (r.boost) giveBoost(r.boost);
    if (r.item && giveItem(r.item) < 0) { S.bag.push(r.item); toast('Board full — the ' + ITEMS[r.item].name + ' went into your bag.'); }
    sfx.collect(); paintBoard(); renderHUD(); save();
  }

  /* ------------------------------------------------------- generic popup */
  let popClose: (() => void) | null = null;
  function pop(title: string, html: string, cls = '', onClose?: () => void) {
    $('#popTitle').innerHTML = title;
    $('#popBody').innerHTML = html;
    $('#pop').className = 'pop open ' + cls;
    popClose = onClose || null;
    sfx.open();
    { const rb = document.getElementById('ribbon'); if (rb && rb.className === 'show') rb.className = 'hide'; }
  }
  function closePop() {
    if ($('#pop').classList.contains('open')) sfx.close();
    $('#pop').classList.remove('open');
    const f = popClose; popClose = null; if (f) f();
    renderHUD(); save();
  }
  const popOpen = () => $('#pop').classList.contains('open');

  /* --------------------------------------------------------- story scenes */
  let talkQ: [string, string][] = [], talkDone: (() => void) | null = null, talkFirst = '';
  function talkScene(lines: [string, string][], done?: () => void) {
    if (!lines || !lines.length) { if (done) done(); return; }
    // a dialog is up: the scene starts once it is closed, never underneath it
    if ($('#modal').classList.contains('open')) { setTimeout(() => talkScene(lines, done), 600); return; }
    if ($('#talk').classList.contains('open')) {
      // already talking: this conversation waits its turn
      talkQ = talkQ.concat(lines);
      const prev = talkDone; talkDone = () => { if (prev) prev(); if (done) done(); };
      return;
    }
    talkQ = lines.slice(); talkDone = done || null; talkFirst = lines[0][0];
    $('#talk').classList.add('open');
    talkStep();
  }
  function talkStep() {
    const l = talkQ.shift();
    if (!l) {
      $('#talk').classList.remove('open');
      const d = talkDone; talkDone = null; if (d) setTimeout(d, 200);
      setTimeout(nextModal, 500);
      return;
    }
    const [who, text] = l;
    const t = $('#talk');
    t.classList.toggle('right', who !== talkFirst);
    $('#tkFace').innerHTML = ART.charFull(who);
    $('#tkName').textContent = (CHARS[who] && CHARS[who].name) || who;
    $('#tkText').innerHTML = text;
    t.classList.remove('beat'); void t.offsetWidth; t.classList.add('beat');
    // a few syllables of gibberish, more for a longer line, now and then a boing
    { const plain = text.replace(/<[^>]+>/g, ''); sfx.voice(who, clamp(Math.round(plain.length / 22), 2, 6), /\?\s*$/.test(plain)); }
    if (/!{2}|\?!|haha|oops|whoa|boing/i.test(text) && Math.random() < 0.5) setTimeout(sfx.boing, 420);
  }
  /** play the current chapter's opening conversation (once, unless asked) */
  function chapterIntro(force = false) {
    const cp = curProject();
    if (!cp || !cp.talk) return false;
    if (S.talked[cp.id] && !force) return false;
    S.talked[cp.id] = 1; save();
    talkScene(cp.talk);
    return true;
  }

  /* --------------------------------------------------------------- the Lab */
  const L2 = () => CFG.lab2;
  const sciOf = (id: string) => ITEMS[id].tier * ITEMS[id].tier * (ITEMS[id].chain === 'junk' ? 3 : 1);
  function recycleItem(i: number) {
    const b = B(), c = b[i]; if (!c || !c.id) return;
    const wanted = S.orders.some(o => o.needs.some(nd => nd.id === c.id))
      || (curProject() && curProject().needs.some(([id]: [string, number]) => id === c.id));
    if (wanted) { sfx.no(); toast('Someone needs that! Keep it.'); return; }
    const v = sciOf(c.id);
    S.sci += v; sfx.discover(); haptic('light');
    floatText(i, '+' + v + ' 🧪', '#c9b3ff'); sparkle(i, 10, '#c9b3ff');
    b[i] = null; sel = null; tally('sell');
    paintCell(i); renderHUD(); renderOrders(); save();
  }
  let labTab = 'research';
  function researchCost(r: any) { return r.cost[Math.min(res(r.id), r.cost.length - 1)]; }
  function buyResearch(id: string) {
    const r = L2().research.find((x: any) => x.id === id); if (!r) return;
    if (res(id) >= r.max) { toast(r.name + ' is maxed out!'); return; }
    const c = researchCost(r);
    if (S.sci < c) { sfx.no(); toast(`Needs <b>${c} 🧪</b> — recycle spare items to make Science.`); return; }
    S.sci -= c; S.res[id] = res(id) + 1;
    sfx.discover(); haptic('medium'); confetti();
    toast(`🔬 <b>${r.name}</b> is now level ${res(id)}!`);
    renderLab(); renderHUD(); save();
  }
  const accLeft = () => S.acc ? Math.max(0, S.acc.at + S.acc.dur - Date.now()) : 0;
  /* Gloop's Goo Still: the Lab's own little producer. Every STILL_MIN minutes
     Gloop bottles two blobs of goo — the bottom of the Gloop Potions chain.
     Like every producer, only waiting, gems or an ad speed it up. */
  const STILL_MIN = 40;
  const stillLeft = () => Math.max(0, (S.still || 0) - Date.now());
  /* The Energy Condenser (it used to be Gloop's Goo Still): it soaks up starlight
     and, every so often, hands you a cell of energy. Bigger with research. */
  const condenseN = () => 12 + res('battery') * 2;
  function stillCollect(rush = false) {
    const left = stillLeft();
    if (left > 0 && !rush) return;
    if (left > 0 && !spendGems(Math.max(1, Math.ceil(left / 60000 / CFG.gems.rushMinPerGem)), 'rush')) return;
    const n = condenseN();
    S.energy += n; bumpChip('#chipEnergy');
    S.still = Date.now() + STILL_MIN * 60000;
    sfx.boost(); haptic('medium'); confetti();
    toast(`🔋 The Energy Condenser hums — <b>+${n} ⚡</b>!`);
    renderLab(); renderHUD(); save();
  }
  function stillPop(quiet = false) {
    const left = stillLeft();
    const pct = left > 0 ? Math.round((1 - left / (STILL_MIN * 60000)) * 100) : 100;
    const html = `<div class="condArt"><img src="${ART.spriteUi('lab_energy')}" alt=""><div class="condFill"><i style="height:${pct}%"></i></div></div>
        <div class="labIntro">The <b>Energy Condenser</b> soaks up starlight and fills a cell with <b>${condenseN()} ⚡</b> every ${STILL_MIN} minutes. Lab research makes it bigger.</div>
        ${left > 0 ? `<div class="accTime" id="stillTime">${mmss(left)}</div>
          <button class="big gold" id="stillRush">Fill it now · 💎 ${Math.max(1, Math.ceil(left / 60000 / CFG.gems.rushMinPerGem))}</button>${adBtn('skipTimer', `−${CFG.ads.skipMin} min`, 'stillAd')}`
        : `<button class="big" id="stillGet">Collect ${condenseN()} ⚡</button>`}`;
    if (quiet) $('#popBody').innerHTML = html; else pop('🔋 Energy Condenser', html, 'labstill holo');
    const g = $('#stillGet'); if (g) g.onclick = () => { closePop(); stillCollect(); };
    const r = $('#stillRush'); if (r) r.onclick = () => { closePop(); stillCollect(true); };
    const a = $('#stillAd'); if (a) a.onclick = () => watchAd('skipTimer', () => { S.still = (S.still || 0) - CFG.ads.skipMin * 60000; renderLab(); save(); });
  }
  /* ---------------------------------------------------------- Pet Incubator
     New kinds of pet come from the Lab: buy an egg with Science, wait, hatch it.
     Each kind grows through three forms and is good at something different. */
  const INC_EGGS: { sp: string; name: string; sci: number; mins: number; perk: string }[] = [
    { sp: 'fox', name: 'Crystal Fox', sci: 60, mins: 90, perk: 'digs up treasure: chests and gems' },
    { sp: 'ray', name: 'Jelly Ray', sci: 90, mins: 120, perk: 'floats in with energy' },
    { sp: 'bunny', name: 'Moon Bunny', sci: 120, mins: 150, perk: 'hops back with coins' },
  ];
  const ownedSp = (): string[] => [pet() ? (pet().sp || 'blob') : '', ...Object.keys(S.zoo || {})].filter(Boolean);
  function incPop() {
    const inc = S.inc, left = inc ? Math.max(0, inc.until - Date.now()) : 0;
    let html = '';
    if (inc) {
      const e = INC_EGGS.find(x => x.sp === inc.sp)!;
      html = `<div class="incEgg${left ? '' : ' ready'}"><img src="${ART.spriteUi('lab_incubator')}" alt=""><span>${pupArt(PET_FORMS[inc.sp + '1'])}</span></div>
        <div class="labIntro">A <b>${e.name}</b> egg is warming up.</div>
        ${left ? `<div class="accTime">${mmss(left)}</div><button class="big gold" id="incRush">Hatch now · 💎 ${Math.max(1, Math.ceil(left / 60000 / CFG.gems.rushMinPerGem))}</button>` : `<button class="big" id="incHatch">Hatch it! 🥚</button>`}`;
    } else {
      html = `<div class="labIntro">Grow a new kind of pet from an egg. Each one has its own talent and grows through three forms.</div>
        <div class="incList">${INC_EGGS.map(e => {
          const own = ownedSp().includes(e.sp);
          return `<div class="incRow${own ? ' own' : ''}"><span class="incArt">${pupArt(PET_FORMS[e.sp + '3'])}</span><div><b>${e.name}</b><i>${e.perk}</i></div>
            ${own ? '<em>✓ yours</em>' : `<button class="buyBtn" data-egg="${e.sp}" ${S.sci >= e.sci ? '' : 'disabled'}>🧪 ${e.sci}</button>`}</div>`;
        }).join('')}</div>`;
    }
    pop('🥚 Pet Incubator', html, 'holo');
    document.querySelectorAll<HTMLElement>('[data-egg]').forEach(b => b.onclick = () => {
      const e = INC_EGGS.find(x => x.sp === b.dataset.egg)!; if (S.sci < e.sci) return;
      S.sci -= e.sci; S.inc = { sp: e.sp, until: Date.now() + e.mins * 60000 }; sfx.discover(); save(); renderLab(); incPop();
    });
    const h = $('#incHatch'); if (h) h.onclick = () => { closePop(); incHatch(); };
    const r = $('#incRush'); if (r) r.onclick = () => { const l = Math.max(0, S.inc.until - Date.now()); if (spendGems(Math.max(1, Math.ceil(l / 60000 / CFG.gems.rushMinPerGem)), 'rush')) { S.inc.until = Date.now(); closePop(); incHatch(); } };
  }
  function incHatch() {
    const inc = S.inc; if (!inc || inc.until > Date.now()) return;
    const np = { sp: inc.sp, form: inc.sp + '1', lv: 1, xp: 0, n: 0, at: Date.now() - 20 * 60000, food: Date.now(), pet: 0 };
    S.inc = null; S.petIntro = 1;
    if (!pet()) S.pup = np; else { S.zoo = S.zoo || {}; S.zoo[inc.sp] = np; }
    save(); renderLab(); renderQuick();
    const f = PET_FORMS[np.form];
    rewardCard(pupArt(f), `${f.name} hatched!`, pet() === np ? 'It blinks at you and decides you are its favourite.' : 'Say hello in the pet room — tap your pet and pick it to swap.', { energy: 5 });
  }
  /** swap which pet is out with you */
  function petSwitch(sp: string) {
    if (!S.zoo || !S.zoo[sp] || !pet()) return;
    const cur = pet(); S.zoo[cur.sp || 'blob'] = cur; S.pup = S.zoo[sp]; delete S.zoo[sp];
    sfx.whoosh(); save(); renderQuick(); pupPop(true);
  }
  function accDur(id: string) { return Math.min(L2().accMaxMin, ITEMS[id].tier * L2().accMinPerTier) * 60000; }
  function accCost(id: string) { return ITEMS[id].tier * L2().accSciPerTier; }
  function accPick() {
    const inv = inventory();
    const ids = Object.keys(inv).filter(id => nextOf(id) && !ITEMS[id].part && !isChest(id) && id !== 'rainbow');
    if (!ids.length) { sfx.no(); toast('Nothing on your board can be grown right now.'); return; }
    ids.sort((a, b) => ITEMS[a].tier - ITEMS[b].tier);
    modal('bloop', 'Grow one step',
      `Pick something. The accelerator turns it into the <b>next step up</b> while you play.
       <div class="pickGrid">${ids.map(id => `<button class="pickCell" data-acc="${id}">${ART.item(id)}<b>🧪${accCost(id)}</b></button>`).join('')}</div>`, 'Cancel');
    setTimeout(() => document.querySelectorAll<HTMLElement>('[data-acc]').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.acc as string, c = accCost(id);
      if (S.sci < c) { sfx.no(); toast(`Needs <b>${c} 🧪</b>.`); return; }
      S.sci -= c; consumeOne(id);
      S.acc = { id, at: Date.now(), dur: accDur(id) };
      closeModal(); sfx.build(); paintBoard(); renderLab(); renderHUD(); save();
    }), 30);
  }
  function accCollect(rush = false) {
    if (!S.acc) return;
    const left = accLeft();
    if (left > 0 && !rush) return;
    if (left > 0 && !spendGems(Math.max(1, Math.ceil(left / 60000 / CFG.gems.rushMinPerGem)), 'rush')) return;
    const out = nextOf(S.acc.id) as string;
    if (!freeCells().length) { sfx.no(); toast('Make some room on the board first!'); return; }
    const at = giveItem(out); S.acc = null;
    sfx.discover(); confetti();
    if (at >= 0) sparkle(at, 20, '#c9b3ff');
    toast(`⚗️ Out comes a <b>${ITEMS[out].name}</b>!`);
    renderLab(); renderHUD(); renderOrders(); save();
  }
  /* THE LAB (v46). One loop, said in one line at the top:
       ♻️ recycle spare items → 🧪 Science → spend it on experiments, growing
       things one step, and permanent upgrades.
     No guessing: every experiment shows exactly what goes in and what comes out. */
  const isSpare = (id: string) => {
    const d = ITEMS[id]; if (!d || d.part || isChest(id) || id === 'rainbow' || POUCH.includes(id)) return false;
    if (S.orders.some(o => o.needs.some(nd => nd.id === id))) return false;
    if (curProject() && curProject().needs.some(([x]: [string, number]) => x === id)) return false;
    return true;
  };
  const brewSci = (r: any) => 8 + 6 * ITEMS[r.result].tier;
  /** experiments you could do on this world: inputs come from here (or anywhere) */
  function labExperiments() {
    const here = (id: string) => { const w = CHAINS[ITEMS[id].chain].world; return w === S.world || w === 'any' || w === 'ship' || inventory()[id] > 0; };
    const open = RECIPES.filter(r => r.inputs.every(here));
    const fresh = open.filter(r => !S.lab.disc[r.id]), known = open.filter(r => S.lab.disc[r.id]);
    return { list: fresh.slice(0, 3).concat(known.slice(0, 3)), total: RECIPES.length, made: RECIPES.filter(r => S.lab.disc[r.id]).length };
  }
  function brewRecipe(id: string) {
    const r = RECIPES.find(x => x.id === id); if (!r) return;
    const inv = inventory();
    const same = r.inputs[0] === r.inputs[1];
    const miss = r.inputs.filter(x => (inv[x] || 0) < (same ? 2 : 1));
    if (miss.length) { sfx.no(); toast('You need ' + [...new Set(miss)].map(x => `<b>${ITEMS[x].name}</b>`).join(' and ') + ' on the board.'); return; }
    const c = brewSci(r);
    if (S.sci < c) { sfx.no(); toast(`Needs <b>${c} 🧪</b> — recycle a few spare items first.`); return; }
    if (!freeCells().length) { sfx.no(); toast('Leave one tile free for the result!'); return; }
    S.sci -= c; consumeOne(r.inputs[0]); consumeOne(r.inputs[1]);
    const knew = !!S.lab.disc[r.id];
    const at = giveItem(r.result);
    S.lab.disc[r.id] = 1; S.lab.made = (S.lab.made || 0) + 1;
    sfx.discover(); haptic('heavy'); confetti();
    if (at >= 0) { sparkle(at, 24, '#ffe9a8'); floatText(at, ITEMS[r.result].name, '#fff'); }
    addXp(4 + ITEMS[r.result].tier * 3); prog('research', 1);
    toast((knew ? '✨ ' : '🎉 First time! ') + '<b>' + ITEMS[r.result].name + '</b> is on your board.');
    renderLab(); renderHUD(); renderOrders(); paintBoard(); save();
  }
  function recycleMany(ids: string[]) {
    const b = B(); let got = 0, n = 0;
    ids.forEach(id => { for (let i = 0; i < N; i++) if (b[i] && b[i].id === id) { got += sciOf(id); b[i] = null; n++; sparkle(i, 8, '#c9b3ff'); break; } });
    if (!n) return;
    S.sci += got; sfx.discover(); haptic('light'); tally('sell');
    toast(`♻️ Recycled ${n} spare${n > 1 ? 's' : ''}: <b>+${got} 🧪</b>`);
    paintBoard(); renderLab(); renderHUD(); renderOrders(); save();
  }
  /* The Lab is a room: the painting fills the screen and its stations sit on
     it (bench sockets, the book shelf, the lamp console). Tapping one opens a
     holographic panel with just that station. */
  function recyclerHTML() {
    const inv = inventory();
    const spares = Object.keys(inv).filter(id => inv[id] > 0 && isSpare(id) && B().some(c => c && c.id === id))
      .sort((x, y) => ITEMS[x].tier - ITEMS[y].tier).slice(0, 15);
    const lows = spares.filter(id => ITEMS[id].tier <= 2);
    const lowSci = lows.reduce((t, id) => t + sciOf(id) * B().filter(c => c && c.id === id).length, 0);
    return { lows, html: `<div class="labIntro">Spare things from your board become 🧪 <b>Science</b>. Tap one to recycle it.</div>
      ${spares.length ? `<div class="lxSpares">${spares.map(id => `<button class="lxSp" data-rec="${id}">${ART.item(id)}<b>×${B().filter(c => c && c.id === id).length}</b><em>+${sciOf(id)}🧪</em></button>`).join('')}</div>
        ${lows.length ? `<button class="big lxAll" id="lxAll">Recycle all small spares · +${lowSci} 🧪</button>` : ''}`
        : '<div class="lxNone">No spares right now — everything on your board is wanted by a contract or the chapter.</div>'}` };
  }
  function experimentsHTML() {
    const inv = inventory(), ex = labExperiments();
    const cell = (id: string, ok: boolean) => `<span class="lxIt${ok ? ' ok' : ''}" data-what="${id}">${ART.item(id)}${ok ? '<i>✓</i>' : ''}</span>`;
    return `<div class="labIntro">Two things in, something rare out. <b>${ex.made}/${ex.total}</b> discovered.</div>
      ${ex.list.length ? ex.list.map(r => {
        const same = r.inputs[0] === r.inputs[1];
        const okA = (inv[r.inputs[0]] || 0) >= 1, okB = (inv[r.inputs[1]] || 0) >= (same ? 2 : 1);
        const ready = okA && okB, c = brewSci(r);
        return `<div class="lxEx${S.lab.disc[r.id] ? ' known' : ''}">${cell(r.inputs[0], okA)}<span class="lxOp">+</span>${cell(r.inputs[1], okB)}<span class="lxOp">➜</span>
          <span class="lxIt res">${S.lab.disc[r.id] ? ART.item(r.result) : `<span class="lxQ">?</span>`}</span>
          <button class="buyBtn${ready && S.sci >= c ? '' : ' off'}" data-brew="${r.id}">🧪${c}</button></div>`;
      }).join('') : '<div class="lxNone">Experiments open up as you explore this world.</div>'}
      <div class="lxHint">Have both things on your board (✓), then brew. Tap a thing to see where it comes from.</div>`;
  }
  function labStation(k: string) {
    sfx.tap();
    if (k === 'grow') { labAccPop(); return; }
    if (k === 'res') { labResPop(); return; }
    if (k === 'goo') { stillPop(); return; }
    if (k === 'inc') { incPop(); return; }
    const draw = () => {
      const body = $('#popBody');
      if (k === 'rec') {
        const r = recyclerHTML(); body.innerHTML = r.html;
        body.querySelectorAll('[data-rec]').forEach((e: any) => e.onclick = () => { recycleMany([e.dataset.rec]); draw(); });
        const all = $('#lxAll'); if (all) all.onclick = () => { recycleMany(r.lows.flatMap(id => B().filter(c => c && c.id === id).map(() => id))); draw(); };
      } else {
        body.innerHTML = experimentsHTML();
        body.querySelectorAll('[data-brew]').forEach((e: any) => e.onclick = () => { brewRecipe(e.dataset.brew); draw(); });
        body.querySelectorAll('[data-what]').forEach((e: any) => e.onclick = () => { sfx.tap(); const id = e.dataset.what; toast(`<b>${ITEMS[id].name}</b> — ${sourceHint(id)}`); });
      }
      $('#popTitle').innerHTML = k === 'rec' ? '♻️ Recycler' : '⚗️ Fusion Chamber';
    };
    pop(k === 'rec' ? '♻️ Recycler' : '⚗️ Fusion Chamber', '', 'holo');
    draw();
  }
  function renderLab() {
    const host = $('#labBody'); if (!host) return;
    $('#labCoins').textContent = S.sci;
    const a = S.acc, left = accLeft();
    const resReady = L2().research.filter((r: any) => res(r.id) < r.max && S.sci >= researchCost(r)).length;
    const spareN = Object.keys(inventory()).filter(id => isSpare(id) && B().some(c => c && c.id === id)).length;
    const st = (k: string, fx: number, fy: number, ic: string, emo: string, t: string, sub: string, hot: boolean) =>
      `<button class="labSt${hot ? ' hot' : ''}" data-st="${k}" data-fx="${fx}" data-fy="${fy}"><span class="lsIc">${ART.uiIcon(ic, emo)}</span><b>${t}</b><i>${sub}</i></button>`;
    host.innerHTML = `<div class="sceneWrap lab"><div class="sceneBlur"></div><div class="sceneImg"></div><div class="sceneVig"></div>
      <div class="labHint">${ART.uiIcon('ic_recycle', '♻️')} Recycle spares for <b>🧪 Science</b> — spend it on fusion, upgrades and new pets</div>
      ${st('rec', 0.176, 0.60, 'lab_recycle', '♻️', 'Recycler', spareN ? spareN + ' spares' : 'no spares', spareN > 0)}
      ${st('exp', 0.50, 0.475, 'lab_fuse', '⚗️', 'Fusion', 'two in, one out', false)}
      ${st('grow', 0.16, 0.41, 'lab_time', '⏫', 'Time Boost', a ? (left ? mmss(left) : 'Ready!') : 'one step up', !!(a && !left))}
      ${st('inc', 0.84, 0.41, 'lab_incubator', '🥚', 'Incubator', S.inc ? (S.inc.until > Date.now() ? mmss(S.inc.until - Date.now()) : 'Hatch!') : 'new pets', !!(S.inc && S.inc.until <= Date.now()))}
      ${st('goo', 0.82, 0.60, 'lab_energy', '🔋', 'Condenser', stillLeft() ? mmss(stillLeft()) : '+' + condenseN() + ' ⚡', !stillLeft())}
      ${st('res', 0.62, 0.22, 'lab_upgrades', '🔬', 'Upgrades', resReady ? resReady + ' ready' : 'forever perks', resReady > 0)}
    </div>`;
    placeSpots('#labBody');
    host.querySelectorAll('[data-st]').forEach((e: any) => e.onclick = () => labStation(e.dataset.st));
    if (popOpen() && $('#pop').classList.contains('labres')) labResPop(true);
    if (popOpen() && $('#pop').classList.contains('labacc')) labAccPop(true);
    if (popOpen() && $('#pop').classList.contains('labstill')) stillPop(true);
    if (!S.labIntro && view === 'lab') {
      S.labIntro = 1; save();
      setTimeout(() => talkScene([
        ['bloop', 'Blorp! My lab. It runs on one thing: 🧪 Science.'],
        ['bloop', 'Spare things from your board go in the Recycler — that makes Science.'],
        ['bloop', 'Spend it at the bench on Experiments (two things in, a treasure out), on Grow (one item, one step up), or on the shelf for Upgrades that last forever.']], () => { }), 400);
    }
  }
  function labResPop(quiet = false) {
    const html = `<div class="labIntro">Recycle spare items on the board (tap one, then 🧪) to earn Science.</div>
        <div class="resList">${L2().research.map((r: any) => {
          const lv = res(r.id), max = lv >= r.max, c = researchCost(r);
          return `<div class="resRow${max ? ' max' : ''}"><span class="resIc">${ART.uiIcon('res_' + r.id, r.icon)}</span>
            <div class="resTxt"><b>${r.name}</b><i>${r.d}</i>
              <span class="resPips">${Array.from({ length: r.max }, (_, k) => `<em class="${k < lv ? 'on' : ''}"></em>`).join('')}</span></div>
            <button class="buyBtn sci" data-res="${r.id}"${max || S.sci < c ? ' disabled' : ''}>${max ? 'MAX' : '🧪 ' + c}</button></div>`;
        }).join('')}</div>`;
    if (quiet) $('#popBody').innerHTML = html; else pop('🔬 Research · 🧪 ' + S.sci, html, 'labres');
    $('#popTitle').innerHTML = '🔬 Research · 🧪 ' + S.sci;
    $('#popBody').querySelectorAll('[data-res]').forEach((b: any) => b.onclick = () => buyResearch(b.dataset.res as string));
  }
  function labAccPop(quiet = false) {
    const a = S.acc, left = accLeft();
    const html = `<div class="labIntro">One item goes in, and comes out <b>one step higher</b> when the timer ends.</div>
        <div class="accBox">${a ? `<div class="accArt">${ART.item(a.id)}<span class="accArrow">➜</span>${ART.item(nextOf(a.id) as string)}</div>
            <div class="catBar"><i style="width:${Math.round((1 - left / a.dur) * 100)}%"></i></div>
            ${left > 0 ? `<div class="accTime" id="accTime">${mmss(left)}</div>
              <button class="big gold" id="accRush">Finish now · 💎 ${Math.max(1, Math.ceil(left / 60000 / CFG.gems.rushMinPerGem))}</button>${adBtn('skipTimer', `−${CFG.ads.skipMin} min`, 'accAd')}`
              : `<button class="big" id="accGet">Collect ${ITEMS[nextOf(a.id) as string].name}!</button>`}`
          : `<div class="accEmpty">⚗️</div><button class="big blue" id="accLoad">Load an item</button>`}</div>`;
    if (quiet) $('#popBody').innerHTML = html; else pop('⚗️ Accelerator', html, 'labacc');
    const al = $('#accLoad'); if (al) al.onclick = () => { closePop(); accPick(); };
    const ag = $('#accGet'); if (ag) ag.onclick = () => { closePop(); accCollect(); };
    const ar = $('#accRush'); if (ar) ar.onclick = () => { closePop(); accCollect(true); };
    const aa = $('#accAd'); if (aa) aa.onclick = () => watchAd('skipTimer', () => { if (S.acc) { S.acc.at -= CFG.ads.skipMin * 60000; renderLab(); save(); } });
  }

  /* ----------------------------------------------------------- live event */
  const EV = () => CFG.event;
  /** which event is on right now (they rotate on a fixed calendar so every
   *  player sees the same one, offline or not) */
  function evNow(): { theme: any; key: string; ends: number } | null {
    if (S.lvl < EV().unlockLevel) return null;
    const cyc = EV().cycleH * 3600000, act = EV().activeH * 3600000;
    const t = Date.now() - EV().epoch, n = Math.floor(t / cyc), into = t - n * cyc;
    if (into >= act) return null;
    const theme = EV().themes[((n % EV().themes.length) + EV().themes.length) % EV().themes.length];
    return { theme, key: theme.id + n, ends: EV().epoch + n * cyc + act };
  }
  function evNext() {
    const cyc = EV().cycleH * 3600000, t = Date.now() - EV().epoch;
    return EV().epoch + (Math.floor(t / cyc) + 1) * cyc;
  }
  const dhm = (ms: number) => {
    const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m % 60}m`;
  };
  function evPts(n: number, at?: number) {
    const e = evNow(); if (!e || n <= 0) return;
    if (S.ev.key !== e.key) { evSettle(); S.ev = { key: e.key, pts: 0, got: 0, placed: S.ev.placed }; }
    S.ev.pts += n;
    if (at !== undefined) setTimeout(() => floatText(at, `+${n} ${e.theme.icon}`, '#ffd0e4'), 380);
    const tr = EV().track;
    while (S.ev.got < tr.length && S.ev.pts >= tr[S.ev.got][0]) {
      const r = tr[S.ev.got][1]; S.ev.got++;
      grant(r);
      toast(`${e.theme.icon} Event reward: <b>${rewardText(r)}</b>`);
    }
    renderQuick();
  }
  function eventPop() {
    const e = evNow();
    if (!e) {
      pop('🎉 Events', `<div class="evOff">The next event starts in <b>${dhm(evNext() - Date.now())}</b>.
        ${S.lvl < EV().unlockLevel ? `<br>Events open at level ${EV().unlockLevel}.` : ''}</div>`, 'ev');
      return;
    }
    if (S.ev.key !== e.key) S.ev = { key: e.key, pts: 0, got: 0 };
    const tr = EV().track, top = tr[tr.length - 1][0];
    pop(`${e.theme.icon} ${e.theme.name}`, `${ART.uiIcon('banner_' + e.theme.id, '').replace('class="uiIc"', 'class="uiIc evBanner"')}<div class="evHead"><span class="evFace">${ART.char(e.theme.who)}</span>
        <div><b>${S.ev.pts}</b> ${e.theme.token}<i>${e.theme.blurb}</i><em>⏳ ends in ${dhm(e.ends - Date.now())}</em></div></div>
      <div class="evTrack">${tr.map(([need, r]: [number, Reward], k: number) => `<div class="evNode${k < S.ev.got ? ' got' : S.ev.pts >= need ? ' ready' : ''}">
          <span class="evNeed">${need}</span><span class="evArt">${rewardIcon(r)}</span><span class="evRw">${rewardText(r)}</span>
          ${k < S.ev.got ? '<span class="evTick">✓</span>' : ''}</div>`).join('')}</div>
      <div class="catBar"><i style="width:${Math.min(100, Math.round(S.ev.pts / top * 100))}%"></i></div>
      ${(() => {
        const fr = evFrac(e), list = rivals(e.key, fr).concat([{ n: 'You', pts: S.ev.pts }]).sort((a, b) => b.pts - a.pts);
        const me = list.findIndex(x => x.n === 'You');
        const show = list.slice(0, 3).concat(me > 3 ? [list[me]] : list.slice(3, 4));
        return `<div class="lbBox"><div class="lbHead">🏆 Leaderboard · you are <b>#${me + 1}</b> · prize ${RANK_GEMS(me + 1)} 💎</div>
          ${show.map(x => `<div class="lbRow${x.n === 'You' ? ' me' : ''}"><b>${list.indexOf(x) < 3 ? ART.uiIcon('medal_' + (list.indexOf(x) + 1), '#' + (list.indexOf(x) + 1)) : '#' + (list.indexOf(x) + 1)}</b><span>${x.n}</span><em>${x.pts}</em></div>`).join('')}</div>`;
      })()}
      ${S.ev.join !== e.key ? `<button class="big" id="evJoin">${e.theme.icon} Invite the ${PRODS[EV_PROD[e.theme.id]].name}</button>
        <div class="noteLine">It sets up on your board for the event: free taps, and its items are worth big ${e.theme.token}.</div>` : ''}
      <div class="noteLine">Merge the event guest's items (big points!), merge to tier ${EV().points.mergeFromTier}+ (+1 and up), fill contracts (+${EV().points.contract}+), finish story chapters (+${EV().points.chapter}).</div>`, 'ev');
    const jb = document.getElementById('evJoin');
    if (jb) jb.onclick = () => {
      if (!freeCells().length) { toast('Make a free tile first — the stall needs room.'); return; }
      S.ev.join = e.key; closePop(); setView('board'); eventTick();
    };
  }

  /* ------------------------------------------------------------ the wheel */
  const SP = () => CFG.spin;
  const freeSpin = () => S.spin.day !== today();
  const spinsLeft = () => (freeSpin() ? 1 : 0) + (S.spin.tok || 0);
  let spinning = false;
  function wheelHTML() {
    const seg = SP().segments, n = seg.length, a = 360 / n;
    // deep-space slices, nebula colours alternating, instead of pastel candy
    const SPACE = ['#3a1f8f', '#1c3f9e', '#6a24a8', '#173b7a', '#4b2ab0', '#1f5aa8', '#7a2a9c', '#25307f'];
    const grad = seg.map((_s: any, k: number) => `${SPACE[k % SPACE.length]} ${k * a}deg ${(k + 1) * a}deg`).join(',');
    return `<div class="wheelWrap space"><div class="wheelPin">${ART.uiIcon('wheel_pin', '▼')}</div>
      <div class="wheel" id="wheel" style="--wheelbg:conic-gradient(${grad})">
        ${seg.map((s: any, k: number) => `<div class="wSeg" style="transform:rotate(${k * a + a / 2}deg)"><span>${rewardIcon(s.r)}<b>${s.r.energy || s.r.coins || ''}</b></span></div>`).join('')}
      </div><div class="wHub">${ART.uiIcon('wheel_hub', '🎡')}</div></div>`;
  }
  function spinPop() {
    if (S.lvl < SP().unlockLevel) { sfx.no(); toast(`The Cosmic Wheel opens at level ${SP().unlockLevel}.`); return; }
    pop('🛸 Cosmic Wheel', `<div class="hostRow"><span class="hostFace">${ART.char('oops')}</span><i>${['I foresaw this spin! Mostly.', 'The ball is cracked but the vibes are clear.', 'Spin, darling. Destiny is waiting. Or lunch.'][Math.floor(Math.random() * 3)]}</i></div>${wheelHTML()}
      <div class="noteLine" id="spinNote">${freeSpin() ? 'One <b>free spin</b> every day.' : 'Free spin used today.'} You have <b>${spinsLeft()}</b> spin${spinsLeft() === 1 ? '' : 's'}.</div>
      <button class="big gold" id="spinGo"${spinsLeft() ? '' : ' disabled'}>${spinsLeft() ? 'SPIN!' : 'Come back tomorrow'}</button>
      ${spinsLeft() ? '' : adBtn('spin', 'One more spin', 'spinAd')}
      <div class="noteLine">Extra spins come from events and the daily chest.</div>`, 'spin');
    const sa = $('#spinAd'); if (sa) sa.onclick = () => watchAd('spin', () => { S.spin.tok++; save(); spinPop(); });
    const go = $('#spinGo'); if (go) go.onclick = doSpin;
  }
  function doSpin() {
    if (spinning || !spinsLeft()) return;
    spinning = true;
    if (freeSpin()) S.spin.day = today(); else S.spin.tok--;
    const seg = SP().segments, tot = seg.reduce((a: number, s: any) => a + s.w, 0);
    let r = Math.random() * tot, k = 0;
    while (r >= seg[k].w) { r -= seg[k].w; k++; }
    const a = 360 / seg.length, target = 360 * 6 + (360 - (k * a + a / 2));
    const w = $('#wheel'); w.style.transition = 'transform 3.6s cubic-bezier(.15,.85,.2,1)'; w.style.transform = `rotate(${target}deg)`;
    ($('#spinGo') as HTMLButtonElement).disabled = true;
    sfx.whoosh();
    const ticks = setInterval(() => sfx.tap(), 180);
    setTimeout(() => clearInterval(ticks), 2600);
    setTimeout(() => {
      spinning = false; grant(seg[k].r); confetti();
      toast(`🎡 You won <b>${rewardText(seg[k].r)}</b>!`);
      spinPop(); setTimeout(() => { const w2 = $('#wheel'); if (w2) w2.style.transform = `rotate(${target % 360}deg)`; }, 0);
    }, 3800);
    save();
  }

  /* ---------------------------------------------------------- Alien Pairs */
  function playPairs() {
    const c = miniCfg('pairs');
    if (S.lvl < (c.unlockLevel || 0)) { sfx.no(); toast(`Alien Pairs opens at level ${c.unlockLevel}.`); return; }
    if (!canPlay('pairs')) return;
    setCooldown('pairs');
    const pool: string[] = [];
    liveChains().forEach(ch => CHAINS[ch].items.forEach(id => { if (ITEMS[id].tier <= 4) pool.push(id); }));
    const picks: string[] = [];
    while (picks.length < 8 && pool.length) { const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; if (picks.indexOf(id) < 0) picks.push(id); }
    while (picks.length < 8) picks.push(rnd(['pebble', 'twig', 'berry', 'dew', 'grass', 'bulbseed', 'nectar', 'caplet']));
    const cards = picks.concat(picks).sort(() => Math.random() - 0.5);
    miniState = { k: 'pairs', cards, open: [] as number[], got: new Set<number>(), flips: c.flips || 24, won: [] as string[], busy: false };
    openMini('🛸 Alien Pairs', 'Dr. Zonk shuffled some things under the cups. Find the pairs!');
    drawPairs();
  }
  function drawPairs() {
    const m = miniState; if (!m || m.k !== 'pairs') return;
    $('#miniBody').innerHTML = `<div class="pairGrid">${m.cards.map((id: string, i: number) =>
      `<button class="pCard${m.got.has(i) ? ' got' : m.open.indexOf(i) >= 0 ? ' up' : ''}" data-pc="${i}">
        <span class="pBack">?</span><span class="pFace">${ART.item(id)}</span></button>`).join('')}</div>`;
    $('#miniFoot').innerHTML = `<div class="pairInfo">Flips left: <b>${m.flips}</b> · Pairs: <b>${m.got.size / 2}/8</b></div>`;
    document.querySelectorAll<HTMLElement>('[data-pc]').forEach(b => b.onclick = () => pairTap(+b.dataset.pc!));
  }
  function pairTap(i: number) {
    const m = miniState; if (!m || m.busy || m.got.has(i) || m.open.indexOf(i) >= 0 || m.flips <= 0) return;
    m.open.push(i); sfx.pop(); drawPairs();
    if (m.open.length < 2) return;
    m.flips--; m.busy = true;
    const [a, b] = m.open;
    setTimeout(() => {
      if (m.cards[a] === m.cards[b]) { m.got.add(a); m.got.add(b); m.won.push(m.cards[a]); sfx.merge(3); }
      else sfx.no();
      m.open = []; m.busy = false; drawPairs();
      if (m.got.size === 16 || m.flips <= 0) endPairs();
    }, 650);
  }
  function endPairs() {
    const m = miniState; if (!m) return;
    const all = m.got.size === 16;
    const list: { id?: string; coins?: number }[] = m.won.slice(0, 4).map((id: string) => ({ id }));
    list.push({ coins: m.won.length * 12 });
    if (all) list.push({ id: 'chest' });
    const p = payout(list);
    $('#miniFoot').innerHTML = `<div class="pairInfo">${all ? '🎉 <b>All pairs!</b> A Supply Chest is yours.' : `${m.won.length} pairs found.`}<br>${payoutLine(p)}</div>
      <button class="big" id="pairDone">Nice!</button>`;
    $('#pairDone').onclick = closeMini;
  }

  /* ================================================================ GEMS
     The premium currency. Earned slowly (levels, chapters, achievements,
     events), bought in the shop, spent on time and convenience — never on
     story progress. */
  function addGems(n: number) { S.gems = (S.gems || 0) + n; bumpChip('#chipGems'); renderHUD(); }
  function spendGems(n: number, what: string) {
    if ((S.gems || 0) < n) { sfx.no(); toast(`Needs <b>${n} 💎</b> — get more in the 🛒 Shop.`); setTimeout(() => { shopTab = 'gems'; setView('shop'); }, 900); return false; }
    S.gems -= n; bumpChip('#chipGems'); floatOn(lastClick, '−' + n + ' 💎', '#c9b3ff'); void what; renderHUD(); return true;
  }

  /* --------------------------------------------------------- rewarded ads
     Every ad is optional and always pays: free energy, free bubbles, faster
     timers, double gifts. Capped per day so it stays a treat. */
  const adLeft = (k: string) => {
    if (!S.adc || S.adc.day !== today()) S.adc = { day: today(), n: {} };
    return Math.max(0, (CFG.ads.caps[k] || 3) - (S.adc.n[k] || 0));
  };
  async function watchAd(k: any, reward: () => void) {
    if (!adLeft(k)) { sfx.no(); toast('No more of those today — back tomorrow!'); return; }
    S.adc.n[k] = (S.adc.n[k] || 0) + 1; save();
    if (S.adfree) { reward(); return; }
    sfx.whoosh();
    const r = await ads.rewarded(k);
    if (r === 'rewarded') { reward(); return; }
    // a skipped or missing video does not use up one of today's views
    S.adc.n[k] = Math.max(0, (S.adc.n[k] || 0) - 1); save();
    toast(r === 'nofill' ? 'No video available right now — try again in a bit.' : 'The video was closed early — no reward this time.');
  }
  /** a watch-a-video offer: play badge, what you get, how many are left today */
  const adBtn = (k: string, label: string, id: string) => `<button class="adB" id="${id}"${adLeft(k) ? '' : ' disabled'}>
    <span class="adPlay">${ART.spriteUi('ic_play') ? ART.uiIcon('ic_play', '') : '<i></i>'}</span><span class="adTx"><b>${label.replace(/^Watch(?: a video)?:\s*/i, '')}</b><i>${S.adfree ? 'instant — no video' : 'watch a short video'}</i></span>
    ${S.adfree ? '' : `<span class="adLeft">${adLeft(k)}<em>left</em></span>`}</button>`;

  /* ------------------------------------------------------------- purchases */
  function gemsShop() {
    const card = (p: any) => {
      const owned = p.once && S.bought[p.id];
      const what = [p.gems ? p.gems + ' 💎' : '', p.energy ? p.energy + ' ⚡' : '', p.coins ? p.coins + ' 🪙' : '',
        p.boosts ? Object.entries(p.boosts).map(([k, n]) => n + '× ' + ((SHOP.boosters.find((x: any) => x.id === k) || { name: k }).name)).join(', ') : '', p.item ? ITEMS[p.item].name : '', p.adfree ? 'No ad videos — rewards are instant' : '']
        .filter(Boolean).join(' · ');
      return `<div class="sCard gemCard${p.tag ? ' hot' : ''}${owned ? ' owned' : ''}">${p.tag ? (/-\d+%/.test(p.tag) && ART.spriteUi('offer_burst') ? `<span class="gBurst">${p.tag.match(/-\d+%/)[0]}</span><span class="gTag">${p.tag.replace(/\s*·?\s*-\d+%/, '')}</span>` : `<span class="gTag">${p.tag}</span>`) : ''}
        <div class="sCArt">${({ gems_s: 'gem_s', gems_m: 'gem_m', gems_l: 'gem_l', gems_xl: 'gem_xl', adfree: 'ic_ad', energy_pack: 'crate_store' } as Record<string, string>)[p.id]
          ? ART.uiIcon(({ gems_s: 'gem_s', gems_m: 'gem_m', gems_l: 'gem_l', gems_xl: 'gem_xl', adfree: 'ic_ad', energy_pack: 'crate_store' } as Record<string, string>)[p.id], p.adfree ? '📺' : p.id === 'energy_pack' ? ART.icon('energy') : ART.icon('gem'))
          : ART.item('bigchest')}</div>
        <div class="sCName">${p.name}</div><div class="sCDesc">${what}</div>
        <button class="buyBtn${owned ? '' : ' cash'}" data-iap="${p.id}"${owned ? ' disabled' : ''}>${owned ? 'Owned' : p.price}</button></div>`;
    };
    return `<div class="sSec"><div class="sSecT">💎 Gems & packs ${iap.live ? '' : '<i class="testTag">test mode</i>'}</div>
      <div class="shopGrid">${PRODUCTS.filter(p => !p.id.startsWith('coins_')).map(card).join('')}</div></div>
      <button class="restoreBtn" id="iapRestore">Restore purchases</button>
      <div class="sSec"><div class="sSecT">✨ Spend gems</div><div class="shopGrid">
        <div class="sCard"><div class="sCArt">${ART.item('bigchest')}</div><div class="sCName">Galaxy Chest</div><div class="sCDesc">A Treasure Chest + 2 boosters</div>
          <button class="buyBtn gem" id="gemChest">💎 ${CFG.gems.galaxyChest}</button></div>
        <div class="sCard"><div class="sCArt">${ART.icon('energy')}</div><div class="sCName">Energy Refill</div><div class="sCDesc">+${CFG.gems.refill.energy} energy now</div>
          <button class="buyBtn gem" id="gemRefill">💎 ${CFG.gems.refill.gems}</button></div>
      </div></div>`;
  }
  /* coins for gems, or for money */
  const COIN_GEMS = [{ gems: 20, coins: 600 }, { gems: 50, coins: 1700 }, { gems: 120, coins: 4500 }];
  function coinShop() {
    const art = (n: number) => ART.spriteUi('coin_s') ? ART.uiIcon(['coin_s', 'coin_m', 'coin_l'][n - 1], '') : `<span class="coinStack">${ART.icon('coin')}${n > 1 ? ART.icon('coin') : ''}${n > 2 ? ART.icon('coin') : ''}</span>`;
    return `<div class="sSec" id="sh-coins"><div class="sSecT">🪙 Coins</div><div class="shopGrid">`
      + COIN_GEMS.map((c, k) => `<div class="sCard"><div class="sCArt">${art(k + 1)}</div><div class="sCName">${c.coins.toLocaleString()} coins</div><div class="sCDesc">for gems</div>
          <button class="buyBtn gem" data-coingem="${k}" ${S.gems < c.gems ? 'disabled' : ''}>💎 ${c.gems}</button></div>`).join('')
      + PRODUCTS.filter(p => p.id.startsWith('coins_')).map((p, k) => `<div class="sCard gemCard${p.tag ? ' hot' : ''}">${p.tag ? (/-\d+%/.test(p.tag) && ART.spriteUi('offer_burst') ? `<span class="gBurst">${p.tag.match(/-\d+%/)[0]}</span><span class="gTag">${p.tag.replace(/\s*·?\s*-\d+%/, '')}</span>` : `<span class="gTag">${p.tag}</span>`) : ''}
          <div class="sCArt">${art(k + 1)}</div><div class="sCName">${p.name}</div><div class="sCDesc">${(p.coins || 0).toLocaleString()} coins</div>
          <button class="buyBtn cash" data-iap="${p.id}">${p.price}</button></div>`).join('')
      + `</div></div>`;
  }
  function buyCoinsGems(k: number) {
    const c = COIN_GEMS[k]; if (!c) return;
    if (!spendGems(c.gems, 'coins')) return;
    S.coins += c.coins; bumpChip('#chipCoins'); sfx.coin(); confetti();
    toast(`🪙 +${c.coins.toLocaleString()} coins!`); renderShop(); renderHUD(); save();
  }
  async function buyProduct(id: string) {
    const p: any = PRODUCTS.find(x => x.id === id); if (!p || (p.once && S.bought[id])) return;
    const r = await iap.buy(p);
    if (r === 'cancelled') return;
    if (r === 'failed') { sfx.no(); toast('The purchase did not go through. Nothing was charged.'); return; }
    if (p.once) S.bought[id] = 1;
    if (p.adfree) S.adfree = 1;
    grant({ gems: p.gems, energy: p.energy, coins: p.coins, item: p.item });
    if (p.boosts) Object.entries(p.boosts).forEach(([k, n]) => giveBoost(k, n as number));
    confetti(); sfx.discover(); toast(`💎 Thank you! <b>${p.name}</b> is yours.`);
    renderShop(); renderHUD(); save();
  }
  function gemRefill() {
    if (!spendGems(CFG.gems.refill.gems, 'refill')) return;
    S.energy += CFG.gems.refill.energy; bumpChip('#chipEnergy'); sfx.boost(); renderHUD(); save();
  }

  /* ------------------------------------------------------ producer storage
     Too many producers clog the board, so it holds at most a handful. The
     rest wait in camp storage; swap them in when a chapter needs them. */
  const capProd = () => CONFIG.board.maxProducers || 7;
  const counted = (c: any) => c && c.p && !c.tmp && !c.ev && PRODS[c.p].mode !== 'once' && c.p !== 'wreck';
  const prodCount = () => B().filter(counted).length;
  const stored = (): any[] => (S.store[S.world] = S.store[S.world] || []);
  /* Producer storage, done properly: the 📦 chip sits over the board whenever
     something is stored; pick one and then tap where it should go — an empty
     tile places it, a producer on the board swaps places with it. */
  let placing: number | null = null;
  function storeProducer(i: number) {
    const c = B()[i]; if (!counted(c)) return;
    stored().push({ p: c.p, lv: c.lv, ch: c.ch, at: c.at });
    B()[i] = null; sfx.whoosh(); sparkle(i, 14, '#ffe9a8');
    toast(`📦 <b>${PRODS[c.p].name}</b> is in Storage — tap 📦 to put it back.`);
    paintBoard(); renderOrders(); renderQuick(); save();
  }
  function startPlacing(k: number) {
    const st = stored()[k]; if (!st) return;
    placing = k; closePop(); setView('board');
    let bar = document.getElementById('placeBar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'placeBar'; $('#app').appendChild(bar); }
    bar.innerHTML = `<span class="pbArt">${ART.producer(PRODS[st.p].art)}</span><span>Tap an <b>empty tile</b> for the ${PRODS[st.p].name}${prodCount() >= capProd() ? ', or a <b>producer</b> to swap' : ', or a producer to swap'}.</span><button class="xBtn" id="pbX">✕</button>`;
    bar.className = 'on'; sfx.tap();
    ($('#pbX') as HTMLElement).onclick = stopPlacing;
    board.setHint(null);
  }
  function stopPlacing() { placing = null; const bar = document.getElementById('placeBar'); if (bar) bar.className = ''; }
  /** the tap that lands while a stored producer is in hand */
  function placeAt(i: number) {
    const k = placing as number, st = stored()[k]; if (!st) { stopPlacing(); return; }
    const c = B()[i];
    const put = () => { B()[i] = { p: st.p, lv: st.lv, ch: st.ch, at: st.at }; };
    if (!c) {
      if (prodCount() >= capProd()) { sfx.no(); toast(`No room for another starter — tap one on the board to swap.`); return; }
      stored().splice(k, 1); put();
    } else if (counted(c)) {
      stored().splice(k, 1, { p: c.p, lv: c.lv, ch: c.ch, at: c.at }); put();
      toast(`Swapped: the <b>${PRODS[c.p].name}</b> went to storage.`);
    } else { sfx.no(); toast('Pick an empty tile, or a producer to swap with.'); return; }
    stopPlacing(); board.bump(i); sparkle(i, 18, '#b7f59a'); sfx.build(); haptic('medium');
    paintBoard(); renderOrders(); renderQuick(); save();
  }
  function storagePop() {
    const list = stored();
    pop(ART.uiIcon('ic_box', '📦') + ' Storage', `<div class="noteLine" style="margin-top:0">Starters you put away wait here. Pick one, then tap an empty tile — or a starter to swap with.</div>
      ${list.length ? list.map((s: any, k: number) => `<div class="enRow"><span class="enIc">${ART.producer(PRODS[s.p].art)}</span>
        <div><b>${PRODS[s.p].name}</b><i>Level ${s.lv || 1}</i></div><button class="buyBtn green" data-place="${k}">Place</button></div>`).join('')
        : '<div class="evOff">Nothing in storage. Tap a producer, then <b>Store</b>, to make room.</div>'}`, 'energy');
    document.querySelectorAll<HTMLElement>('[data-place]').forEach(b => b.onclick = () => startPlacing(+b.dataset.place!));
  }

  /* ---------------------------------------------- event guests and rivals */
  const EV_PROD: Record<string, string> = { meteor: 'fallingstar', bloom: 'lanternstall', carnival: 'candycart' };
  function eventTick() {
    evSettle();
    const e = evNow(), b = B();
    // guests from an ended event, or ones an older version placed uninvited, pack up
    for (let i = 0; i < N; i++) if (b[i] && b[i].ev && (!e || b[i].ev !== e.key || S.ev.join !== e.key)) { b[i] = null; paintBoard(); }
    // when the event is over its souvenirs are no use on the board: they sell themselves
    if (!e || S.ev.join !== e.key) {
      let n = 0, coins = 0;
      for (let i = 0; i < N; i++) { const c = b[i]; if (c && c.id && /^ev_/.test(ITEMS[c.id].chain)) { n++; coins += 15 * ITEMS[c.id].tier * ITEMS[c.id].tier; b[i] = null; } }
      if (S.bag) { const keep = S.bag.filter((id: string) => !/^ev_/.test(ITEMS[id].chain)); n += S.bag.length - keep.length; S.bag = keep; }
      if (n) { S.coins += coins; bumpChip('#chipCoins'); paintBoard(); save(); setTimeout(() => toast(`🎪 The event packed up. Your <b>${n}</b> leftover event item${n > 1 ? 's' : ''} sold for <b>${coins} 🪙</b>.`), 800); }
    }
    if (!e || view !== 'board' || !S.tut) return;
    const k = EV_PROD[e.theme.id]; if (!k || b.some((c: any) => c && c.ev === e.key)) return;
    if ((S.ev.placed || '') === e.key + S.world) return;
    // the guest only comes when invited from the event screen — dropped on a new
    // player's board unasked it is just a mystery stall full of things nobody wants
    if (S.ev.join !== e.key) return;
    const fr = freeCells(); if (!fr.length) return;
    const i = fr[fr.length - 1];
    b[i] = { ...mkProd(k), ev: e.key }; S.ev.placed = e.key + S.world;
    sparkle(i, 22, '#ffd0e4'); paintBoard(); save();
    toast(`${e.theme.icon} The <b>${PRODS[k].name}</b> arrived for the ${e.theme.name}! Merge its items for ${e.theme.token}.`);
  }
  /* rivals: twenty other travellers in your event bracket. Simulated on the
     device (no server yet) — each has a fixed pace seeded by the event key. */
  const RIVALS = ['Zorbo', 'Mipsy', 'Kael', 'Vex', 'Luno', 'Pelli', 'Quark', 'Tisha', 'Orrin', 'Bix', 'Nova', 'Juno', 'Fizz', 'Ottie', 'Rhea', 'Spud', 'Wren', 'Yuki', 'Dax'];
  function rivals(key: string, frac: number) {
    let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd2 = () => { h = (h * 1103515245 + 12345) >>> 0; return h / 4294967296; };
    return RIVALS.map(n => ({ n, pts: Math.round((60 + Math.pow(rnd2(), 1.6) * 700) * Math.min(1, Math.pow(frac, 0.8))) }));
  }
  const evFrac = (e: any) => Math.max(0.02, 1 - (e.ends - Date.now()) / (EV().activeH * 3600000));
  function evRank(key: string, pts: number, frac: number) { return 1 + rivals(key, frac).filter(x => x.pts > pts).length; }
  const RANK_GEMS = (r: number) => r === 1 ? 50 : r <= 3 ? 30 : r <= 10 ? 15 : 5;
  function evSettle() {
    const e = evNow();
    if (!S.ev || !S.ev.key || S.ev.paid || (e && e.key === S.ev.key) || !S.ev.pts) return;
    const rk = evRank(S.ev.key, S.ev.pts, 1); S.ev.paid = 1;
    const gems = RANK_GEMS(rk); addGems(gems); save();
    setTimeout(() => modal('bloop', '🏁 Event over!', `You finished <b>#${rk}</b> of 20 with ${S.ev.pts} points.<div class="rewardLine">+${gems} 💎</div>`, 'Yay!'), 600);
  }

  /* ------------------------------------------------------ discoveries
     Travel Town's best small joy: every new thing you make leaves a present
     in the album. Bigger finds give more. */
  // coins come from contracts and events only; a discovery pays in XP and, for the big ones, energy
  const discPay = (id: string) => ({ coins: 0, xp: ITEMS[id].tier * 3, energy: ITEMS[id].tier >= 3 ? ITEMS[id].tier - 1 : 0 });
  function discCard() {
    const d: string[] = S.disc || []; if (!d.length) return '';
    const tot = d.reduce((a, id) => { const p = discPay(id); a.c += p.coins; a.x += p.xp; a.e += p.energy; return a; }, { c: 0, x: 0, e: 0 });
    return `<div class="card disc"><div class="cardTitle">${ART.uiIcon('badge_new', '🆕')} New discoveries <span class="pCount">${d.length}</span></div>
      <div class="discRow">${d.slice(-8).map(id => `<span class="discIt">${ART.item(id)}</span>`).join('')}${d.length > 8 ? `<i>+${d.length - 8}</i>` : ''}</div>
      <button class="big" id="claimDisc">Collect ${tot.x} XP${tot.e ? ' · ' + tot.e + ' ⚡' : ''}</button>${adBtn('disc', 'Collect ×2', 'claimDiscAd')}</div>`;
  }
  function claimDisc(mult = 1) {
    const d: string[] = S.disc || []; if (!d.length) return;
    let c = 0, x = 0, e = 0; d.forEach(id => { const p = discPay(id); c += p.coins * mult; x += p.xp * mult; e += p.energy * mult; });
    S.disc = []; S.coins += c; S.energy += e; bumpChip('#chipCoins'); if (e) bumpChip('#chipEnergy');
    sfx.coin(); confetti(); addXp(x); toast(`🆕 Discoveries: +${x} XP${e ? ' +' + e + ' ⚡' : ''}`);
    renderBook(); renderHUD(); save();
  }

  /* ------------------------------------------------------- achievements */
  const stat = (k: string, n = 1) => { S.stats = S.stats || {}; S.stats[k] = (S.stats[k] || 0) + n; };
  const ACH = [
    { id: 'merge', icon: '✨', name: 'Merge Master', d: 'Merge {n} times', at: [50, 250, 1000, 5000], v: () => (S.stats && S.stats.merge) || 0 },
    { id: 'deliver', icon: '📦', name: 'Good Neighbour', d: 'Fill {n} contracts', at: [10, 50, 200, 800], v: () => (S.stats && S.stats.deliver) || 0 },
    { id: 'seen', icon: '📖', name: 'Collector', d: 'Discover {n} items', at: [20, 60, 120, 250], v: () => Object.keys(S.seen).length },
    { id: 'chest', icon: '🎁', name: 'Treasure Hunter', d: 'Open {n} chests', at: [5, 25, 100], v: () => (S.stats && S.stats.chest) || 0 },
    { id: 'story', icon: '📜', name: 'Storyteller', d: 'Finish {n} chapters', at: [5, 16, 40], v: () => Object.values(S.proj || {}).reduce((a: number, b: any) => a + Math.min(b, 99), 0) as number },
    { id: 'friend', icon: '❤️', name: 'Best Friends', d: 'Reach friendship {n} with anyone', at: [2, 3, 4, 5], v: () => Math.max(0, ...Object.keys(S.fr || {}).map(frLv)) },
    { id: 'level', icon: '⭐', name: 'Rising Star', d: 'Reach level {n}', at: [5, 10, 20, 30], v: () => S.lvl },
  ];
  const achTier = (a: any) => (S.ach && S.ach[a.id]) || 0;
  const achReady = () => ACH.filter(a => achTier(a) < a.at.length && a.v() >= a.at[achTier(a)]).length;
  const achReward = (t: number): Reward => t === 0 ? { coins: 60, gems: 3 } : t === 1 ? { coins: 150, energy: 10, gems: 6 } : t === 2 ? { coins: 400, spin: 1, gems: 12 } : { coins: 900, spin: 2, gems: 25 };
  function achPop() {
    pop(`${ART.uiIcon('ic_trophy', '🏆')} Achievements`, `<div class="achList">${ACH.map(a => {
      const t = achTier(a), max = t >= a.at.length, need = a.at[Math.min(t, a.at.length - 1)], v = a.v(), ok = !max && v >= need;
      return `<div class="enRow ach${ok ? ' ready' : ''}"><span class="enIc">${a.icon}</span>
        <div><b>${a.name} ${'★'.repeat(t)}<span class="achDim">${'★'.repeat(a.at.length - t)}</span></b><i>${max ? 'Complete!' : a.d.replace('{n}', String(need))}</i>
          ${max ? '' : `<span class="achBar"><em style="width:${Math.min(100, Math.round(v / need * 100))}%"></em></span>`}</div>
        ${max ? '<span class="achDone">✓</span>' : `<button class="buyBtn" data-ach="${a.id}"${ok ? '' : ' disabled'}>${ok ? 'Claim' : Math.min(v, need) + '/' + need}</button>`}</div>`;
    }).join('')}</div>`, 'spin');
    document.querySelectorAll<HTMLElement>('[data-ach]').forEach(b => b.onclick = () => {
      const a = ACH.find(x => x.id === b.dataset.ach)!; const t = achTier(a);
      if (t >= a.at.length || a.v() < a.at[t]) return;
      S.ach = S.ach || {}; S.ach[a.id] = t + 1;
      // mirror it to Google Play Games / Game Center when the store ids are filled in
      { const sid = (SERVICES.games as any).achievements[a.id + '_' + (t + 1)]; games.unlock(sid || a.id + '_' + (t + 1)); }
      const rw = achReward(t); save(); achPop(); renderHUD();
      if (view === 'rocket') renderRocket();
      rewardCard('glimmer', '🏆 ' + a.name, '<b>Captain Glimmer:</b> "MAGNIFICENT! A triumph — mostly mine, but yours too."', rw, () => { if (popOpen()) achPop(); if (view === 'rocket') renderRocket(); renderHUD(); });
    });
  }


  /* ============================================================ STAR CHALLENGE
     A week-long challenge: two featured chains you are playing right now, and
     points for merging them up, delivering contracts and opening chests.
     Three medal tiers pay out, and the week's score goes to the leaderboard. */
  const wkKey = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const weekEnds = () => { const d = new Date(wkKey() + 'T00:00:00'); d.setDate(d.getDate() + 7); return d.getTime(); };
  const WK_TIERS = [{ pts: 150, r: { coins: 300, energy: 20 } }, { pts: 400, r: { gems: 15, item: 'chest' } }, { pts: 900, r: { gems: 40, item: 'bigchest', energy: 50 } }];
  const WK_RIVALS = ['Zorp the Quick', 'Captain Nebula', 'Blibblob', 'Mx. Crater', 'Lady Quasar', 'Glorp Jr.', 'Twinkle-9', 'Sir Orbitson'];
  function weekly() {
    const k = wkKey();
    if (!S.wk || S.wk.k !== k) {
      const pool = playChains().filter(c => CHAINS[c].items.length >= 5);
      const pick: string[] = [];
      let seed = k.split('-').reduce((a, x) => a * 31 + +x, 7);
      while (pick.length < Math.min(2, pool.length)) { seed = (seed * 9301 + 49297) % 233280; const c = pool[seed % pool.length]; if (!pick.includes(c)) pick.push(c); }
      if (S.wk && S.wk.pts) { S.wkBest = Math.max(S.wkBest || 0, S.wk.pts); }
      S.wk = { k, pts: 0, feat: pick, got: [] };
    }
    return S.wk;
  }
  function weeklyAdd(n: number) {
    if (!S.tut || projDone('earth') < 3) return;
    const w = weekly(); const before = w.pts; w.pts += n;
    games.submitScore('weekly', w.pts);
    const t = WK_TIERS.findIndex(x => before < x.pts && w.pts >= x.pts);
    if (t >= 0) setTimeout(() => toast(`🏅 Star Challenge: <b>${['Bronze', 'Silver', 'Gold'][t]}</b> reached! Claim it in the Mission Log.`), 600);
  }
  function weeklyTally(kind: string, n: number) {
    if (kind === 'merge') weeklyAdd(1 * n);
    else if (kind.startsWith('make:')) { const id = kind.slice(5), it = ITEMS[id]; if (it && weekly().feat.includes(it.chain)) weeklyAdd(it.tier * 3); }
    else if (kind === 'deliver') weeklyAdd(8 * n);
    else if (kind === 'chest') weeklyAdd(3 * n);
    else if (kind === 'chain') weeklyAdd(20 * n);
    else if (kind === 'bloom') weeklyAdd(4 * n);
  }
  /** pretend rivals on the local board: their scores climb through the week */
  function wkRivals() {
    const w = weekly(), start = new Date(w.k + 'T00:00:00').getTime(), f = clamp((Date.now() - start) / (7 * 864e5), 0.05, 1);
    let seed = w.k.split('-').reduce((a, x) => a * 17 + +x, 3);
    return WK_RIVALS.map(n => { seed = (seed * 9301 + 49297) % 233280; return { n, pts: Math.round((120 + (seed % 900)) * f) }; });
  }
  function weeklyCard() {
    const w = weekly(), left = weekEnds() - Date.now();
    const top = WK_TIERS[WK_TIERS.length - 1].pts, pct = Math.min(100, Math.round(w.pts / top * 100));
    return `<div class="card wkCard"><div class="cardTitle">${ART.uiIcon('ic_trophy', '🏆')} Star Challenge<span class="pCount">${dhm(left)} left</span></div>
      <div class="wkFeat">This week: ${w.feat.map((c: string) => `<span>${ART.item(CHAINS[c].items[0])}<b>${CHAINS[c].name}</b></span>`).join('')}</div>
      <div class="wkHow">Merge featured chains for big points · contracts 8 · chests 3 · finished chains 20</div>
      <div class="wkBar"><i style="width:${pct}%"></i>${WK_TIERS.map((t, i) => `<button class="wkMed${w.pts >= t.pts ? ' ok' : ''}${w.got.includes(i) ? ' got' : ''}" data-wk="${i}" style="left:${t.pts / top * 100}%">${['🥉', '🥈', '🥇'][i]}<em>${t.pts}</em></button>`).join('')}</div>
      <div class="wkPts"><b>${w.pts}</b> points</div>
      <button class="big soft" id="wkBoard">${ART.uiIcon('ic_medals', '📊')} Leaderboard</button></div>`;
  }
  function wkClaim(i: number) {
    const w = weekly(), t = WK_TIERS[i];
    if (!t || w.pts < t.pts) { sfx.no(); toast(`Reach <b>${t ? t.pts : 0}</b> points for this medal.`); return; }
    if (w.got.includes(i)) return;
    w.got.push(i); save();
    rewardCard('glimmer', ['🥉 Bronze', '🥈 Silver', '🥇 Gold'][i] + ' — Star Challenge', '<b>Captain Glimmer:</b> "A medal! Shiny. Almost as shiny as me."', t.r as Reward, () => { if (view === 'rocket') renderRocket(); });
  }
  async function wkBoard() {
    if (await games.showBoard('weekly')) return;
    const w = weekly(), me = { n: games.signedIn ? games.player : 'You', pts: w.pts, me: true };
    const list = [...wkRivals(), me].sort((a: any, b: any) => b.pts - a.pts);
    pop('🏆 Galaxy League', `<div class="noteLine" style="margin-top:0">This week · resets in <b>${dhm(weekEnds() - Date.now())}</b></div>
      <div class="lbList">${list.map((r: any, k: number) => `<div class="lbRow${r.me ? ' me' : ''}"><b>${k + 1}</b><span>${r.n}</span><i>${r.pts}</i></div>`).join('')}</div>
      <div class="noteLine">${games.signedIn ? 'Your score is sent to the global board.' : 'Sign in to Google Play Games (⚙️ Settings) to compete on the global board. Until then you race these alien rivals.'}</div>`, 'spin');
  }
  /* ----------------------------------------------------------- coach marks
     One line, pointing at the thing, the first time it matters. Never blocks:
     any tap anywhere dismisses it. */
  type Coach = { k: string; at: string | (() => number | number[] | null); say: string; when: () => boolean; on?: string };
  const firstCell = (fn: (c: any) => boolean) => () => { const b = B(); for (let i = 0; i < N; i++) if (b[i] && fn(b[i])) return i; return null; };
  const COACH: Coach[] = [
    { k: 'contract', at: '#orders .order.ready', say: '<b>Tap</b> to give it!', when: () => !!document.querySelector('#orders .order.ready'), on: 'deliver' },
    { k: 'map', at: '#tabMap', say: 'Your <b>map</b>: upgrades, Album, Lab and games.', when: () => projDone('earth') >= 2 },
    { k: 'chapter', at: '#btnQuests', say: '<b>Tap to build</b> the chapter!', when: () => projReady(curProject()) },
    { k: 'chest', at: firstCell(c => !!c.id && isChest(c.id)), say: 'A <b>chest</b>! Tap it to open it.', when: () => B().some((c: any) => c && c.id && isChest(c.id)) },
    { k: 'wreck', at: firstCell(c => c.p === 'wreck'), say: 'Tap the <b>wreck</b> for rocket parts.', when: () => B().some((c: any) => c && c.p === 'wreck') },
    { k: 'crater', at: firstCell(c => c.p === 'crater'), say: 'A <b>crater</b>! Tap it to dig.', when: () => B().some((c: any) => c && c.p === 'crater') },
    { k: 'energy', at: '#chipEnergy', say: 'Low energy? <b>Tap here</b>.', when: () => S.energy < 8 },
  ];
  let coachOn: string | null = null, coachT = 0;
  /* Just-in-time help: the first time something matters, the screen dims around
     it and one line explains it. Never more than one, never during a story or a
     dialog, and each one only ever once. */
  function coachTick() {
    if (jit || S.tipsOff) return;
    if (!S.tut || tutOn() || view !== 'board') return;
    if (popOpen() || $('#modal').classList.contains('open') || $('#talk').classList.contains('open') || $('#mini').classList.contains('open')) return;
    if (Date.now() < coachT || Date.now() - lastAct < 900) return;
    const c = COACH.find(x => {
      if (S.coach[x.k] || !x.when()) return false;
      return typeof x.at === 'string' ? !!document.querySelector(x.at) : x.at() !== null;
    });
    if (!c) return;
    coachOn = c.k; S.coach[c.k] = 1; coachT = Date.now() + 120000; save();
    jit = { id: 'jit:' + c.k, who: S.met ? 'bloop' : 'pip', say: c.say, on: c.on, at: typeof c.at === 'string' ? (() => c.at as string) : c.at };
    tutShow(); sfx.tap();
    // a tip never traps the player: tapping the dark area closes it, and it
    // gives up on its own if the thing it points at goes away
    const mine = jit;
    document.querySelectorAll<HTMLElement>('#tut .tDim').forEach(d => d.onclick = () => { if (jit === mine) jitEnd(); });
    const watch = setInterval(() => {
      if (jit !== mine) { clearInterval(watch); return; }
      if (tutRect() === null || view !== 'board') { clearInterval(watch); jitEnd(); }
    }, 700);
  }
  function jitEnd() {
    jit = null; coachOn = null; coachT = Date.now() + 6000;
    $('#tut').classList.remove('on');
    setTimeout(() => { if (!tutOn()) $('#tut').style.display = 'none'; }, 300);
    clearInterval(tutTimer); tutTimer = 0;
  }
  function coachOff() { if (jit) jitEnd(); }

  /* ----------------------------------------------------------- rolling tips
     Every few minutes of play, one short tip about something you have
     actually unlocked — never the same one twice in a row, each at most twice. */
  const TIPS: { k: string; who: string; say: string; when: () => boolean }[] = [
    { k: 'dbl', who: 'pip', say: '<b>Double-tap</b> an item to merge it with its nearest twin — no dragging needed.', when: () => S.lvl >= 2 },
    { k: 'info', who: 'pip', say: 'Not sure where something comes from? Tap it, then the <b>ⓘ</b> in the bottom bar.', when: () => S.lvl >= 2 },
    { k: 'sell', who: 'grandma', say: 'Board getting crowded? <b>Sell</b> the little leftovers — every coin helps, dear.', when: () => freeCells().length < 8 },
    { k: 'store', who: 'grandma', say: 'Tap an item and press <b>Stash</b> to keep it safe in Storage for later.', when: () => bagHas() && S.lvl >= 3 },
    { k: 'upg', who: 'biscuit', say: 'A <b>levelled-up starter</b> drops better things and holds more charges. Tap one to upgrade it!', when: () => projDone() >= 4 },
    { k: 'seal', who: 'pip', say: 'See a <b>glowing glass bubble</b>? Drag its twin onto it and whatever is inside is yours.', when: () => B().some((c: any) => c && c.f) },
    { k: 'lab', who: 'bloop', say: 'Spare items? The <b>Recycler</b> in my Lab turns them into Science for upgrades that last forever.', when: () => labOpen() },
    { k: 'grow', who: 'bloop', say: 'The Lab can <b>grow</b> one item a step while you play. Put something in before you leave!', when: () => labOpen() && projDone() >= 8 },
    { k: 'stars', who: 'bloop', say: 'Star Scrap from craters fuses into <b>Star Cores</b>. Light a constellation in the Galaxy for a perk in every world.', when: () => !!(S.seen.scrap || pouch('scrap')) },
    { k: 'heart', who: 'grandma', say: 'Finishing a chain for the first time earns a <b>Bloom Spark</b>. Feed it to the Meadow Heart on the map!', when: () => projDone() >= 3 },
    { k: 'magnet', who: 'pip', say: 'Stuck? The <b>Star Magnet</b> pulls every matching pair together at once.', when: () => boostN('wand') > 0 },
    { k: 'x2', who: 'biscuit', say: 'Energy to spare? Switch on <b>⚡×2</b>: every tap costs double but drops one step higher.', when: () => S.lvl >= BOOST_LV },
    { k: 'wheel', who: 'oops', say: 'The <b>Cosmic Wheel</b> has a free spin every day. Destiny insists.', when: () => S.lvl >= SP().unlockLevel && spinsLeft() > 0 },
    { k: 'pet', who: 'bloop', say: 'Your <b>pet</b> fetches gifts on its own. Feed it spare items to help it grow and evolve!', when: () => petOn() },
    { k: 'daily', who: 'biscuit', say: 'The <b>Daily Log</b> in the Mission Log fills chests just for playing. Vote Marin!', when: () => projDone() >= 2 },
    { k: 'weekly', who: 'glimmer', say: 'This week\'s <b>Star Challenge</b> is in the Mission Log. Score points, climb the leaderboard!', when: () => projDone() >= 3 },
    { k: 'event', who: 'gigi', say: 'An <b>event</b> is on! Event items only show up for a few days, darling.', when: () => !!evNow() },
    { k: 'contracts', who: 'pip', say: 'Chapters need <b>contracts</b> delivered too. Keep an eye on the faces above the board!', when: () => projDone() >= 3 },
    { k: 'energyfree', who: 'pip', say: 'Out of energy? Energy comes back on its own — and the daily gift in the shop is free.', when: () => S.energy < 10 },
    { k: 'retire', who: 'grandma', say: 'Starters <b>retire</b> as the story moves on, and new ones arrive. Use them while they are here!', when: () => projDone() >= 6 },
  ];
  let tipAt = 0, lastTip = '';
  function tipTick() {
    const now = Date.now();
    if (!tipAt) { tipAt = now + 150000; return; }
    if (S.tipsOff || now < tipAt || !S.tut || tutOn() || jit || view !== 'board') return;
    if (popOpen() || $('#modal').classList.contains('open') || $('#talk').classList.contains('open') || now - lastAct < 4000) return;
    S.tipN = S.tipN || {};
    const pool = TIPS.filter(t => t.k !== lastTip && (S.tipN[t.k] || 0) < 2 && t.when());
    tipAt = now + 210000 + Math.random() * 90000;
    if (!pool.length) return;
    const t = pool.sort((a, b) => (S.tipN[a.k] || 0) - (S.tipN[b.k] || 0))[0];
    S.tipN[t.k] = (S.tipN[t.k] || 0) + 1; lastTip = t.k; save();
    let el = document.getElementById('tipBub');
    if (!el) { el = document.createElement('div'); el.id = 'tipBub'; $('#app').appendChild(el); }
    el.innerHTML = `<span class="tbFace">${ART.char(t.who)}</span><div class="tbTxt"><i>${ART.uiIcon('ic_tips', '💡')} Tip</i>${t.say}</div><button class="tbX">✕</button>`;
    el.className = 'on'; sfx.popHi();
    const hide = () => { el!.className = ''; };
    (el.querySelector('.tbX') as HTMLElement).onclick = hide;
    setTimeout(hide, 9000);
  }

  /* ------------------------------------------------------- the fun corner */
  function funPop() {
    const e = evNow();
    const card = (k: string, ic: string, name: string, sub: string, lock = '', hot = false) =>
      `<button class="funCard${lock ? ' locked' : ''}${hot ? ' hot' : ''}" data-fun="${k}"><span class="fIc">${ART.uiIcon('fun_' + k, ic)}</span><b>${name}</b><i>${lock || sub}</i></button>`;
    const cd = (k: string) => miniLeft(k) ? '⏳ ' + mmss(miniLeft(k)) : 'Ready!';
    const lockLv = (n: number) => S.lvl < n ? `🔒 Level ${n}` : '';
    pop('🎪 Fun & Games', `<div class="funGrid">
      ${card('event', e ? ART.uiIcon('tok_' + e.theme.id, e.theme.icon) : ART.uiIcon('ic_event', '🎉'), e ? e.theme.name : 'Events', e ? `${S.ev.key === e.key ? S.ev.pts : 0} ${e.theme.token} · ${dhm(e.ends - Date.now())}` : 'next in ' + dhm(evNext() - Date.now()), lockLv(EV().unlockLevel), !!e)}
      ${card('spin', ART.uiIcon('ic_spin', '🎡'), 'Lucky Wheel', spinsLeft() ? spinsLeft() + ' spin' + (spinsLeft() > 1 ? 's' : '') + ' ready!' : 'Free spin tomorrow', lockLv(SP().unlockLevel), spinsLeft() > 0 && S.lvl >= SP().unlockLevel)}
      ${card('pairs', '🛸', 'Alien Pairs', cd('pairs'), lockLv((miniCfg('pairs').unlockLevel || 0)), !miniLeft('pairs') && S.lvl >= (miniCfg('pairs').unlockLevel || 0))}
      ${card('dig', '⛏️', 'Crater Dig', cd('dig'), S.met ? '' : '🔒 After the meteor')}
      ${card('brew', '⚗️', 'Fuel Brewing', cd('brew'), rocketTime() ? '' : (S.met ? '🔒 When the ship turns up' : '🔒 After the meteor'))}
      ${card('market', '🛍️', 'Alien Market', cd('market'), S.met ? '' : '🔒 After the meteor')}
      ${card('bingo', '🧩', 'Clean-up Bingo', bingoSub(), lockLv(4), bingoReady() > 0)}
    </div>`, 'fun');
    document.querySelectorAll<HTMLElement>('[data-fun]').forEach(b => b.onclick = () => {
      if (b.classList.contains('locked')) { sfx.no(); toast('Not yet — ' + b.querySelector('i')!.textContent); return; }
      const k = b.dataset.fun;
      if (k === 'event') { eventPop(); return; }
      if (k === 'spin') { spinPop(); return; }
      closePop();
      if (k === 'stars') { closePop(); starChart(); return; }
      if (k === 'bingo') { bingoPop(); return; }
      if (k === 'pairs') playPairs(); else if (k === 'dig') playDig(); else if (k === 'brew') playBrew(); else playMarket();
    });
  }

  /* ------------------------------------------------------- Clean-up Bingo
     A weekly 3x3 card of things to hand in from your board (Merge Mansion's
     Garage Clean-up, made small). Every row, column or diagonal you finish
     pays; the whole card pays big. Old leftovers finally have a use. */
  const weekKey = () => Math.floor((Date.now() / 86400000 + 3) / 7);
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function bingo() {
    const wk = weekKey();
    if (!S.bingo || S.bingo.wk !== wk || S.bingo.world !== S.world) {
      const live = liveChains().filter(c => CHAINS[c].world !== 'any');
      const cap = clamp(2 + Math.floor(S.lvl / 5), 2, 4);
      const pool: string[] = [];
      live.forEach(c => CHAINS[c].items.forEach(id => { const t = ITEMS[id].tier; if (t >= 1 && t <= cap) pool.push(id); }));
      const cells: string[] = [], all = pool.slice();
      for (let k = 0; k < 9 && pool.length; k++) cells.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      while (cells.length < 9) cells.push(all.length ? rnd(all) : 'twig');
      cells.sort(() => Math.random() - 0.5);
      S.bingo = { wk, world: S.world, cells, done: Array(9).fill(0), paid: {} };
    }
    return S.bingo;
  }
  const bingoReady = () => { if (S.lvl < 4) return 0; const bg = bingo(); return bg.cells.filter((id: string, k: number) => !bg.done[k] && countItem(id) > 0).length; };
  const bingoSub = () => { if (S.lvl < 4) return ''; const bg = bingo(); const n = bg.done.filter(Boolean).length; return bingoReady() ? bingoReady() + ' to hand in!' : n + '/9 · new card weekly'; };
  function bingoPop() {
    const bg = bingo();
    const lineDone = (l: number[]) => l.every(k => bg.done[k]);
    pop('🧩 Clean-up Bingo', `<div class="bgGrid">${bg.cells.map((id: string, k: number) => {
        const have = !bg.done[k] && countItem(id) > 0;
        return `<button class="bgCell${bg.done[k] ? ' done' : ''}${have ? ' have' : ''}" data-bg="${k}">${ART.item(id)}${bg.done[k] ? '<span class="bgTick">✓</span>' : ''}</button>`;
      }).join('')}</div>
      <div class="bgPay">Line: <b>${ART.icon('coin')}60 · ${ART.icon('energy')}10</b> &nbsp; Full card: <b>${ART.item('chest')} + 💎 5</b></div>
      <div class="noteLine">${LINES.filter(lineDone).length}/8 lines done</div>`, 'bingoPop');
    document.querySelectorAll<HTMLElement>('[data-bg]').forEach(b => b.onclick = () => {
      const k = +b.dataset.bg!, id = bg.cells[k];
      if (bg.done[k]) return;
      if (countItem(id) < 1) { sfx.no(); toast(`Make a <b>${ITEMS[id].name}</b> first — tap it to see where it comes from.`); closePop(); chainPanel(id); return; }
      consumeOne(id); bg.done[k] = 1; sfx.pop(); haptic('light');
      let coins = 0, nrg = 0;
      LINES.forEach((l, li) => { if (!bg.paid[li] && lineDone(l)) { bg.paid[li] = 1; coins += 60; nrg += 10; } });
      if (coins) { S.coins += coins; S.energy += nrg; bumpChip('#chipCoins'); sfx.collect(); toast(`🧩 Bingo! +${coins} 🪙 +${nrg} ⚡`); }
      if (bg.done.every(Boolean) && !bg.paid.full) { bg.paid.full = 1; addGems(5); giveItem('chest'); confetti(); sfx.big(); toast('🎉 Full card! A chest and 5 💎'); }
      paintBoard(); renderHUD(); renderOrders(); save(); bingoPop();
    });
  }

  /* ------------------------------------------------------------- energy */
  function energyPop() {
    const per = regenMs(), full = S.energy >= maxEnergy();
    const next = full ? 0 : Math.max(0, per - (Date.now() - (S.eAt || Date.now())));
    pop('⚡ Energy', `${ART.spriteUi('energy_refill') ? `<img class="enArt" src="${ART.spriteUi('energy_refill')}" alt="">` : ''}<div class="enBig">${ART.icon('energy')}<b>${S.energy}</b><i>/ ${maxEnergy()}</i></div>
      <div class="noteLine" style="margin-top:2px">${full ? 'Full! Go merge something.' : `+1 every ${Math.round(per / 60000 * 10) / 10} min · next in <b>${mmss(next)}</b>`}</div>
      <div class="enRow"><span class="enIc">${ART.icon('gem')}</span><div><b>Big refill</b><i>+${CFG.gems.refill.energy} energy</i></div>
        <button class="buyBtn gem" id="enGem">💎 ${CFG.gems.refill.gems}</button></div>
      ${adBtn('energy', `+${CFG.ads.energy} ⚡ energy`, 'enAd')}
      <div class="noteLine">More energy: daily tasks, the 🎡 wheel, events, and 🔬 Lab research.</div>`, 'energy');
    const eg = $('#enGem'); if (eg) eg.onclick = () => { gemRefill(); energyPop(); };
    const ea = $('#enAd'); if (ea) ea.onclick = () => watchAd('energy', () => { S.energy += CFG.ads.energy; bumpChip('#chipEnergy'); sfx.boost(); renderHUD(); save(); energyPop(); });
  }

  /* --------------------------------------------------------- Power ×2
     The Travel Town trick for players with energy to burn: every tap costs
     double and every drop arrives one step higher. A switch, remembered. */
  const BOOST_LV = 8;
  const boostOn = () => !!S.boost2 && S.lvl >= BOOST_LV;
  function renderBoost() {
    const t = $('#tools'); if (!t) return;
    let b = document.getElementById('btnX2');
    if (S.lvl < BOOST_LV) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('button'); b.id = 'btnX2'; b.className = 'hintTag x2';
      t.insertBefore(b, t.firstChild);
      b.onclick = () => {
        S.boost2 = S.boost2 ? 0 : 1; sfx.tap(); haptic('light'); renderBoost(); save();
        toast(S.boost2 ? '⚡×2 on: taps cost double energy, drops arrive <b>one step higher</b>.' : '⚡×2 off.');
      };
    }
    b.classList.toggle('on', !!S.boost2);
    b.innerHTML = `${ART.icon('energy')}<b>×2</b>`; b.title = S.boost2 ? 'Power ×2 is on' : 'Power ×2';
  }

  /* ============================================================ MOON PUP
     A pet that turns up when you first reach the Moon. It fetches a gift every
     half hour or so, eats spare items from your board, gains levels, and
     EVOLVES: Pup → Puppy → (your choice of three hounds) → their final form.
     Each branch is good at something different, so the choice matters.
     Art: chars/pet_<form>.png when painted, the pup growth sprites until then. */
  type PetForm = { id: string; name: string; stage: number; art: string; tint?: string; perk: string; mins: number };
  const PET_FORMS: Record<string, PetForm> = {
    baby: { id: 'baby', name: 'Gloopling', stage: 1, art: 'pet_baby', perk: 'Fetches a little something now and then.', mins: 40 },
    pup: { id: 'pup', name: 'Glooper', stage: 2, art: 'pet_pup', perk: 'Fetches faster and better.', mins: 34 },
    star: { id: 'star', name: 'Star Pup', stage: 3, art: 'pet_star', perk: 'Brings <b>energy</b>. Your energy refills <b>10% faster</b>.', mins: 28 },
    crater: { id: 'crater', name: 'Crater Pup', stage: 3, art: 'pet_crater', perk: 'Digs up <b>items</b>, sometimes a chest.', mins: 28 },
    comet: { id: 'comet', name: 'Comet Pup', stage: 3, art: 'pet_comet', perk: 'Brings <b>coins and gems</b>. Contracts pay <b>10% more</b>.', mins: 28 },
    nova: { id: 'nova', name: 'Nova Wobbler', stage: 4, art: 'pet_nova', perk: 'Lots of <b>energy</b>. Energy refills <b>20% faster</b>.', mins: 22 },
    titan: { id: 'titan', name: 'Boulderbelly', stage: 4, art: 'pet_titan', perk: 'Higher-tier <b>items</b> and chests.', mins: 22 },
    king: { id: 'king', name: 'Comet Emperor', stage: 4, art: 'pet_king', perk: '<b>Coins and gems</b>. Contracts pay <b>20% more</b>.', mins: 22 },
    fox1: { id: 'fox1', name: 'Crystal Kit', stage: 1, art: 'pet_fox1', perk: 'Sniffs out <b>chests</b> now and then.', mins: 38 },
    fox2: { id: 'fox2', name: 'Crystal Fox', stage: 2, art: 'pet_fox2', perk: 'Digs up <b>chests and gems</b>.', mins: 32 },
    fox3: { id: 'fox3', name: 'Starmane Fox', stage: 3, art: 'pet_fox3', perk: '<b>Treasure Chests</b> and plenty of <b>gems</b>.', mins: 26 },
    ray1: { id: 'ray1', name: 'Jelly Puff', stage: 1, art: 'pet_ray1', perk: 'Floats in with a little <b>energy</b>.', mins: 36 },
    ray2: { id: 'ray2', name: 'Jelly Ray', stage: 2, art: 'pet_ray2', perk: 'Brings <b>energy</b>. Energy refills <b>10% faster</b>.', mins: 30 },
    ray3: { id: 'ray3', name: 'Queen Ray', stage: 3, art: 'pet_ray3', perk: 'Lots of <b>energy</b>. Energy refills <b>20% faster</b>.', mins: 24 },
    bunny1: { id: 'bunny1', name: 'Moon Bun', stage: 1, art: 'pet_bunny1', perk: 'Hops back with <b>coins</b>.', mins: 36 },
    bunny2: { id: 'bunny2', name: 'Astro Bunny', stage: 2, art: 'pet_bunny2', perk: '<b>Coins</b>. Contracts pay <b>10% more</b>.', mins: 30 },
    bunny3: { id: 'bunny3', name: 'Rocket Hare', stage: 3, art: 'pet_bunny3', perk: 'Heaps of <b>coins</b>. Contracts pay <b>20% more</b>.', mins: 24 },
  };
  /** the Lab's pets grow in a straight line: form 1 → 2 at level 5 → 3 at level 12 */
  const SP_NEXT: Record<string, [string, number]> = { fox1: ['fox2', 5], fox2: ['fox3', 12], ray1: ['ray2', 5], ray2: ['ray3', 12], bunny1: ['bunny2', 5], bunny2: ['bunny3', 12] };
  /** the pet only exists in the game once ChatGPT has painted its line */
  const petPainted = () => ['baby', 'pup', 'star', 'crater', 'comet', 'nova', 'titan', 'king'].every(k => !!ART.spriteChar('pet_' + k));
  const PET_NEXT: Record<string, string> = { star: 'nova', crater: 'titan', comet: 'king' };
  const PET_EVOLVE = { pup: 5, branch: 10, final: 20 };
  const PET_MAXLV = 25;
  const petXpNeed = (lv: number) => 40 + lv * 30;
  /** XP per meal: small, so a pet grows over days, not seconds */
  const petFeedXp = (t: number) => 2 + t * 2;
  /** it only eats when it has room: a meal fills it up, it gets hungry again over hours */
  const PET_FULL = 75, PET_MEAL = 30;
  const pet = () => S.pup as any;
  function petMigrate() {
    const p = pet(); if (!p) return;
    if (!p.sp) p.sp = 'blob';
    if (p.form) return;
    // a pup from v26 (gifts only): keep its progress as levels
    p.form = 'baby'; p.lv = 1; p.xp = (p.n || 0) * 6; p.food = Date.now(); delete p.name;
    while (p.lv < PET_MAXLV && p.xp >= petXpNeed(p.lv)) { p.xp -= petXpNeed(p.lv); p.lv++; }
    if (p.lv >= PET_EVOLVE.pup) p.form = 'pup';
  }
  const petForm = (): PetForm => PET_FORMS[(pet() && pet().form) || 'baby'];
  const petOn = () => !!pet() && petPainted();
  /** 0..100: full after a meal, empty eight hours later */
  const petFood = () => pet() ? clamp(100 - (Date.now() - (pet().food || 0)) / (8 * 36000), 0, 100) : 0;
  const petMood = () => { const f = petFood(); return f > 60 ? 'happy' : f > 25 ? 'ok' : 'hungry'; };
  const pupLeft = () => {
    if (!pet()) return 0;
    const mins = petForm().mins * (petMood() === 'happy' ? 0.8 : petMood() === 'hungry' ? 1.4 : 1);
    return Math.max(0, pet().at + mins * 60000 - Date.now());
  };
  function pupArt(form = petForm(), cls = '') {
    const mood = pet() && form === petForm() ? petMood() : '';
    const src = (mood === 'hungry' && ART.spriteChar('pet_' + form.id + '_sad')) || ART.spriteChar('pet_' + form.id);
    return `<img class="pupImg ${cls}" style="--s:${(0.62 + form.stage * 0.1).toFixed(2)}" src="${src}" alt="${form.name}">`;
  }
  /** perks other systems read */
  const petRegen = () => { const f = pet() && pet().form; return f === 'star' || f === 'ray2' ? 0.1 : f === 'nova' || f === 'ray3' ? 0.2 : 0; };
  const petCoins = () => { const f = pet() && pet().form; return f === 'comet' || f === 'bunny2' ? 0.1 : f === 'king' || f === 'bunny3' ? 0.2 : 0; };

  const PET_LV = 10;
  function pupTick() {
    if (!petPainted()) return;
    if (pet()) {
      petMigrate();
      if (!S.petIntro && S.tut && view === 'board' && !popOpen() && !$('#modal').classList.contains('open') && !$('#talk').classList.contains('open')) { S.petIntro = 1; save(); petIntro(); }
      petHelp(); petPeek();
      return;
    }
    // it comes from the Moon: the first time you are there (and settled in)
    if (S.lvl < PET_LV || (S.world === 'earth' && projDone('earth') < 14) || !S.tut || view !== 'board' || popOpen() || $('#modal').classList.contains('open') || $('#talk').classList.contains('open')) return;
    S.pup = { at: Date.now() - 38 * 60000, n: 0, pet: 0, form: 'baby', lv: 1, xp: 0, food: Date.now() }; S.petIntro = 1; save();
    petHatch(petIntro);
  }

  /* ---------------------------------------------- the pet lends a paw
     A fed pet helps on the board now and then: it merges one pair for you.
     And every so often it pops up at the edge of the board to say hello. */
  function petHelp() {
    const p = pet(); if (!p || view !== 'board' || popOpen() || jit || tutOn()) return;
    if (petMood() === 'hungry' || Date.now() < (p.help || 0)) return;
    const pair = findPair(); if (!pair) return;
    p.help = Date.now() + (35 + Math.random() * 20) * 60000; save();
    if (!tryMerge(pair[0], pair[1])) return;
    sparkle(pair[1], 18, '#ffb6f0'); sfx.voice('pup', 2);
    toast(`🐾 <b>${p.name || petForm().name}</b> pushed two things together for you!`);
    petGainXp(2); petPeek(true);
  }
  let peekAt = 0;
  function petPeek(now = false) {
    if (!pet() || view !== 'board' || popOpen()) return;
    if (!now && Date.now() < peekAt) return;
    peekAt = Date.now() + 120000 + Math.random() * 120000;
    let el = document.getElementById('petPeek');
    if (!el) { el = document.createElement('button'); el.id = 'petPeek'; $('#app').appendChild(el); el.onclick = () => { sfx.boing(); el!.className = ''; pupPop(true); }; }
    const emo = petMood() === 'hungry' ? 'emo_food' : ['emo_heart', 'emo_play', 'emo_spark', 'emo_what'][Math.floor(Math.random() * 4)];
    el.innerHTML = `${pupArt()}${ART.spriteUi(emo) ? `<img class="peekEmo" src="${ART.spriteUi(emo)}" alt="">` : '<i>Hi!</i>'}`;
    el.className = 'on' + (Math.random() < 0.5 ? ' r' : '');
    setTimeout(() => { if (el) el.className = el.className.replace('on', '').trim(); }, 5200);
  }
  /** play fetch: a star flies across the room and the pet chases it */
  function petPlay() {
    const p = pet(); if (!p) return;
    const st = $('#pupStage') as HTMLElement; if (!st) return;
    if (Date.now() < (p.play || 0)) { sfx.no(); toast(`${petForm().name} is still puffed out — play again in <b>${mmss((p.play || 0) - Date.now())}</b>.`); return; }
    p.play = Date.now() + 20 * 60000;
    const toy = ['toy_star', 'toy_ball', 'toy_bone'][Math.floor(Math.random() * 3)];
    const star = document.createElement('i'); star.className = 'petBall'; if (ART.spriteUi(toy)) star.innerHTML = `<img src="${ART.spriteUi(toy)}" alt="">`; else star.textContent = '⭐'; st.appendChild(star);
    st.classList.remove('fetch'); void st.offsetWidth; st.classList.add('fetch');
    sfx.whoosh(); setTimeout(() => { sfx.boing(); sfx.voice('pup', 3); }, 700);
    setTimeout(() => {
      star.remove(); st.classList.remove('fetch');
      const c = 15 + (p.lv || 1) * 3; S.coins += c; bumpChip('#chipCoins'); petGainXp(4); p.food = Math.max(p.food || 0, Date.now() - 3600000);
      toast(`🐾 Fetch! It brought back <b>${c} 🪙</b> it found under a rock.`); renderHUD(); save();
    }, 1500);
  }
  /** a ring of sparks and stars flying out of an element: for big moments */
  function burst(host: HTMLElement, n = 26) {
    const cols = ['#ffe48a', '#ff8ad8', '#8af0ff', '#b6ff5c', '#ffffff', '#ffb02e'];
    for (let k = 0; k < n; k++) {
      const p = document.createElement('i'); p.className = 'bstP' + (k % 3 ? '' : ' star');
      const a = (Math.PI * 2 * k) / n + Math.random() * 0.3, d = 90 + Math.random() * 110;
      p.style.cssText = `--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;--c:${cols[k % cols.length]};animation-delay:${(Math.random() * 0.15).toFixed(2)}s`;
      host.appendChild(p); setTimeout(() => p.remove(), 1500);
    }
    const ring = document.createElement('i'); ring.className = 'bstRing'; host.appendChild(ring); setTimeout(() => ring.remove(), 1000);
  }
  /* The hatch: an egg drops in, wobbles, cracks with a flash and the pet pops out. */
  function petHatch(done: () => void) {
    let el = document.getElementById('evo');
    if (!el) { el = document.createElement('div'); el.id = 'evo'; $('#app').appendChild(el); }
    const egg = ART.spriteChar('pet_egg') ? `<img src="${ART.spriteChar('pet_egg')}" alt="">`
      : ART.spriteItem('petegg') ? `<img src="${ART.spriteItem('petegg')}" alt="">` : ART.item('petegg');
    el.innerHTML = `<div class="rwcRays"></div><div class="evoTxt">Something is <b>wobbling</b>…</div>
      <div class="evoStage hatch"><span class="evoEgg">${egg}</span><span class="evoB">${pupArt(PET_FORMS.baby)}</span></div><button class="big" id="evoGo" style="visibility:hidden">Hello, little one!</button>`;
    el.className = 'open hatching'; sfx.whoosh(); haptic('light');
    setTimeout(() => { sfx.boing(); haptic('medium'); }, 900);
    setTimeout(() => {
      sfx.boing(); haptic('medium');
      const cr = ART.spriteChar('pet_egg_crack'), im = el!.querySelector('.evoEgg img') as HTMLImageElement;
      if (cr && im) im.src = cr;
    }, 1500);
    setTimeout(() => {
      el!.classList.add('done'); sfx.discover(); sfx.voice('pup', 3); haptic('heavy'); confetti();
      burst(el!.querySelector('.evoStage') as HTMLElement, 30);
      ($('.evoTxt') as HTMLElement).innerHTML = `A <b>${PET_FORMS.baby.name}</b> hatched!<br><small>It is yours now. Feed it and it will grow.</small>`;
      ($('#evoGo') as HTMLElement).style.visibility = '';
    }, 2300);
    ($('#evoGo') as HTMLElement).onclick = () => { el!.className = ''; done(); };
  }
  function petIntro() {
    talkScene([['bloop', 'Something crawled out of a crater and into my lab coat. It is squishy. It has one enormous eye. It will not stop staring at me.'],
      ['zib', 'A Gloopling! Kix knows these. They fetch things. They eat things. They CHANGE, friend.'],
      ['bloop', 'Tap it on the left of the board. It brings you a gift every half hour or so.'],
      ['bloop', 'Feed it a few spare items when it is hungry. Full bellies are happy bellies. Happy ones grow, and one day they evolve. Into what, nobody knows.']], () => { renderQuick(); setTimeout(pupPop, 600); });
  }
  function petGainXp(n: number) {
    const p = pet(); if (!p || p.lv >= PET_MAXLV) return;
    p.xp += n;
    let up = false;
    while (p.lv < PET_MAXLV && p.xp >= petXpNeed(p.lv)) { p.xp -= petXpNeed(p.lv); p.lv++; up = true; }
    if (!up) return;
    toast(`🐾 ${p.name || petForm().name} reached <b>level ${p.lv}</b>!`);
    sfx.coin();
    const f = petForm();
    if (SP_NEXT[f.id]) { if (p.lv >= SP_NEXT[f.id][1]) setTimeout(() => petEvolve(SP_NEXT[f.id][0]), 900); return; }
    if (f.id === 'baby' && p.lv >= PET_EVOLVE.pup) setTimeout(() => petEvolve('pup'), 900);
    else if (f.id === 'pup' && p.lv >= PET_EVOLVE.branch) setTimeout(petBranch, 900);
    else if (f.stage === 3 && p.lv >= PET_EVOLVE.final) setTimeout(() => petEvolve(PET_NEXT[f.id]), 900);
  }
  function pupGift(): Reward {
    const f = petForm(), k = f.stage, r = Math.random(), lv = pet().lv || 1;
    const tierUp = (f.id === 'crater' || f.id === 'titan') ? 1 : 0;
    const energy = { energy: 5 + k * 3 + Math.floor(lv / 3) }, coins = { coins: 20 + k * 18 + lv * 2 };
    const sp = pet().sp;
    if (sp === 'fox') return r < 0.1 + k * 0.06 ? { item: k >= 3 && r < 0.08 ? 'bigchest' : 'chest' } : r < 0.55 ? { gems: k } : { item: miniItem(Math.min(2 + k, 5), 2) };
    if (sp === 'ray') return r < 0.8 ? { energy: energy.energy + k * 3 } : coins;
    if (sp === 'bunny') return r < 0.75 ? { coins: Math.round(coins.coins * (1 + k * 0.4)) } : energy;
    if (f.id === 'star' || f.id === 'nova') return r < 0.75 ? { energy: energy.energy + (f.id === 'nova' ? 8 : 4) } : coins;
    if (f.id === 'comet' || f.id === 'king') return r < 0.55 ? { coins: coins.coins * 2 } : r < 0.85 ? { gems: f.id === 'king' ? 3 : 2 } : energy;
    if (tierUp) return r < 0.12 ? { item: f.id === 'titan' ? 'bigchest' : 'chest' } : { item: miniItem(Math.min(3 + tierUp + Math.floor(k / 2), 5), 2) };
    if (r < 0.35) return energy;
    if (r < 0.6) return coins;
    return { item: miniItem(Math.min(2 + Math.floor(k / 2), 4), 1) };
  }
  /** what it would eat: spare items on the board, not specials, not what a contract wants */
  function petFoodList() {
    const want = new Set<string>();
    S.orders.forEach((o: any) => o.needs.forEach((nd: any) => want.add(nd.id)));
    const pj = curProject(); if (pj) pj.needs.forEach(([id]: [string, number]) => want.add(id));
    const got: Record<string, number> = {};
    B().forEach((c: any) => {
      if (!c || !c.id || want.has(c.id)) return;
      const d = ITEMS[c.id]; if (!d || d.part || ['star', 'relic', 'bloom', 'chest', 'wild', 'hull', 'engine', 'nav', 'tank', 'fuel'].includes(d.chain)) return;
      got[c.id] = (got[c.id] || 0) + 1;
    });
    return Object.entries(got).sort((a, b) => ITEMS[a[0]].tier - ITEMS[b[0]].tier).slice(0, 12);
  }
  function petFeed(id: string) {
    const b = B(), at = b.findIndex((c: any) => c && c.id === id); if (at < 0) return;
    if (petFood() >= PET_FULL) { sfx.no(); toast(`😋 ${petForm().name} is full! Feed it again in about ${Math.ceil((petFood() - PET_FULL + 1) * 8 / 100 * 60)} min.`); return; }
    const t = ITEMS[id].tier, xp = petFeedXp(t);
    board.consume(at, id); b[at] = null;
    pet().food = Date.now() - (100 - Math.min(100, petFood() + PET_MEAL)) * 8 * 36000;
    sfx.pop(); setTimeout(() => sfx.voice('pup', 2), 120); haptic('light');
    const st = $('#pupStage'); if (st) { st.classList.remove('eating'); void (st as HTMLElement).offsetWidth; st.classList.add('eating'); }
    petGainXp(xp); paintBoard(); renderOrders(); save();
    setTimeout(() => { if (popOpen() && document.getElementById('pupStage')) pupPop(true); }, 650);
  }
  function pupPop(stay = false) {
    if (!pet()) return;
    petMigrate();
    if (!pupLeft() && !stay) {
      const r = pupGift();
      pet().at = Date.now(); pet().n = (pet().n || 0) + 1; save(); renderQuick();
      rewardCard(pupArt(), `${petForm().name} fetched!`, ['Blorp! It spits something out at your feet.', 'It looks very proud of itself.', 'All its eyes blink at you, one after the other.'][Math.floor(Math.random() * 3)], r, () => petGainXp(6));
      return;
    }
    const p = pet(), f = petForm(), mood = petMood(), food = Math.round(petFood());
    const need = p.lv >= PET_MAXLV ? 0 : petXpNeed(p.lv);
    const evoAt = f.id === 'baby' ? PET_EVOLVE.pup : f.id === 'pup' ? PET_EVOLVE.branch : f.stage === 3 ? PET_EVOLVE.final : 0;
    const feed = petFoodList();
    pop('🐾 ' + (p.name || f.name), `<div class="pupBox">
      <div class="pupStage ${mood}" id="pupStage">${ART.spriteChar('pet_bed') ? `<img class="pupBed" src="${ART.spriteChar('pet_bed')}" alt="">` : ''}${ART.spriteChar('pet_bowl') ? `<img class="pupBowl${food < 30 ? ' empty' : ''}" src="${ART.spriteChar('pet_bowl')}" alt="">` : ''}${pupArt(f)}<span class="pupMood">${ART.spriteUi('emo_heart') ? `<img src="${ART.spriteUi(mood === 'happy' ? 'emo_heart' : mood === 'hungry' ? 'emo_food' : pupLeft() ? 'emo_sleep' : 'emo_spark')}" alt="">` : mood === 'happy' ? '💗' : mood === 'hungry' ? '🍖?' : '🙂'}</span>${pupLeft() && !ART.spriteUi('emo_sleep') ? '<span class="pupZ">z<i>z</i><b>z</b></span>' : ''}</div>
      <b class="pupName">${f.name} <small>Lv ${p.lv}</small></b>
      <div class="pupBars"><span>XP</span><div class="catBar"><i style="width:${need ? Math.round(p.xp / need * 100) : 100}%"></i></div>
        <span>Food</span><div class="catBar food"><i style="width:${food}%"></i></div></div>
      <div class="noteLine">${f.perk} ${evoAt ? `<br><b>Evolves at level ${evoAt}.</b>` : '<br>Final form!'}</div>
      <div class="noteLine">Next gift in <b>${mmss(pupLeft())}</b>${mood === 'happy' ? ' (fed: faster)' : mood === 'hungry' ? ' — <b>hungry, so slower</b>' : ''}.</div>
      <div class="petFeed"><b>${food >= PET_FULL ? 'Full! Feed it again later' : 'Feed it a spare item'}</b> <i>(${food >= PET_FULL ? 'it gets hungry over a few hours' : 'a few bites, then it is full'})</i>
        <div class="petFoods">${feed.length ? feed.map(([id, n]) => `<button class="petFood" data-feed="${id}">${ART.item(id)}<em>×${n}</em><small>+${petFeedXp(ITEMS[id].tier)} XP</small></button>`).join('') : '<div class="evOff">Nothing spare on the board right now.</div>'}</div></div>
      <div class="petActs"><button class="big soft" id="pupPet">💗 Pet</button><button class="big blue" id="pupPlay">⭐ Play fetch</button></div>
      ${Object.keys(S.zoo || {}).length ? `<div class="petZoo"><b>Your other pets</b><div>${Object.keys(S.zoo).map(sp => `<button class="zooPet" data-zoo="${sp}">${pupArt(PET_FORMS[S.zoo[sp].form])}<i>${PET_FORMS[S.zoo[sp].form].name} · Lv ${S.zoo[sp].lv}</i></button>`).join('')}</div><i>Tap one to take it along instead.</i></div>` : (labOpen() ? '<div class="noteLine">More kinds of pet hatch in the Lab\'s <b>Pet Incubator</b>.</div>' : '')}</div>`, 'fun');
    document.querySelectorAll<HTMLElement>('[data-zoo]').forEach(b => b.onclick = () => petSwitch(b.dataset.zoo!));
    ($('#pupPlay') as HTMLElement).onclick = petPlay;
    document.querySelectorAll<HTMLElement>('[data-feed]').forEach(b => b.onclick = () => petFeed(b.dataset.feed!));
    ($('#pupPet') as HTMLElement).onclick = () => {
      const st = $('#pupStage'); st.classList.remove('petted'); void (st as HTMLElement).offsetWidth; st.classList.add('petted');
      for (let h = 0; h < 6; h++) { const e = document.createElement('i'); e.className = 'pupHeart'; e.textContent = '💗'; e.style.left = (25 + Math.random() * 50) + '%'; e.style.animationDelay = (h * 0.08) + 's'; st.appendChild(e); setTimeout(() => e.remove(), 1400); }
      sfx.boing(); sfx.voice('pup', 2); haptic('light');
      if (Date.now() - (p.pet || 0) > 3600000) { p.pet = Date.now(); S.energy += 3; bumpChip('#chipEnergy'); petGainXp(3); toast('It loves you. +3 ⚡'); renderHUD(); save(); }
    };
  }
  /* level 10: you choose what it becomes */
  function petBranch() {
    if (popOpen()) closePop();
    const opts = ['star', 'crater', 'comet'];
    pop('✨ Evolution!', `<div class="noteLine" style="margin-top:16px">Your ${petForm().name} is ready to evolve. <b>Choose its path</b> — this is forever.</div>
      <div class="evoPick">${opts.map(k => `<button class="evoOpt" data-evo="${k}"><span class="evoArt">${pupArt(PET_FORMS[k])}</span><b>${PET_FORMS[k].name}</b><i>${PET_FORMS[k].perk}</i><em>→ ${PET_FORMS[PET_NEXT[k]].name}</em></button>`).join('')}</div>`, 'fun');
    document.querySelectorAll<HTMLElement>('[data-evo]').forEach(b => b.onclick = () => { closePop(); petEvolve(b.dataset.evo!); });
  }
  /* the evolution scene: glow, white silhouette, pulses, then the new form */
  function petEvolve(to: string) {
    const from = petForm(), nf = PET_FORMS[to]; if (!nf) return;
    let el = document.getElementById('evo');
    if (!el) { el = document.createElement('div'); el.id = 'evo'; $('#app').appendChild(el); }
    el.innerHTML = `<div class="rwcRays"></div><div class="evoTxt">What? <b>${from.name}</b> is evolving!</div>
      <div class="evoStage"><span class="evoA">${pupArt(from)}</span><span class="evoB">${pupArt(nf)}</span></div><button class="big" id="evoGo" style="visibility:hidden">Hooray!</button>`;
    el.className = 'open'; sfx.discover(); audio.duck(4, 0.15); haptic('heavy');
    [700, 1500, 2200, 2700].forEach(t => setTimeout(() => { sfx.popHi(); haptic('light'); }, t));
    setTimeout(() => { el!.classList.add('done'); sfx.unlock(); confetti(); burst(el!.querySelector('.evoStage') as HTMLElement, 34); ($('.evoTxt') as HTMLElement).innerHTML = `It became a <b>${nf.name}</b>!<br><small>${nf.perk}</small>`; ($('#evoGo') as HTMLElement).style.visibility = ''; }, 3200);
    pet().form = to; save();
    ($('#evoGo') as HTMLElement).onclick = () => { el!.className = ''; renderQuick(); renderHUD(); };
  }

  /* -------------------------------------------- quick chips over the board */
  function renderQuick() {
    const host = $('#quick'); if (!host) return;
    const e = evNow(), bits: string[] = [];
    // contracts until the next chest: a chip with the others, not a tag stuck on the board frame
    if (S.tut) { const mn = (S.om && S.om.n) || 0; bits.push(`<button class="qChip mile" data-q="mile">${ART.uiIcon('ic_mile', ART.item('chest'))}<b>${mn}/${mileGoal()}</b><i>to chest</i></button>`); }
    if (e) bits.push(`<button class="qChip ev" data-q="event">${ART.uiIcon('tok_' + e.theme.id, e.theme.icon)}<b>${S.ev.key === e.key ? S.ev.pts : 0}</b><i>${dhm(e.ends - Date.now())}</i></button>`);
    if (S.lvl >= SP().unlockLevel && spinsLeft()) bits.push(`<button class="qChip spin" data-q="spin">${ART.uiIcon('ic_spin', '🎡')}<b>${spinsLeft()}</b></button>`);
    if (S.seen.scrap || pouch('scrap') || pouch('starcore')) bits.push(`<button class="qChip pouch" data-q="pouch">${ART.uiIcon('ic_pouch', ART.item('starcore'))}<b>${pouch('starcore')}</b><i>${pouch('scrap')} scrap</i></button>`);
    if (stored().length) bits.push(`<button class="qChip store" data-q="store">${ART.uiIcon('ic_box', '📦')}<b>${stored().length}</b></button>`);
    if (petOn()) {
      // the pet says how it is at a glance: a gift waiting, hungry, or full
      const ps = !pupLeft() ? 'gift' : petMood() === 'hungry' ? 'hungry' : petFood() >= PET_FULL ? 'full' : '';
      const pb = { gift: '🎁', hungry: '🍖', full: '💗' }[ps] || '';
      bits.push(`<button class="qChip pup${ps ? ' ' + ps : ''}${ps === 'gift' ? ' ready' : ''}" data-q="pup">${pupArt()}${pb ? `<b>${pb}</b>` : ''}<i>${pupLeft() ? mmss(pupLeft()) : 'gift!'}</i></button>`);
    }
    if (S.acc) bits.push(`<button class="qChip acc" data-q="acc">${ART.uiIcon('ic_labchip', '⚗️')}<i>${accLeft() ? mmss(accLeft()) : 'done!'}</i></button>`);
    const html = bits.join('');
    if (host.dataset.h === html) return;
    // same chips as before, only the numbers moved: update the text in place, so
    // a tap that lands mid-update is never lost to a rebuilt button
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const fresh = Array.from(tmp.children) as HTMLElement[], old = Array.from(host.children) as HTMLElement[];
    const sig = (e: HTMLElement) => e.dataset.q + '|' + e.className + '|' + (e.querySelector('img')?.getAttribute('src') || '');
    if (fresh.length === old.length && fresh.every((e, k) => sig(e) === sig(old[k]))) {
      fresh.forEach((e, k) => ['b', 'i'].forEach(t => { const a2 = e.querySelector(t), b2 = old[k].querySelector(t); if (a2 && b2 && a2.textContent !== b2.textContent) b2.textContent = a2.textContent; }));
      host.dataset.h = html; return;
    }
    host.dataset.h = html; host.innerHTML = html;
    host.querySelectorAll('[data-q]').forEach((b: any) => b.onclick = () => {
      const k = b.dataset.q;
      if (k === 'mile') { sfx.tap(); toast(`📦 Deliver <b>${mileGoal() - ((S.om && S.om.n) || 0)}</b> more contract${mileGoal() - ((S.om && S.om.n) || 0) === 1 ? '' : 's'} for ${((S.om && S.om.step) || 0) % 2 === 1 ? 'a free chest' : `+${CFG.milestone.energy} ⚡`}`); } else if (k === 'event') eventPop(); else if (k === 'spin') spinPop(); else if (k === 'pup') pupPop(); else if (k === 'store') storagePop(); else if (k === 'pouch') starChart(); else { setView('lab'); labAccPop(); }
    });
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
    playChains().forEach(c => CHAINS[c].items.forEach(id => {
      const t = ITEMS[id].tier; if (t >= minTier && t <= maxTier && (S.seen[id] || t === 1)) pool.push(id);
    }));
    if (!pool.length) liveChains().forEach(c => { const id = CHAINS[c].items[0]; if (id) pool.push(id); });
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
              : r < 0.305 ? { kind: 'item', id: 'fuelore' }
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
      + (c.open ? (c.kind === 'cavein' ? ART.uiIcon('dig_rubble', '💥') : c.kind === 'coins' ? ART.icon('coin') : ART.item(c.id)) : ART.uiIcon('dig_grass', '')) + '</button>').join('')}</div>`;
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
    if (!rocketTime()) { sfx.no(); toast('No rocket yet, so nothing to brew fuel for. Soon!'); return; }
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
    // fuel is meant to be rare: a good brew gives one ore, a perfect one two
    rewards.push({ coins: 40 + hits * 40 });
    if (hits >= 3) rewards.push({ id: 'fuelore' });
    if (hits === st.rounds) rewards.push({ id: 'fuelore' });
    $('#brewPips').innerHTML = Array.from({ length: st.rounds }, (_, i) =>
      `<i class="${st.marks[i] ? 'hit' : 'miss'}"></i>`).join('');
    const p = payout(rewards);
    $('#miniSub').innerHTML = hits === st.rounds
      ? '<b>Perfect brew!</b> Dr. Zonk is quietly impressed, which is rare.'
      : hits ? `<b>${hits} of ${st.rounds}.</b> Serviceable.` : 'Not a drop. Steadier hands next time.';
    $('#miniFoot').innerHTML = `<div class="miniStat">${payoutLine(p)}</div><button class="big" id="brewDone">Done</button>`;
    $('#brewDone').onclick = closeMini;
    if (hits === st.rounds) { confetti(); sfx.big(); }
  }

  /* ------------------------------------------------------- 3. Alien Market
     A gamble about information: three crates, you may look inside two, and you
     keep exactly one. Then Kix offers to sweeten it — for coins. */
  function playMarket() {
    if (!canPlay('market')) return;
    setCooldown('market');
    const crates = [0, 1, 2].map(() => Math.random() < 0.22
      ? { coins: 120 + Math.floor(Math.random() * 260) }
      : { id: miniItem(4, 2) });
    miniState = { crates, flips: 0, kept: -1 };
    openMini('🛸 Alien Market', `<span class="hostFace">${ART.char('grubs')}</span>The Grub Brothers let you peek inside <b>two</b> crates. You walk away with <b>one</b>. (One of them is not happy about it.)`);
    drawMarket();
  }
  function drawMarket() {
    const st = miniState;
    $('#miniBody').innerHTML = `<div class="mktRow">${st.crates.map((c: any, i: number) =>
      `<button class="mktCrate${c.open ? ' open' : ''}${st.kept === i ? ' kept' : ''}" data-m="${i}">`
      + (c.open ? `<div class="mktArt">${c.coins ? '🪙' : ART.item(c.id)}</div>
           <div class="mktLab">${c.coins ? c.coins + ' coins' : ITEMS[c.id].name}</div>`
        : `<div class="mktArt">${ART.uiIcon('mystery_box', '📦')}</div><div class="mktLab">?</div>`) + '</button>').join('')}</div>`;
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
      ? `<div class="miniStat">Kix will trade it up to a <b>${ITEMS[up].name}</b> for <b>${price} 🪙</b>.</div>
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
  /* Ten of them, two per world, each one dearer than the last: the sky fills
     in over the whole game, not in an afternoon. A constellation can only be
     traced once you have reached its world. Positions are on a 100 x 100 box. */
  const CONSTS: any[] = [
    { id: 'plough', name: 'The Rocket', world: 'earth', cost: 3, perk: '+10% coins from every sale and contract', pts: [[23.8, 50.2], [49.6, 1.4], [55.1, 31.4], [77.7, 52.1], [78.7, 76.8], [50.4, 98.4], [50.2, 67.0], [21.3, 76.8], [23.8, 50.2]] },
    { id: 'lantern', name: 'The Lantern', world: 'earth', cost: 5, perk: 'Every producer holds 20% more charges', pts: [[45.7, 29.3], [49.4, 1.2], [65.0, 27.1], [74.2, 45.1], [66.6, 59.6], [50.4, 98.0], [52.0, 67.0], [26.0, 49.8], [45.7, 29.3]] },
    { id: 'seed', name: 'The Moon Pup', world: 'luna', cost: 7, perk: 'Producers recharge 20% faster', pts: [[8.6, 39.1], [21.1, 11.1], [50.4, 1.8], [53.3, 47.1], [87.7, 33.0], [92.6, 69.7], [68.2, 95.1], [32.8, 97.3], [26.8, 65.6], [8.6, 39.1]] },
    { id: 'vault', name: 'The Vault', world: 'luna', cost: 9, perk: 'Every Bloom Essence you feed a Heart counts double', pts: [[14.1, 15.6], [49.4, 44.7], [48.0, 2.1], [81.2, 14.6], [95.5, 47.3], [84.8, 81.4], [52.5, 96.9], [18.6, 85.5], [7.2, 51.6], [14.1, 15.6]] },
    { id: 'forge', name: 'The Anvil', world: 'cindra', cost: 12, reward: { gems: 25, item: 'bigchest' }, perk: 'A Treasure Chest and 25 gems', pts: [[29.1, 49.6], [15.8, 17.0], [55.5, 26.6], [96.3, 23.2], [77.3, 43.9], [77.5, 74.8], [45.9, 81.8], [13.7, 81.1], [29.1, 49.6]] },
    { id: 'phoenix', name: 'The Firebird', world: 'cindra', cost: 14, reward: { gems: 30, energy: 60 }, perk: '30 gems and 60 energy', pts: [[11.3, 30.7], [19.7, 0.8], [51.8, 21.9], [80.1, 4.9], [89.3, 27.9], [67.2, 56.4], [82.0, 79.3], [62.1, 98.0], [49.2, 75.4], [26.8, 89.6], [31.1, 53.7], [11.3, 30.7]] },
    { id: 'squid', name: 'The Kraken', world: 'nerith', cost: 16, reward: { gems: 35, item: 'bigchest' }, perk: 'A Treasure Chest and 35 gems', pts: [[15.8, 31.6], [42.6, 46.5], [47.7, 1.4], [64.8, 23.4], [87.9, 39.5], [68.6, 65.4], [82.2, 94.5], [42.4, 93.4], [33.6, 69.9], [9.8, 77.9], [12.1, 54.7], [15.8, 31.6]] },
    { id: 'shell', name: 'The Shell', world: 'nerith', cost: 18, reward: { gems: 40, energy: 80 }, perk: '40 gems and 80 energy', pts: [[42.2, 41.0], [48.0, 1.8], [71.3, 18.4], [82.0, 44.9], [88.5, 75.4], [66.6, 97.7], [53.5, 68.6], [30.9, 87.9], [7.0, 59.4], [42.2, 41.0]] },
    { id: 'crown', name: 'The Crown', world: 'vela', cost: 22, reward: { gems: 60, item: 'bigchest' }, perk: 'A Treasure Chest and 60 gems', pts: [[4.5, 38.1], [32.2, 30.1], [49.6, 4.7], [71.3, 33.2], [96.7, 40.2], [87.7, 65.0], [60.9, 94.1], [21.5, 91.6], [43.0, 55.3], [12.3, 65.0], [4.5, 38.1]] },
    { id: 'galaxy', name: 'The Galaxy', world: 'vela', cost: 30, reward: { gems: 100, item: 'bigchest', energy: 100 }, perk: '100 gems, 100 energy and a Treasure Chest', pts: [[6.6, 36.5], [28.1, 8.6], [49.6, 46.9], [63.1, 4.7], [86.1, 28.9], [91.2, 62.1], [65.8, 66.4], [71.1, 91.2], [35.7, 94.1], [29.7, 61.9], [7.0, 72.5], [6.6, 36.5]] },
  ];
  const lit = (id: string) => !!(typeof S !== 'undefined' && S && S.stars && S.stars[id]);
  const starPerk = (id: string) => lit(id);
  /* The Star Chart lives IN the galaxy: every constellation hangs in the sky
     beside the world you see it from. Tap one for its card; light it and it
     draws itself across the sky, then stays glowing there for good. */
  const constById = (id: string) => CONSTS.find(x => x.id === id);
  const constState = (c: any) => lit(c.id) ? 'lit' : !visited(c.world) ? 'locked' : countItem('starcore') >= c.cost ? 'ready' : 'open';
  function constSvg(c: any, cls = '') {
    const segs = c.pts.slice(1).map((p: number[], i: number) => { const q = c.pts[i]; return `<line x1="${q[0]}" y1="${q[1]}" x2="${p[0]}" y2="${p[1]}"/>`; }).join('');
    const dots = c.pts.map((p: number[], i: number) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i % 3 ? 3 : 4.2}" style="animation-delay:${(i * 0.37) % 2.2}s"/>`).join('');
    const art = ART.spriteUi('const_' + c.id);
    return `<svg viewBox="-8 -8 116 116" class="cSvg ${cls}${art ? ' hasArt' : ''}">${art ? `<image class="cImg" href="${art}" x="0" y="0" width="100" height="100"/>` : ''}<g class="cLines">${segs}</g><g class="cDots">${dots}</g></svg>`;
  }
  /** the painted figure behind a constellation's stars (const_<id>), when there is one */
  const constArt = (_c: any) => '';   // the painted figure now sits inside the svg, under its own stars
  function fuseScrap() {
    if (pouch('scrap') < 3) return false;
    S.wal.scrap -= 3; S.wal.starcore = pouch('starcore') + 1; S.seen.starcore = 1;
    sfx.discover(); haptic('medium'); save(); return true;
  }
  const flowHTML = () => `<div class="skFlow">
      <span><img src="${ART.spriteUi('sk_shoot')}" alt=""><i>Dig meteor craters</i></span><em>➜</em>
      <span><img src="${ART.spriteUi('starscrap_ui')}" alt=""><i>Star Scrap<b>${pouch('scrap')}</b></i></span><em>➜</em>
      <span><img src="${ART.spriteUi('starcore_ui')}" alt=""><i>Star Core<b>${countItem('starcore')}</b></i></span><em>➜</em>
      <span><img src="${ART.spriteUi('sk_badge')}" alt=""><i>Light a constellation</i></span></div>`;
  const fuseBtn = () => `<button class="skFuse2" id="skFuseH" ${pouch('scrap') < 3 ? 'disabled' : ''}><img src="${ART.spriteUi('sk_fuser')}" alt=""><span><b>Fuse</b><i>3 Star Scrap → 1 Star Core</i></span></button>`;
  /** how it works, from the star button in the galaxy */
  function starHelp() {
    const n = CONSTS.filter(c => lit(c.id)).length;
    pop('✨ Star Chart', `${flowHTML()}
      <div class="skExplain">Every world has two constellations in its sky. Fill one with <b>Star Cores</b> and it lights up for good: a perk that works in every world, or a big gift.</div>
      ${fuseBtn()}
      <div class="skLitBar"><i style="width:${Math.round(n / CONSTS.length * 100)}%"></i><span>${n}/${CONSTS.length} constellations lit</span></div>`, 'starsheet');
    const f = $('#skFuseH'); if (f) f.onclick = () => { if (fuseScrap()) { starHelp(); skyPage(); } };
  }
  /** one constellation's card */
  function constCard(id: string) {
    const c = constById(id); if (!c) return;
    const st = constState(c), cores = countItem('starcore'), pct = Math.min(100, Math.round(cores / c.cost * 100));
    const body = st === 'lit' ? `<div class="skDone">✦ Lit — ${c.reward ? 'its gift is yours' : 'active in every world'}</div>`
      : st === 'locked' ? `<div class="skNeed">You can only see it from <b>${WORLDS[c.world].name}</b>. Fly there first.</div>`
      : `<div class="skBar2"><em style="width:${pct}%"></em><span>${ART.item('starcore')} ${Math.min(cores, c.cost)} / ${c.cost} Star Cores</span></div>
         ${st === 'ready' ? `<button class="skLightBig" id="skLight"><img src="${ART.spriteUi('sk_shoot')}" alt=""><b>Light it!</b></button>`
           : `<div class="skNeed">${c.cost - cores} more Star Core${c.cost - cores > 1 ? 's' : ''}. Dig meteor craters for Star Scrap, then fuse it.</div>${fuseBtn()}`}`;
    pop(st === 'locked' ? '✨ Unknown stars' : '✨ ' + c.name, `<div class="skCardBig gc-${st}">${constArt(c)}${constSvg(c, 'cBig')}</div>
      <div class="skPerk">${st === 'locked' ? 'A constellation nobody has charted yet.' : c.perk}</div>${body}`, 'starsheet');
    const l = $('#skLight'); if (l) l.onclick = () => skyLight(c.id);
    const f = $('#skFuseH'); if (f) f.onclick = () => { if (fuseScrap()) { constCard(id); skyPage(); } };
  }
  /** the Star Chart page: the painted night sky, every constellation drawn on it */
  function skyPage() {
    let el = document.getElementById('skyChart');
    if (!el) { el = document.createElement('div'); el.id = 'skyChart'; $('#app').appendChild(el); }
    const rows = WORLD_ORDER.filter(w => CONSTS.some(c => c.world === w)).map(w => {
      const two = CONSTS.filter(c => c.world === w).map((c, k) => {
        const st = constState(c);
        return `<button class="gc gc-${st} ${k ? 'r' : 'l'}" data-const="${c.id}">${constArt(c)}${constSvg(c)}
          <b>${st === 'locked' ? '???' : c.name}</b>${st === 'ready' ? '<i class="gcTag">✨ Light me!</i>' : st === 'open' ? `<i class="gcCnt">${ART.item('starcore')} ${Math.min(countItem('starcore'), c.cost)}/${c.cost}</i>` : st === 'lit' ? '<i class="gcLit">✦ lit</i>' : ''}</button>`;
      }).join('');
      return `<div class="skRow${visited(w) ? '' : ' far'}"><div class="skWorld">${ART.uiIcon('planet_' + w, '🪐')}<span>Seen from <b>${WORLDS[w].name}</b></span></div><div class="skPair">${two}</div></div>`;
    }).join('');
    const n = CONSTS.filter(c => lit(c.id)).length;
    el.innerHTML = `<div class="skBgArt"></div><div class="skNeb"></div>
      <div class="skTop2"><button class="galBack" id="skBack">↩ Galaxy</button><b>Star Chart</b>
        <span class="skPouch2"><img src="${ART.spriteUi('starcore_ui')}" alt=""><b>${countItem('starcore')}</b></span><button class="skHelp" id="skHelp">?</button></div>
      <div class="skLit2"><i style="width:${Math.round(n / CONSTS.length * 100)}%"></i><span>${n}/${CONSTS.length} constellations lit</span></div>
      <div class="skScroll2" id="skScroll">${rows}<div class="skEnd">More skies wait beyond Aurora Reach…</div></div>
      <div class="skDock"><button class="skFuser${pouch('scrap') >= 3 ? ' on' : ''}" id="skFuse"><img src="${ART.spriteUi('sk_fuser')}" alt=""></button>
        <div class="skDockTxt"><b>Star Fuser</b><i>${ART.spriteUi('starscrap_ui') ? `<img src="${ART.spriteUi('starscrap_ui')}" alt="">` : ''} ${pouch('scrap')} scrap · 3 make 1 Star Core</i></div>
        <button class="skFuseGo" id="skFuseGo" ${pouch('scrap') < 3 ? 'disabled' : ''}>Fuse</button></div>`;
    el.className = 'open';
    ($('#skBack') as HTMLElement).onclick = () => { sfx.close(); el!.className = ''; renderWorldScreen(); };
    ($('#skHelp') as HTMLElement).onclick = () => { sfx.tap(); starHelp(); };
    const fuse = () => {
      if (!fuseScrap()) { sfx.no(); toast('Dig meteor craters for Star Scrap — 3 make a Star Core.'); return; }
      const m = $('#skFuse') as HTMLElement; m.classList.remove('go'); void m.offsetWidth; m.classList.add('go');
      burst(m, 18); setTimeout(skyPage, 650);
    };
    ($('#skFuse') as HTMLElement).onclick = fuse; ($('#skFuseGo') as HTMLElement).onclick = fuse;
    el.querySelectorAll<HTMLElement>('[data-const]').forEach(b => b.onclick = () => { sfx.tap(); constCard(b.dataset.const!); });
  }
  /** open the chart page, optionally scrolled to (and opening) one constellation */
  function starChart(focus?: string) {
    skyPage(); audio.duck(1, 0.5);
    S.story = S.story || {};
    const go = () => {
      if (!focus) return;
      const el = document.querySelector(`#skyChart .gc[data-const="${focus}"]`) as HTMLElement, sc = $('#skScroll');
      if (el && sc) sc.scrollTop = Math.max(0, el.offsetTop - sc.clientHeight / 2);
      constCard(focus);
    };
    if (!S.story.stars) {
      S.story.stars = 1; save();
      talkScene([
        ['bloop', 'Blorp! The Star Chart. Every dot up there is a sleeping constellation — and every one of them owes us a favour.'],
        ['bloop', 'Dig meteor craters for <b>Star Scrap</b>. Feed three to the <b>Star Fuser</b> down there and out pops a glowing <b>Star Core</b>.'],
        ['bloop', 'Give a constellation enough Star Cores and it lights up for good — a perk in every world. Start with <b>The Rocket</b>!'],
      ], go);
    } else go();
  }
  /* Lighting one: the sky dims, the constellation fills the screen, its stars
     pop one after another and the lines draw between them, a shooting star
     crosses, then it shrinks back to its own place in the galaxy, glowing. */
  function skyLight(id: string) {
    const c = constById(id); if (!c || lit(id)) return;
    if (countItem('starcore') < c.cost) { sfx.no(); return; }
    for (let k = 0; k < c.cost; k++) consumeOne('starcore');
    S.stars[c.id] = 1; prog('star', 1); save();
    closePop();
    let fx = document.getElementById('skFx');
    if (!fx) { fx = document.createElement('div'); fx.id = 'skFx'; $('#app').appendChild(fx); }
    const T = 0.24;
    const segs = c.pts.slice(1).map((p: number[], i: number) => { const q = c.pts[i]; return `<line class="skSeg" x1="${q[0]}" y1="${q[1]}" x2="${p[0]}" y2="${p[1]}" style="animation-delay:${0.3 + i * T}s"/>`; }).join('');
    const dots = c.pts.map((p: number[], i: number) => `<circle class="skStar" cx="${p[0]}" cy="${p[1]}" r="3.6" style="animation-delay:${i * T}s"/>`).join('');
    const end = c.pts.length * T;
    fx.innerHTML = `<div class="fxSky"></div><div class="fxRays"></div>
      <div class="fxIn"><div class="fxName">${c.name}</div><div class="fxArtWrap"><svg viewBox="-8 -8 116 116" class="skBig" id="fxSvg">${ART.spriteUi('const_' + c.id) ? `<image class="fxArt" href="${ART.spriteUi('const_' + c.id)}" x="0" y="0" width="100" height="100" style="animation-delay:${end * 0.5}s"/>` : ''}${segs}${dots}</svg></div>
      <div class="fxLit" style="animation-delay:${end + 0.2}s">CONSTELLATION LIT!</div><div class="fxPerk" style="animation-delay:${end + 0.5}s">${c.perk}</div></div>
      <i class="skShoot" style="animation-delay:${end * 0.6}s"></i><i class="skShoot b" style="animation-delay:${end * 0.6 + 0.5}s"></i>`;
    fx.className = 'on'; sfx.whoosh(); audio.duck(4, 0.2);
    c.pts.forEach((_: any, i: number) => setTimeout(() => sfx.star(), i * T * 1000));
    setTimeout(() => { sfx.discover(); haptic('heavy'); confetti(); fx!.classList.add('flash'); }, (end + 0.2) * 1000);
    setTimeout(() => {
      // fly back into the galaxy, onto its own spot
      skyPage();
      const spot = document.querySelector(`#skyChart .gc[data-const="${c.id}"]`) as HTMLElement, sc = $('#skScroll');
      if (spot && sc) sc.scrollTop = Math.max(0, spot.offsetTop - sc.clientHeight / 2);
      const svg = $('#fxSvg') as HTMLElement;
      if (spot && svg) {
        const a = svg.getBoundingClientRect(), t = spot.querySelector('svg')!.getBoundingClientRect();
        svg.style.transition = 'transform .7s cubic-bezier(.5,0,.3,1)';
        svg.style.transform = `translate(${t.left + t.width / 2 - (a.left + a.width / 2)}px, ${t.top + t.height / 2 - (a.top + a.height / 2)}px) scale(${t.width / a.width})`;
      }
      fx!.classList.add('out');
      setTimeout(() => {
        fx!.className = ''; fx!.innerHTML = '';
        if (spot) { spot.classList.add('justLit'); burst(spot, 26); }
        const r: Reward = c.reward || {};
        if (c.reward && r.item && freeCells().length) giveItem(r.item);
        if (r.gems) S.gems += r.gems;
        if (r.energy) S.energy += r.energy;
        save(); renderHUD();
        setTimeout(() => rewardCard(`<img class="rwcChest" src="${ART.spriteUi('sk_badge')}" alt="">`, `${c.name} is lit!`, c.reward ? 'The sky hands you a gift.' : `${c.perk}. For good, in every world.`, c.reward ? r : { energy: 10 }), 700);
      }, 750);
    }, (end + 2.4) * 1000);
  }

  /* ============================================================ WORLD SCREEN
     Not a list of cards — a painted place you tap. The camp is the world you
     are standing in, with your rocket on the big pad, the lab beside it, the
     Heart on the far plinth and every producer on a stone of its own. The
     galaxy is the map between worlds. Everything else pops up over the top. */
  let worldTab: 'camp' | 'galaxy' = 'camp';
  let fromMap = false;

  /* Anchors measured off the painted background, as a fraction of the scene.
     Each one is the *top of a plinth*, and a spot is drawn standing on it. */
  const PAD_DEFAULT = {
    rocket: [0.355, 0.435], lab: [0.545, 0.545], heart: [0.788, 0.472],
  };
  const PROD_PADS_DEFAULT = [
    [0.265, 0.742], [0.512, 0.742], [0.788, 0.738],
    [0.36, 0.90], [0.64, 0.90], [0.15, 0.605],
  ];

  function spot(kind: string, pad: number[], art: string, label: string, sub: string, cls = '', badge = '') {
    return `<button class="spot ${cls}" data-ent="${kind}" data-fx="${pad[0]}" data-fy="${pad[1]}">
      ${badge ? `<span class="spotBadge">${badge}</span>` : ''}
      <span class="spotArt">${art}</span>
      <span class="spotTag"><b>${label}</b>${sub ? `<i>${sub}</i>` : ''}</span></button>`;
  }

  const hubBtn = (k: string, ic: string, emo: string, label: string) =>
    `<button class="hubBtn" data-hub="${k}"><span class="ti">${ART.uiIcon(ic, emo)}</span><i>${label}</i>${hubN[k] ? `<span class="dot">${hubN[k] > 1 ? hubN[k] : ''}</span>` : ''}</button>`;
  function campHTML() {
    const A = sceneAnchors(S.world);
    const PAD = { ...PAD_DEFAULT, ...A };
    const PROD_PADS: number[][] = A.prods || PROD_PADS_DEFAULT;
    const w = W(), b = B();
    const prods: { i: number; k: string }[] = [];
    for (let i = 0; i < N; i++) if (b[i] && b[i].p && PRODS[b[i].p].mode !== 'once' && !b[i].tmp && !b[i].ev) prods.push({ i, k: b[i].p });

    const built = Object.keys(S.parts).filter(k => S.parts[k]).length;
    const P = !!A.painted;   // the painting already has the rocket, lab and heart: tap targets only
    const hole = (k: string) => `<div class="spotPaint ${k}"></div>`;
    let ents = !rocketTime() ? '' : P ? spot('rocket', PAD.rocket, hole('rk'),
      S.met ? 'Rocket' : 'Launch pad',
      S.met ? (allParts() ? 'Ready · ⛽' + S.fuel + '/' + CONFIG.rocket.fuelToLaunch : built + '/4 parts') : 'nothing here yet',
      'ship painted' + (S.met && allParts() && S.fuel >= CONFIG.rocket.fuelToLaunch ? ' ready' : '')) : spot('rocket', PAD.rocket,
      S.met ? (ART.spriteUi('rocket_0') ? `<img class="campImg" src="${ART.spriteUi('rocket_' + (built >= 4 ? 3 : built >= 3 ? 2 : built >= 1 ? 1 : 0))}">`
        : built ? (ART.spriteUi('rocket_0') ? `<img class="rkImg" src="${ART.spriteUi('rocket_' + (built >= 4 ? 3 : built >= 3 ? 2 : built >= 1 ? 1 : 0))}">` : ART.rocket(S.parts)) : '<div class="spotGhost">🚀</div>') : '<div class="spotGhost">🚀</div>',
      S.met ? 'Rocket' : '???',
      S.met ? (allParts() ? 'Ready · ⛽' + S.fuel + '/' + CONFIG.rocket.fuelToLaunch : built + '/4 parts') : 'nothing here yet',
      'ship' + (S.met && allParts() && S.fuel >= CONFIG.rocket.fuelToLaunch ? ' ready' : ''));
    // no lab yet: its corner of the painting is a grey, boarded-up ruin
    // the painting has a finished lab in it: veil that corner first, so only the ruin reads
    if (!labOpen() && P && ART.spriteUi('camp_lab_ruin') && !ART.spriteScene(S.world + '_nolab')) ents += `<div class="labHide" data-fx="${PAD.lab[0]}" data-fy="${PAD.lab[1]}"></div>`;
    applyScene();
    if (!labOpen() && P) ents += ART.spriteUi('camp_lab_ruin')
      ? `<div class="labRuin art" data-fx="${PAD.lab[0]}" data-fy="${PAD.lab[1]}"><img src="${ART.spriteUi('camp_lab_ruin')}" alt=""></div>`
      : `<div class="labRuin" data-fx="${PAD.lab[0]}" data-fy="${PAD.lab[1]}"><span>🚧</span></div>`;
    if (!labOpen() && !labOffered() && P) ents += spot('lab', PAD.lab, hole('lb'), 'Old ruin', 'a ruin… for now', 'lab painted empty');
    if (!labOpen() && labOffered()) ents += spot('lab', PAD.lab, P ? hole('lb') : '<div class="spotGhost">🔬</div>', 'Build the Lab', `${CONFIG.lab.build.coins} 🪙 · ${CONFIG.lab.build.qty} scrap`, (P ? 'lab painted ' : 'lab ') + (S.coins >= CONFIG.lab.build.coins && countItem(CONFIG.lab.build.item) >= CONFIG.lab.build.qty ? 'ready' : 'empty'));
    if (labOpen() && P) ents += spot('lab', PAD.lab, hole('lb'), "Dr. Zonk's Lab", S.acc && !accLeft() ? '⚗️ ready!' : '🧪 ' + S.sci, 'lab painted' + (S.acc && !accLeft() ? ' ready' : ''));
    else if (labOpen()) ents += spot('lab', PAD.lab, ART.spriteUi('camp_lab') ? `<img class="campImg" src="${ART.spriteUi('camp_lab')}">` : ART.icon('flask'), "Dr. Zonk's Lab", S.acc && !accLeft() ? '⚗️ ready!' : '🧪 ' + S.sci, 'lab' + (S.acc && !accLeft() ? ' ready' : ''));
    if (P) ents += spot('heart', PAD.heart, hole('ht'), w.heart, worldAwake() ? 'Awake' : fed() + '/' + bloomGoal() + ' Bloom', 'heart painted' + (worldAwake() ? ' awake' : ' asleep'));
    else ents += spot('heart', PAD.heart, ART.spriteUi('camp_heart_on') ? `<img class="campImg" src="${ART.spriteUi(worldAwake() ? 'camp_heart_on' : 'camp_heart_off')}">` : ART.item(worldAwake() ? 'bloomheart' : 'bloomcore'),
      w.heart, worldAwake() ? 'Awake' : fed() + '/' + bloomGoal() + ' Bloom', 'heart');

    prods.slice(0, PROD_PADS.length).forEach((pr, n) => {
      const p = PRODS[pr.k], c = b[pr.i], lv = plv(c), cap = capOf(p, lv);
      const can = lv < PMAX && S.coins >= upCost(p, lv);
      ents += spot('p' + pr.i, PROD_PADS[n], ART.producer(p.art), p.name,
        can ? '⬆ Upgrade ' + upCost(p, lv) + ' 🪙' : '',
        can ? 'ready' : '', lv > 1 ? 'Lv' + lv : '');
    });
    // the next plinth stands empty until you have grown everything on this one
    const nxt = nextProducer();
    if (nxt && prods.length < PROD_PADS.length && !scripted()) {
      ents += spot('next', PROD_PADS[prods.length], '<div class="spotGhost">➕</div>',
        'Empty plot', 'opens at lv ' + nextAt(), 'empty');
    }

    return `<div class="sceneWrap camp${P ? ' painted' : ''}">
      <div class="sceneBlur"></div><div class="sceneImg"></div><div class="sceneVig"></div>
      <div class="sceneName">${w.name}<i>lv ${wlv()}</i></div>
      <button class="starMapBtn" data-pop="galaxy"><span>${ART.uiIcon('ic_galaxy', '🌌')}</span><b>Galaxy</b></button>
      <div class="campRail">
        ${hubBtn('book', 'ic_chapter', '📖', 'Album')}
        ${hubBtn('fun', 'ic_fun', '🎪', 'Games')}
        ${labOpen() ? hubBtn('lab', 'ic_lab', '🔬', 'Lab') : ''}
      </div>
      ${ents}
    </div>`;
  }

  /* The star map: a winding path up through space, home at the bottom. Each
     planet is big, glows in its own colour, and says plainly what it needs. */
  const GAL = {
    earth: { tag: 'Home world · meadows & orchards', glow: '#7be06a' },
    luna: { tag: 'The Moon · craters & crystals', glow: '#c9b8ff' },
    cindra: { tag: 'Fire planet · forges & lava', glow: '#ff8a3d' },
    nerith: { tag: 'Ocean planet · reefs & pearls', glow: '#45c7e8' },
    vela: { tag: 'Sky planet · clouds & auroras', glow: '#d08bff' },
  } as Record<string, { tag: string; glow: string }>;
  const GAL_STEP = 300, GAL_TOP = 110;
  function galaxyHTML() {
    const fuelOk = S.fuel >= CONFIG.rocket.fuelToLaunch;
    // one more stop than there are worlds: the path runs on to a planet nobody has charted yet
    const n = WORLD_ORDER.length + 1, H = GAL_TOP + (n - 1) * GAL_STEP + 150;
    const pt = (i: number) => ({ x: i % 2 ? 70 : 30, y: GAL_TOP + (n - 1 - i) * GAL_STEP + 55 });
    let path = '', lit = '';
    for (let i = 1; i < n; i++) {
      const a = pt(i - 1), c = pt(i), my = (a.y + c.y) / 2;
      const seg = `M${a.x} ${a.y} C${a.x} ${my} ${c.x} ${my} ${c.x} ${c.y}`;
      path += seg + ' ';
      if (visited(WORLD_ORDER[i])) lit += seg + ' ';
    }
    const nodes = WORLD_ORDER.map((k, i) => {
      const ww = WORLDS[k], here = k === S.world, reached = reachable(k), seen = visited(k);
      const can = !here && reached && (seen || (allParts() && fuelOk));
      const prev = WORLD_ORDER[i - 1];
      const state = here ? 'here' : reached ? (can ? 'go' : 'wait') : 'locked';
      const p = pt(i), side = p.x < 50 ? 'r' : 'l';
      const list = projList(k), done = projDone(k);
      const prog = seen && list.length ? `<div class="gpBar"><i style="width:${Math.round(done / list.length * 100)}%"></i></div>
        <em>📜 ${done}/${list.length} chapters${worldDone(k) ? ' · restored ✨' : ''}</em>` : '';
      const btn = here ? '<button class="gpGo here" data-pop="camp">📍 You are here · Enter camp</button>'
        : !painted(k) ? '<span class="gpNeed">🎨 Coming soon</span>'
        : !reached ? `<span class="gpNeed">🔒 ${prev && visited(prev) ? `Restore ${WORLDS[prev].name} · ${projDone(prev)}/${projList(prev).length}` : 'Far away'}</span>`
          : seen ? `<button class="gpGo" data-world="${k}">${S.unlocked[k] && projDone(k) ? 'Fly back ✈️' : 'Fly there ✈️'}</button>`
            : can ? `<button class="gpGo launch" data-world="${k}">LAUNCH 🚀</button>`
              : `<span class="gpNeed">${allParts() ? `Needs ⛽ ${S.fuel}/${CONFIG.rocket.fuelToLaunch} fuel` : 'Finish the rocket first'}</span>`;
      return `<div class="gp gp-${k} ${state} side-${side}" style="left:${p.x}%;top:${p.y}px;--glow:${GAL[k] ? GAL[k].glow : '#fff'}">
        <button class="gpPlanet" data-world="${k}"><span class="gpRing"></span>
          <span class="galArt">${ART.uiIcon('planet_' + k, ART.planet(ww.planet))}</span>
          ${here ? `<span class="gpRocket">${ART.uiIcon('gal_rocket', ART.uiIcon('rocket_pad', '🚀'))}</span>` : ''}${state === 'locked' ? `<span class="gpLock">${ART.uiIcon('gal_lock', '🔒')}</span>` : ''}
          ${reached && worldAwake(k) ? '<span class="galBloom">🌱</span>' : ''}</button>
        <div class="gpCard"><b>${ww.name}</b><i>${GAL[k] ? GAL[k].tag : ''}</i>${prog}${btn}</div>
      </div>`;
    }).join('') + (() => {
      const p = pt(n - 1), side = p.x < 50 ? 'r' : 'l';
      return `<div class="gp gp-next locked side-${side}" style="left:${p.x}%;top:${p.y}px;--glow:#8b7bd8">
        <button class="gpPlanet" data-soon="1"><span class="gpRing"></span>
          ${ART.spriteUi('planet_unknown') ? `<span class="galArt">${ART.uiIcon('planet_unknown', '')}</span>` : `<span class="galArt mystery">${ART.uiIcon('planet_vela', ART.planet('aurora'))}</span><b class="galQ">?</b>`}</button>
        <div class="gpCard"><b>Uncharted world</b><i>Somewhere past Aurora Reach</i><span class="gpNeed">🔭 Coming soon</span></div></div>`;
    })();
    return `<div class="gal2"><div class="galSky"></div>
      <div class="galTop"><button class="galBack" data-pop="camp">↩ Camp</button><button class="galStars2 inTop${CONSTS.some(c => constState(c) === 'ready') ? ' ready' : ''}" data-pop="stars"><img src="${ART.spriteUi('gal_starchart')}" alt=""><b>Star Chart</b><i>${CONSTS.filter(c => S.stars && S.stars[c.id]).length}/${CONSTS.length} lit</i></button><b>Galaxy</b><span class="galFuel">⛽ ${S.fuel}/${CONFIG.rocket.fuelToLaunch}</span></div>

      <div class="galScroll" id="galScroll"><div class="galPath" style="height:${H}px">
        <svg class="galSvg" viewBox="0 0 100 ${H}" preserveAspectRatio="none" style="height:${H}px">
          <path d="${path}" class="galRoute"/><path d="${lit}" class="galRoute lit"/></svg>
        ${nodes}</div></div>
      <div class="galFoot">A new world costs <b>${CONFIG.rocket.fuelToLaunch} ⛽</b> · flying back is always free</div></div>`;
  }

  function renderWorldScreen() {
    const host = $('#mapBody'); if (!host) return;
    $('#mapTitle').textContent = worldTab === 'camp' ? '🌍 ' + W().name : '🌌 Galaxy';
    host.innerHTML = worldTab === 'camp' ? campHTML() : galaxyHTML();
    placeSpots();
    if (worldTab !== 'camp') {
      const sc = $('#galScroll'), me = host.querySelector('.gp.here') as HTMLElement;
      if (sc && me) sc.scrollTop = Math.max(0, me.offsetTop - sc.clientHeight / 2);
    }
    host.querySelectorAll('[data-world]').forEach((b: any) => b.onclick = () => galaxyTap(b.dataset.world));
    host.querySelectorAll('[data-soon]').forEach((b: any) => b.onclick = () => { sfx.no(); toast('🔭 Dr. Zonk is still charting this one. Coming soon!'); });
    host.querySelectorAll('[data-const]').forEach((b: any) => b.onclick = () => { sfx.tap(); constCard(b.dataset.const); });
    host.querySelectorAll('[data-ent]').forEach((b: any) => b.onclick = () => campTap(b.dataset.ent));
    host.querySelectorAll('[data-hub]').forEach((b: any) => b.onclick = () => { sfx.tap(); const k = b.dataset.hub; if (k === 'fun') { funPop(); } else { setView(k); fromMap = true; } });
    host.querySelectorAll('[data-pop]').forEach((b: any) => b.onclick = () => {
      const k = b.dataset.pop;
      sfx.tap();
      if (k === 'store') { storagePop(); return; }
      if (k === 'games') gamesPanel();
      else if (k === 'stars') starChart();
      else { worldTab = k === 'camp' ? 'camp' : 'galaxy'; renderWorldScreen(); }
    });
  }

  /* The picture is fitted to the WIDTH of the phone (a tall phone used to crop
     away the plinths at the sides) and sits on the bottom; the strip of sky
     left above it is the same painting, blurred. Every spot then lands exactly
     on its plinth. */
  function placeSpots(sel = '#mapBody') {
    const host = $(sel); if (!host) return;
    const wrap = host.querySelector('.sceneWrap') as HTMLElement;
    if (!wrap) return;
    const W2 = wrap.clientWidth, H = wrap.clientHeight;
    if (!W2 || !H) return;
    const iw = 1086, ih = 1448;
    if (sel === '#labBody') {
      // the lab is a room you stand in: fill the page, crop the edges
      const sc2 = Math.max(W2 / iw, H / ih), dw2 = iw * sc2, dh2 = ih * sc2, ox2 = (W2 - dw2) / 2, oy2 = (H - dh2) / 2;
      const img2 = wrap.querySelector('.sceneImg') as HTMLElement;
      if (img2) { img2.style.backgroundSize = `${dw2}px ${dh2}px`; img2.style.backgroundPosition = `${ox2}px ${oy2}px`; }
      wrap.classList.remove('fitw');
      host.querySelectorAll('[data-fx]').forEach((e: any) => {
        e.style.left = clamp(ox2 + +e.dataset.fx * dw2, 40, W2 - 40) + 'px';
        e.style.top = (oy2 + +e.dataset.fy * dh2) + 'px';
      });
      return;
    }
    // keep the plinths' band (x 7%–93%) on screen; crop only bare edges
    // a painted camp has buildings out to the edges: show its full width
    const full = wrap.classList.contains('camp') && !!(sceneAnchors(S.world) as any).painted;
    // a painted camp fills the screen as far as it can while every plinth (x 13%–87%) stays on it
    const sc = full ? Math.min(Math.max(W2 / iw, H / ih), W2 / (0.95 * iw)) : Math.max(H / ih, W2 / iw) * iw > W2 / 0.86 ? W2 / (0.86 * iw) : Math.max(W2 / iw, H / ih);
    const dw = iw * sc, dh = ih * sc;
    const ox = (W2 - dw) / 2, oy = dh < H ? H - dh : Math.max(H - dh, (H - dh) / 2);
    const img = wrap.querySelector('.sceneImg') as HTMLElement;
    if (img) { img.style.backgroundSize = `${dw}px ${dh}px`; img.style.backgroundPosition = `${ox}px ${oy}px`; }
    wrap.classList.toggle('fitw', oy > 0); wrap.style.setProperty('--fadeTop', Math.max(0, oy - 10) + 'px');
    host.querySelectorAll('[data-fx]').forEach((e: any) => {
      // positioned by its own measured size, not a CSS translate: the art stands
      // centred on the plinth whatever the WebView does with zoom and percentages
      const x = ox + +e.dataset.fx * dw, y = oy + +e.dataset.fy * dh;
      if (e.classList.contains('spot')) {
        const art = e.querySelector('.spotArt') as HTMLElement;
        const w = e.offsetWidth || 104, h = art ? art.offsetHeight : 72;
        e.style.transform = 'none';
        e.style.left = clamp(x - w / 2, 2, W2 - w - 2) + 'px';
        e.style.top = (y - h + Math.round(dh * 0.018)) + 'px';
      } else {
        e.style.left = x + 'px'; e.style.top = y + 'px';
      }
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
  function starsPanel() { starChart(); }

  function galaxyTap(k: string) {
    if (k === S.world) { worldTab = 'camp'; sfx.tap(); renderWorldScreen(); return; }
    const i = WORLD_ORDER.indexOf(k), prev = WORLD_ORDER[i - 1];
    if (!painted(k)) { sfx.no(); toast(`🎨 <b>${WORLDS[k].name}</b> is coming soon — it is still being painted.`); return; }
    if (!reachable(k)) {
      sfx.no();
      if (!visited(prev)) toast('🔒 Fly to ' + WORLDS[prev].name + ' first.');
      else toast(`🔒 Restore <b>${WORLDS[prev].name}</b> first — ${projDone(prev)}/${projList(prev).length} chapters done. See 📜 Goals.`);
      return;
    }
    if (visited(k)) { travelTo(k); return; }
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
    if (kind === 'lab') { if (labOpen()) setView('lab'); else if (labOffered()) buildLab(); else { sfx.no(); toast('An old, broken workshop. Someone clever could fix it up one day…'); } return; }
    if (kind === 'heart') { heartPanel(); return; }
    if (kind === 'next') { nextPlotPanel(); return; }
    if (kind[0] === 'p') producerPanel(+kind.slice(1));
  }

  function nextPlotPanel() {
    const nxt = nextProducer(), at = nextAt();
    modal(W().folks[0] || 'bloop', 'An empty plot',
      nxt ? `A <b>${PRODS[nxt].name}</b> takes root here when ${W().name} reaches <b>level ${at}</b>.`
        + `<div class="noteLine">World level ${wlv()} · ${Math.max(0, wNeed(wlv()) - wxp())} XP to the next one. Contracts and restoration projects give the most.</div>`
        : 'Everything this world can grow is already growing.',
      'Right');
  }

  function rocketPanel() {
    if (S.met && !rocketTime()) {
      modal('bloop', 'Not yet',
        `My ship is in pieces somewhere out in your woods. We will go looking after <b>Stargazing Night</b> — chapter ${ROCKET_AFTER}, you are on ${projDone('earth') + 1}. First I want to see this planet. And eat its pie.`, 'OK');
      return;
    }
    if (!S.met) {
      modal('pip', 'Nothing there yet',
        'Just meadow, for now. Keep merging — something is going to fall out of that sky, and when it does this is where it lands.', 'OK');
      return;
    }
    const parts = [['hull', 'Hull'], ['engine', 'Engine'], ['nav', 'Nav Dish'], ['tank', 'Fuel Tank']];
    const built = PART_KEYS.filter(k => S.parts[k]).length;
    const stageImg = ART.spriteUi('rocket_0') ? `<img class="rkImg" src="${ART.spriteUi('rocket_' + (built >= 4 ? 3 : built >= 3 ? 2 : built >= 1 ? 1 : 0))}">` : ART.rocket(S.parts);
    const inv = inventory();
    // each part is a three-step chain; show where you are on it, so the next merge is obvious
    const row = ([k, name]: string[]) => {
      const ids = CHAINS[k].items, done = !!S.parts[k];
      return `<div class="rkPart${done ? ' done' : ''}"><b>${name}</b><div class="rkSteps">${ids.map((id, n) =>
        `<span class="rkStep${done || inv[id] ? ' have' : ''}">${ART.item(id)}${!done && inv[id] ? `<em>${inv[id]}</em>` : ''}</span>${n < ids.length - 1 ? '<i>›</i>' : ''}`).join('')}</div>
        <span class="rkTick">${done ? '✓' : ''}</span></div>`;
    };
    const wreckAt = B().findIndex((c: any) => c && c.p === 'wreck');
    modal('bloop', allParts() ? 'Your rocket' : `Rocket ${built}/4`,
      `<div class="rkWrap">${stageImg}</div>
       <div class="rkParts">${parts.map(row).join('')}</div>
       <div class="fuelRow"><div style="font-size:12px;font-weight:700">Fuel</div>
         <div class="fuelDots">${Array.from({ length: CONFIG.rocket.fuelToLaunch }, (_, k) => k).map(k => `<div class="fuelDot${S.fuel > k ? ' on' : ''}">${ART.icon('fuel')}</div>`).join('')}</div>
         <div style="font-size:11px;color:#9a7a4e;font-weight:600">${S.fuel}/3</div></div>
       <div class="noteLine">${allParts()
        ? 'She flies. Open the galaxy and pick somewhere to go.'
        : 'Tap the <b>Rocket Wreck</b> for pieces. Two pieces merge into the next step; the last step bolts itself onto the rocket.'}</div>
       ${allParts() ? `<button class="big" id="toGalaxy">🌌 Open the galaxy</button>`
        : wreckAt >= 0 ? `<button class="srcCard" id="toWreck">${ART.producer('scrapwreck')}<span class="srcTxt"><b>Rocket Wreck</b><i>tap it for rocket pieces</i></span><span class="srcGo">Find it</span></button>` : ''}`, 'Close');
    setTimeout(() => {
      const g = $('#toGalaxy');
      if (g) g.onclick = () => { closeModal(); worldTab = 'galaxy'; setView('map'); renderWorldScreen(); };
      const w = $('#toWreck');
      if (w) w.onclick = () => { closeModal(); setView('board'); pointAt([wreckAt]); };
    }, 30);
  }
  /** close whatever is open and make these tiles bounce until the player looks */
  function pointAt(cells: number[], ms = 2600) {
    hintPair = cells; board.setHint(cells);
    setTimeout(() => { if (hintPair === cells) { hintPair = null; board.setHint(null); } }, ms);
  }

  function heartPanel() {
    const w = W(), st = stage(), done = worldAwake(), r = CONFIG.bloom.reward;
    const onBoard = B().reduce((a: number, c: any) => a + (c && c.id ? bloomValue(c.id) : 0), 0);
    const pct = done ? 100 : clamp(fed() / bloomGoal() * 100, 0, 100);
    const heartArt = ART.spriteUi(done || st > 0 ? 'camp_heart_on' : 'camp_heart_off') || ART.spriteUi('camp_heart_on');
    const ess = BLOOM().map((id, i) => `<span class="hEss">${ART.item(id)}<b>${Math.pow(2, i)}</b></span>`).join('<em>+</em>');
    pop('💗 ' + w.heart, `<div class="hStage${done ? ' awake' : ''}" style="--p:${pct}">
        <div class="hRing"></div>${heartArt ? `<img class="hArt" src="${heartArt}" alt="">` : '💗'}
        <div class="hNum">${done ? 'AWAKE' : `${fed()}<i>/${bloomGoal()}</i>`}</div></div>
      <div class="hLine">${done ? `${w.name} is awake and beating on its own. Thank you, star traveller!` : `Every world has a sleeping Heart. Wake it and the whole planet comes back to life — colour, music and rewards.`}</div>
      <div class="hHow"><b>How to wake it</b>
        <div class="hStep"><span>1</span><i>Finish any merge chain for the first time — the top step</i></div>
        <div class="hStep"><span>2</span><i>The Vault gives you a <b>Bloom Spark</b>. Merge sparks up: each step is worth double</i></div>
        <div class="hEssRow">${ess}</div>
        <div class="hStep"><span>3</span><i>Tap <b>Feed</b> and the Heart drinks every essence on your board</i></div></div>
      <div class="hPath">${w.bloom.map((b: any, i: number) => `<div class="hNode${i < st ? ' done' : i === st ? ' now' : ''}"><i>${i < st ? '✓' : b.need}</i><b>${b.title}</b><em>+${r.coins} 🪙 · +${r.energy} ⚡</em></div>`).join('')}</div>
      <button class="big gold" id="feed2"${onBoard && !done ? '' : ' disabled'}>${done ? 'Fully awake ✨' : onBoard ? `Feed the Heart · ${onBoard} Bloom` : 'No Bloom essence on the board yet'}</button>`, 'heartsheet');
    const f = $('#feed2'); if (f) f.onclick = () => { closePop(); feedHeart(); };
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
        ? `<div class="chargeLine"><b>${ecost(p, lv)} ${ART.icon('energy')}</b> a tap<i>uses energy, never runs out</i></div>`
        : `<div class="chargeLine"><b>${c.ch ?? cap}/${cap}</b> charges<i>${c.ch >= cap ? 'full · free taps' : 'free taps · a full battery takes ' + mmss(evOf(p, c) * cap)}</i></div>`}
       <div class="noteLine" style="margin:4px 0 2px">Tap it on the board and it makes:</div>
       <div class="dropRow">${uniq.map(d => `<span class="dropChip">${ART.item(d)}<b>${ITEMS[d].name}</b></span>`).join('')}</div>
       ${lv >= PMAX
        ? `<div class="noteLine">Fully grown. It will keep going for a while yet, then go to seed and let something else take root.</div>`
        : `<div class="noteLine">Level ${lv + 1}: ${p.mode === 'energy'
          ? (ecost(p, lv + 1) > ecost(p, lv) ? `<b>${ecost(p, lv + 1)} ⚡</b> a tap` : `still <b>${ecost(p, lv)} ⚡</b> a tap`)
          : '<b>+5</b> charges'}${added.length
          ? ` and it starts dropping <b>${added.map(d => ITEMS[d].name).join('</b>, <b>')}</b>`
          : ' and better odds on the rarer drops'}.</div>
           <button class="big gold" id="upProd"${S.coins >= price ? '' : ' disabled'}>Upgrade · ${price} ${ART.icon('coin')}</button>`}`
      + (counted(c) ? `<button class="big blue" id="storeProd">📦 Move to storage</button>` : ''),
      'Close');
    setTimeout(() => {
      const sp2 = $('#storeProd'); if (sp2) sp2.onclick = () => { closeModal(); storeProducer(cell); };
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
  /* Short and hands-on: every step but the last is something you DO. The
     rest of the game is introduced by coach() hints as each part opens. */
  const TUT: TutStep[] = [
    { id: 'tap', who: 'pip', say: "Hi! Tap the <b>Meteor Heap</b>.", at: () => cellWith(c => c.p === 'tree'), on: 'spawn' },
    { id: 'tap2', who: 'pip', say: "Once more!", at: () => cellWith(c => c.p === 'tree'), on: 'spawn' },
    { id: 'merge', who: 'pip', say: "<b>Drag</b> one twig onto the other.", at: () => cellsWith(c => c.id === 'twig'), on: 'merge' },
    { id: 'energy', who: 'pip', say: "Taps cost <b>⚡ energy</b>. It refills by itself.", at: () => '#chipEnergy' },
    {
      id: 'deliver', who: 'pip', say: "<b>Tap</b> to give it!",
      at: () => '#orders .order.ready', on: 'deliver',
      when: () => S.orders.some((o: any) => o.needs.every((nd: any) => countItem(nd.id) >= nd.qty)),
    },
    { id: 'coins', who: 'pip', say: "Customers pay <b>coins</b>.", at: () => '#chipCoins' },
    { id: 'story', who: 'pip', say: "Your <b>chapter</b>. Tap it to see what it needs.", at: () => '#btnQuests' },
  ];
  /* a one-off spotlight the game raises when a feature first matters (see COACH) */
  let jit: TutStep | null = null;
  const curStep = (): TutStep | null => jit || (tutAt >= 0 && tutAt < TUT.length ? TUT[tutAt] : null);

  let tutAt = -1, tutHave = 0, tutTimer: any = 0;
  const tutOn = () => (tutAt >= 0 && tutAt < TUT.length) || !!jit;

  function tutStart() {
    if (S.tut) return;
    tutAt = -1; tutNext();
  }
  function tutNext() {
    if (jit) { jitEnd(); return; }
    tutHave = 0;
    do { tutAt++; } while (tutAt < TUT.length && TUT[tutAt].when && !TUT[tutAt].when!());
    if (tutAt >= TUT.length) { tutEnd(); return; }
    tutShow();
  }
  function tutEnd() {
    const wasOn = tutAt >= 0;
    tutAt = -1;
    S.tut = 1; save();
    analytics.track('tutorial_end', { during: wasOn ? 1 : 0 });
    coachT = Date.now() + 8000;          // a breather before the first just-in-time tip
    // the daily calendar and the story beats queue up behind the intro rather
    // than popping a modal over the one button you were told to press
    if (wasOn) setTimeout(() => chapterIntro(), 600);
    $('#tut').classList.remove('on');
    setTimeout(() => { if (!tutOn()) $('#tut').style.display = 'none'; }, 300);
    clearInterval(tutTimer); tutTimer = 0;
  }
  /** where on screen the current step points, in page pixels */
  function tutRect(): { x: number; y: number; w: number; h: number } | null {
    const st = curStep(); if (!st || !st.at) return null;
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
      const k = zk();
      return { x: (r.left - app.left) / k + x0, y: (r.top - app.top) / k + y0, w: x1 - x0, h: y1 - y0 };
    }
    const e = document.querySelector(target as string) as HTMLElement;
    if (!e || !e.offsetParent) return null;
    const r = e.getBoundingClientRect(), k = zk();
    return { x: (r.left - app.left) / k, y: (r.top - app.top) / k, w: r.width / k, h: r.height / k };
  }
  function tutShow() {
    const st = curStep()!, host = $('#tut');
    host.style.display = '';
    void host.offsetWidth;
    host.classList.add('on');
    $('#tFace').innerHTML = ART.char(st.who || 'pip');
    if (ART.spriteUi('hand')) $('#tHand').innerHTML = `<img src="${ART.spriteUi('hand')}" alt="">`;
    $('#tSay').innerHTML = st.say;
    { const plain = String(st.say).replace(/<[^>]+>/g, ''); sfx.voice(st.who || 'pip', clamp(Math.round(plain.length / 26), 2, 4), /\?\s*$/.test(plain)); }
    $('#tNext').classList.toggle('hide', !!st.on);
    $('#tSkip').classList.toggle('hide', !!jit);
    tutPlace();
    clearInterval(tutTimer);
    // the board relays out, screens open, cards move — keep the hole on target
    tutTimer = setInterval(() => { if (tutOn()) tutPlace(); }, 260);
  }
  function tutPlace() {
    const host = $('#tut'), app = { width: $('#app').offsetWidth, height: $('#app').offsetHeight };
    const r = tutRect();
    const pad = 7;
    const set = (id: string, x: number, y: number, w: number, h: number) => {
      const e = $(id);
      e.style.left = Math.max(0, x) + 'px'; e.style.top = Math.max(0, y) + 'px';
      e.style.width = Math.max(0, w) + 'px'; e.style.height = Math.max(0, h) + 'px';
    };
    host.classList.toggle('noHole', !r);
    // a step that waits for an action on something that is not on screen would
    // lock the game behind the dark overlay: skip it instead
    const st = curStep();
    if (!r && st && st.on && st.at) {
      if (jit) { jitEnd(); return; }
      if (view === 'board' && !$('#modal').classList.contains('open') && !$('#talk').classList.contains('open')) { setTimeout(tutNext, 0); return; }
    }
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
    const st = curStep()!;
    if (jit) { if (st.on === ev) setTimeout(jitEnd, 300); return; }
    if (st.on !== ev) return;
    tutHave++;
    if (tutHave >= (st.need || 1)) setTimeout(tutNext, 420);
  }

  /* ================================================================ MODALS */
  /* One dialog at a time. A level-up, a chapter reward and a story beat can all
     land in the same second; the later ones wait their turn instead of
     replacing the one the player is reading. */
  type MItem = { face: string; title: string; body: string; btn?: string; after: (() => void) | null };
  const mQ: MItem[] = [];
  let mQueued: MItem | null = null;
  const dialogBusy = () => $('#modal').classList.contains('open') || $('#talk').classList.contains('open');
  function modal(face: string, title: string, body: string, btn?: string) {
    // a dialog the player just asked for (a button inside the open one) replaces it;
    // one the game raised on its own waits in line
    const asked = Date.now() - lastPointer < 400; if (asked) lastPointer = 0;   // one per tap
    if (dialogBusy() && !(asked && !$('#talk').classList.contains('open'))) { mQueued = { face, title, body, btn, after: null }; mQ.push(mQueued); return; }
    mQueued = null;
    showModal(face, title, body, btn);
  }
  /** what to run once the player closes the dialog just requested (queued or not) */
  function setAfter(f: (() => void) | null) { if (mQueued) mQueued.after = f; else afterModal = f; }
  function nextModal() {
    if (dialogBusy() || !mQ.length) return;
    const m = mQ.shift()!; mQueued = null;
    showModal(m.face, m.title, m.body, m.btn); afterModal = m.after;
  }
  function showModal(face: string, title: string, body: string, btn?: string) {
    $('#mFace').innerHTML = ART.char(face);
    $('#mTitle').textContent = title;
    $('#mBody').innerHTML = body;
    $('#mBtn').textContent = btn || 'OK';
    // "Close" is not an action: it gets the quiet button, the real action stays the loud one
    $('#mBtn').className = 'big' + (/^close$/i.test(btn || 'OK') ? ' soft' : '');
    $('#modal').classList.remove('lite');
    if (!$('#modal').classList.contains('open')) sfx.open();
    $('#modal').classList.add('open');
  }
  const closeModal = () => { sfx.close(); $('#modal').classList.remove('open'); setTimeout(nextModal, 450); };
  /** something to do once the player has read the modal (a story beat chains on) */
  let afterModal: (() => void) | null = null;
  $('#mBtn') && ($('#mBtn').onclick = () => { closeModal(); const f = afterModal; afterModal = null; if (f) setTimeout(f, 250); });
  $('#mX') && ($('#mX').onclick = () => ($('#mBtn') as HTMLElement).click());

  /* ================================================================ INPUT */
  /* Pointer handling lives in board.ts (Pixi hit-testing): it calls back into
     tap() / onDrop() above. Nothing here touches the DOM. */

  function tap(i: number) {
    const c = B()[i];
    lastAct = Date.now();
    audio.unlock();                                   // the first gesture starts the mixer
    const pick = (k: number | null) => { sel = k; board.setSelected(k); };
    if (placing !== null) { placeAt(i); return; }
    if (!c) { pick(null); hideInfo(); return; }
    if (c.f) {
      sfx.tap(); pick(null); hideInfo();
      const src = sourceHint(c.f);
      toast(`🔒 Sealed <b>${ITEMS[c.f].name}</b>. Merge another ${ITEMS[c.f].name} into it to open it — ${src}.`);
      return;
    }
    if (c.b) {
      // this is the *world* level, not your own — every world starts at 1, and
      // saying "Level 3" to someone who is account level 7 reads like a bug
      toast(`Overgrown — it clears at <b>${W().name} level ${c.b}</b> (you are on ${wlv()}). Fill contracts here to raise it.`);
      return;
    }
    if (c.bub) { pick(null); hideInfo(); tapBubble(i); return; }
    if (c.p) { pick(null); hideInfo(); useProducer(i); if (B()[i] && B()[i].p && !$('#modal').classList.contains('open')) showProdInfo(i); return; }
    if (isChest(c.id) && sel !== i && !(sel !== null && B()[sel] && mergeResult(B()[sel].id, c.id))) { pick(null); hideInfo(); openChest(i); return; }
    // double-tap: the item finds its nearest twin and merges with it — no dragging needed
    const now = Date.now(), dbl = lastTap.i === i && now - lastTap.t < 400;
    lastTap = { i, t: dbl ? 0 : now };
    if (dbl) {
      const twin = nearestTwin(i);
      if (twin >= 0) { pick(null); hideInfo(); tryMerge(i, twin); S.tipDbl = 1; return; }
      if (!nextOf(c.id)) toast(ITEMS[c.id].name + ' is already the best in its chain!');
      else toast('No twin on the board yet — make another ' + ITEMS[c.id].name + '.');
    }
    if (sel === null) {
      pick(i); showInfo(i);
      if (!S.tipDbl && S.tut && nearestTwin(i) >= 0) { S.tipDbl = 1; setTimeout(() => toast('💡 Tip: <b>double-tap</b> an item to merge it with its twin.'), 500); }
      return;
    }
    if (sel === i) { pick(null); hideInfo(); return; }
    const a = B()[sel];
    if (a && mergeResult(a.id, c.id)) { const f = sel; pick(null); hideInfo(); tryMerge(f, i); return; }
    pick(i); showInfo(i);
  }
  let lastTap = { i: -1, t: 0 };
  /** the closest tile this one would merge with, or -1 */
  function nearestTwin(i: number) {
    const b = B(), a = b[i]; if (!a || !a.id) return -1;
    let best = -1, bd = 1e9;
    const ci = i % COLS, ri = Math.floor(i / COLS);
    for (let k = 0; k < N; k++) {
      if (k === i || !b[k] || !b[k].id || b[k].bub || !mergeResult(a.id, b[k].id)) continue;
      const d = Math.hypot(k % COLS - ci, Math.floor(k / COLS) - ri);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function hideInfo() { $('#infoBar').classList.remove('on', 'undo'); }
  /** sold something by mistake? a few seconds to take it back */
  let undoT: any = 0;
  function showUndo(sold: { i: number; id: string; coins: number; w: string }) {
    const bar = $('#infoBar');
    bar.classList.add('on', 'undo');
    $('#infoTxt').innerHTML = `Sold <b>${ITEMS[sold.id].name}</b> for ${sold.coins} 🪙`;
    $('#btnUndo').onclick = () => {
      clearTimeout(undoT); bar.classList.remove('on', 'undo');
      if (S.world !== sold.w || S.coins < sold.coins) return;
      const b = B(); const at = b[sold.i] ? nearFree(sold.i) : sold.i; if (at < 0) { toast('No room to put it back.'); return; }
      S.coins -= sold.coins; b[at] = { id: sold.id }; sfx.pop(); paintBoard(); renderHUD(); renderOrders(); save();
    };
    clearTimeout(undoT); undoT = setTimeout(() => bar.classList.remove('on', 'undo'), 4000);
  }
  /** the bottom bar for a producer: its name, level and a way back to its card */
  function showProdInfo(i: number) {
    const c = B()[i]; if (!c || !c.p) return;
    const p = PRODS[c.p];
    $('#infoBar').classList.add('on');
    $('#infoTxt').innerHTML = `<b>${p.name} <small>lv ${plv(c)}</small> ${ART.spriteUi('btn_info') ? ART.uiIcon('btn_info', '') : '<span class="infoQ">i</span>'}</b><i>tap again to use it · ⓘ more info</i>`;
    ($('#infoTxt') as HTMLElement).onclick = () => { sfx.tap(); producerPanel(i); };
    ['#btnStash', '#btnShow', '#btnRecycle'].forEach(k => { const e = $(k) as HTMLElement; if (e) e.style.display = 'none'; });
    $('#btnSell').innerHTML = 'Info';
    $('#btnSell').onclick = () => { sfx.tap(); producerPanel(i); };
  }
  function showInfo(i: number) {
    const c = B()[i]; if (!c || !c.id) return;
    const d = ITEMS[c.id], nx = nextOf(c.id);
    $('#infoBar').classList.add('on');
    $('#infoTxt').innerHTML = `<b>${d.name} <small>lv ${d.tier}</small> ${ART.spriteUi('btn_info') ? ART.uiIcon('btn_info', '') : '<span class="infoQ">i</span>'}</b><i>${nx ? `merge 2 → <span class="nxArt">${ART.item(nx)}</span>` : 'top of its chain!'}</i>`;
    ($('#infoTxt') as HTMLElement).onclick = () => { sfx.tap(); chainPanel(c.id); };
    $('#btnSell').innerHTML = `Sell ${sellOf(c.id)} ${ART.icon('coin')}`;
    $('#btnSell').onclick = () => { sellItem(i); $('#infoBar').classList.remove('on'); };
    const st = $('#btnStash');
    st.style.display = bagHas() ? '' : 'none';
    st.onclick = () => stashItem(i);
    // a finished chain has nowhere to go: put it on the trophy shelf instead
    const sh = $('#btnShow');
    sh.style.display = nx ? 'none' : '';
    sh.innerHTML = ART.uiIcon('ic_trophy', '🏆') + ' Shelf';
    sh.onclick = () => showcase(i);
    const rc = $('#btnRecycle');
    rc.style.display = labOpen() ? '' : 'none';
    rc.innerHTML = '🧪 +' + sciOf(c.id);
    rc.onclick = () => { recycleItem(i); $('#infoBar').classList.remove('on'); };
  }

  /* ================================================================== LOOP */
  function tick() {
    const now = Date.now();
    // energy regen
    const per = regenMs();
    while (S.energy < maxEnergy() && now - S.eAt >= per) { S.eAt += per; S.energy++; renderHUD(); }
    if (S.energy >= maxEnergy()) S.eAt = now;
    tickProducers();
    pupTick(); renderBoost();
    board.heal();
    sweepSpecials();
    // snack cooldown
    const cd = Math.max(0, CONFIG.energy.snack.cooldownMs - (now - S.snackAt));
    const sb = $('#btnSnack'); sb.disabled = cd > 0 || S.energy >= maxEnergy();
    sb.textContent = cd > 0 ? Math.ceil(cd / 1000) + 's' : '🍪 +' + snackAmt();
    // idle hint
    // the idle hint is for someone looking at the board, not reading a popup
    if (view === 'board' && now - lastAct > CONFIG.hint.idleMs && !hintPair && !popOpen() && !dialogBusy() && !tutOn()) { showHint(false); lastAct = now; }
    shipTick(now);
    orderTick(now);
    visitorTick(now);
    // bubbles pop when their time is up
    { const b = B(); let popped = false;
      for (let i = 0; i < N; i++) if (b[i] && b[i].bub && now >= b[i].until) { b[i] = null; sparkle(i, 12, '#bff0ff'); popped = true; }
      if (popped) { sfx.pop(); paintBoard(); } }
    worldEvent(now);
    checkStuck(now);
    renderQuick(); coachTick(); tipTick(); eventTick();
    if (view === 'lab' && S.acc) {
      const t = $('#accTime');
      if (t) { if (accLeft() > 0) t.textContent = mmss(accLeft()); else renderLab(); }
    }
    // the shelf restocks on its own so the 🛒 badge can nag you
    if (shopOpen()) {
      const before = S.shop.at;
      shopStock();
      if (S.shop.at !== before) { renderHUD(); if (view === 'shop') renderShop(); }
    }
    // random meteors
    // a meteor the player could not receive (wrong screen, no room, crater still
    // open) is retried shortly instead of burning a whole rare cycle
    // kept in the save, so reopening the app does not drop a fresh meteor every time
    if (!meteorTimer) meteorTimer = Math.max(S.metAt || 0, now + 180000);
    if (S.met && now > meteorTimer) {
      const fell = Math.random() < CONFIG.meteor.chance ? randomMeteor() : true;
      meteorTimer = S.metAt = fell
        ? now + (CONFIG.meteor.everyMinMs + Math.random() * CONFIG.meteor.everyRandomMs) * meteorScale()
        : now + 20000;
    }
  }

  function pocket(i: number) {
    const b = B(), c = b[i]; if (!c) return;
    const id = c.id; b[i] = null;
    S.wal = S.wal || {}; S.wal[id] = (S.wal[id] || 0) + 1;
    paintCell(i); board.consume(i, id);
    renderQuick();
    // it flies into the little pouch chip by the board; the chip counts it, no message needed
    flyTo(cellXY(i), document.querySelector('.qChip.pouch') || $('#tabMap'), ART.item(id), 1, { size: 40 });
    sparkle(i, 10, '#ffe9a8'); sfx.coin();
    setTimeout(() => { const pc = document.querySelector('.qChip.pouch') as HTMLElement | null; if (pc) { pc.classList.remove('bump'); void pc.offsetWidth; pc.classList.add('bump'); } }, 650);
    save();
  }
  function sweepSpecials() {
    const b = B();
    for (let i = 0; i < N; i++) {
      const c = b[i]; if (!c || !c.id) continue;
      const d = ITEMS[c.id]; if (!d) continue;
      if (POUCH.includes(c.id)) pocket(i);
      else if (d.part && !S.parts[d.part]) installPart(i, d.part);
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
  /* Painted emoji: the copy is written with emoji (easy to read in code), and
     the page swaps each one for its painted icon as it appears, everywhere —
     popups, screens, toasts, buttons. An emoji without a painting stays. */
  const EMO: Record<string, string> = {
    '🪙': 'icon_coin', '💎': 'icon_gem', '⚡': 'icon_energy', '🧪': 'icon_flask', '🔒': 'sec_lock', '⏳': 'cl_timer',
    '📜': 'ic_scroll', '🎁': 'ic_gift', '🏆': 'ic_trophy', '📦': 'ic_box', '🎡': 'ic_spin', '🔬': 'ic_microscope', '🛒': 'ic_shop',
    '🎪': 'ic_tent', '📖': 'ic_album2', '🗺️': 'ic_map2', '🗺': 'ic_map2', '🔑': 'ic_key', '🔔': 'cl_bell', '🌌': 'ic_galaxy', '💡': 'ic_hint', '⬆': 'ic_up', '🧺': 'ic_pouch', '✉️': 'ic_feedback', '📅': 'ic_calendar', '🍪': 'ic_cookie', '🧲': 'icon_magnet', '🔊': 'ic_sound', '🎵': 'ic_music', '💾': 'ic_saved', '➡️': 'ic_nextch', '🛸': 'ic_galaxy',
  };
  const EMO_RE = new RegExp(Object.keys(EMO).filter(k => ART.spriteUi(EMO[k])).sort((a, b) => b.length - a.length).join('|'), 'g');
  function paintEmoji(root: Node) {
    if (!EMO_RE.source || EMO_RE.source === '(?:)') return;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n: any) => {
        const p = n.parentElement;
        if (!p || /^(TEXTAREA|INPUT|SCRIPT|STYLE|OPTION)$/.test(p.tagName) || p.closest('.noEmo')) return NodeFilter.FILTER_REJECT;
        EMO_RE.lastIndex = 0;
        return EMO_RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    } as any);
    const hits: Text[] = []; let n: Node | null;
    while ((n = walk.nextNode())) hits.push(n as Text);
    for (const t of hits) {
      const frag = document.createDocumentFragment(), v = t.nodeValue || ''; let at = 0;
      v.replace(EMO_RE, (m, i) => {
        if (i > at) frag.appendChild(document.createTextNode(v.slice(at, i)));
        const img = document.createElement('img'); img.className = 'emo'; img.alt = m; img.src = ART.spriteUi(EMO[m]); img.draggable = false;
        frag.appendChild(img); at = i + m.length; return m;
      });
      if (at < v.length) frag.appendChild(document.createTextNode(v.slice(at)));
      t.replaceWith(frag);
    }
  }
  new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') { if (m.target.parentNode) paintEmoji(m.target.parentNode); } else m.addedNodes.forEach(x => paintEmoji(x)); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  setTimeout(() => paintEmoji(document.body), 0);

  async function boot() {
    if (import.meta.env.DEV) {
      const problems = validateContent();
      if (problems.length) console.error('[content]\n' + problems.join('\n'));
    }
    S = load();
    const away = welcomeBack();
    // a save that names a world it never built a board for would land on nothing
    if (!WORLDS[S.world]) S.world = CONFIG.start.world;
    if (!S.boards[S.world]) S.boards[S.world] = freshBoard(S.world);
    if (!S.wlv[S.world]) { S.wlv[S.world] = 1; S.wxp[S.world] = 0; }
    // never greet someone with a contract for a thing that does not grow here
    if (Array.isArray(S.orders)) {
      const live = liveChains();
      S.orders = S.orders.filter((o: any) => o.needs.every((n: any) => {
        const ch = ITEMS[n.id] && ITEMS[n.id].chain;
        return ch && ch !== 'star' && CHAINS[ch].world !== 'ship' && (CHAINS[ch].world === 'any' || live.indexOf(ch) >= 0);
      }));
    }
    if (!S.orders || !S.orders.length) { S.orders = []; fillOrders(); }
    // the waves moved: anything a finished chapter hands out (and nothing retired) must be there
    if (S.boards[S.world] && scripted()) {
      const done = projList().slice(0, projDone());
      const gone = new Set(done.flatMap((p: any) => p.retire || []));
      done.flatMap(unlocksOf).filter((u: string) => !gone.has(u)).forEach((u: string) => setTimeout(() => plantProducer(u), 1500));
    }
    // producers the story has already retired leave older saves too
    WORLD_ORDER.forEach(w => {
      const gone = projList(w).slice(0, projDone(w)).flatMap((p: any) => p.retire || []);
      if (!gone.length || !S.boards[w]) return;
      S.boards[w].forEach((c: any, i: number) => { if (c && c.p && !c.tmp && gone.includes(c.p)) S.boards[w][i] = null; });
      const sw = sweepOrphans(gone, w, false); if (sw.n) { S.coins += sw.coins; setTimeout(() => toast(`🧹 Cleared ${sw.n} leftover${sw.n > 1 ? 's' : ''} nobody needs any more — +${sw.coins} 🪙`), 3000); }
      if (S.store && S.store[w]) S.store[w] = S.store[w].filter((x: any) => !gone.includes(x.p));
    });
    S.orders = S.orders.filter((o: any) => o.vis || o.needs.every((nd: any) => { const ch = ITEMS[nd.id].chain; return CHAINS[ch].world === 'any' || B().some((c: any) => c && c.p && PRODS[c.p].drops.some((d: string) => ITEMS[d].chain === ch)); }));
    if (S.orders.length < CONFIG.orders.minSlots) fillOrders();
    // the wreck belongs to the end of the Meadow (see rocketTime)
    if (S.boards.earth && !S.wreck) {
      const eb = S.boards.earth, at = eb.findIndex((c: any) => c && c.p === 'wreck');
      if (at >= 0 && rocketTime()) S.wreck = 1;
      else if (at >= 0) eb[at] = mkProd('crater');
    }
    if (S.world === 'earth' && S.met && (S.proj.earth || 0) >= ROCKET_AFTER && !S.wreck && !allParts()) setTimeout(wreckStory, 2500);
    dailyOk(); renderMile();
    growProducers();
    oid = S.orders.length + 1;
    scenery();
    audio.setSfx(!!S.sound); audio.setMusic(!!S.music);
    audio.playMusic(worldMusic(S.world));
    await buildBoard();
    paintBoard(); renderHUD(); renderOrders(); renderRocket();
    meteorTimer = 0;
    { const bs = $('#bootScr'); if (bs) { bs.classList.add('gone'); setTimeout(() => bs.remove(), 600); } }
    if (S.tut) setTimeout(() => { if (!$('#modal').classList.contains('open') && !tutOn()) chapterIntro(); }, 2200);

    document.querySelectorAll<HTMLElement>('.tab').forEach(t => t.onclick = () => { if (t.id === 'tabMap') worldTab = 'galaxy'; setView(t.dataset.v as string); });
    // a page opened from the map goes back to the map
    document.querySelectorAll<HTMLElement>('.scClose').forEach(b => b.onclick = () => { const back = fromMap && (view === 'book' || view === 'lab'); fromMap = false; setView(back ? 'map' : 'board'); });
    $('#btnHint').onclick = () => { showHint(true); lastAct = Date.now(); };
    { const hi = document.querySelector('#btnHint .hintIc'); if (hi) hi.innerHTML = ART.uiIcon('ic_tips', '💡'); }
    $('#btnSnack').onclick = async () => {
      if (S.energy >= maxEnergy()) { toast('Energy is already full!'); return; }
      // once an ad network is wired up this becomes "watch to refill"; until then
      // ads.rewarded() resolves false and the snack is simply free
      // the snack is free: no video in front of a small kindness
      S.snackAt = Date.now(); S.energy = Math.min(maxEnergy(), S.energy + snackAmt());
      bumpChip('#chipEnergy'); sfx.coin(); toast('🍪 Yum! +' + snackAmt() + ' energy'); renderHUD(); save();
    };
    let testerOn = false;
    const testerPanel = () => `<div class="ttBox"><b>🧪 Tester tools</b><div class="ttRow">
        <button class="buyBtn" data-tt="energy">+100 ⚡</button><button class="buyBtn" data-tt="coins">+2000 🪙</button>
        <button class="buyBtn" data-tt="gems">+100 💎</button><button class="buyBtn" data-tt="refill">Refill sources</button>
        <button class="buyBtn" data-tt="chapter">Give chapter items</button><button class="buyBtn" data-tt="level">+500 XP</button></div>
        <i>These are only for testing and are not in the store build.</i></div>`;
    $('#btnGear').onclick = () => {
      // settings are switches, not a stack of shouting buttons
      const row = (id: string, ic: string, label: string, on: boolean) =>
        `<button class="optRow" id="${id}"><span class="optIc">${ic}</span><b>${label}</b><span class="sw${on ? ' on' : ''}"><i></i></span></button>`;
      const draw = () => `<div class="optList">
          ${row('sndBtn', ART.uiIcon(S.sound ? 'ic_sound' : 'ic_mute', '🔊'), 'Sound effects', !!S.sound)}
          ${row('musBtn', ART.uiIcon(S.music ? 'ic_music' : 'ic_nomusic', '🎵'), 'Music', !!S.music)}
          ${row('tipBtn', ART.uiIcon('ic_tips', '💡'), 'Tips', !S.tipsOff)}
        </div>
        <button class="big soft" id="fbBtn">${ART.uiIcon('ic_feedback', '✉️')} Send feedback</button>
        <button class="optDanger" id="resetBtn">${ART.uiIcon('ic_restart', '')} Start a new game</button>
        <div class="verLine" id="verLine">Galaxy Adventure ${SERVICES.app.build}</div>
        ${testerOn ? testerPanel() : ''}
        ${import.meta.env.DEV ? devPanel() : ''}`;
      modal('pip', 'Settings', draw(), 'Close');
      const bind = () => {
        const sb2 = $('#sndBtn'), mb = $('#musBtn'), tb = $('#tipBtn'), rb = $('#resetBtn');
        const redraw = () => { $('#mBody').innerHTML = draw(); bind(); save(); };
        if (sb2) sb2.onclick = () => { S.sound = S.sound ? 0 : 1; audio.setSfx(!!S.sound); if (S.sound) sfx.tap(); redraw(); };
        if (mb) mb.onclick = () => { S.music = S.music ? 0 : 1; audio.setMusic(!!S.music); redraw(); };
        if (tb) tb.onclick = () => { S.tipsOff = S.tipsOff ? 0 : 1; if (S.tipsOff) coachOff(); else S.coach = {}; redraw(); };
        document.querySelectorAll<HTMLElement>('[data-dev]').forEach(b => b.onclick = async () => {
          const k = b.dataset.dev;
          if (k === 'ad') { const o = ['complete', 'skip', 'nofill'] as const; mockControls.ad = o[(o.indexOf(mockControls.ad) + 1) % o.length]; }
          if (k === 'buy') { const o = ['ask', 'success', 'cancel', 'error'] as const; mockControls.purchase = o[(o.indexOf(mockControls.purchase) + 1) % o.length]; }
          if (k === 'review') { closeModal(); store.requestReview(); return; }
          if (k === 'signin') await games.signIn();
          if (k === 'away') goingAway();
          redraw();
        });
        const fb = $('#fbBtn'); if (fb) fb.onclick = () => { closeModal(); setTimeout(feedbackPop, 500); };
        const vl = $('#verLine'); let taps = 0;
        if (vl) vl.onclick = () => { if (SERVICES.app.testerTools && ++taps >= 5) { testerOn = true; redraw(); toast('🧪 Tester tools on'); } };
        document.querySelectorAll<HTMLElement>('[data-tt]').forEach(b => b.onclick = () => {
          const k = b.dataset.tt;
          if (k === 'energy') { S.energy += 100; bumpChip('#chipEnergy'); }
          if (k === 'coins') { S.coins += 2000; bumpChip('#chipCoins'); }
          if (k === 'gems') addGems(100);
          if (k === 'refill') B().forEach((c: any) => { if (c && c.p) { c.ch = undefined; c.ready = 0; } });
          if (k === 'chapter') { const pj = curProject(); if (pj) { pj.needs.forEach(([id, q]: [string, number]) => { for (let n = 0; n < q; n++) if (giveItem(id) < 0) S.bag.push(id); }); S.coins = Math.max(S.coins, pj.coins); } }
          if (k === 'level') addXp(500);
          sfx.collect(); paintBoard(); renderHUD(); save();
        });
        if (rb) rb.onclick = () => {
          // a whole save is one tap from gone: ask first
          if (rb.dataset.sure) { localStorage.removeItem(SAVE); location.reload(); return; }
          rb.dataset.sure = '1'; rb.textContent = 'Tap again to erase everything'; rb.classList.add('sure');
          setTimeout(() => { if (document.body.contains(rb)) { delete rb.dataset.sure; rb.textContent = 'Start a new game'; rb.classList.remove('sure'); } }, 3500);
        };
      };
      setTimeout(bind, 30);
    };
    $('#chipEnergy').onclick = () => energyPop();
    $('#chipCoins').onclick = () => setView('shop');
    $('#chipGems').onclick = () => { shopTab = 'gems'; setView('shop'); };
    $('#popX').onclick = () => closePop();
    $('#scrim').onclick = () => setView('board');
    $('#pop').onclick = (ev: any) => { if (ev.target && ev.target.id === 'pop') closePop(); };
    $('#talk').onclick = () => talkStep();
    $('#infoClose').onclick = () => { $('#infoBar').classList.remove('on'); sel = null; paintBoard(); };
    $('#bagClose').onclick = () => openBag(false);
    $('#oLeft').onclick = () => scrollOrders(-1);
    $('#oRight').onclick = () => scrollOrders(1);
    $('#orders').addEventListener('scroll', orderArrows, { passive: true });
    renderTools();
    if (bagHas()) renderBag();
    // the painted backdrops, handed to CSS as variables
    applyScene();
    $('#app').style.setProperty('--labbg', `url(${ART.spriteScene('lab')})`);
    $('#miniClose').onclick = closeMini;
    $('#btnQuests').onclick = () => { tutFire('quests'); const pj = curProject(); if (pj && projReady(pj)) buildProject(); else { sfx.tap(); chapterSheet(); } };
    $('#btnStore').onclick = () => { sfx.tap(); storeTap(); };
    { const gi = $('#goalsIc'); if (gi) gi.innerHTML = ART.uiIcon('ic_goals', '📜'); }
    { const si = document.querySelector('#btnStore .ti') as HTMLElement | null; if (si && ART.spriteUi('ic_box')) si.innerHTML = ART.uiIcon('ic_box', '📦'); }
    $('#chapLine').onclick = () => ($('#btnQuests') as HTMLElement).click();
    applyBloomSkin();

    if (import.meta.env.DEV) (window as any).__game = {
      state: () => S, cells: () => B(),
      prods: PRODS, items: ITEMS, chains: CHAINS, config: CONFIG, recipes: RECIPES, shop: SHOP,
      hud: () => renderHUD(), world: () => renderWorldScreen(), wlv, bloomValue,
      grow: () => { growProducers(); paintBoard(); }, capOf, plv, dropsOf, liveChains, allMaxed, ecost,
      roll: () => rollOrder(), xpNeed, maxEnergy, orderSlots,
      fly: (w: string) => galaxyTap(w), view: (v: string) => setView(v),
      curProject: () => curProject(), v9: { paintAll: () => WORLD_ORDER.forEach(w => { paintedCache[w] = true; }), painted, storagePop, producerReveal, plantProducer, funPop, spinPop, eventPop, energyPop, playPairs, chapterIntro, talkScene, closePop, evNow, modal, contractSheet, chapterSheet, buildProject, bingoPop, bingo, upNeeds, upgradeProducer, upCost, stillPop, stillCollect, stillLeft, petHatch: () => petHatch(() => {}), travelTo, chapterFanfare: () => chapterFanfare(projList()[Math.max(0, projDone() - 1)], () => {}), rocketPanel, starsPanel: () => starChart(), starChart, questsPop: () => questPanel(), meteorStory, wreckStory, chainPanel, services: { mockControls, analytics, notify, games }, jitOn: () => !!jit, jitOff: () => coachOff(), tutState: () => ({ at: tutAt, jit: jit ? jit.id : '', cls: $('#tut').className }), labTab: (t: string) => { labTab = t; setView('lab'); if (t === 'acc') labAccPop(); else if (t === 'research') labResPop(); } },
    };
    setInterval(tick, 500);
    setInterval(() => { if (!document.hidden) S.playMs = (S.playMs || 0) + 5000; }, 5000);
    setInterval(save, 8000);
    // the shell asks for a save when the app goes to the background
    window.addEventListener('mr:save', () => goingAway());
    document.addEventListener('visibilitychange', () => { if (document.hidden) goingAway(); });
    store.init(toast);

    $('#tNext').onclick = () => { sfx.tap(); tutNext(); };
    $('#tSkip').onclick = () => { sfx.tap(); tutEnd(); toast('Intro skipped.'); };
    if (!S.tut) {
      setTimeout(tutStart, 700);
    } else {
      $('#tut').style.display = 'none';
      setTimeout(checkDaily, 1200);
      if (away) setTimeout(() => toast(away), 3200);
      setTimeout(() => checkStory(), 1800);
    }
  }
  await boot();
}
