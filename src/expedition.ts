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
interface Expedition { id: string; world: string; name: string; tag: string; producer: { name: string; art: string; kind: 'producer' | 'item' | 'ui' }; hue: number; host: string; chains: [Chain, Chain]; blurb: string }

/* ---------------------------------------------------------------- the chains */
const C: Record<string, Chain> = {
  stars: { key: 'stars', name: 'Falling Stars', steps: [['starbit', 'Star Bit'], ['starbunch', 'Star Bunch'], ['starjar', 'Jar of Stars'], ['cometlamp', 'Comet Lamp'], ['starthrone', 'Star Throne']] },
  treasure: { key: 'treasure', name: 'Pirate Treasure', steps: [['starkey', 'Star Key'], ['woodchest', 'Little Chest'], ['gemchest', 'Gem Chest'], ['treasureship', 'Cloud Galleon']] },
  candy: { key: 'candy', name: 'Space Candy', steps: [['candydrop', 'Planet Gumdrop'], ['lollipop', 'Galaxy Lollipop'], ['candyjar', 'Star Candy Jar'], ['cupcakes', 'Alien Cupcakes'], ['carousel', 'Saucer Carousel'], ['candycastle', 'Rocket Candy Castle']] },
  play: { key: 'play', name: 'Bouncy Playground', steps: [['bounceball', 'Bounce Ball'], ['bigspring', 'Big Spring'], ['ringswing', 'Ring Swing'], ['twistslide', 'Twisty Slide'], ['bouncycastle', 'Rocket Bouncer'], ['playdome', 'Play Dome']] },
  lantern: { key: 'lantern', name: 'Comet Lanterns', steps: [['paperlantern', 'Comet Lantern'], ['lanternstring', 'Lantern String'], ['flowerlantern', 'Bloom Lantern'], ['lanternarch', 'Lantern Arch'], ['lanternboat', 'Lantern Saucer'], ['skyfestival', 'Lantern Isle']] },
  books: { key: 'books', name: 'Star Library', steps: [['starpage', 'Star Page'], ['planetbook', 'Planet Book'], ['bookstack', 'Book Stack'], ['floattome', 'Floating Tome'], ['robobookshelf', 'Shelf Bot'], ['librarytower', 'Library Tower']] },
  spooks: { key: 'spooks', name: 'Nebula Spooks', steps: [['glowwisp', 'Glow Wisp'], ['wisppair', 'Wisp Pair'], ['spookjar', 'Spook Jar'], ['moonlantern', 'Moon Rock Lantern'], ['hauntstation', 'Haunted Station'], ['spookking', 'Spook King']] },
  fashion: { key: 'fashion', name: 'Alien Fashion', steps: [['starbutton', 'Star Button'], ['threadspool', 'Thread Spool'], ['antennahat', 'Antenna Hat'], ['glowgown', 'Glow Gown'], ['sewbot', 'Sewing Bot'], ['runwaydome', 'Runway Dome']] },
  art: { key: 'art', name: 'Art Club', steps: [['paintdrop', 'Rainbow Drop'], ['glowbrush', 'Glow Brush'], ['planetpalette', 'Planet Palette'], ['rocketeasel', 'Rocket Easel'], ['aliensculpt', 'Alien Statue'], ['artdome', 'Art Dome']] },
};

/* six expeditions; month m runs EXPEDITIONS[m % 6] (October is Nebula Spooks) */
const EXPEDITIONS: Expedition[] = [
  { id: 'bounce', world: 'luna', name: 'Bouncy Moon Park', tag: 'A playground in low gravity', hue: 160, host: 'gigi',
    producer: { name: 'Toy Saucer', art: 'toysaucer', kind: 'producer' }, chains: [C.play, C.stars],
    blurb: 'A playground opened on a low-gravity moon. Tap the Toy Saucer, merge toys and falling stars, and keep the kids bouncing.' },
  { id: 'fashion', world: 'vela', name: 'Alien Fashion Week', tag: 'The galaxy dresses up', hue: 300, host: 'luma',
    producer: { name: 'Comet Easel', art: 'cometeasel', kind: 'producer' }, chains: [C.fashion, C.art],
    blurb: 'Designers from every planet are in town. Tap the Comet Easel, merge outfits and art, and dress up the runway.' },
  { id: 'carnival', world: 'cindra', name: 'Sugar Moon Fair', tag: 'The candy fair floats into orbit', hue: 330, host: 'gigi',
    producer: { name: 'Paint Rover', art: 'paintrover', kind: 'producer' }, chains: [C.candy, C.art],
    blurb: 'The Sugar Moon Fair is in orbit! Tap the Paint Rover for sweets and paints, merge them up and keep the visitors happy.' },
  { id: 'spooks', world: 'vela', name: 'Nebula Spooks', tag: 'Friendly ghosts drift out of the nebula', hue: 270, host: 'mumbo',
    producer: { name: 'Lantern Stall', art: 'lanternstall', kind: 'producer' }, chains: [C.spooks, C.lantern],
    blurb: 'Friendly ghosts drifted out of the nebula and they love lanterns. Tap the Lantern Stall, merge spooks and lanterns, and light their way home.' },
  { id: 'starfall', world: 'luna', name: 'Starfall Treasure Hunt', tag: 'Stars rain down on a pirate moon', hue: 45, host: 'glimmer',
    producer: { name: 'Treasure Comet', art: 'treasurecomet', kind: 'producer' }, chains: [C.stars, C.treasure],
    blurb: 'A treasure comet crashed on a pirate moon. Tap it, merge stars and treasure, and fill the requests!' },
  { id: 'lanterns', world: 'nerith', name: 'Lantern Library', tag: 'A floating library lit by comets', hue: 200, host: 'luma',
    producer: { name: 'Lantern Stall', art: 'lanternstall', kind: 'producer' }, chains: [C.lantern, C.books],
    blurb: 'A library drifts past, lit by comet lanterns. Tap the Lantern Stall, merge lanterns and books, and light it all up.' },
];

/* the points track: ten rewards, the last one a medal. Points come mostly from requests,
   and visitors take a while to arrive, so the track lasts the whole month */
const TRACK: [number, XpReward][] = [
  [40, { energy: 10 }], [100, { coins: 150 }], [180, { pack: 'basic' }], [280, { gems: 5 }], [400, { energy: 20 }],
  [550, { coins: 300 }], [720, { pack: 'gold' }], [920, { gems: 10 }], [1150, { energy: 30, coins: 500 }], [1400, { gems: 25 }],
];
/** the producer holds this many taps and refills one every few minutes */
/** the producer holds 8 taps; once empty it recharges fully after 90 minutes */
const CHARGE_MAX = 8, CHARGE_MS = 90 * 60000;
/** a visitor who leaves is replaced after this long */
const VISIT_MS = 90000;
const W = 6, H = 7, N = W * H, PROD_AT = 3 * W + 2;
const VISITORS = ['glimmer', 'gigi', 'luma', 'mumbo', 'biscuit', 'marin', 'kelpa', 'halo', 'grubs', 'nix', 'oops', 'ember'];
export const XP_UNLOCK = 10;

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
  const mmss = (ms: number) => { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const dhm = (ms: number) => { const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m / 60) % 24; return d ? `${d}d ${h}h` : `${h}h ${m % 60}m`; };

  /* ------------------------------------------------------------- items */
  const allSteps = () => cur().chains.flatMap(c => c.steps.map(([id, name], t) => ({ id, name, t: t + 1, c })));
  const info = (id: string) => allSteps().find(s => s.id === id)!;
  const pic = (id: string) => { const u = ART.spriteItem(id); return u ? `<img src="${u}" alt="" draggable="false">` : ART.item ? ART.item(id) : ''; };
  const prodPic = () => { const p = cur().producer; const u = p.kind === 'producer' ? ART.spriteProducer(p.art) : p.kind === 'ui' ? ART.spriteUi(p.art) : ART.spriteItem(p.art); return `<img src="${u}" alt="" draggable="false">`; };

  /* ------------------------------------------------------------- state */
  function st() {
    const k = key();
    if (!ctx.S.exped || ctx.S.exped.key !== k) {
      const old = ctx.S.exped;
      if (old && old.key && old.pts && !old.told) { old.told = 1; ctx.S.xpPast = (ctx.S.xpPast || []).concat([{ key: old.key, pts: old.pts, medals: Object.keys(old.ach || {}).length }]).slice(-12); }
      const b: (string | null)[] = Array(N).fill(null);
      b[PROD_AT] = 'P';
      const [a, c] = cur().chains;
      [[PROD_AT - 1, a.steps[0][0]], [PROD_AT + 1, c.steps[0][0]], [PROD_AT + W, a.steps[0][0]], [PROD_AT - W, c.steps[0][0]]].forEach(([i, id]) => { b[i as number] = id as string; });
      ctx.S.exped = { key: k, pts: 0, got: 0, b, disc: { [a.steps[0][0]]: 1, [c.steps[0][0]]: 1 }, ord: [], ach: {}, intro: 0, ch: CHARGE_MAX, chAt: Date.now(), wait: [] };
      fillOrders();
    }
    const x = ctx.S.exped;
    if (x.ch === undefined) { x.ch = CHARGE_MAX; x.chAt = Date.now(); x.wait = []; }
    // the producer refills over time; visitors whose wait is over step up
    if (x.ch > CHARGE_MAX) x.ch = CHARGE_MAX;                      // older saves held 30
    if (x.ch <= 0 && Date.now() - x.chAt >= CHARGE_MS) x.ch = CHARGE_MAX;   // a full refill once the wait is over
    const due = x.wait.filter((t: number) => t <= Date.now()).length;
    if (due) { x.wait = x.wait.filter((t: number) => t > Date.now()); fillOrders(); }
    return x;
  }

  /* ------------------------------------------------------------- requests */
  function best(c: Chain) { const x = ctx.S.exped; let t = 1; c.steps.forEach(([id], k) => { if (x.disc[id]) t = Math.max(t, k + 1); }); return t; }
  function fillOrders() {
    const x = ctx.S.exped;
    while (x.ord.length + (x.wait || []).length < 3) {
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
  const has = (id: string) => ctx.S.exped.b.indexOf(id);

  /* ------------------------------------------------------------- points & medals */
  function addPts(n: number) {
    const x = ctx.S.exped; x.pts += n;
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
    const x = ctx.S.exped; if (x.ach[k]) return;
    x.ach[k] = 1; ctx.S.xpMedals = (ctx.S.xpMedals || 0) + 1;
    const m = MEDALS().find(z => z.k === k)!;
    setTimeout(() => ctx.rewardCard('', '🏅 ' + m.name, `An expedition medal: <b>${m.say}</b>.`, { gems: m.gems }), 400);
    ctx.save();
  }
  function discover(id: string) {
    const x = ctx.S.exped; if (x.disc[id]) return false;
    x.disc[id] = 1;
    const s = info(id), [a] = cur().chains;
    if (s.t === s.c.steps.length) medal(s.c === a ? 'topA' : 'topB');
    if (allSteps().every(z => x.disc[z.id])) medal('log');
    return true;
  }

  /* ------------------------------------------------------------- board actions */
  function nearestFree(from: number) {
    const x = ctx.S.exped, fx = from % W, fy = Math.floor(from / W);
    let bestI = -1, bd = 1e9;
    for (let i = 0; i < N; i++) if (!x.b[i]) { const d = Math.hypot(i % W - fx, Math.floor(i / W) - fy) + Math.random() * 0.3; if (d < bd) { bd = d; bestI = i; } }
    return bestI;
  }
  function tapProducer() {
    const x = ctx.S.exped;
    const to = nearestFree(PROD_AT);
    if (to < 0) { sfx.no(); ctx.toast('The expedition board is full — merge something first!'); return; }
    if (x.ch < 1) { sfx.no(); say(`The <b>${cur().producer.name}</b> is recharging: next tap in <b>${mmss(CHARGE_MS - (Date.now() - x.chAt))}</b>.`); return; }
    if (ctx.S.energy < 1) { sfx.no(); ctx.toast('Out of energy — every tap costs <b>1 ⚡</b>.'); setTimeout(ctx.energyPop, 400); return; }
    ctx.S.energy -= 1; ctx.S.eAt = ctx.S.eAt || Date.now();
    x.ch--;
    if (x.ch <= 0) x.chAt = Date.now();     // empty: the recharge clock starts now
    const c = cur().chains[(x.taps = (x.taps || 0) + 1) % 2 === 0 ? 0 : 1];
    const id = c.steps[Math.random() < 0.22 ? 1 : 0][0];
    x.b[to] = id; const fresh = discover(id);
    sfx.pop(); ctx.haptic('light');
    paintBoard(to); paintEnergy(); ctx.renderHUD();
    if (fresh) say(`New: <b>${info(id).name}</b>!`);
    ctx.save();
  }
  function moveOrMerge(from: number, to: number) {
    const x = ctx.S.exped, a = x.b[from], b = x.b[to];
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
      // merging pays a little only from the third step up: requests are where the points are
      const gain = Math.max(0, s.t - 1);
      if (gain) addPts(gain);
      paintBoard(to, true);
      say((fresh ? `New discovery: <b>${info(next).name}</b>!` : `<b>${info(next).name}</b>`) + (gain ? ` +${gain} points` : ''));
      ctx.save(); return;
    }
    if (b === 'P') { paintBoard(); return; }
    x.b[from] = b; x.b[to] = a; sfx.tap(); paintBoard(); ctx.save();       // swap
  }
  function give(k: number) {
    const x = ctx.S.exped, o = x.ord[k]; if (!o) return;
    const i = has(o.id); if (i < 0) return;
    const t = info(o.id).t;
    x.b[i] = null; x.ord.splice(k, 1);
    const pts = 5 * t, coins = 10 * t;
    ctx.S.coins += coins; sfx.coin(); ctx.haptic('medium');
    addPts(pts);
    say(`Thank you! +${pts} points · +${coins} coins`);
    paintBoard(); paintOrders();
    x.wait.push(Date.now() + VISIT_MS);       // the next visitor takes a while to arrive
    ctx.renderHUD(); ctx.save();
  }

  /* ------------------------------------------------------------- painting */
  let sel = -1;
  function say(h: string) { const e = document.getElementById('xpSay'); if (e) { e.innerHTML = h; e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); } }
  function describe(i: number) {
    const v = ctx.S.exped.b[i];
    if (v === 'P') return say(`<b>${cur().producer.name}</b>: tap for ${cur().chains[0].name} and ${cur().chains[1].name} · 1 ⚡ a tap`);
    if (!v) return;
    const s = info(v);
    say(s.t >= s.c.steps.length ? `<b>${s.name}</b> · the top of ${s.c.name}!` : `<b>${s.name}</b> · merge two to make a <b>${s.c.steps[s.t][1]}</b>`);
  }
  function paintBoard(pop = -1, big = false) {
    const g = document.getElementById('xpGrid'); if (!g) return;
    const x = ctx.S.exped;
    const want = new Set(x.ord.map((o: any) => o.id));
    g.innerHTML = x.b.map((v: string | null, i: number) => {
      const cls = 'xpC' + ((Math.floor(i / W) + i) % 2 ? ' alt' : '') + (v === 'P' ? ' prod' : '') + (i === sel ? ' sel' : '') + (i === pop ? (big ? ' merged' : ' dropped') : '') + (v && v !== 'P' && want.has(v) ? ' want' : '');
      return `<div class="${cls}" data-i="${i}">${v === 'P' ? prodPic() + `<b class="xpBolt${x.ch ? '' : ' empty'}">${x.ch ? x.ch + '/' + CHARGE_MAX : mmss(CHARGE_MS - (Date.now() - x.chAt))}</b>` : v ? pic(v) : ''}</div>`;
    }).join('');
    paintOrders();
  }
  function paintOrders() {
    const h = document.getElementById('xpOrd'); if (!h) return;
    const x = ctx.S.exped;
    const html = x.ord.map((o: any, k: number) => {
      const ok = has(o.id) >= 0;
      return `<div class="xpO${ok ? ' ok' : ''}"><span class="xpWho">${ART.char(o.who)}</span>
        <span class="xpWant">${pic(o.id)}</span><i>${info(o.id).name}</i>
        <button class="xpGive" data-give="${k}"${ok ? '' : ' disabled'}>${ok ? 'Give' : `<em>+${5 * info(o.id).t}</em> pts`}</button></div>`;
    }).join('');   // an empty request slot simply stays empty until the next visitor walks in
    // only rebuild when something changed: a rebuild replays the cards' pop-in, which flashed on every tap
    if (h.dataset.h === html) return;
    h.dataset.h = html; h.innerHTML = html;
    h.querySelectorAll<HTMLElement>('.xpWaitT').forEach(e => { e.textContent = mmss(+e.dataset.t! - Date.now()); });
    h.querySelectorAll<HTMLElement>('[data-give]').forEach(b => b.onclick = () => give(+b.dataset.give!));
  }
  function paintTop() {
    const x = ctx.S.exped, nx = TRACK[x.got], prev = x.got ? TRACK[x.got - 1][0] : 0;
    const bar = document.getElementById('xpBar'); if (!bar) return;
    const pct = nx ? Math.min(100, (x.pts - prev) / (nx[0] - prev) * 100) : 100;
    bar.innerHTML = `<div class="xpPts"><b>${x.pts}</b><i>points</i></div>
      <div class="xpTrack"><i style="width:${pct}%"></i><em>${nx ? `${x.pts} / ${nx[0]}` : 'Track complete!'}</em></div>
      <div class="xpNext">${nx ? rwIcon(nx[1]) : '🏅'}</div>`;
  }
  function paintEnergy() { const e = document.getElementById('xpEn'); if (e) e.textContent = String(ctx.S.energy); }
  function rwIcon(r: XpReward) {
    if (r.pack) return ART.uiIcon(r.pack === 'gold' ? 'pack_gold' : 'pack_basic', '🎴');
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
    // the board stands on a painted world: its scene behind, its own tiles under the items
    const sc = ART.spriteScene(e.world), tA = ART.spriteUi('tile_light_' + e.world) || ART.spriteUi('tile_light'), tB = ART.spriteUi('tile_dark_' + e.world) || ART.spriteUi('tile_dark');
    el.style.setProperty('--xpScene', sc ? `url(${sc})` : 'none');
    el.style.setProperty('--xpTileA', tA ? `url(${tA})` : 'none');
    el.style.setProperty('--xpTileB', tB ? `url(${tB})` : 'none');
    el.innerHTML = `<div class="xpSky"></div>
      <div class="xpHead"><div class="xpTitle">${e.name}</div><button class="xpX" id="xpClose" aria-label="Close">✕</button>
        <div class="xpSub"><span class="xpTime">${ART.uiIcon('cl_timer', '⏳')} ${dhm(left())}</span><span class="xpEnergy">${ART.icon('energy')}<b id="xpEn">${ctx.S.energy}</b></span></div></div>
      <div class="xpBar" id="xpBar"></div>
      <div class="xpOrd" id="xpOrd"></div>
      <div class="xpBoard"><div class="xpGrid" id="xpGrid"></div></div>
      <div class="xpSay" id="xpSay">Tap the <b>${e.producer.name}</b>, then drag two of a kind together.</div>
      <div class="xpTabs"><button id="xpLog">${ART.uiIcon('sec_collection', '📖')}<span>Log</span></button><button id="xpGoals">${ART.uiIcon('ic_medals', '🏅')}<span>Prizes <b>${Object.keys(x.ach).length}/4</b></span></button><button id="xpHelp">${ART.uiIcon('btn_info', 'ℹ️')}<span>How</span></button></div>`;
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
    const x = ctx.S.exped, e = cur();
    const p = document.createElement('div'); p.id = 'xpPanel';
    let body = '';
    if (kind === 'log') body = e.chains.map(c => `<div class="xpLogC"><b>${c.name}</b><div class="xpLogRow">${c.steps.map(([id, name]) =>
        `<span class="${x.disc[id] ? '' : 'unk'}">${pic(id)}<i>${x.disc[id] ? name : '???'}</i></span>`).join('')}</div></div>`).join('')
      + `<div class="xpNote">${allSteps().filter(s => x.disc[s.id]).length} / ${allSteps().length} discovered</div>`;
    if (kind === 'goals') {
      // two simple parts: the prize road (points unlock each prize), then the four medals
      const pts = x.pts || 0;
      body = `<div class="xpGoalT">Prizes · earn points to unlock</div>
        <div class="xpTrackList">${TRACK.map(([n, r], k) => `<span class="${k < x.got ? 'got' : pts >= n ? 'ready' : ''}">${rwIcon(r)}<i>${k < x.got ? '✓' : n + ' pts'}</i></span>`).join('')}</div>
        <div class="xpGoalT">Medals · gems for big goals</div>`
        + MEDALS().map(m => `<div class="xpMedal${x.ach[m.k] ? ' got' : ''}"><span>${ART.uiIcon(x.ach[m.k] ? 'medal_gold' : 'medal_silver', '🏅')}</span><div><b>${m.name}</b><i>${m.say}</i></div><em>${x.ach[m.k] ? '✓' : '+' + m.gems + ' ' + '💎'}</em></div>`).join('');
    }
    if (kind === 'help') body = `<div class="xpHelpArt">${prodPic()}</div>
      <div class="xpIcons"><span>👆<b>Tap</b></span><span>🔀<b>Merge</b></span><span>📦<b>Fill requests</b></span><span>🏅<b>Win prizes</b></span></div>
      <div class="xpNote">Ends in <b>${dhm(left())}</b></div>`;
    const title = kind === 'log' ? 'Expedition Log' : kind === 'goals' ? 'Prizes & Medals' : e.name;
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
      if (!ctx.S.exped.b[from]) { from = -1; return; }
      try { g.setPointerCapture(pid); } catch { /* a synthetic or finished pointer */ }
    };
    g.onpointermove = (ev: PointerEvent) => {
      if (from < 0 || ev.pointerId !== pid) return;
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
        const src = g.querySelector(`[data-i="${from}"]`) as HTMLElement;
        ghost = document.createElement('div'); ghost.className = 'xpGhost'; ghost.id = 'xpGhost'; ghost.innerHTML = src.innerHTML;
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
      if (ctx.S.exped.b[f] === 'P') { tapProducer(); return; }
      if (sel >= 0 && sel !== f && ctx.S.exped.b[sel] === ctx.S.exped.b[f]) { const s = sel; sel = -1; moveOrMerge(s, f); return; }
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
      const x = ctx.S.exped && ctx.S.exped.key === key() ? ctx.S.exped : null;
      const ready = x ? x.ord.some((o: any) => x.b.indexOf(o.id) >= 0) : true;
      return `<button class="qChip xp${ready ? ' ready' : ''}" data-q="xp">${prodPic()}<b>${x ? x.pts : 'NEW'}</b><i>${dhm(left())}</i></button>`;
    },
    tick: () => {
      if (document.getElementById('xpScr')?.className !== 'open' || document.getElementById('xpGhost')) return;
      paintEnergy();
      const t = document.querySelector('#xpScr .xpTime'); if (t) t.innerHTML = `${ART.uiIcon('cl_timer', '⏳')} ${dhm(left())}`;
      const x = ctx.S.exped, was = x.ch + '|' + x.ord.length;
      st();
      if (x.ch + '|' + x.ord.length !== was) paintBoard();
      document.querySelectorAll<HTMLElement>('.xpWaitT').forEach(e => { e.textContent = mmss(+e.dataset.t! - Date.now()); });
      if (!x.ch) { const bolt = document.querySelector('#xpScr .xpBolt'); if (bolt) bolt.textContent = mmss(CHARGE_MS - (Date.now() - x.chAt)); }
    },
    pick: (n: number) => { force = n; },
    list: () => EXPEDITIONS.map(e => e.name),
    state: () => st(),
    /** sprite ids the expedition needs (for the art check) */
    art: () => EXPEDITIONS.flatMap(e => e.chains.flatMap(c => c.steps.map(s => s[0]))),
  };
}
