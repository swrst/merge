/* MERGE ROCKET - core game loop. Earth -> rebuild a rocket -> new worlds. */
import { ART } from './art';
import { haptic } from './native';
import { board } from './board';

export async function startGame() {
  const $ = (s: string): any => document.querySelector(s);
  const el = (t: string, c?: string) => { const e = document.createElement(t); if (c) e.className = c; return e; };
  const rnd = (a: any[]) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const COLS = 6, ROWS = 8, N = COLS * ROWS;

  /* ============================================================= CONTENT */
  const ITEMS = {
    twig: { n: 'Twig', c: 'wood', t: 1, sell: 2 }, branch: { n: 'Branch', c: 'wood', t: 2, sell: 5 },
    log: { n: 'Log', c: 'wood', t: 3, sell: 14 }, lumber: { n: 'Lumber Pile', c: 'wood', t: 4, sell: 34 },
    pebble: { n: 'Pebble', c: 'stone', t: 1, sell: 2 }, rock: { n: 'Rock', c: 'stone', t: 2, sell: 6 },
    geode: { n: 'Geode', c: 'stone', t: 3, sell: 15 }, gem: { n: 'Gemstone', c: 'stone', t: 4, sell: 38 },
    berry: { n: 'Berry', c: 'berry', t: 1, sell: 3 }, berries: { n: 'Berry Bunch', c: 'berry', t: 2, sell: 7 },
    jam: { n: 'Jam Jar', c: 'berry', t: 3, sell: 17 }, pie: { n: 'Berry Pie', c: 'berry', t: 4, sell: 42 },
    scrap: { n: 'Star Scrap', c: 'star', t: 1, sell: 30 }, starcore: { n: 'Star Core', c: 'star', t: 2, sell: 80 },
    bolt: { n: 'Bolt', c: 'hull', t: 1, sell: 4 }, boltpack: { n: 'Bolt Pack', c: 'hull', t: 2, sell: 10 },
    hullplate: { n: 'Hull Plate', c: 'hull', t: 3, sell: 28, part: 'hull' },
    spring: { n: 'Spring', c: 'engine', t: 1, sell: 4 }, coil: { n: 'Coil', c: 'engine', t: 2, sell: 10 },
    enginecore: { n: 'Engine Core', c: 'engine', t: 3, sell: 28, part: 'engine' },
    wire: { n: 'Wire', c: 'nav', t: 1, sell: 4 }, circuit: { n: 'Circuit', c: 'nav', t: 2, sell: 10 },
    navdish: { n: 'Nav Dish', c: 'nav', t: 3, sell: 28, part: 'nav' },
    glass: { n: 'Glass Shard', c: 'tank', t: 1, sell: 4 }, tankglass: { n: 'Tank Glass', c: 'tank', t: 2, sell: 10 },
    fueltank: { n: 'Fuel Tank', c: 'tank', t: 3, sell: 28, part: 'tank' },
    fuelore: { n: 'Fuel Ore', c: 'fuel', t: 1, sell: 6 }, fuelcan: { n: 'Fuel Can', c: 'fuel', t: 2, sell: 15 },
    rocketfuel: { n: 'Rocket Fuel', c: 'fuel', t: 3, sell: 40, fuel: true },
    mrock: { n: 'Moon Rock', c: 'moon', t: 1, sell: 4 }, mcrystal: { n: 'Moon Crystal', c: 'moon', t: 2, sell: 9 },
    mcore: { n: 'Lunar Core', c: 'moon', t: 3, sell: 20 }, mstar: { n: 'Star Crystal', c: 'moon', t: 4, sell: 46 },
    spore: { n: 'Glow Spore', c: 'glow', t: 1, sell: 4 }, bulb: { n: 'Glow Bulb', c: 'glow', t: 2, sell: 9 },
    glowflower: { n: 'Glow Flower', c: 'glow', t: 3, sell: 20 }, starbloom: { n: 'Star Bloom', c: 'glow', t: 4, sell: 46 },
  };
  const CHAINS = {
    wood: { n: 'Woodworks', w: 'earth', ids: ['twig', 'branch', 'log', 'lumber'] },
    stone: { n: 'Rock Quarry', w: 'earth', ids: ['pebble', 'rock', 'geode', 'gem'] },
    berry: { n: 'Berry Kitchen', w: 'earth', ids: ['berry', 'berries', 'jam', 'pie'] },
    star: { n: 'Meteor Finds', w: 'any', ids: ['scrap', 'starcore'] },
    hull: { n: 'Rocket: Hull', w: 'ship', ids: ['bolt', 'boltpack', 'hullplate'] },
    engine: { n: 'Rocket: Engine', w: 'ship', ids: ['spring', 'coil', 'enginecore'] },
    nav: { n: 'Rocket: Nav Dish', w: 'ship', ids: ['wire', 'circuit', 'navdish'] },
    tank: { n: 'Rocket: Fuel Tank', w: 'ship', ids: ['glass', 'tankglass', 'fueltank'] },
    fuel: { n: 'Rocket Fuel', w: 'ship', ids: ['fuelore', 'fuelcan', 'rocketfuel'] },
    moon: { n: 'Moon Rocks', w: 'luna', ids: ['mrock', 'mcrystal', 'mcore', 'mstar'] },
    glow: { n: 'Glow Garden', w: 'luna', ids: ['spore', 'bulb', 'glowflower', 'starbloom'] },
  };
  const PRODS = {
    tree: { n: 'Big Tree', art: 'tree', mode: 'tap', cost: 1, drops: ['twig', 'twig', 'twig', 'branch'] },
    rocks: { n: 'Rock Pile', art: 'rocks', mode: 'tap', cost: 1, drops: ['pebble', 'pebble', 'pebble', 'rock'] },
    bush: { n: 'Berry Bush', art: 'bush', mode: 'timer', every: 15000, cap: 3, drops: ['berry', 'berry', 'berries'] },
    wreck: { n: 'Rocket Wreck', art: 'scrapwreck', mode: 'tap', cost: 1, drops: ['bolt', 'spring', 'wire', 'glass', 'bolt', 'spring', 'wire', 'glass', 'boltpack', 'coil', 'circuit', 'tankglass'] },
    fuelpod: { n: 'Fuel Pod', art: 'fuelpod', mode: 'timer', every: 18000, cap: 3, drops: ['fuelore', 'fuelore', 'fuelcan'] },
    geyser: { n: 'Moon Geyser', art: 'geyser', mode: 'tap', cost: 1, drops: ['mrock', 'mrock', 'mrock', 'mcrystal'] },
    glowpod: { n: 'Glow Pod', art: 'glowpod', mode: 'timer', every: 15000, cap: 3, drops: ['spore', 'spore', 'bulb'] },
  };
  const LOCKS_E = { 0: 2, 1: 2, 4: 2, 5: 2, 2: 3, 3: 3, 42: 4, 43: 4, 46: 4, 47: 4, 44: 5, 45: 5 };
  const LOCKS_L = { 0: 2, 5: 2, 42: 2, 47: 2, 1: 3, 4: 3, 43: 3, 46: 3, 2: 4, 3: 4, 44: 5, 45: 5 };
  const WORLDS = {
    earth: {
      n: 'Sunny Meadow', sub: 'Home planet', planet: 'earth', chains: ['wood', 'stone', 'berry'],
      start: [{ i: 19, p: 'tree' }, { i: 22, p: 'rocks' }], locks: LOCKS_E,
      folks: ['grandma', 'timmy', 'gigi', 'biscuit'],
    },
    luna: {
      n: 'Crater Camp', sub: 'Luna', planet: 'luna', chains: ['moon', 'glow'],
      start: [{ i: 19, p: 'geyser' }, { i: 22, p: 'glowpod' }], locks: LOCKS_L,
      folks: ['zib', 'luma', 'rokk', 'nix'],
    },
  };
  const CHARS = {
    pip: { n: 'Pip' },
    grandma: { n: 'Grandma Plum', say: ['My pie senses are tingling!', 'Be a dear, fetch me this!', 'I am too old to climb trees.'] },
    timmy: { n: 'Scout Timmy', say: ['My fort needs supplies!', 'Badge time! Help me out?', 'I promise I will share. Maybe.'] },
    gigi: { n: 'Chef Gigi', say: ['Ze recipe demands it!', 'My kitchen is desperate!', 'Quickly, before ze soup cools!'] },
    biscuit: { n: 'Biscuit', say: ['Woof! (He wants this.)', '*tail wag intensifies*', 'Bork bork! (Please?)'] },
    bloop: { n: 'Prof. Bloop', say: ['For SCIENCE! And snacks.', 'My scanner says: gimme.', 'Blorp! I need this thing.'] },
    zib: { n: 'Zib', say: ['Three eyes, one wish!', 'Zib want. Zib pay.', 'Trade you space money!'] },
    luma: { n: 'Luma', say: ['It would look lovely on my ship.', 'Pretty please, star friend?', 'I collect these!'] },
    rokk: { n: 'Rokk', say: ['BEEP. RESOURCE REQUEST.', 'MY CIRCUITS DEMAND IT.', 'TRADE = GOOD. YES.'] },
    nix: { n: 'Nix', say: ['I wandered far for this.', 'Shiny. I want it.', 'A gift for my home world?'] },
  };
  const MISSIONS = [
    { id: 'spawn', need: 3, txt: 'Shake the Big Tree 3 times', hint: 'Tap the <b>Big Tree</b> to shake out twigs!', coins: 25 },
    { id: 'merge', need: 2, txt: 'Merge 2 times', hint: '<b>Drag</b> one item onto a matching one to merge!', coins: 25 },
    { id: 'deliver', need: 2, txt: 'Deliver 2 orders', hint: 'Fill an order up top — orders give the most XP!', coins: 60 },
    { id: 'level', need: 3, txt: 'Reach Level 3', hint: 'Level up to clear weeds and refill energy.', coins: 80 },
    { id: 'meteor', need: 1, txt: 'Find what fell from the sky', hint: 'Keep playing... something is coming.', coins: 100 },
    { id: 'part', need: 4, txt: 'Build all 4 rocket parts', hint: 'Tap the wreck for parts, merge them into rocket pieces!', coins: 250 },
    { id: 'fuelm', need: 3, txt: 'Brew 3 Rocket Fuel', hint: 'Merge fuel ore up into Rocket Fuel to fill the tank!', coins: 200 },
    { id: 'travel', need: 1, txt: 'Fly to a new world', hint: 'Tank is full! Open 🚀 and LAUNCH!', coins: 500 },
  ];

  const xpNeed = (l: number) => 6 + (l - 1) * 5;
  const maxEnergy = () => 50 + (S.lvl - 1) * 5;
  const nextOf = (id: string): string | null => { const d = ITEMS[id]; if (!d) return null; const a = CHAINS[d.c].ids, i = a.indexOf(id); return i >= 0 && i < a.length - 1 ? a[i + 1] : null; };

  /* =============================================================== STATE */
  const SAVE = 'mergeRocket_v2';
  let S: any, cells: any[] = [], view = 'board', drag: any = null, sel: number | null = null,
    hintPair: number[] | null = null, lastAct = Date.now(), meteorTimer = 0;

  function freshBoard(world: string) {
    const w = WORLDS[world], b = new Array(N).fill(null);
    const lvl = (typeof S !== 'undefined' && S && S.lvl) ? S.lvl : 1;
    for (const k in w.locks) if (w.locks[k] > lvl) b[k] = { b: w.locks[k] };
    w.start.forEach(s => { b[s.i] = mkProd(s.p); });
    // a few starter items so the board isn't bare
    const c0 = CHAINS[w.chains[0]].ids[0], c1 = CHAINS[w.chains[1]].ids[0];
    [13, 16, 25, 28].forEach((i, k) => { if (!b[i]) b[i] = { id: k % 2 ? c1 : c0 }; });
    return b;
  }
  function mkProd(k: string) { const p = PRODS[k], o: any = { p: k }; if (p.mode === 'timer') { o.ch = 1; o.at = Date.now(); } return o; }
  function fresh() {
    return {
      v: 2, world: 'earth', lvl: 1, xp: 0, coins: 120, energy: 45, eAt: Date.now(),
      boards: { earth: freshBoard('earth'), luna: null },
      orders: [], seen: { twig: 1, pebble: 1 }, parts: { hull: 0, engine: 0, nav: 0, tank: 0 },
      fuel: 0, mp: {}, met: 0, unlocked: { luna: 0 }, snackAt: 0, sound: 1, tut: 0,
    };
  }
  function load() {
    try { const r = localStorage.getItem(SAVE); if (r) { const p = JSON.parse(r); if (p && p.v === 2 && p.boards) return p; } } catch (e) { }
    return fresh();
  }
  function save() { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) { } }
  const B = () => S.boards[S.world];
  const W = () => WORLDS[S.world];

  /* ================================================================ AUDIO */
  let actx: any = null;
  function beep(freqs: number[], type?: OscillatorType, dur?: number, vol?: number) {
    if (!S.sound) return;
    try {
      actx = actx || new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + i * 0.07;
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol || 0.16, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + (dur || 0.22));
        o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + (dur || 0.22) + 0.05);
      });
    } catch (e) { }
  }
  const sfx = {
    pop: () => beep([520, 700], 'sine', 0.16, 0.12),
    merge: () => beep([600, 800, 1000], 'sine', 0.18, 0.14),
    big: () => beep([700, 900, 1200, 1500], 'triangle', 0.22, 0.14),
    coin: () => beep([900, 1250], 'square', 0.12, 0.07),
    boom: () => beep([90, 60], 'sawtooth', 0.5, 0.18),
    no: () => beep([220, 170], 'sine', 0.14, 0.09),
  };

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

  /* ================================================================ RENDER */
  async function buildBoard() {
    await board.init($('#board'), COLS, ROWS, {
      onTap: (i: number) => { if (i < 0) { sel = null; hideInfo(); board.setSelected(null); } else tap(i); },
      onDrop: (from: number, to: number) => onDrop(from, to),
      dropKind: (from: number, to: number) => {
        const b = B(), a = b[from], c = b[to];
        if (!a || a.b) return null;
        if (!c) return 'move';
        if (a.id && c.id && a.id === c.id && nextOf(a.id)) return 'merge';
        return null;
      },
      canDrag: (i: number) => { const c = B()[i]; return !!c && !c.b; },
    });
    await board.preload(Object.keys(ITEMS), Object.keys(PRODS).map(k => PRODS[k].art));
    board.setTheme(S.world as 'earth' | 'luna');
  }

  function onDrop(from: number, to: number) {
    const b = B(), a = b[from], c = b[to];
    lastAct = Date.now();
    sel = null; board.setSelected(null); hideInfo();
    if (!a) return;
    if (c && c.id && a.id === c.id && nextOf(a.id)) { tryMerge(from, to); return; }
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
      if (p.mode !== 'timer') { board.setReady(i, S.energy >= p.cost); continue; }
      while (c.ch < p.cap && now - c.at >= p.every) { c.at += p.every; c.ch++; }
      if (c.ch >= p.cap) c.at = now;
      board.setBadge(i, c.ch, c.ch >= p.cap ? 'FULL' : Math.ceil((p.every - (now - c.at)) / 1000) + 's');
      board.setReady(i, c.ch > 0);
    }
  }

  function renderHUD() {
    $('#coins').textContent = S.coins;
    $('#energy').textContent = S.energy + '/' + maxEnergy();
    $('#lvl').textContent = S.lvl;
    $('#xpTxt').textContent = S.xp + '/' + xpNeed(S.lvl);
    $('#xpFill').style.width = clamp(S.xp / xpNeed(S.lvl) * 100, 0, 100) + '%';
    $('#app').classList.toggle('luna', S.world === 'luna');
    $('#worldName').textContent = W().n;
    $('#worldIcon').innerHTML = ART.planet(W().planet);
    const m = curMission();
    $('#guideFace').innerHTML = ART.char(S.met ? 'bloop' : 'pip');
    $('#guideTxt').innerHTML = m ? m.hint : '<b>Nice!</b> Keep merging, trading and exploring — more worlds are waiting.';
    $('#tabRocket').classList.toggle('locked', !S.met);
    $('#tabMap').classList.toggle('locked', !allParts());
    $('#dotRocket').style.display = (S.met && (readyParts() || S.fuel >= 3)) ? '' : 'none';
  }
  function curMission() { return MISSIONS.find(m => (S.mp[m.id] || 0) < m.need); }
  function readyParts() { return !allParts() && Object.keys(S.parts).some(k => !S.parts[k]); }
  const allParts = () => S.parts.hull && S.parts.engine && S.parts.nav && S.parts.tank;

  function countItem(id: string) { let n = 0; const b = B(); for (let i = 0; i < N; i++) if (b[i] && b[i].id === id) n++; return n; }

  function renderOrders(newIds?: string[]) {
    const host = $('#orders'); host.innerHTML = '';
    S.orders.forEach(o => {
      const ready = o.needs.every(nd => countItem(nd.id) >= nd.qty);
      const card = el('div', 'order' + (ready ? ' ready' : '') + (newIds && newIds.indexOf(o.id) >= 0 ? ' newin' : ''));
      const ch = CHARS[o.char];
      card.innerHTML =
        `<div class="oTop"><div class="face">${ART.char(o.char)}</div><div><div class="oName">${ch.n}</div><div class="oSay">${o.say}</div></div></div>
         <div class="oNeeds">${o.needs.map(nd => {
          const have = Math.min(countItem(nd.id), nd.qty);
          return `<div class="oNeed${have >= nd.qty ? ' done' : ''}">${ART.item(nd.id)}<b>${have}/${nd.qty}</b></div>`;
        }).join('')}</div>
         <div class="oFoot"><div class="oRew">${ART.icon('coin')}${o.coins}</div><div class="oRew">${ART.icon('star')}${o.xp}</div>
         <button class="btnDeliver${ready ? ' on' : ''}">${ready ? 'GIVE!' : 'FIND IT'}</button></div>`;
      (card.querySelector('.btnDeliver') as HTMLElement).onclick = (ev: Event) => { ev.stopPropagation(); ready ? deliver(o.id) : findFor(o); };
      card.onclick = () => findFor(o);
      host.appendChild(card);
    });
  }
  function findFor(o: any) {
    const need = o.needs.find(nd => countItem(nd.id) < nd.qty) || o.needs[0];
    const b = B(); let at = -1;
    for (let i = 0; i < N; i++) if (b[i] && b[i].id === need.id) { at = i; break; }
    if (at >= 0) { hintPair = [at]; board.setHint(hintPair); setTimeout(() => { hintPair = null; board.setHint(null); }, 1800); toast('Here it is! ' + ITEMS[need.id].n); }
    else {
      const src = sourceHint(need.id);
      toast('Need <b>' + ITEMS[need.id].n + '</b> — ' + src);
    }
  }
  function sourceHint(id: string) {
    const d = ITEMS[id], ids = CHAINS[d.c].ids, base = ids[0];
    for (const k in PRODS) if (PRODS[k].drops.indexOf(base) >= 0) {
      const on = B().some(c => c && c.p === k);
      return (on ? 'tap the ' : 'find the ') + PRODS[k].n + (d.t > 1 ? ' and merge up' : '');
    }
    return 'merge smaller ones together';
  }

  /* ================================================================ ORDERS */
  let oid = 1;
  function rollOrder() {
    const w = W(), maxT = clamp(1 + Math.floor(S.lvl / 2), 1, 4);
    // only ask for things the player can actually make right now: a chain counts
    // if one of its producers is sitting on the board
    const live: Record<string, boolean> = {};
    B().forEach(c => {
      if (!c || !c.p) return;
      PRODS[c.p].drops.forEach((d: string) => { live[ITEMS[d].c] = true; });
    });
    let pool: string[] = [];
    w.chains.forEach(c => { if (live[c]) CHAINS[c].ids.forEach(id => { if (ITEMS[id].t <= maxT) pool.push(id); }); });
    if (!pool.length) w.chains.forEach(c => CHAINS[c].ids.forEach(id => { if (ITEMS[id].t <= maxT) pool.push(id); }));
    if (S.seen.scrap && Math.random() < 0.15) pool.push('scrap');
    if (S.met && Math.random() < 0.12) pool.push(rnd(['bolt', 'spring', 'wire', 'glass']));
    const pick = rnd(pool), d = ITEMS[pick];
    const needs = [{ id: pick, qty: d.t >= 3 ? 1 : 1 + Math.floor(Math.random() * 2) }];
    if (S.lvl >= 4 && Math.random() < 0.3) {
      const p2 = rnd(pool.filter(x => x !== pick));
      if (p2) needs.push({ id: p2, qty: 1 });
    }
    const worth = needs.reduce((a, nd) => a + ITEMS[nd.id].sell * nd.qty, 0);
    const folks = W().folks.concat(S.met ? ['bloop'] : []);
    const char = rnd(folks);
    return {
      id: 'o' + (oid++), char, say: rnd(CHARS[char].say),
      needs, coins: Math.round(worth * (2 + Math.random())) + 8,
      xp: 3 + needs.reduce((a, nd) => a + ITEMS[nd.id].t * 2 + nd.qty, 0),
    };
  }
  function fillOrders() {
    let guard = 0;
    while (S.orders.length < 3 && guard++ < 40) {
      const o = rollOrder();
      if (S.orders.some(x => x.char === o.char) && guard < 30) continue;
      S.orders.push(o);
    }
  }
  function deliver(id: string) {
    const o = S.orders.find(x => x.id === id); if (!o) return;
    const b = B();
    o.needs.forEach(nd => { let left = nd.qty; for (let i = 0; i < N && left; i++) if (b[i] && b[i].id === nd.id) { b[i] = null; left--; sparkle(i, 8, '#ffe9a8'); } });
    S.coins += o.coins; bumpChip('#chipCoins');
    const idx = S.orders.findIndex(x => x.id === id);
    let nw = rollOrder(), guard = 0;
    while (guard++ < 25 && S.orders.some((x, k) => k !== idx && x.char === nw.char)) nw = rollOrder();
    S.orders[idx] = nw;
    sfx.coin(); toast(`${CHARS[o.char].n}: thank you! +${o.coins} coins`);
    prog('deliver', 1);
    addXp(o.xp);
    paintBoard(); renderOrders([nw.id]); renderHUD(); save();
  }
  function bumpChip(sel2: string) { const c = $(sel2); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }

  /* ============================================================ PROGRESSION */
  function addXp(n: number) {
    S.xp += n; let up = false;
    while (S.xp >= xpNeed(S.lvl)) { S.xp -= xpNeed(S.lvl); S.lvl++; up = true; onLevel(); }
    if (up) { levelBanner(); prog('level', 0, S.lvl); }
    renderHUD();
  }
  function onLevel() {
    S.energy = maxEnergy();
    const b = B(), locks = W().locks; let cleared = 0;
    for (const k in locks) if (locks[k] <= S.lvl && b[k] && b[k].b) { b[k] = null; cleared++; }
    if (S.world === 'earth' && S.lvl >= 3 && !b.some(c => c && c.p === 'bush')) {
      const i = firstFree([32, 31, 33, 26, 20]); if (i >= 0) { b[i] = mkProd('bush'); setTimeout(() => toast('🌿 A Berry Bush grew! It fills up by itself — collect it free.'), 1400); }
    }
    paintBoard();
  }
  function levelBanner() {
    sfx.big(); haptic('medium'); confetti();
    const lu = $('#levelup');
    $('#luTxt').textContent = 'LEVEL ' + S.lvl + '!';
    $('#luSub').textContent = 'Energy refilled • weeds cleared';
    lu.classList.remove('show'); void lu.offsetWidth; lu.classList.add('show');
    setTimeout(() => lu.classList.remove('show'), 2100);
    if (S.lvl >= 3 && !S.met) setTimeout(meteorStory, 1800);
  }
  function prog(id: string, add?: number, setTo?: number) {
    const m = MISSIONS.find(x => x.id === id); if (!m) return;
    const was = S.mp[id] || 0; if (was >= m.need) return;
    S.mp[id] = setTo !== undefined ? setTo : was + add;
    if (S.mp[id] >= m.need) {
      S.coins += m.coins; bumpChip('#chipCoins'); sfx.coin();
      setTimeout(() => toast('✅ ' + m.txt + ' — +' + m.coins + ' coins!'), 600);
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
    if (p.mode === 'timer') {
      if (!c.ch) { sfx.no(); toast(p.n + ' is still growing — ' + Math.ceil((p.every - (Date.now() - c.at)) / 1000) + 's'); return; }
      c.ch--; if (c.ch === 0) c.at = Date.now();
    } else {
      if (S.energy < p.cost) { sfx.no(); toast('Out of energy! Wait a bit or take a Snack Break 🍪'); return; }
      S.energy -= p.cost; bumpChip('#chipEnergy');
      floatText(i, '-' + p.cost + '⚡', '#bfe9ff');
    }
    const id = rnd(p.drops);
    b[spot] = { id }; S.seen[id] = 1;
    sfx.pop(); haptic('light'); board.animSpawn(spot, id, i);
    if (c.p === 'tree') prog('spawn', 1);
    lastAct = Date.now(); renderHUD(); renderOrders(); save();
  }
  function tryMerge(from: number, to: number) {
    const b = B(), a = b[from], c = b[to];
    if (!a || !c || !a.id || !c.id || a.id !== c.id) return false;
    const nx = nextOf(a.id);
    if (!nx) { toast(ITEMS[a.id].n + ' is already the best in its chain!'); return false; }
    b[from] = null; b[to] = { id: nx }; S.seen[nx] = 1;
    board.animMerge(from, to, nx);
    sfx.merge(); haptic('light'); floatText(to, ITEMS[nx].n, '#fff');
    addXp(1); prog('merge', 1);
    const d = ITEMS[nx];
    if (d.part) installPart(to, d.part);
    else if (d.fuel) addFuel(to);
    lastAct = Date.now(); renderOrders(); save();
    return true;
  }
  function installPart(i: number, part: string) {
    const b = B(); if (!b[i] || !ITEMS[b[i].id] || ITEMS[b[i].id].part !== part) return;
    b[i] = null; S.parts[part] = 1;
    paintCell(i); sparkle(i, 20, '#bff0ff'); sfx.big(); haptic('heavy'); confetti();
    const names = { hull: 'HULL', engine: 'ENGINE', nav: 'NAV DISH', tank: 'FUEL TANK' };
    toast('🚀 ' + names[part] + ' installed on the rocket!');
    prog('part', 1);
    renderRocket(); renderHUD(); save();
    if (allParts()) setTimeout(rocketDone, 900);
  }
  function rocketDone() {
    const b = B();
    if (!b.some(c => c && c.p === 'fuelpod')) { const i = firstFree([26, 27, 32, 20, 15]); if (i >= 0) b[i] = mkProd('fuelpod'); }
    paintBoard(); confetti(); sfx.big();
    modal('bloop', 'THE ROCKET IS WHOLE!', 'Blorp! She flies again! Now we just need FUEL. I planted a Fuel Pod on your board — merge its ore up into <b>Rocket Fuel</b>. Three of those and we can go visit my moon!', 'Let\'s go!');
    renderRocket(); save();
  }
  function addFuel(i: number) {
    const b = B(); if (!b[i] || b[i].id !== 'rocketfuel') return;
    b[i] = null; S.fuel++;
    paintCell(i); sparkle(i, 16, '#b6ffd2'); sfx.big();
    toast('⛽ Rocket Fuel loaded! ' + S.fuel + '/3');
    prog('fuelm', 1);
    if (S.fuel >= 3) setTimeout(() => { toast('Tank is FULL! Open 🗺️ Map and launch!'); }, 900);
    renderRocket(); renderHUD(); save();
  }
  function sellItem(i: number) {
    const b = B(), c = b[i]; if (!c || !c.id) return;
    const wanted = S.orders.some(o => o.needs.some(nd => nd.id === c.id));
    if (wanted) { sfx.no(); toast('Someone ordered that! Keep it.'); return; }
    S.coins += ITEMS[c.id].sell; bumpChip('#chipCoins'); sfx.coin();
    floatText(i, '+' + ITEMS[c.id].sell, '#ffe07a');
    b[i] = null; sel = null; paintCell(i); renderHUD(); renderOrders(); save();
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
      const s2 = nearFree(spot); if (s2 >= 0) { B()[s2] = { id: 'scrap' }; S.seen.scrap = 1; }
      paintBoard(); prog('meteor', 1);
      modal('bloop', 'Blorp! Hello!', 'My rocket hit your meadow — oopsie! I am <b>Professor Bloop</b>. Tap the wreck to dig out broken bits, then merge them into the 4 rocket parts: <b>Hull, Engine, Nav Dish, Fuel Tank</b>. Fix my ship and I will take you to the stars!', 'Deal!');
      renderHUD(); renderRocket(); save();
    }), 700);
  }
  function randomMeteor() {
    if (!S.met || view !== 'board') return;
    const free = freeCells(); if (free.length < 3) return;
    const spot = rnd(free);
    toast('☄️ Meteor shower! Rare scrap incoming!');
    flyMeteor(spot, () => {
      B()[spot] = { id: 'scrap' }; S.seen.scrap = 1;
      paintCell(spot, 'drop'); toast('✨ Found <b>Star Scrap</b> — rare and worth a lot!');
      renderOrders(); save();
    });
  }

  /* ================================================================= HINTS */
  function findPair() {
    const b = B(), seenAt = {};
    for (let i = 0; i < N; i++) {
      const c = b[i]; if (!c || !c.id || !nextOf(c.id)) continue;
      if (seenAt[c.id] !== undefined) return [seenAt[c.id], i];
      seenAt[c.id] = i;
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
    hintPair = p; board.setHint(hintPair); if (manual) sfx.pop();
    toast('💡 These two match — drag one onto the other!');
    setTimeout(() => { hintPair = null; board.setHint(null); }, 2400);
  }

  /* ============================================================== SCREENS */
  function setView(v: string) {
    if (v === 'rocket' && !S.met) { sfx.no(); toast('Locked — keep playing, something will fall from the sky!'); return; }
    if (v === 'map' && !allParts()) { sfx.no(); toast('Locked — finish building the rocket first!'); return; }
    view = v;
    ['rocket', 'book', 'map'].forEach(k => $('#sc-' + k).classList.toggle('open', v === k));
    document.querySelectorAll<HTMLElement>('.tab').forEach(t => t.classList.toggle('on', t.dataset.v === v));
    if (v === 'rocket') renderRocket(); if (v === 'book') renderBook(); if (v === 'map') renderMap();
  }
  function renderRocket() {
    const host = $('#rocketBody'); if (!host) return;
    const parts = [['hull', 'Hull', 'hullplate'], ['engine', 'Engine', 'enginecore'], ['nav', 'Nav Dish', 'navdish'], ['tank', 'Fuel Tank', 'fueltank']];
    host.innerHTML =
      `<div class="card"><div class="cardTitle">🎯 Missions</div>
        ${MISSIONS.map(m => {
        const p = S.mp[m.id] || 0, done = p >= m.need;
        return `<div class="mission${done ? ' done' : ''}"><div class="mBox">${done ? '✓' : ''}</div>
          <div class="mTxt">${m.txt}${!done && m.need > 1 ? ` <span style="color:#b59158">(${Math.min(p, m.need)}/${m.need})</span>` : ''}</div>
          <div class="mRew">${ART.icon('coin')}${m.coins}</div></div>`;
      }).join('')}</div>
       <div class="card"><div class="cardTitle">🚀 Rocket workshop</div>
        <div class="rocketWrap">${ART.rocket(S.parts)}</div>
        <div class="partGrid">${parts.map(p => `<div class="part${S.parts[p[0]] ? ' on' : ''}">${ART.item(p[2])}<div class="pl">${p[1]}</div></div>`).join('')}</div>
        <div class="fuelRow"><div style="font-size:12px;font-weight:700">Fuel tank</div>
          <div class="fuelDots">${[0, 1, 2].map(k => `<div class="fuelDot${S.fuel > k ? ' on' : ''}">${ART.icon('fuel')}</div>`).join('')}</div>
          <div style="font-size:11px;color:#9a7a4e;font-weight:600">${S.fuel}/3</div></div>
        ${allParts()
        ? `<button class="big${S.fuel >= 3 ? '' : ' '}" id="btnLaunch" ${S.fuel >= 3 ? '' : 'disabled'}>${S.fuel >= 3 ? '🚀 OPEN THE MAP' : 'Need 3 Rocket Fuel'}</button>`
        : `<div style="font-size:11.5px;color:#9a7a4e;font-weight:600;margin-top:8px;text-align:center">Merge scrap from the wreck into all 4 parts to finish the rocket.</div>`}
       </div>`;
    const bl = $('#btnLaunch'); if (bl) bl.onclick = () => setView('map');
  }
  function renderBook() {
    const host = $('#bookBody');
    const groups = Object.keys(CHAINS).filter(k => {
      const w = CHAINS[k].w;
      return w === 'any' ? !!S.seen.scrap : w === 'ship' ? !!S.met : (w === S.world || CHAINS[k].ids.some(id => S.seen[id]));
    });
    host.innerHTML = groups.map(k => {
      const ch = CHAINS[k];
      return `<div class="card"><div class="cardTitle">${ch.n}</div><div class="chainRow">${ch.ids.map((id, n) => {
        const kn = S.seen[id];
        return `<div class="cStep"><div class="cArt${kn ? '' : ' unk'}">${kn ? ART.item(id) : '?'}</div><div class="cLab">${kn ? ITEMS[id].n : '???'}</div></div>`
          + (n < ch.ids.length - 1 ? '<div class="arrow">➜</div>' : '');
      }).join('')}</div>
      <div style="font-size:10.5px;color:#9a7a4e;font-weight:600;margin-top:4px">Drag 2 identical items together to make the next one.</div></div>`;
    }).join('') +
      `<div class="card"><div class="cardTitle">🏭 Producers</div>${Object.keys(PRODS).filter(k => B().some(c => c && c.p === k) || (k === 'wreck' && S.met)).map(k => {
        const p = PRODS[k];
        return `<div class="mission"><div class="mBox" style="background:#fff;box-shadow:none">${ART.producer(p.art)}</div>
        <div class="mTxt">${p.n}<div style="font-size:10px;color:#9a7a4e;font-weight:600">${p.mode === 'timer' ? `Free! Refills every ${p.every / 1000}s (holds ${p.cap})` : `Costs ${p.cost} ⚡ per tap`} · makes ${[...new Set(p.drops as string[])].map(d => ITEMS[d].n).join(', ')}</div></div></div>`;
      }).join('')}</div>
      <div class="card"><div class="cardTitle">☄️ Meteors</div><div style="font-size:11.5px;font-weight:600;color:#7a6244">Every now and then a meteor crashes on your board and leaves rare <b>Star Scrap</b>. Keep a few tiles free so it has room to land!</div></div>`;
  }
  function renderMap() {
    const host = $('#mapBody');
    const cards = [
      { k: 'earth', n: 'Sunny Meadow', s: 'Home planet · wood, rocks & berries', p: 'earth' },
      { k: 'luna', n: 'Crater Camp', s: 'Luna · moon rocks & glow plants', p: 'luna' },
      { k: 'x', n: 'Unknown World', s: 'Coming soon...', p: 'mystery' },
    ];
    host.innerHTML = cards.map(c => {
      const here = c.k === S.world;
      const can = c.k !== 'x' && !here && allParts() && S.fuel >= 3;
      return `<div class="worldCard${here ? ' here' : ''}">${ART.planet(c.p)}
        <div style="flex:1"><div class="wName">${c.n}</div><div class="wSub">${c.s}</div></div>
        ${here ? '<div class="wSub" style="font-weight:700;color:#4fa332">You are here</div>'
          : c.k === 'x' ? '<div class="wSub">🔒</div>'
            : `<button class="goBtn" data-go="${c.k}" ${can ? '' : 'disabled'}>${can ? 'LAUNCH 🚀' : 'Need ⛽3'}</button>`}</div>`;
    }).join('') + `<div class="card"><div class="cardTitle">⛽ Fuel</div><div style="font-size:11.5px;font-weight:600;color:#7a6244">Each trip costs <b>3 Rocket Fuel</b>. Make more by merging Fuel Ore from the Fuel Pod. You have <b>${S.fuel}</b>.</div></div>`;
    host.querySelectorAll('[data-go]').forEach(b => b.onclick = () => travelTo(b.dataset.go));
  }

  /* =============================================================== TRAVEL */
  function travelTo(w: string) {
    if (S.fuel < 3 || !allParts()) return;
    S.fuel -= 3;
    const cut = $('#cut'); $('#cutRocket').innerHTML = ART.rocket({ hull: 1, engine: 1, nav: 1, tank: 1 }, { flame: true });
    $('#cutTitle').textContent = 'Blasting off!';
    $('#cutSub').textContent = 'Destination: ' + WORLDS[w].n;
    const warpHost = $('#warps'); warpHost.innerHTML = '';
    for (let i = 0; i < 22; i++) { const s = el('div', 'warp'); s.style.cssText = `left:${Math.random() * 100}%;height:${30 + Math.random() * 90}px;animation-delay:${-Math.random()}s`; warpHost.appendChild(s); }
    cut.classList.add('show'); sfx.big();
    setTimeout(() => {
      if (!S.boards[w]) S.boards[w] = freshBoard(w);
      S.world = w; S.unlocked[w] = 1; sel = null;
      // carry the fuel pod over so you can refuel anywhere
      const b = S.boards[w];
      if (!b.some(c => c && c.p === 'fuelpod')) { const i = firstFree([26, 27, 32, 20]); if (i >= 0) b[i] = mkProd('fuelpod'); }
      S.orders = []; fillOrders();
      prog('travel', 1);
      board.setTheme(w as 'earth' | 'luna');
      paintBoard(); renderHUD(); renderOrders(); setView('board');
      setTimeout(() => {
        cut.classList.remove('show');
        modal('zib', 'Welcome to Luna!', 'Whoa — new world, new stuff! Moon Rocks and Glow Plants grow here, and the locals pay <b>very</b> well. Your rocket stays with you: gather 3 more fuel any time you want to fly again.', 'Explore!');
      }, 900);
      save();
    }, 2100);
  }

  /* ================================================================ MODALS */
  function modal(face: string, title: string, body: string, btn?: string) {
    $('#mFace').innerHTML = ART.char(face);
    $('#mTitle').textContent = title;
    $('#mBody').innerHTML = body;
    $('#mBtn').textContent = btn || 'OK';
    $('#modal').classList.add('open');
  }
  $('#mBtn') && ($('#mBtn').onclick = () => $('#modal').classList.remove('open'));

  /* ================================================================ INPUT */
  /* Pointer handling lives in board.ts (Pixi hit-testing): it calls back into
     tap() / onDrop() above. Nothing here touches the DOM. */

  function tap(i: number) {
    const c = B()[i];
    lastAct = Date.now();
    if (!actx && S.sound) beep([0], 'sine', 0.01, 0.001);        // unlock audio on first gesture
    const pick = (k: number | null) => { sel = k; board.setSelected(k); };
    if (!c) { pick(null); hideInfo(); return; }
    if (c.b) { sfx.no(); pick(null); hideInfo(); toast('Clears at Level ' + c.b + ' — keep leveling up!'); return; }
    if (c.p) { pick(null); hideInfo(); useProducer(i); return; }
    if (sel === null) { pick(i); showInfo(i); return; }
    if (sel === i) { pick(null); hideInfo(); return; }
    const a = B()[sel];
    if (a && a.id === c.id && nextOf(a.id)) { const f = sel; pick(null); hideInfo(); tryMerge(f, i); return; }
    pick(i); showInfo(i);
  }
  function hideInfo() { $('#infoBar').classList.remove('on'); }
  function showInfo(i: number) {
    const c = B()[i]; if (!c || !c.id) return;
    const d = ITEMS[c.id], nx = nextOf(c.id);
    $('#infoBar').classList.add('on');
    $('#infoTxt').innerHTML = `<b>${d.n}</b> · sells for ${d.sell} 🪙${nx ? ` · 2 make a ${ITEMS[nx].n}` : ' · top tier!'}`;
    $('#btnSell').onclick = () => { sellItem(i); $('#infoBar').classList.remove('on'); };
  }

  /* ================================================================== LOOP */
  function tick() {
    const now = Date.now();
    // energy regen
    const per = 15000;
    while (S.energy < maxEnergy() && now - S.eAt >= per) { S.eAt += per; S.energy++; renderHUD(); }
    if (S.energy >= maxEnergy()) S.eAt = now;
    tickProducers();
    sweepSpecials();
    // snack cooldown
    const cd = Math.max(0, 60000 - (now - S.snackAt));
    const sb = $('#btnSnack'); sb.disabled = cd > 0 || S.energy >= maxEnergy();
    sb.textContent = cd > 0 ? Math.ceil(cd / 1000) + 's' : '🍪 +20';
    // idle hint
    if (view === 'board' && now - lastAct > 17000 && !hintPair) { showHint(false); lastAct = now; }
    // random meteors
    if (S.met && now > meteorTimer) { meteorTimer = now + 55000 + Math.random() * 45000; if (Math.random() < 0.85) randomMeteor(); }
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
  }
  async function boot() {
    S = load();
    if (!S.orders || !S.orders.length) { S.orders = []; fillOrders(); }
    oid = S.orders.length + 1;
    scenery();
    await buildBoard();
    paintBoard(); renderHUD(); renderOrders(); renderRocket();
    meteorTimer = Date.now() + 40000;

    document.querySelectorAll<HTMLElement>('.tab').forEach(t => t.onclick = () => setView(t.dataset.v as string));
    document.querySelectorAll<HTMLElement>('.scClose').forEach(b => b.onclick = () => setView('board'));
    $('#btnHint').onclick = () => { showHint(true); lastAct = Date.now(); };
    $('#btnSnack').onclick = () => {
      if (S.energy >= maxEnergy()) { toast('Energy is already full!'); return; }
      S.snackAt = Date.now(); S.energy = Math.min(maxEnergy(), S.energy + 20);
      bumpChip('#chipEnergy'); sfx.coin(); toast('🍪 Yum! +20 energy'); renderHUD(); save();
    };
    $('#btnGear').onclick = () => {
      modal('pip', 'Settings', `Sound is <b>${S.sound ? 'ON' : 'OFF'}</b>.<br><br><button class="big blue" id="sndBtn" style="margin-top:4px">${S.sound ? 'Turn sound OFF' : 'Turn sound ON'}</button>
        <button class="big gold" id="resetBtn">Start a new game</button>`, 'Close');
      setTimeout(() => {
        const sb2 = $('#sndBtn'), rb = $('#resetBtn');
        if (sb2) sb2.onclick = () => { S.sound = S.sound ? 0 : 1; save(); $('#modal').classList.remove('open'); toast('Sound ' + (S.sound ? 'on 🔊' : 'off 🔇')); };
        if (rb) rb.onclick = () => { localStorage.removeItem(SAVE); location.reload(); };
      }, 30);
    };
    $('#infoClose').onclick = () => { $('#infoBar').classList.remove('on'); sel = null; paintBoard(); };

    if (import.meta.env.DEV) (window as any).__game = { state: () => S, cells: () => B(), prods: PRODS, items: ITEMS };
    setInterval(tick, 500);
    setInterval(save, 8000);

    if (!S.tut) {
      S.tut = 1; save();
      setTimeout(() => modal('pip', 'Hi, I\'m Pip!', 'Welcome to <b>Merge Rocket</b>! Tap the <b>Big Tree</b> to shake out twigs, then <b>drag two matching things together</b> to merge them into something better. Fill orders for your friends to level up!', 'Let\'s play!'), 400);
    }
  }
  await boot();
}
