/* MERGE ROCKET - core game loop. Earth -> rebuild a rocket -> new worlds. */
import { ART } from './art';
import { haptic } from './native';
import { board } from './board';
import { ads } from './ads';
import {
  ITEMS, CHAINS, PRODUCERS as PRODS, WORLDS, CHARACTERS as CHARS, MISSIONS, CONFIG,
  RECIPES, SHOP, ITEM_IDS, PRODUCER_ARTS, nextOf, validateContent,
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

  /* ------------------------------------------------- shop upgrade effects */
  const upLv = (id: string) => (S.up && S.up[id]) || 0;
  const upPrice = (u: any) => u.basePrice + u.step * upLv(u.id);
  const maxEnergy = () =>
    CONFIG.energy.base + (S.lvl - 1) * CONFIG.energy.perLevel + upLv('energy') * CONFIG.upgrades.energyPerStep;
  const orderSlots = () => CONFIG.orders.slots + upLv('orders') * CONFIG.upgrades.ordersPerStep;
  const snackAmt = () => CONFIG.energy.snack.amount + upLv('snack') * CONFIG.upgrades.snackPerStep;
  /** a timer producer's refill time, sped up by the Fertiliser upgrade */
  const everyOf = (p: any) =>
    Math.max(3000, Math.round(p.every * Math.max(0.25, 1 - upLv('speed') * CONFIG.upgrades.speedPerStep)));
  const shopOpen = () => S.lvl >= CONFIG.unlocks.shopAtLevel;
  const labOpen = () => S.lvl >= CONFIG.unlocks.labAtLevel;

  /* =============================================================== STATE */
  const SAVE = 'mergeRocket_v2';   // key kept; the shape is versioned inside (S.v)
  let S: any, cells: any[] = [], view = 'board', drag: any = null, sel: number | null = null,
    hintPair: number[] | null = null, lastAct = Date.now(), meteorTimer = 0;

  function freshBoard(world: string) {
    const w = WORLDS[world], b = new Array(N).fill(null);
    const lvl = (typeof S !== 'undefined' && S && S.lvl) ? S.lvl : 1;
    for (const k in w.locks) if (w.locks[k] > lvl) b[k] = { b: w.locks[k] };
    w.start.forEach(s => { b[s.cell] = mkProd(s.producer); });
    // a few starter items so the board isn't bare
    const c0 = CHAINS[w.chains[0]].items[0], c1 = CHAINS[w.chains[1]].items[0];
    [13, 16, 25, 28].forEach((i, k) => { if (!b[i]) b[i] = { id: k % 2 ? c1 : c0 }; });
    return b;
  }
  function mkProd(k: string) { const p = PRODS[k], o: any = { p: k }; if (p.mode === 'timer') { o.ch = 1; o.at = Date.now(); } return o; }
  function fresh() {
    return {
      v: 3, world: 'earth', lvl: 1, xp: 0, coins: CONFIG.start.coins, energy: CONFIG.start.energy, eAt: Date.now(),
      boards: { earth: freshBoard('earth'), luna: null },
      orders: [], seen: { twig: 1, pebble: 1 }, parts: { hull: 0, engine: 0, nav: 0, tank: 0 },
      fuel: 0, mp: {}, met: 0, unlocked: { luna: 0 }, snackAt: 0, sound: 1, tut: 0,
      /* v3: coin sinks */
      up: {},                                   // upgrade id -> level bought
      shop: { stock: null, at: 0 },             // rotating supply shelf
      lab: { disc: {}, clue: {}, slots: [null, null], tries: 0, made: 0 },
      made: {},                                 // item id -> how many you have ever owned
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
    p.v = 3;
    return p;
  }
  function load() {
    try {
      const r = localStorage.getItem(SAVE);
      if (r) { const p = JSON.parse(r); if (p && (p.v === 2 || p.v === 3) && p.boards) return migrate(p); }
    } catch (e) { }
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
    await board.preload(ITEM_IDS, PRODUCER_ARTS);
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
      const ev = everyOf(p);
      while (c.ch < p.cap && now - c.at >= ev) { c.at += ev; c.ch++; }
      if (c.ch >= p.cap) c.at = now;
      board.setBadge(i, c.ch, c.ch >= p.cap ? 'FULL' : Math.ceil((ev - (now - c.at)) / 1000) + 's');
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
    $('#worldName').textContent = W().name;
    $('#worldIcon').innerHTML = ART.planet(W().planet);
    const m = curMission();
    $('#guideFace').innerHTML = ART.char(S.met ? 'bloop' : 'pip');
    $('#guideTxt').innerHTML = m ? m.hint : '<b>Nice!</b> Keep merging, trading and exploring — more worlds are waiting.';
    $('#tabRocket').classList.toggle('locked', !S.met);
    $('#tabMap').classList.toggle('locked', !allParts());
    $('#tabShop').classList.toggle('locked', !shopOpen());
    $('#tabLab').classList.toggle('locked', !labOpen());
    $('#dotRocket').style.display = (S.met && (readyParts() || S.fuel >= CONFIG.rocket.fuelToLaunch)) ? '' : 'none';
    $('#dotShop').style.display = shopNews() ? '' : 'none';
    if (view === 'shop') $('#shopCoins').textContent = S.coins;
    if (view === 'lab') $('#labCoins').textContent = S.coins;
  }
  function curMission() { return MISSIONS.find(m => (S.mp[m.id] || 0) < m.need); }
  function readyParts() { return !allParts() && Object.keys(S.parts).some(k => !S.parts[k]); }
  const allParts = () => S.parts.hull && S.parts.engine && S.parts.nav && S.parts.tank;

  function countItem(id: string) { let n = 0; const b = B(); for (let i = 0; i < N; i++) if (b[i] && b[i].id === id) n++; return n; }
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
    S.orders.forEach(o => {
      const ready = o.needs.every(nd => countItem(nd.id) >= nd.qty);
      const card = el('div', 'order' + (ready ? ' ready' : '') + (newIds && newIds.indexOf(o.id) >= 0 ? ' newin' : ''));
      const ch = CHARS[o.char];
      card.innerHTML =
        `<div class="oTop"><div class="face">${ART.char(o.char)}</div><div><div class="oName">${ch.name}</div><div class="oSay">${o.say}</div></div></div>
         <div class="oNeeds">${o.needs.map(nd => {
          const have = Math.min(countItem(nd.id), nd.qty);
          return `<div class="oNeed${have >= nd.qty ? ' done' : ''}">${ART.item(nd.id)}<b>${have}/${nd.qty}</b></div>`;
        }).join('')}</div>
         <div class="oFoot"><div class="oRew">${ART.icon('coin')}${o.coins}</div><div class="oRew">${ART.icon('star')}${o.xp}</div>
         ${o.give ? `<div class="oRew" title="${ITEMS[o.give].name}" style="width:18px">${ART.item(o.give)}</div>` : ''}
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
    w.chains.forEach(c => { if (live[c]) CHAINS[c].items.forEach(id => { if (ITEMS[id].tier <= maxT) pool.push(id); }); });
    if (!pool.length) w.chains.forEach(c => CHAINS[c].items.forEach(id => { if (ITEMS[id].tier <= maxT) pool.push(id); }));
    if (S.seen.scrap && Math.random() < 0.15) pool.push('scrap');
    if (S.met && Math.random() < 0.12) pool.push(rnd(['bolt', 'spring', 'wire', 'glass']));
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
      needs, coins: Math.round(worth * (2 + Math.random())) + 8,
      xp: CONFIG.xp.orderBase + needs.reduce((a, nd) => a + ITEMS[nd.id].tier * 2 + nd.qty, 0),
    };
  }
  function fillOrders() {
    let guard = 0;
    while (S.orders.length < orderSlots() && guard++ < 40) {
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
    sfx.coin(); toast(`${CHARS[o.char].name}: thank you! +${o.coins} coins`);
    if (o.give) {
      const at = giveItem(o.give);
      if (at >= 0) setTimeout(() => toast(`🎁 ${CHARS[o.char].name} threw in a <b>${ITEMS[o.give].name}</b>!`), 1300);
      else setTimeout(() => toast(`${CHARS[o.char].name} had a gift but your board is full!`), 1300);
    }
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
    if (S.lvl === CONFIG.unlocks.shopAtLevel) setTimeout(() => modal('pip', 'The Trading Post!',
      'A trader rolled into the meadow! Tap 🛒 to spend your coins on materials, salvage crates, and <b>permanent upgrades</b> — a bigger energy backpack, faster plants, an extra order slot. Coins are for spending!',
      'Take my coins!'), 2300);
    if (S.lvl === CONFIG.unlocks.labAtLevel) setTimeout(() => modal('bloop', 'Research Lab built!',
      'Blorp! I built a lab out of spare parts. Put <b>two things from your board</b> on the bench and hit EXPERIMENT. Most pairs do nothing... but the right pairs make <b>relics</b>, the rarest treasures in the galaxy. Read the rumours for clues!',
      'To science!'), 2300);
    paintBoard();
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
    if (p.mode === 'timer') {
      if (!c.ch) { sfx.no(); toast(p.name + ' is still growing — ' + Math.ceil((everyOf(p) - (Date.now() - c.at)) / 1000) + 's'); return; }
      c.ch--; if (c.ch === 0) c.at = Date.now();
    } else {
      if (S.energy < p.cost) { sfx.no(); toast('Out of energy! Wait a bit or take a Snack Break 🍪'); return; }
      S.energy -= p.cost; bumpChip('#chipEnergy');
      floatText(i, '-' + p.cost + '⚡', '#bfe9ff');
    }
    // The wreck is not a slot machine: it hands out pieces for the part you are
    // furthest from finishing, so the rocket always creeps forward.
    const id = (c.p === 'wreck' && !allParts() ? partPiece() : null) || rnd(p.drops);
    b[spot] = { id }; gotItem(id);
    sfx.pop(); haptic('light'); board.animSpawn(spot, id, i);
    if (c.p === 'tree') prog('spawn', 1);
    lastAct = Date.now(); renderHUD(); renderOrders(); save();
  }
  function tryMerge(from: number, to: number) {
    const b = B(), a = b[from], c = b[to];
    if (!a || !c || !a.id || !c.id || a.id !== c.id) return false;
    const nx = nextOf(a.id);
    if (!nx) { toast(ITEMS[a.id].name + ' is already the best in its chain!'); return false; }
    b[from] = null; b[to] = { id: nx }; gotItem(nx);
    board.animMerge(from, to, nx);
    sfx.merge(); haptic('light'); floatText(to, ITEMS[nx].name, '#fff');
    addXp(CONFIG.xp.perMerge); prog('merge', 1);
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
    toast('⛽ Rocket Fuel loaded! ' + S.fuel + '/' + CONFIG.rocket.fuelToLaunch);
    prog('fuelm', 1);
    if (S.fuel >= CONFIG.rocket.fuelToLaunch) setTimeout(() => { toast('Tank is FULL! Open 🗺️ Map and launch!'); }, 900);
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
      const s2 = nearFree(spot); if (s2 >= 0) { B()[s2] = { id: 'scrap' }; gotItem('scrap'); }
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
      B()[spot] = { id: 'scrap' }; gotItem('scrap');
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
  const SCREENS = ['shop', 'lab', 'rocket', 'book', 'map'];
  function setView(v: string) {
    if (v === 'rocket' && !S.met) { sfx.no(); toast('Locked — keep playing, something will fall from the sky!'); return; }
    if (v === 'map' && !allParts()) { sfx.no(); toast('Locked — finish building the rocket first!'); return; }
    if (v === 'shop' && !shopOpen()) { sfx.no(); toast('The Trading Post opens at Level ' + CONFIG.unlocks.shopAtLevel + '!'); return; }
    if (v === 'lab' && !labOpen()) { sfx.no(); toast('The Research Lab opens at Level ' + CONFIG.unlocks.labAtLevel + '!'); return; }
    view = v;
    SCREENS.forEach(k => $('#sc-' + k).classList.toggle('open', v === k));
    document.querySelectorAll<HTMLElement>('.tab').forEach(t => t.classList.toggle('on', t.dataset.v === v));
    if (v === 'rocket') renderRocket();
    if (v === 'book') renderBook();
    if (v === 'map') renderMap();
    if (v === 'shop') { S.shop.seenAt = S.shop.at; renderShop(); renderHUD(); }
    if (v === 'lab') renderLab();
  }

  /* ============================================================ TRADING POST
     Coins finally have somewhere to go: a rotating shelf of materials, crates
     that unstick a rocket build, and four permanent upgrades. */
  function rollShop() {
    const pool: string[] = [];
    const cap = clamp(1 + Math.floor(S.lvl / 2), 2, 4);
    W().chains.forEach(c => CHAINS[c].items.forEach(id => {
      const t = ITEMS[id].tier; if (t >= 2 && t <= cap) pool.push(id);
    }));
    partsLeft().forEach(k => { if (S.met) { pool.push(CHAINS[k].items[0]); pool.push(CHAINS[k].items[1]); } });
    if (S.met) { pool.push('fuelore'); pool.push('fuelcan'); }
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
    S.coins -= price; st.left--;
    giveItem(st.id);
    sfx.coin(); haptic('light'); bumpChip('#chipCoins');
    toast('Bought a <b>' + ITEMS[st.id].name + '</b>!');
    renderShop(); renderHUD(); renderOrders(); save();
  }
  function buyCrate(id: string) {
    const c = SHOP.crates.filter(x => x.id === id)[0]; if (!c) return;
    if (!S.met || allParts()) { sfx.no(); toast('Nothing to salvage — the rocket is done!'); return; }
    if (S.coins < c.price) { sfx.no(); toast('Not enough coins yet.'); return; }
    if (!freeCells().length) { sfx.no(); toast('No room on the board! Merge something first.'); return; }
    if (id === 'blueprint') { pickPartFor(c); return; }
    S.coins -= c.price;
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
        S.coins -= c.price;
        openCrate(CHAINS[k].items[1]);
      });
    }, 30);
  }
  function openCrate(piece: string) {
    const at = giveItem(piece);
    sfx.big(); haptic('medium'); confetti();
    if (at >= 0) sparkle(at, 18, '#bff0ff');
    toast('📦 Crate opened — <b>' + ITEMS[piece].name + '</b>!');
    renderShop(); renderHUD(); renderOrders(); save();
  }
  function buyUpgrade(id: string) {
    const u = SHOP.upgrades.filter(x => x.id === id)[0]; if (!u) return;
    const lv = upLv(id);
    if (lv >= u.max) { toast(u.name + ' is fully upgraded!'); return; }
    const price = upPrice(u);
    if (S.coins < price) { sfx.no(); toast('Not enough coins — that costs ' + price + '.'); return; }
    S.coins -= price; S.up[id] = lv + 1;
    if (id === 'energy') S.energy = Math.min(maxEnergy(), S.energy + CONFIG.upgrades.energyPerStep);
    if (id === 'orders') { fillOrders(); renderOrders(); }
    sfx.big(); haptic('medium'); confetti();
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
        $('#modal').classList.remove('open'); sfx.pop(); renderLab(); save();
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
    S.coins -= cost; bumpChip('#chipCoins');
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
    sfx.big(); haptic('heavy'); confetti();
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
    S.coins -= price; S.lab.disc[id] = 1;
    sfx.coin(); bumpChip('#chipCoins');
    toast('📘 Recipe bought: <b>' + ITEMS[r.result].name + '</b>');
    renderLab(); renderHUD(); save();
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
    const coin = ART.icon('coin');
    const slotArt = (id: string | null, k: number) =>
      `<button class="slot${id ? ' full' : ''}" data-slot="${k}">${id ? ART.item(id) : '+'}</button>`;

    let html = `<div class="card"><div class="cardTitle">🧪 Experiment bench</div>
      <div class="labSlots">
        ${slotArt(a, 0)}<div class="labOp">+</div>${slotArt(b, 1)}<div class="labOp">➜</div>
        <div class="slot out">${knew ? ART.item(r!.result) : '?'}</div>
      </div>
      <button class="big${knew ? '' : ' blue'}" id="btnResearch" ${ready ? '' : 'disabled'}>${ready
        ? (knew ? `BREW · ${cost} 🪙` : `EXPERIMENT · ${cost} 🪙`)
        : 'Tap a slot to load a sample'}</button>
      ${a || b ? '<button class="big gold" id="btnClearSlots">Empty the slots</button>' : ''}
      <div class="noteLine">Any experiment costs ${CONFIG.lab.failFee} 🪙 — so <b>discovering</b> a recipe is cheap;
        brewing a known one again costs its full price. Duds keep your samples, and every
        ${CONFIG.lab.clueEvery} of them earns a clue.</div></div>`;

    html += `<div class="card"><div class="cardTitle">📘 Lab book <span style="font-size:10px;color:#9a7a4e;font-weight:600">${known.length}/${RECIPES.length}</span></div>
      ${known.length ? known.map(r2 => {
      const poor = S.coins < r2.coins;
      return `<div class="recipeRow">
          <div class="rMini">${ART.item(r2.inputs[0])}</div><div class="rArrow">+</div>
          <div class="rMini">${ART.item(r2.inputs[1])}</div><div class="rArrow">➜</div>
          <div class="rMini">${ART.item(r2.result)}</div>
          <div class="rNote" style="font-style:normal">${ITEMS[r2.result].name}</div>
          <button class="buyBtn" data-load="${r2.id}" ${poor ? 'disabled' : ''}>${coin}${r2.coins}</button></div>`;
    }).join('') : '<div class="noteLine">Nothing discovered yet. Try combining two odd things!</div>'}</div>`;

    if (blind.length) {
      html += `<div class="card"><div class="cardTitle">❓ Rumours (${blind.length})</div>
        ${blind.map(r2 => {
        const clue = S.lab.clue[r2.id];
        const price = Math.round(r2.coins * 1.5);
        return `<div class="recipeRow">
            <div class="rMini">${clue ? ART.item(r2.inputs[0]) : '?'}</div><div class="rArrow">+</div>
            <div class="rMini">?</div><div class="rArrow">➜</div><div class="rMini">?</div>
            <div class="rNote">“${r2.note}”</div>
            <button class="buyBtn" data-learn="${r2.id}" ${S.coins < price ? 'disabled' : ''}>${coin}${price}</button></div>`;
      }).join('')}
        <div class="noteLine">Buy a rumour to have Bloop write the whole recipe down for you.</div></div>`;
    }

    host.innerHTML = html;
    host.querySelectorAll('[data-slot]').forEach((s: any) => s.onclick = () => pickForSlot(+s.dataset.slot));
    host.querySelectorAll('[data-learn]').forEach((s: any) => s.onclick = () => buyRecipe(s.dataset.learn));
    host.querySelectorAll('[data-load]').forEach((s: any) => s.onclick = () => {
      const r2 = RECIPES.filter(x => x.id === s.dataset.load)[0]; if (!r2) return;
      const inv = inventory();
      const short = r2.inputs.filter(id => (inv[id] || 0) < (r2.inputs[0] === r2.inputs[1] ? 2 : 1));
      if (short.length) { sfx.no(); toast('You need a <b>' + ITEMS[short[0]].name + '</b> on the board.'); return; }
      S.lab.slots = [r2.inputs[0], r2.inputs[1]];
      renderLab(); doResearch();
    });
    const br = $('#btnResearch'); if (br) br.onclick = () => doResearch();
    const bc = $('#btnClearSlots'); if (bc) bc.onclick = () => { S.lab.slots = [null, null]; sfx.pop(); renderLab(); save(); };
  }
  function renderRocket() {
    const host = $('#rocketBody'); if (!host) return;
    const parts = [['hull', 'Hull', 'hullplate'], ['engine', 'Engine', 'enginecore'], ['nav', 'Nav Dish', 'navdish'], ['tank', 'Fuel Tank', 'fueltank']];
    host.innerHTML =
      `<div class="card"><div class="cardTitle">🎯 Missions</div>
        ${MISSIONS.map(m => {
        const p = S.mp[m.id] || 0, done = p >= m.need;
        return `<div class="mission${done ? ' done' : ''}"><div class="mBox">${done ? '✓' : ''}</div>
          <div class="mTxt">${m.text}${!done && m.need > 1 ? ` <span style="color:#b59158">(${Math.min(p, m.need)}/${m.need})</span>` : ''}</div>
          <div class="mRew">${ART.icon('coin')}${m.coins}</div></div>`;
      }).join('')}</div>
       <div class="card"><div class="cardTitle">🚀 Rocket workshop</div>
        <div class="rocketWrap">${ART.rocket(S.parts)}</div>
        <div class="partGrid">${parts.map(p => `<div class="part${S.parts[p[0]] ? ' on' : ''}">${ART.item(p[2])}<div class="pl">${p[1]}</div></div>`).join('')}</div>
        <div class="fuelRow"><div style="font-size:12px;font-weight:700">Fuel tank</div>
          <div class="fuelDots">${[0, 1, 2].map(k => `<div class="fuelDot${S.fuel > k ? ' on' : ''}">${ART.icon('fuel')}</div>`).join('')}</div>
          <div style="font-size:11px;color:#9a7a4e;font-weight:600">${S.fuel}/3</div></div>
        ${allParts()
        ? `<button class="big${S.fuel >= CONFIG.rocket.fuelToLaunch ? '' : ' '}" id="btnLaunch" ${S.fuel >= CONFIG.rocket.fuelToLaunch ? '' : 'disabled'}>${S.fuel >= CONFIG.rocket.fuelToLaunch ? '🚀 OPEN THE MAP' : 'Need 3 Rocket Fuel'}</button>`
        : `<div style="font-size:11.5px;color:#9a7a4e;font-weight:600;margin-top:8px;text-align:center">Merge scrap from the wreck into all 4 parts to finish the rocket.</div>`}
       </div>`;
    const bl = $('#btnLaunch'); if (bl) bl.onclick = () => setView('map');
  }
  function renderBook() {
    const host = $('#bookBody');
    const groups = Object.keys(CHAINS).filter(k => {
      const w = CHAINS[k].world;
      if (k === 'relic') return !!(S.seen.relic1 || labOpen());
      return w === 'any' ? !!S.seen.scrap : w === 'ship' ? !!S.met : (w === S.world || CHAINS[k].items.some(id => S.seen[id]));
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
      `<div class="card"><div class="cardTitle">🏭 Producers</div>${Object.keys(PRODS).filter(k => B().some(c => c && c.p === k) || (k === 'wreck' && S.met)).map(k => {
        const p = PRODS[k];
        return `<div class="mission"><div class="mBox" style="background:#fff;box-shadow:none">${ART.producer(p.art)}</div>
        <div class="mTxt">${p.name}<div style="font-size:10px;color:#9a7a4e;font-weight:600">${p.mode === 'timer' ? `Free! Refills every ${(everyOf(p) / 1000).toFixed(0)}s (holds ${p.cap})` : `Costs ${p.cost} ⚡ per tap`} · makes ${[...new Set(p.drops as string[])].map(d => ITEMS[d].name).join(', ')}</div></div></div>`;
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
      const can = c.k !== 'x' && !here && allParts() && S.fuel >= CONFIG.rocket.fuelToLaunch;
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
    if (S.fuel < CONFIG.rocket.fuelToLaunch || !allParts()) return;
    S.fuel -= CONFIG.rocket.fuelToLaunch;
    const cut = $('#cut'); $('#cutRocket').innerHTML = ART.rocket({ hull: 1, engine: 1, nav: 1, tank: 1 }, { flame: true });
    $('#cutTitle').textContent = 'Blasting off!';
    $('#cutSub').textContent = 'Destination: ' + WORLDS[w].name;
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
    $('#infoTxt').innerHTML = `<b>${d.name}</b> · sells for ${d.sell} 🪙${nx ? ` · 2 make a ${ITEMS[nx].name}` : ' · top tier!'}`;
    $('#btnSell').onclick = () => { sellItem(i); $('#infoBar').classList.remove('on'); };
  }

  /* ================================================================== LOOP */
  function tick() {
    const now = Date.now();
    // energy regen
    const per = CONFIG.energy.regenMs;
    while (S.energy < maxEnergy() && now - S.eAt >= per) { S.eAt += per; S.energy++; renderHUD(); }
    if (S.energy >= maxEnergy()) S.eAt = now;
    tickProducers();
    sweepSpecials();
    // snack cooldown
    const cd = Math.max(0, CONFIG.energy.snack.cooldownMs - (now - S.snackAt));
    const sb = $('#btnSnack'); sb.disabled = cd > 0 || S.energy >= maxEnergy();
    sb.textContent = cd > 0 ? Math.ceil(cd / 1000) + 's' : '🍪 +' + snackAmt();
    // idle hint
    if (view === 'board' && now - lastAct > CONFIG.hint.idleMs && !hintPair) { showHint(false); lastAct = now; }
    // the shelf restocks on its own so the 🛒 badge can nag you
    if (shopOpen()) {
      const before = S.shop.at;
      shopStock();
      if (S.shop.at !== before) { renderHUD(); if (view === 'shop') renderShop(); }
    }
    // random meteors
    if (S.met && now > meteorTimer) { meteorTimer = now + CONFIG.meteor.everyMinMs + Math.random() * CONFIG.meteor.everyRandomMs;
      if (Math.random() < CONFIG.meteor.chance) randomMeteor(); }
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
    if (import.meta.env.DEV) {
      const problems = validateContent();
      if (problems.length) console.error('[content]\n' + problems.join('\n'));
    }
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
      modal('pip', 'Settings', `Sound is <b>${S.sound ? 'ON' : 'OFF'}</b>.<br><br><button class="big blue" id="sndBtn" style="margin-top:4px">${S.sound ? 'Turn sound OFF' : 'Turn sound ON'}</button>
        <button class="big gold" id="resetBtn">Start a new game</button>`, 'Close');
      setTimeout(() => {
        const sb2 = $('#sndBtn'), rb = $('#resetBtn');
        if (sb2) sb2.onclick = () => { S.sound = S.sound ? 0 : 1; save(); $('#modal').classList.remove('open'); toast('Sound ' + (S.sound ? 'on 🔊' : 'off 🔇')); };
        if (rb) rb.onclick = () => { localStorage.removeItem(SAVE); location.reload(); };
      }, 30);
    };
    $('#infoClose').onclick = () => { $('#infoBar').classList.remove('on'); sel = null; paintBoard(); };

    if (import.meta.env.DEV) (window as any).__game = {
      state: () => S, cells: () => B(),
      prods: PRODS, items: ITEMS, chains: CHAINS, config: CONFIG, recipes: RECIPES, shop: SHOP,
      roll: () => rollOrder(), xpNeed, maxEnergy, orderSlots,
    };
    setInterval(tick, 500);
    setInterval(save, 8000);

    if (!S.tut) {
      S.tut = 1; save();
      setTimeout(() => modal('pip', 'Hi, I\'m Pip!', 'Welcome to <b>Merge Rocket</b>! Tap the <b>Big Tree</b> to shake out twigs, then <b>drag two matching things together</b> to merge them into something better. Fill orders for your friends to level up!', 'Let\'s play!'), 400);
    }
  }
  await boot();
}
