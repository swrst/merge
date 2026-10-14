/* ================================================================ STAR EXPEDITIONS
   A monthly event on its own little board. Every month a new expedition lands
   with its own producer, two chains of its own, a request board, a points
   track with rewards, a discovery log and four medals to earn.
   It shares the player's energy (one tap = 1 ⚡) and pays out into the main game.
   Everything here is self-contained: the main game passes in a small context. */

export type XpReward = { energy?: number; coins?: number; gems?: number; pack?: 'basic' | 'gold' };
export interface XpCtx {
  S: any; ART: any;
  save(): void; toast(h: string): void; sfx: any; haptic(k: string): void;
  grant(r: { energy?: number; coins?: number; gems?: number }): void;
  rewardCard(who: string, title: string, line: string, r: any, after?: () => void): void;
  albumGive(kind: 'basic' | 'gold', why?: string): void;
  energyPop(): void; renderHUD(): void; level(): number;
}

type Step = [id: string, name: string];
interface Chain { key: string; name: string; steps: Step[] }
interface Expedition { id: string; name: string; tag: string; producer: { name: string; art: string; kind: 'producer' | 'item' | 'ui' }; hue: number; host: string; chains: [Chain, Chain]; blurb: string }

/* ---------------------------------------------------------------- the chains */
const C: Record<string, Chain> = {
  stars: { key: 'stars', name: 'Falling Stars', steps: [['starbit', 'Star Bit'], ['starbunch', 'Star Bunch'], ['starjar', 'Jar of Stars'], ['cometlamp', 'Comet Lamp'], ['starthrone', 'Star Throne']] },
  treasure: { key: 'treasure', name: 'Pirate Treasure', steps: [['starkey', 'Star Key'], ['woodchest', 'Little Chest'], ['gemchest', 'Gem Chest'], ['treasureship', 'Cloud Galleon']] },
  candy: { key: 'candy', name: 'Space Candy', steps: [['candydrop', 'Planet Gumdrop'], ['lollipop', 'Galaxy Lollipop'], ['candyjar', 'Star Candy Jar'], ['cupcakes', 'Alien Cupcakes'], ['carousel', 'Saucer Carousel'], ['candycastle', 'Rocket Candy Castle']] },
  play: { key: 'play', name: 'Bouncy Playground', steps: [['bounceball', 'Bounce Ball'], ['bigspring', 'Big Spring'], ['ringswing', 'Ring Swing'], ['twistslide', 'Twisty Slide'], ['bouncycastle', 'Rocket Bouncer'], ['playdome', 'Play Dome']] },
  lantern: { key: 'lantern', name: 'Comet Lanterns', steps: [['paperlantern', 'Comet Lantern'], ['lanternstring', 'Lantern String'], ['flowerlantern', 'Bloom Lantern'], ['lanternarch', 'Lantern Arch'], ['lanternboat', 'Lantern Saucer'], ['skyfestival', 'Lantern Isle']] },
  books: { key: 'books', name: 'Star Library', steps: [['starpage', 'Star Page'], ['planetbook', 'Planet Book'], ['bookstack', 'Book Stack'], ['floattome', 'Floating Tome'], ['robobookshelf', 'Shelf Bot'], ['librarytower', 'Library Tower']] },
  art: { key: 'art', name: 'Art Club', steps: [['paintdrop', 'Rainbow Drop'], ['glowbrush', 'Glow Brush'], ['planetpalette', 'Planet Palette'], ['rocketeasel', 'Rocket Easel'], ['aliensculpt', 'Alien Statue'], ['artdome', 'Art Dome']] },
};

/* one expedition per calendar month, in this order (month 0 = January) */
const EXPEDITIONS: Expedition[] = [
  { id: 'starfall', name: 'Starfall Treasure Hunt', tag: 'Stars rain down on a pirate moon', hue: 45, host: 'glimmer',
    producer: { name: 'Falling Star', art: 'fallingstar', kind: 'producer' }, chains: [C.stars, C.treasure],
    blurb: 'A shower of falling stars hit a pirate moon. Tap the Falling Star, merge stars and treasure, and fill the requests!' },
  { id: 'carnival', name: 'Sugar Moon Fair', tag: 'The candy fair floats into orbit', hue: 330, host: 'gigi',
    producer: { name: 'Candy Cart', art: 'candycart', kind: 'producer' }, chains: [C.candy, C.art],
    blurb: 'The Sugar Moon Fair is in orbit! Tap the Candy Cart for sweets and paints, merge them up and keep the visitors happy.' },
  { id: 'lanterns', name: 'Lantern Library', tag: 'A floating library lit by comets', hue: 200, host: 'luma',
    producer: { name: 'Lantern Stall', art: 'lanternstall', kind: 'producer' }, chains: [C.lantern, C.books],
    blurb: 'A library drifts past, lit by comet lanterns. Tap the Lantern Stall, merge lanterns and books, and light it all up.' },
  { id: 'bounce', name: 'Bouncy Moon Park', tag: 'A playground in low gravity', hue: 160, host: 'gigi',
    producer: { name: 'Toy Saucer', art: 'ufo_freighter', kind: 'ui' }, chains: [C.play, C.treasure],
    blurb: 'A playground opened on a low-gravity moon. Tap the Toy Saucer, merge toys and treasure, and keep the kids bouncing.' },
];

/* the points track: ten rewards, the last one a medal */
const TRACK: [number, XpReward][] = [
  [20, { energy: 10 }], [50, { coins: 150 }], [90, { pack: 'basic' }], [140, { gems: 5 }], [200, { energy: 20 }],
  [270, { coins: 300 }], [350, { pack: 'gold' }], [440, { gems: 10 }], [540, { energy: 30, coins: 500 }], [650, { gems: 25 }],
];
const W = 6, H = 7, N = W * H, PROD_AT = 3 * W + 2;
const VISITORS = ['glimmer', 'gigi', 'luma', 'mumbo', 'biscuit', 'marin', 'kelpa', 'halo', 'grubs', 'nix', 'oops', 'ember'];
export const XP_UNLOCK = 5;

export function createExpedition(ctx: XpCtx) {
  const { ART, sfx } = ctx;
  const $ = (q: string) => document.querySelector(q) as HTMLElement;
  let force = -1;     // testers can pick an expedition

  /* --------------------------------------------------------------- time */
  const monthKey = (d = new Date()) => d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1);
  const endsAt = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); };
  const cur = (): Expedition => EXPEDITIONS[force >= 0 ? force : new Date().getUTCMonth() % EXPEDITIONS.length];
  const key = () => cur().id + '@' + monthKey();
  const open = () => ctx.level() >= XP_UNLOCK;
  const left = () => endsAt() - Date.now();
  const dhm = (ms: number) => { const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m / 60) % 24; return d ? `${d}d ${h}h` : `${h}h ${m % 60}m`; };

  /* ------------------------------------------------------------- items */
  const allSteps = () => cur().chains.flatMap(c => c.steps.map(([id, name], t) => ({ id, name, t: t + 1, c })));
  const info = (id: string) => allSteps().find(s => s.id === id)!;
  const pic = (id: string) => { const u = ART.spriteItem(id); return u ? `<img src="${u}" alt="" draggable="false">` : ART.item ? ART.item(id) : ''; };
  const prodPic = () => { const p = cur().producer; const u = p.kind === 'producer' ? ART.spriteProducer(p.art) : p.kind === 'ui' ? ART.spriteUi(p.art) : ART.spriteItem(p.art); return `<img src="${u}" alt="" draggable="false">`; };

  /* ------------------------------------------------------------- state */
  function st() {
    const k = key();
    if (!ctx.S.xp || ctx.S.xp.key !== k) {
      const old = ctx.S.xp;
      if (old && old.key && old.pts && !old.told) { old.told = 1; ctx.S.xpPast = (ctx.S.xpPast || []).concat([{ key: old.key, pts: old.pts, medals: Object.keys(old.ach || {}).length }]).slice(-12); }
      const b: (string | null)[] = Array(N).fill(null);
      b[PROD_AT] = 'P';
      const [a, c] = cur().chains;
      [[PROD_AT - 1, a.steps[0][0]], [PROD_AT + 1, c.steps[0][0]], [PROD_AT + W, a.steps[0][0]], [PROD_AT - W, c.steps[0][0]]].forEach(([i, id]) => { b[i as number] = id as string; });
      ctx.S.xp = { key: k, pts: 0, got: 0, b, disc: { [a.steps[0][0]]: 1, [c.steps[0][0]]: 1 }, ord: [], ach: {}, intro: 0 };
      fillOrders();
    }
    return ctx.S.xp;
  }

  /* ------------------------------------------------------------- requests */
  function best(c: Chain) { const x = ctx.S.xp; let t = 1; c.steps.forEach(([id], k) => { if (x.disc[id]) t = Math.max(t, k + 1); }); return t; }
  function fillOrders() {
    const x = ctx.S.xp;
    while (x.ord.length < 3) {
      const used = new Set(x.ord.map((o: any) => o.who));
      const pool = VISITORS.filter(v => !used.has(v)), who = pool[Math.floor(Math.random() * pool.length)];
      // no two visitors want the very same thing
      let id = '';
      for (let n = 0; n < 12 && (!id || x.ord.some((o: any) => o.id === id)); n++) {
        const c = cur().chains[Math.random() < 0.5 ? 0 : 1];
        const hi = Math.min(c.steps.length, best(c) + 1 + (n > 6 ? 1 : 0)), lo = Math.min(2, hi);
        id = c.steps[Math.min(c.steps.length, lo + Math.floor(Math.random() * (hi - lo + 1))) - 1][0];
      }
      x.ord.push({ who, id });
    }
  }
  const has = (id: string) => ctx.S.xp.b.indexOf(id);

  /* ------------------------------------------------------------- points & medals */
  function addPts(n: number) {
    const x = ctx.S.xp; x.pts += n;
    while (x.got < TRACK.length && x.pts >= TRACK[x.got][0]) {
      const r = TRACK[x.got][1]; x.got++;
      const last = x.got === TRACK.length;
      if (r.pack) { ctx.albumGive(r.pack, cur().name); }
      else ctx.rewardCard(cur().host, last ? 'Expedition complete!' : 'Expedition reward', last ? `You reached the end of the <b>${cur().name}</b> track!` : `<b>${TRACK[x.got - 1][0]}</b> expedition points!`, r);
      if (last) medal('track');
    }
    paintTop();
  }
  const MEDALS = () => {
    const [a, c] = cur().chains;
    return [
      { k: 'topA', name: 'Top of ' + a.name, say: `Make the ${a.steps[a.steps.length - 1][1]}`, gems: 5 },
      { k: 'topB', name: 'Top of ' + c.name, say: `Make the ${c.steps[c.steps.length - 1][1]}`, gems: 5 },
      { k: 'log', name: 'Full Log', say: 'Discover every item of this expedition', gems: 8 },
      { k: 'track', name: 'Expedition Hero', say: 'Reach the end of the points track', gems: 15 },
    ];
  };
  function medal(k: string) {
    const x = ctx.S.xp; if (x.ach[k]) return;
    x.ach[k] = 1; ctx.S.xpMedals = (ctx.S.xpMedals || 0) + 1;
    const m = MEDALS().find(z => z.k === k)!;
    setTimeout(() => ctx.rewardCard('', '🏅 ' + m.name, `An expedition medal: <b>${m.say}</b>.`, { gems: m.gems }), 400);
    ctx.save();
  }
  function discover(id: string) {
    const x = ctx.S.xp; if (x.disc[id]) return false;
    x.disc[id] = 1;
    const s = info(id), [a] = cur().chains;
    if (s.t === s.c.steps.length) medal(s.c === a ? 'topA' : 'topB');
    if (allSteps().every(z => x.disc[z.id])) medal('log');
    return true;
  }

  /* ------------------------------------------------------------- board actions */
  function nearestFree(from: number) {
    const x = ctx.S.xp, fx = from % W, fy = Math.floor(from / W);
    let bestI = -1, bd = 1e9;
    for (let i = 0; i < N; i++) if (!x.b[i]) { const d = Math.hypot(i % W - fx, Math.floor(i / W) - fy) + Math.random() * 0.3; if (d < bd) { bd = d; bestI = i; } }
    return bestI;
  }
  function tapProducer() {
    const x = ctx.S.xp;
    const to = nearestFree(PROD_AT);
    if (to < 0) { sfx.no(); ctx.toast('The expedition board is full — merge something first!'); return; }
    if (ctx.S.energy < 1) { sfx.no(); ctx.toast('Out of energy — every tap costs <b>1 ⚡</b>.'); setTimeout(ctx.energyPop, 400); return; }
    ctx.S.energy -= 1; ctx.S.eAt = ctx.S.eAt || Date.now();
    const c = cur().chains[(x.taps = (x.taps || 0) + 1) % 2 === 0 ? 0 : 1];
    const id = c.steps[Math.random() < 0.22 ? 1 : 0][0];
    x.b[to] = id; const fresh = discover(id);
    sfx.pop(); ctx.haptic('light');
    paintBoard(to); paintEnergy(); ctx.renderHUD();
    if (fresh) say(`New: <b>${info(id).name}</b>!`);
    ctx.save();
  }
  function moveOrMerge(from: number, to: number) {
    const x = ctx.S.xp, a = x.b[from], b = x.b[to];
    if (from === to || !a) return;
    if (a === 'P') { if (!b) { x.b[to] = 'P'; x.b[from] = null; paintBoard(); ctx.save(); } return; }   // the producer may move to an empty spot
    if (!b) { x.b[to] = a; x.b[from] = null; sfx.tap(); paintBoard(); ctx.save(); return; }
    if (a === b) {
      const s = info(a);
      if (s.t >= s.c.steps.length) { sfx.no(); say(`The <b>${s.name}</b> is already the very top!`); paintBoard(); return; }
      const next = s.c.steps[s.t][0];
      x.b[from] = null; x.b[to] = next;
      const fresh = discover(next);
      sfx.merge(s.t + 1); ctx.haptic('medium');
      addPts(s.t + 1);
      paintBoard(to, true);
      say(fresh ? `New discovery: <b>${info(next).name}</b>! +${s.t + 1} points` : `<b>${info(next).name}</b> · +${s.t + 1} points`);
      ctx.save(); return;
    }
    if (b === 'P') { paintBoard(); return; }
    x.b[from] = b; x.b[to] = a; sfx.tap(); paintBoard(); ctx.save();       // swap
  }
  function give(k: number) {
    const x = ctx.S.xp, o = x.ord[k]; if (!o) return;
    const i = has(o.id); if (i < 0) return;
    const t = info(o.id).t;
    x.b[i] = null; x.ord.splice(k, 1);
    const pts = 6 * t, coins = 15 * t;
    ctx.S.coins += coins; sfx.coin(); ctx.haptic('medium');
    addPts(pts);
    say(`Thank you! +${pts} points · +${coins} coins`);
    paintBoard(); paintOrders();
    setTimeout(() => { if (!ctx.S.xp) return; fillOrders(); paintOrders(); ctx.save(); }, 900);
    ctx.renderHUD(); ctx.save();
  }

  /* ------------------------------------------------------------- painting */
  let sel = -1;
  function say(h: string) { const e = document.getElementById('xpSay'); if (e) { e.innerHTML = h; e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); } }
  function describe(i: number) {
    const v = ctx.S.xp.b[i];
    if (v === 'P') return say(`<b>${cur().producer.name}</b>: tap for ${cur().chains[0].name} and ${cur().chains[1].name} · 1 ⚡ a tap`);
    if (!v) return;
    const s = info(v);
    say(s.t >= s.c.steps.length ? `<b>${s.name}</b> · the top of ${s.c.name}!` : `<b>${s.name}</b> · merge two to make a <b>${s.c.steps[s.t][1]}</b>`);
  }
  function paintBoard(pop = -1, big = false) {
    const g = document.getElementById('xpGrid'); if (!g) return;
    const x = ctx.S.xp;
    const want = new Set(x.ord.map((o: any) => o.id));
    g.innerHTML = x.b.map((v: string | null, i: number) => {
      const cls = 'xpC' + ((Math.floor(i / W) + i) % 2 ? ' alt' : '') + (v === 'P' ? ' prod' : '') + (i === sel ? ' sel' : '') + (i === pop ? (big ? ' merged' : ' dropped') : '') + (v && v !== 'P' && want.has(v) ? ' want' : '');
      return `<div class="${cls}" data-i="${i}">${v === 'P' ? prodPic() + '<b class="xpBolt">⚡1</b>' : v ? pic(v) : ''}</div>`;
    }).join('');
    paintOrders();
  }
  function paintOrders() {
    const h = document.getElementById('xpOrd'); if (!h) return;
    h.innerHTML = ctx.S.xp.ord.map((o: any, k: number) => {
      const ok = has(o.id) >= 0;
      return `<div class="xpO${ok ? ' ok' : ''}"><span class="xpWho">${ART.char(o.who)}</span>
        <span class="xpWant">${pic(o.id)}</span><i>${info(o.id).name}</i>
        <button class="xpGive" data-give="${k}"${ok ? '' : ' disabled'}>${ok ? 'Give' : `+${6 * info(o.id).t}`}</button></div>`;
    }).join('');
    h.querySelectorAll<HTMLElement>('[data-give]').forEach(b => b.onclick = () => give(+b.dataset.give!));
  }
  function paintTop() {
    const x = ctx.S.xp, nx = TRACK[x.got], prev = x.got ? TRACK[x.got - 1][0] : 0;
    const bar = document.getElementById('xpBar'); if (!bar) return;
    const pct = nx ? Math.min(100, (x.pts - prev) / (nx[0] - prev) * 100) : 100;
    bar.innerHTML = `<div class="xpPts"><b>${x.pts}</b><i>points</i></div>
      <div class="xpTrack"><i style="width:${pct}%"></i><em>${nx ? `${x.pts} / ${nx[0]}` : 'Track complete!'}</em></div>
      <div class="xpNext">${nx ? rwIcon(nx[1]) : '🏅'}</div>`;
  }
  function paintEnergy() { const e = document.getElementById('xpEn'); if (e) e.textContent = String(ctx.S.energy); }
  function rwIcon(r: XpReward) {
    if (r.pack) return ART.uiIcon(r.pack === 'gold' ? 'ic_album2' : 'ic_album', '🎴');
    if (r.gems) return ART.icon('gem');
    if (r.energy) return ART.icon('energy');
    return ART.icon('coin');
  }

  /* ------------------------------------------------------------- the screen */
  function show() {
    if (!open()) { sfx.no(); ctx.toast(`Star Expeditions open at Level ${XP_UNLOCK}!`); return; }
    const x = st(); sel = -1;
    let el = document.getElementById('xpScr');
    if (!el) { el = document.createElement('div'); el.id = 'xpScr'; document.getElementById('app')!.appendChild(el); }
    const e = cur();
    el.style.setProperty('--xh', String(e.hue));
    el.innerHTML = `<div class="xpSky"></div>
      <div class="xpHead"><div class="xpTitle">${e.name}</div><button class="xpX" id="xpClose" aria-label="Close">✕</button>
        <div class="xpSub"><span class="xpTime">${ART.uiIcon('cl_timer', '⏳')} ${dhm(left())}</span><span class="xpEnergy">${ART.icon('energy')}<b id="xpEn">${ctx.S.energy}</b></span></div></div>
      <div class="xpBar" id="xpBar"></div>
      <div class="xpOrd" id="xpOrd"></div>
      <div class="xpBoard"><div class="xpGrid" id="xpGrid"></div></div>
      <div class="xpSay" id="xpSay">Tap the <b>${e.producer.name}</b>, then drag two of a kind together.</div>
      <div class="xpTabs"><button id="xpLog">${ART.uiIcon('sec_collection', '📖')}<span>Log</span></button><button id="xpGoals">${ART.uiIcon('ic_medals', '🏅')}<span>Medals <b>${Object.keys(x.ach).length}/4</b></span></button><button id="xpHelp">${ART.uiIcon('btn_info', 'ℹ️')}<span>How</span></button></div>`;
    el.className = 'open';
    paintTop(); paintBoard(); bind();
    $('#xpClose').onclick = hide;
    $('#xpLog').onclick = () => panel('log');
    $('#xpGoals').onclick = () => panel('goals');
    $('#xpHelp').onclick = () => panel('help');
    sfx.open();
    if (!x.intro) { x.intro = 1; ctx.save(); setTimeout(() => panel('help'), 350); }
  }
  function hide() { const el = document.getElementById('xpScr'); if (el) el.className = ''; document.getElementById('xpPanel')?.remove(); sfx.close(); ctx.renderHUD(); }
  function panel(kind: 'log' | 'goals' | 'help') {
    document.getElementById('xpPanel')?.remove();
    const x = ctx.S.xp, e = cur();
    const p = document.createElement('div'); p.id = 'xpPanel';
    let body = '';
    if (kind === 'log') body = e.chains.map(c => `<div class="xpLogC"><b>${c.name}</b><div class="xpLogRow">${c.steps.map(([id, name]) =>
        `<span class="${x.disc[id] ? '' : 'unk'}">${pic(id)}<i>${x.disc[id] ? name : '???'}</i></span>`).join('')}</div></div>`).join('')
      + `<div class="xpNote">${allSteps().filter(s => x.disc[s.id]).length} / ${allSteps().length} discovered</div>`;
    if (kind === 'goals') body = MEDALS().map(m => `<div class="xpMedal${x.ach[m.k] ? ' got' : ''}"><span>${x.ach[m.k] ? ART.uiIcon('medal_1', '🏅') : ART.uiIcon('medal_3', '🏅')}</span><div><b>${m.name}</b><i>${m.say}</i></div><em>${x.ach[m.k] ? '✓' : '+' + m.gems + ' ' + '💎'}</em></div>`).join('')
      + `<div class="xpTrackList">${TRACK.map(([n, r], k) => `<span class="${k < x.got ? 'got' : ''}">${rwIcon(r)}<i>${n}</i></span>`).join('')}</div>`
      + `<div class="xpNote">Medals from all expeditions: <b>${ctx.S.xpMedals || 0}</b></div>`;
    if (kind === 'help') body = `<div class="xpHelpArt">${prodPic()}</div><p>${e.blurb}</p>
      <ol class="xpSteps"><li>Tap the <b>${e.producer.name}</b> (1 ⚡ a tap).</li><li>Drag two of the same together to merge them up.</li>
      <li>Fill the <b>requests</b> at the top for big points.</li><li>Points unlock rewards and the medal at <b>${TRACK[TRACK.length - 1][0]}</b>.</li></ol>
      <div class="xpNote">A new expedition lands every month. This one ends in <b>${dhm(left())}</b>.</div>`;
    const title = kind === 'log' ? 'Expedition Log' : kind === 'goals' ? 'Medals & Rewards' : e.name;
    p.innerHTML = `<div class="xpPBox"><div class="xpPT">${title}</div><button class="xpX" id="xpPClose">✕</button><div class="xpPB">${body}</div>
      <button class="big" id="xpPOk">${kind === 'help' ? "Let's go!" : 'Close'}</button></div>`;
    document.getElementById('xpScr')!.appendChild(p);
    const close = () => { p.remove(); sfx.close(); };
    $('#xpPClose').onclick = close; $('#xpPOk').onclick = close;
    sfx.open();
  }

  /* drag to move / merge, tap to look (or to use the producer) */
  function bind() {
    const g = document.getElementById('xpGrid')!;
    let from = -1, sx = 0, sy = 0, ghost: HTMLElement | null = null, pid = -1;
    const cellAt = (cx: number, cy: number) => { const t = document.elementFromPoint(cx, cy)?.closest('.xpC') as HTMLElement | null; return t ? +t.dataset.i! : -1; };
    g.onpointerdown = (ev: PointerEvent) => {
      const c = (ev.target as HTMLElement).closest('.xpC') as HTMLElement | null; if (!c) return;
      from = +c.dataset.i!; sx = ev.clientX; sy = ev.clientY; pid = ev.pointerId;
      if (!ctx.S.xp.b[from]) { from = -1; return; }
      g.setPointerCapture(pid);
    };
    g.onpointermove = (ev: PointerEvent) => {
      if (from < 0 || ev.pointerId !== pid) return;
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
        const src = g.querySelector(`[data-i="${from}"]`) as HTMLElement;
        ghost = document.createElement('div'); ghost.className = 'xpGhost'; ghost.innerHTML = src.innerHTML;
        document.body.appendChild(ghost); src.classList.add('lifted'); sfx.lift && sfx.lift();
      }
      if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
    };
    const end = (ev: PointerEvent) => {
      if (from < 0 || ev.pointerId !== pid) return;
      const f = from; from = -1;
      try { g.releasePointerCapture(pid); } catch { /* already released */ }
      if (ghost) {
        ghost.remove(); ghost = null;
        const to = cellAt(ev.clientX, ev.clientY);
        if (to >= 0) moveOrMerge(f, to); else paintBoard();
        sel = -1; return;
      }
      // a tap
      if (ctx.S.xp.b[f] === 'P') { tapProducer(); return; }
      if (sel >= 0 && sel !== f && ctx.S.xp.b[sel] === ctx.S.xp.b[f]) { const s = sel; sel = -1; moveOrMerge(s, f); return; }
      sel = f; describe(f); paintBoard();
    };
    g.onpointerup = end; g.onpointercancel = (ev: PointerEvent) => { if (ghost) { ghost.remove(); ghost = null; } from = -1; void ev; paintBoard(); };
  }

  /* ------------------------------------------------------------- outside hooks */
  return {
    open, show, hide,
    /** the side chip on the main screen */
    chip: () => {
      if (!open()) return '';
      const x = ctx.S.xp && ctx.S.xp.key === key() ? ctx.S.xp : null;
      const ready = x ? x.ord.some((o: any) => x.b.indexOf(o.id) >= 0) : true;
      return `<button class="qChip xp${ready ? ' ready' : ''}" data-q="xp">${prodPic()}<b>${x ? x.pts : 'NEW'}</b><i>${dhm(left())}</i></button>`;
    },
    tick: () => { if (document.getElementById('xpScr')?.className === 'open') { paintEnergy(); const t = document.querySelector('#xpScr .xpTime'); if (t) t.innerHTML = `${ART.uiIcon('cl_timer', '⏳')} ${dhm(left())}`; } },
    pick: (n: number) => { force = n; },
    list: () => EXPEDITIONS.map(e => e.name),
    state: () => st(),
    /** sprite ids the expedition needs (for the art check) */
    art: () => EXPEDITIONS.flatMap(e => e.chains.flatMap(c => c.steps.map(s => s[0]))),
  };
}
