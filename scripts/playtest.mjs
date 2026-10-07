/* Headless regression run. Drives the real game through Playwright using the
   dev-only window.__game / window.__board hooks, and fails loudly on any
   console error. Usage:  npm run dev   (in another shell)   then  npm test    */
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
let pw; try { pw = require_('playwright'); } catch { pw = require_('/home/claude/.npm-global/lib/node_modules/playwright'); }
const { chromium } = pw;

const URL = process.env.URL || 'http://localhost:5173/';
const errors = [];
let step = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const head = (m) => console.log(`\n${++step}. ${m}`);
function must(cond, msg) { if (!cond) { console.error(`  ✗ ${msg}`); process.exitCode = 1; } else ok(msg); }

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 440, height: 900 } });
// the sandbox has no route to fonts.googleapis.com; that is not a game bug
const IGNORE = /ERR_TUNNEL_CONNECTION_FAILED|fonts\.googleapis|ERR_NAME_NOT_RESOLVED/;
page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL);
// boot rasterises every item (500+) before the first frame; software GL needs the headroom
await page.waitForFunction(() => window.__game && window.__board, null, { timeout: 45000 });

const S = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__game.state())));
// A test that pokes state directly has to ask for a repaint; the game itself
// repaints off its own events.
const set = async (fn) => { await page.evaluate(fn); await page.evaluate(() => window.__game.hud()); };
const closeModal = async () => {
  // story scenes and small popups sit over everything: tap through / close them
  // a new producer flying in, or a reward card: take them
  for (let k = 0; k < 4 && await page.locator('#npw.open #npGo, #rwc.open #rwcGo').count(); k++) { await page.locator('#npw.open #npGo, #rwc.open #rwcGo').first().click({ force: true }); await page.waitForTimeout(900); }
  for (let k = 0; k < 12 && await page.locator('#talk.open').count(); k++) { await page.click('#talk'); await page.waitForTimeout(260); }
  if (await page.locator('#pop.open').count()) { await page.click('#popX', { force: true }); await page.waitForTimeout(250); }
  let n = 0;
  while (await page.locator('#modal.open').count() && n++ < 4) {
    if (process.env.MODALS) console.log('   [modal] ' + await page.textContent('#mTitle'));
    await page.click('#mBtn'); await page.waitForTimeout(650);   // a queued dialog follows ~450ms after
  }
};
const tapCell = async (i) => {
  await closeModal();
  const p = await page.evaluate(i => { const c = window.__board.center(i); const r = document.querySelector('#board canvas').getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, i);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(120);
};
const pt = (i) => page.evaluate(i => { const c = window.__board.center(i); const r = document.querySelector('#board canvas').getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, i);
const drag = async (from, to) => {
  const a = await pt(from), b = await pt(to);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(500);
};
/** click something on the board screen, shooing away any modal that got in first */
const tapUI = async (sel) => { await closeModal(); await page.locator(sel).first().click({ force: true }); };
const shot = (n) => page.screenshot({ path: `/tmp/shot-${n}.png` });
/** the shell must never be scrolled; if a click nudged it, put it back */
const unscroll = () => page.evaluate(() => {
  window.scrollTo(0, 0);
  const a = document.querySelector('.app'); if (a) { a.scrollTop = 0; a.scrollLeft = 0; }
});
/** switch tabs; story beats and level-ups can pop a modal at any moment */
const tab = async (v) => {
  await closeModal();
  await unscroll();
  // there is no "board" button any more — the rail opens panels, the ✕ closes them
  if (v === 'board') {
    const x = page.locator('.screen.open .scClose');
    if (await x.count()) await x.first().click({ force: true });
  } else {
    // Album, Lab and games live on the map now; open the pages directly
    await page.evaluate((v) => window.__game.view(v), v);
  }
  // the screen slides in; on a software renderer that can take a while to
  // settle, and half-way through it everything is 200px lower than it looks
  await page.waitForFunction(() => {
    const sc = document.querySelector('.screen.open');
    if (!sc) return true;
    const m = new DOMMatrixReadOnly(getComputedStyle(sc).transform);
    return Math.abs(m.m42) < 0.5 && Math.abs(m.a - 1) < 0.01 && +getComputedStyle(sc).opacity > 0.98;
  }, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
};
/** open the World tab standing in the camp, whichever view it was left on */
const camp = async () => {
  await tab('map');
  const back = page.locator('[data-pop="camp"]');
  if (await back.count()) { await back.first().click({ force: true }); await page.waitForTimeout(500); }
};
/** open one of the camp's side pop-ups; a queued story beat can steal the modal,
    so check the title we landed on and try once more if something barged in */
const pop = async (k, title) => {
  for (let n = 0; n < 3; n++) {
    await camp();
    await page.locator(`[data-pop="${k}"]`).first().click({ force: true });
    await page.waitForTimeout(700);
    if (await page.locator('#modal.open').count()
      && (await page.textContent('#mTitle').catch(() => '')) === title) return;
    await closeModal();
  }
  throw new Error(`the ${k} pop-up never opened`);
};
/** fly somewhere and wait for the launch cutscene to finish clearing */
const travel = async (world) => {
  await closeModal();
  // new worlds open once the one before has its launch pad restored
  await set(() => { const st = window.__game.state(); st.fuel = 3; st.proj = { earth: 99, luna: 99, cindra: 99, nerith: 99, vela: 99 }; });
  await closeModal();
  await tab('map');
  // the galaxy is a sub-view of the World tab, and it remembers which view it
  // was left on, so only switch when we are looking at the camp
  const toGal = page.locator('[data-pop="galaxy"]');
  if (await toGal.count()) { await toGal.click({ force: true }); await page.waitForTimeout(600); }
  await page.locator(`.gpPlanet[data-world="${world}"]`).click({ force: true });
  await page.waitForFunction(w => window.__game.state().world === w, world, { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('#cut').classList.contains('show'), null, { timeout: 15000 });
  await page.waitForTimeout(900); await closeModal(); await page.waitForTimeout(300);
};

// the guided intro owns the screen on a fresh save; the regression is about
// everything after it, so skip it the way a returning player does
await page.waitForTimeout(1200);
if (await page.locator('#tSkip').isVisible().catch(() => false)) {
  await page.locator('#tSkip').click({ force: true });
  await page.waitForTimeout(500);
}
await page.waitForTimeout(700); await closeModal();
// just-in-time tips dim the screen and would eat these scripted clicks; this
// run checks the systems, so the tips count as seen (ux-check covers them)
await page.evaluate(() => { const s = window.__game.state(); s.tipsOff = 1; window.__game.v9.jitOff(); });

/* ------------------------------------------------------------------ curve */
head('XP curve is a real climb');
const curve = await page.evaluate(() => {
  const c = window.__game.config;
  return Array.from({ length: 10 }, (_, k) => Math.round(c.xp.base + k * c.xp.perLevel + c.xp.growth * k * k));
});
must(curve[0] >= 30 && curve[9] > 600, `levels 1..10 cost ${curve.join(', ')}`);
must(curve.reduce((a, b) => a + b, 0) > 1000, 'over 1000 XP to reach level 11');
const cfg = await page.evaluate(() => window.__game.config);
must(cfg.energy.regenMs >= 30000, `energy trickles back every ${cfg.energy.regenMs / 1000}s`);
must(cfg.meteor.everyMinMs >= 180000, `meteors are at least ${cfg.meteor.everyMinMs / 60000} min apart`);

/* ------------------------------------------------------- merging still works */
head('Producers and merging');
const prodCells = await page.evaluate(() => window.__game.cells().map((c, i) => c && c.p ? i : -1).filter(i => i >= 0));
must(prodCells.length === 1, `the meadow starts calm: ${prodCells.length} producer on the board`);
for (let n = 0; n < 6; n++) await tapCell(prodCells[0]);
let s = await S();
must(Object.keys(s.made).length > 0, 'the catalogue records what you make');

/* ---------------------------------------------------------------- the shop */
head('Trading Post');
await set(() => { const s = window.__game.state(); s.lvl = 6; s.coins = 6000; s.met = 1; });
await tab('shop');
must(await page.locator('#sc-shop.open').count() === 1, 'shop screen opens at level 6');
const shelf = await page.locator('#shopBody [data-buy]').count();
must(shelf >= 1, `${shelf} supplies on the shelf`);
await shot('shop');
let before = (await S()).coins;
await page.locator('#shopBody [data-buy]:not([disabled])').first().click();
await page.waitForTimeout(400);
let after = await S();
must(after.coins < before, `buying a supply spends coins (${before} -> ${after.coins})`);
must(after.boards.earth.filter(c => c && c.id).length > 0, 'the bought item lands on the board');

head('Permanent upgrades');
before = (await S()).coins;
await page.locator('#shopBody [data-up="energy"]').click(); await page.waitForTimeout(400);
after = await S();
must(after.up.energy === 1, 'Bigger Backpack bought');
must(after.coins < before, 'upgrade cost coins');
const maxTxt = await page.locator('#energy').textContent();
must(maxTxt.endsWith('/60'), `max energy grew to ${maxTxt.split('/')[1]} (40 + 2x5 + 10)`);
before = await page.evaluate(() => window.__game.orderSlots());
await page.locator('#shopBody [data-up="orders"]').click(); await page.waitForTimeout(500);
must(await page.evaluate(() => window.__game.orderSlots()) === before + 1,
  `Order Board raises the contract cap (${before} -> ${before + 1}); cards now trickle in`);

/* ----------------------------------------------------------- rocket unstick */
head('The wreck hands out the pieces you need');
await page.click('#sc-shop .scClose'); await page.waitForTimeout(400);
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  b[10] = { p: 'wreck' };
});
await page.waitForTimeout(300);
for (let n = 0; n < 10; n++) await tapCell(10);
const chains = await page.evaluate(() => {
  const g = window.__game, out = {};
  g.cells().forEach(c => { if (c && c.id && g.items[c.id]) { const ch = g.items[c.id].chain; out[ch] = (out[ch] || 0) + 1; } });
  return out;
});
const partChains = ['hull', 'engine', 'nav', 'tank'].filter(k => chains[k]);
must(partChains.length >= 3, `wreck spread pieces over ${partChains.length} part chains: ${JSON.stringify(chains)}`);

head('No contract ever asks for a rocket piece or star scrap');
const early = await page.evaluate(() => {
  const g = window.__game, s = g.state(), keep = s.wreck; s.wreck = 0;
  let bad = 0, partGift = 0;
  for (let i = 0; i < 80; i++) {
    const o = g.roll();
    if (o.needs.some(nd => ['star', 'hull', 'engine', 'nav', 'tank'].includes(g.items[nd.id].chain))) bad++;
    if (o.give && ['hull', 'engine', 'nav', 'tank'].includes(g.items[o.give].chain)) partGift++;
  }
  s.wreck = keep; return { bad, partGift };
});
must(early.bad === 0, `${early.bad}/80 contracts asked for a rocket piece or scrap`);
must(early.partGift === 0, `before the wreck turns up nobody pays in rocket pieces (${early.partGift})`);

head('Star Scrap and Star Cores fly into the pouch');
const pouch0 = await page.evaluate(() => { const s = window.__game.state(); s.wal = s.wal || {}; return (s.wal.scrap || 0) + (s.wal.starcore || 0); });
await set(() => { const b = window.__game.state().boards.earth; let n = 0; for (let i = 0; i < b.length && n < 2; i++) if (!b[i]) { b[i] = { id: n ? 'starcore' : 'scrap' }; n++; } });
await page.waitForTimeout(2500);
const pouch1 = await page.evaluate(() => { const s = window.__game.state(); return { n: (s.wal.scrap || 0) + (s.wal.starcore || 0), onBoard: s.boards.earth.filter(c => c && (c.id === 'scrap' || c.id === 'starcore')).length }; });
must(pouch1.n === pouch0 + 2 && pouch1.onBoard === 0, `scrap and cores left the board for the pouch (${pouch0} -> ${pouch1.n}, ${pouch1.onBoard} still on board)`);

head('Orders pay you back with rocket pieces');
await set(() => { window.__game.state().wreck = 1; });
const gift = await page.evaluate(() => {
  const g = window.__game, parts = ['hull', 'engine', 'nav', 'tank'];
  let withGift = 0, partGift = 0;
  for (let i = 0; i < 60; i++) {
    const o = g.roll();
    if (o.give) { withGift++; if (parts.indexOf(g.items[o.give].chain) >= 0) partGift++; }
  }
  return { withGift, partGift };
});
must(gift.partGift >= 20, `${gift.partGift}/60 rolled orders hand back a rocket piece (${gift.withGift} gifts total)`);

/* ----------------------------------------------------------------- the lab */
head('The lab has to be built');
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i]) b[i] = null;
  s.parts = { hull: 1, engine: 1, nav: 1, tank: 1 };
  s.coins = 4000;
  b[12] = { id: 'gem' }; b[13] = { id: 'scrap' };
});
await page.waitForTimeout(300);
must(await page.evaluate(() => { window.__game.view('map'); const n = document.querySelectorAll('[data-hub=lab]').length; window.__game.view('board'); return n; }) === 0, 'the Lab is not on the map before it exists');
// the story builds the lab (Meadow chapter 5) — here we just switch it on
await set(() => { window.__game.state().lab.built = 1; });
await page.waitForTimeout(300);
must(await page.evaluate(() => { window.__game.view('map'); const n = document.querySelectorAll('[data-hub=lab]').length; window.__game.view('board'); return n; }) === 1, 'the Lab shows on the map once built');

head('Research Lab');
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  b[12] = { id: 'gem' }; b[13] = { id: 'scrap' };
  s.coins = 4000;
});
await tab('lab');
must(await page.locator('#sc-lab.open').count() === 1, 'lab screen opens');
await page.waitForTimeout(400);
await shot('lab-empty');
const recipeCount = await page.evaluate(() => window.__game.recipes.length);
// the rumours are a pop-up off the bench now
await page.evaluate(() => document.querySelector('[data-labpop="rumours"]').click());
await page.waitForTimeout(1000);
must(await page.locator('[data-learn]').count() === recipeCount, `all ${recipeCount} rumours listed, none spoiled`);
await closeModal();

// a dud pair costs the bench fee and consumes nothing
await set(() => { const b = window.__game.state().boards.earth; b[14] = { id: 'twig' }; b[15] = { id: 'twig' }; });
await page.locator('[data-lab="s0"]').click({ force: true }); await page.waitForTimeout(300);
await page.locator('[data-pick="twig"]').click(); await page.waitForTimeout(300);
await page.locator('[data-lab="s1"]').click({ force: true }); await page.waitForTimeout(300);
await page.locator('[data-pick="twig"]').click(); await page.waitForTimeout(300);
before = (await S()).coins;
await page.locator('#btnResearch').click({ force: true }); await page.waitForTimeout(600);
after = await S();
must(after.coins === before - 40, `a dud costs the 40 coin bench fee (${before} -> ${after.coins})`);
must(after.boards.earth.filter(c => c && c.id === 'twig').length === 2, 'a dud does not eat your samples');

// the real recipe
await page.locator('[data-lab="s0"]').click({ force: true }); await page.waitForTimeout(300);
await page.locator('[data-pick="gem"]').click(); await page.waitForTimeout(300);
await page.locator('[data-lab="s1"]').click({ force: true }); await page.waitForTimeout(300);
await page.locator('[data-pick="scrap"]').click(); await page.waitForTimeout(300);
await shot('lab-loaded');
before = (await S()).coins;
await page.locator('#btnResearch').click({ force: true }); await page.waitForTimeout(900);
after = await S();
must(after.lab.disc.r1 === 1, 'Star Gem recipe discovered');
must(after.boards.earth.some(c => c && c.id === 'relic1'), 'a Star Gem is on the board');
must(!after.boards.earth.some(c => c && (c.id === 'gem' || c.id === 'scrap')), 'both samples were used up');
must(after.coins === before - 40, `discovering only costs the bench fee (${before} -> ${after.coins})`);
await closeModal(); await page.waitForTimeout(400);
await shot('lab-known');
await page.evaluate(() => document.querySelector('[data-labpop="book"]').click());
await page.waitForTimeout(1000);
must(await page.locator('[data-load="r1"]').count() === 1, 'the recipe is in the lab book, ready to brew again');
await closeModal();

head('Fuel does not leave a ghost tile (regression)');
await tab('board');
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i]) b[i] = null;
  s.parts = { hull: 1, engine: 1, nav: 1, tank: 1 }; s.fuel = 0;
  b[20] = { id: 'fuelcan' }; b[21] = { id: 'fuelcan' };
  window.__board.sync(b);
});
await page.waitForTimeout(400);
await drag(20, 21);
await page.waitForTimeout(900);
let ghost = await page.evaluate(() => ({
  fuel: window.__game.state().fuel,
  cell: window.__game.cells()[21],
  key: window.__board.slots[21].key,
  sprite: !!window.__board.slots[21].art,
}));
must(ghost.fuel === 1, 'the fuel went into the tank');
must(!ghost.cell, 'the tile is empty in the model');
must(ghost.key === 'e' && !ghost.sprite, `the tile is empty on screen too (key "${ghost.key}", sprite ${ghost.sprite})`);

head('Meteor craters run dry');
const craterUses = await page.evaluate(() => window.__game.prods.crater.uses);
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i]) b[i] = null;
  s.energy = 90; s.sawCrater = 1;
  b[10] = { p: 'crater', u: window.__game.prods.crater.uses };
  window.__board.sync(b);
});
await page.waitForTimeout(300);
for (let n = 0; n < craterUses; n++) await tapCell(10);
await page.waitForTimeout(900);
const crater = await page.evaluate(() => {
  const g = window.__game, out = { gone: !g.cells()[10], ore: 0, scrap: 0 };
  g.cells().forEach(c => { if (c && c.id === 'fuelore') out.ore++; if (c && c.id === 'scrap') out.scrap++; });
  return out;
});
must(crater.gone, 'the crater collapses after its last dig');
must(crater.ore >= 1, `it gave ${crater.ore} Fuel Ore and ${crater.scrap} Star Scrap from ${craterUses} digs`);
must(await page.evaluate(() => !window.__game.prods.fuelpod), 'the free Fuel Pod producer is gone from the game');

head('Catalogue');
await closeModal();
await tab('book');
must((await page.locator('#bookBody .catBar').count()) === 1, 'collection bar shown');
must((await page.textContent('#bookBody')).includes('Relics'), 'the Relics chain appears once unlocked');
await shot('book');
await closeModal(); await page.click('#sc-book .scClose'); await page.waitForTimeout(300);

/* --------------------------------------------------------------- full arc */
head('Storage bag');
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  s.coins = 9000; s.up.bag = 0; s.bag = [];
  b[12] = { id: 'gem' };
  window.__board.sync(b);
});
await closeModal();
await set(() => { window.__game.state().coins = 20000; });
await tab('shop');
const shopDiag = await page.evaluate(() => ({
  open: !!document.querySelector('#sc-shop.open'),
  lvl: window.__game.state().lvl,
  coins: window.__game.state().coins,
  rows: document.querySelectorAll('#shopBody [data-up]').length,
  bagBtn: !!document.querySelector('[data-up="bag"]'),
  disabled: document.querySelector('[data-up="bag"]')?.disabled,
}));
if (!shopDiag.open || !shopDiag.bagBtn || shopDiag.disabled) console.log('   [shop]', JSON.stringify(shopDiag));
console.log('   [shop]', JSON.stringify(shopDiag));
await tapUI('[data-up="bag"]'); await page.waitForTimeout(450);
must((await S()).up.bag === 1, 'Storage Bag bought');
await tab('board');
must(await page.locator('#btnStore').count() === 1, 'the storage button sits at the bottom');
must(await page.evaluate(() => {
  const r = document.querySelector('#board canvas').getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return el && el.tagName === 'CANVAS';
}), 'a closed screen does not swallow board taps');
await tapCell(12); await page.waitForTimeout(350);
const bagDiag = await page.evaluate(() => ({
  cell12: window.__game.cells()[12],
  info: document.querySelector('#infoBar')?.className,
  stash: getComputedStyle(document.querySelector('#btnStash')).display,
  openScreens: [...document.querySelectorAll('.screen.open')].map(e => e.id),
}));
if (!bagDiag.info?.includes('on')) {
  console.log('   [bag]', JSON.stringify(bagDiag));
  console.log('   [geom]', JSON.stringify(await page.evaluate(() => {
    const bd = window.__board, r = document.querySelector('#board canvas').getBoundingClientRect();
    const c = bd.center(12);
    const el = document.elementFromPoint(r.left + c.x, r.top + c.y);
    return { cell: bd.cell, ox: bd.ox, oy: bd.oy, canvas: [r.left | 0, r.top | 0, r.width | 0, r.height | 0],
             point: [(r.left + c.x) | 0, (r.top + c.y) | 0], hit: el ? (el.id || el.className || el.tagName) : 'none',
             screenW: bd.app.screen.width, screenH: bd.app.screen.height,
             shopT: getComputedStyle(document.querySelector('#sc-shop')).transform,
             shopRect: (() => { const q = document.querySelector('#sc-shop').getBoundingClientRect(); return [q.top|0, q.bottom|0, q.height|0]; })(),
             shopCls: document.querySelector('#sc-shop').className };
  })));
}
await tapUI('#btnStash'); await page.waitForTimeout(500);
after = await S();
must(after.bag.length === 1 && after.bag[0] === 'gem', 'the item moved into the bag');
must(!after.boards.earth[12], 'and left the board');
await tapUI('#btnStore');
// the tray slides up; on software GL that can take well over its 0.3s, and a
// click mid-slide lands outside the viewport
await page.waitForFunction(() => /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(getComputedStyle(document.querySelector('#bagTray')).transform));
await tapUI('.bagSlot.full'); await page.waitForTimeout(500);
after = await S();
must(after.bag.length === 0 && after.boards.earth.some(c => c && c.id === 'gem'), 'and comes back out again');

head('Boosters');
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  s.boost = { wand: 1, bomb: 1, rainbow: 1 }; s.coins = 9000;
  for (let i = 0; i < 8; i++) b[i] = { id: i % 2 ? 'pebble' : 'twig' };
  window.__board.sync(b);
});
await page.waitForTimeout(400);
before = await page.evaluate(() => window.__game.cells().filter(c => c && c.id).length);
await tapUI('#tools .toolbox'); await page.waitForTimeout(400);
must(await page.locator('#pop.open [data-boost-use]').count() === 3, 'boosters open in a toolbox that says what each does');
await page.evaluate(() => document.querySelector('[data-boost-use="wand"]').click()); await page.waitForTimeout(900);
after = await S();
const nowItems = await page.evaluate(() => window.__game.cells().filter(c => c && c.id).length);
must(nowItems < before, `the wand merged the board down (${before} -> ${nowItems} items)`);
must(after.boost.wand === 0, 'and used itself up');

await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  for (let i = 0; i < 6; i++) b[i] = { id: 'pebble' };   // nobody is asking for stone yet
  s.orders = []; s.ship = null;
  window.__board.sync(b);
});
await page.waitForTimeout(400);
before = (await S()).coins;
await tapUI('#tools .toolbox'); await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('[data-boost-use="bomb"]').click()); await page.waitForTimeout(800);
after = await S();
must(after.coins > before, `the bomb sold the clutter for coins (${before} -> ${after.coins})`);
must(after.boards.earth.filter(c => c && c.id === 'pebble').length === 0, 'and cleared the board');

head('Rainbow Gem is a wildcard');
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  b[20] = { id: 'rainbow' }; b[21] = { id: 'geode' };
  window.__board.sync(b);
});
await page.waitForTimeout(400);
await drag(20, 21);
await page.waitForFunction(() => window.__game.cells()[21]?.id === 'gem', null, { timeout: 4000 }).catch(() => {});
must(await page.evaluate(() => window.__game.cells()[21]?.id) === 'gem', 'rainbow + geode makes a Gemstone');

head('Star Freighter');
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i]) b[i] = null;
  b[19] = { p: 'tree' }; b[22] = { p: 'rocks' };
  s.lvl = 9; s.ship = null; s.shipAt = Date.now() - 1; s.proj.earth = 6;   // ships come after chapter 6
  window.__board.sync(b);
});
await page.waitForTimeout(1500);
let sh = await page.evaluate(() => window.__game.state().ship);
must(!!sh, sh ? `a ship docked wanting ${sh.needs.map(n => n.qty + '× ' + n.id).join(', ')} for ${sh.coins} coins` : 'no ship appeared');
must(await page.locator('.order.ship').count() === 1, 'and shows as a card in the order row');
await set(() => {
  const g = window.__game, s = g.state(), b = g.cells();
  s.ship.needs.forEach(nd => { let n = nd.qty; for (let i = 0; i < b.length && n; i++) if (!b[i]) { b[i] = { id: nd.id }; n--; } });
  window.__board.sync(b);
});
await page.waitForTimeout(500);
before = (await S()).coins;
await page.evaluate(() => document.querySelector('.order.ship').click()); await page.waitForTimeout(900);
after = await S();
must(after.coins > before && !after.ship, `loading the manifest paid out (${before} -> ${after.coins})`);
must(Object.values(after.boost).some(n => n > 0), 'and threw in a booster');

head('Daily rewards');
// clear it in memory: the game now saves when the tab hides, so a reload would
// otherwise write the live state straight back over a localStorage edit
await set(() => { const s = window.__game.state(); s.daily = { key: 0, day: 0 }; });
await page.reload();
// boot rasterises every item (500+) before the first frame; software GL needs the headroom
await page.waitForFunction(() => window.__game && window.__board, null, { timeout: 45000 });
await page.waitForTimeout(2600);
const dayCells = await page.locator('#modal.open .dayCell').count();
if (dayCells !== 7) console.log('   [daily] modal title is now: ' + (await page.textContent('#mTitle')) + ' | cells ' + dayCells);
must(dayCells === 7, 'a 7-day calendar greets you');
must((await S()).daily.day === 1, 'and starts you on day 1');
await closeModal();

head('No soft-lock: a full unmergeable board is rescued');
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  // one of everything, so nothing on the board can merge with anything else —
  // taken from the live catalogue rather than a hand-written list that rots
  const ids = Object.keys(window.__game.items);
  for (let i = 0; i < b.length; i++) b[i] = { id: ids[i % ids.length] };
  s.orders = []; s.ship = null; s.bag = []; s.up.bag = 0;
  window.__board.sync(b);
});
await page.waitForTimeout(1600);
must(await page.locator('#modal.open').count() === 1, 'Bloop turns up when the board is stuck');
before = (await S()).coins;
await page.click('#mBtn'); await page.waitForTimeout(800);
after = await S();
must(after.boards.earth.some(c => !c), 'the rescue freed tiles');
must(after.coins > before, `and paid for the clutter (${before} -> ${after.coins})`);

head('Launch still works end to end');
await set(() => {
  const s = window.__game.state();
  s.parts = { hull: 1, engine: 1, nav: 1, tank: 1 }; s.fuel = 3;
});
await travel('luna');
s = await S();
must(s.world === 'luna', 'landed on Luna');
await shot('luna');

head('And on to Cindra');
await travel('cindra');
s = await S();
must(s.world === 'cindra', 'landed on Cindra');
must(s.boards.cindra.some(c => c && c.p === 'lavavent'), 'with a Lava Vent to tap');
await shot('cindra');

/* ------------------------------------------------- the v6 systems */
head('Nerith and Vela');
must(await page.evaluate(() => ['earth', 'luna', 'cindra', 'nerith', 'vela'].every(w => window.__game.v9.painted(w))), 'every world is fully painted (no stand-in art)');
// the rest of the run uses these worlds as a test bed, stand-in art and all
await page.evaluate(() => window.__game.v9.paintAll());
await travel('nerith');
s = await S();
must(s.world === 'nerith', 'landed on Nerith');
must(s.boards.nerith.some(c => c && c.p === 'shellbed'), 'with a Shell Bed to tap');
await travel('vela');
s = await S();
must(s.world === 'vela', 'and on to Vela');
await shot('vela');

head('A new world starts small and opens up');
await closeModal();
let live = await page.evaluate(() => {
  const g = window.__game, w = g.state().world;
  return { lv: g.wlv(w), open: g.chains && Object.values(g.chains).filter(c => c.world === w && c.unlock <= g.wlv(w)).length,
    total: Object.values(g.chains).filter(c => c.world === w).length,
    locked: g.cells().filter(c => c && c.b).length };
});
must(live.lv === 1, 'a fresh world is at world level 1');
must(live.open === 2 && live.total > 6, `only ${live.open} of ${live.total} chains are awake at first`);
must(live.locked > 8, `and ${live.locked} board cells are still overgrown`);
// orders can only ask for things that are actually awake here
const asked = await page.evaluate(() => {
  const g = window.__game, out = [];
  for (let i = 0; i < 40; i++) g.roll().needs.forEach(n => out.push(g.items[n.id].chain));
  return [...new Set(out)];
});
const sleeping = await page.evaluate((cs) => {
  const g = window.__game, w = g.state().world;
  return cs.filter(c => g.chains[c].world === w && g.chains[c].unlock > g.wlv(w));
}, asked);
must(sleeping.length === 0, 'and no contract asks for something that has not woken up yet');

head('A world level brings the next producer');
let before2 = await page.evaluate(() => {
  const g = window.__game;
  return { live: g.liveChains().length, prods: g.cells().filter(c => c && c.p && !c.tmp && c.p !== 'crater').length };
});
// not yet: a fresh world is level 1 and the next plot waits for level 2
await page.evaluate(() => window.__game.grow());
await page.waitForTimeout(400);
let mid = await page.evaluate(() => window.__game.cells().filter(c => c && c.p && !c.tmp && c.p !== 'crater').length);
must(mid === before2.prods, 'nothing new takes root before its world level');
await set(() => { const g = window.__game, st = g.state(); st.wlv[st.world] = 2; });
await page.evaluate(() => window.__game.grow());
await page.waitForTimeout(1200);
const after4 = await page.evaluate(() => {
  const g = window.__game;
  return { live: g.liveChains().length, prods: g.cells().filter(c => c && c.p && !c.tmp && c.p !== "crater").length };
});
must(after4.prods > before2.prods, `reaching the level planted a new producer (${before2.prods} -> ${after4.prods})`);
must(after4.live > before2.live, `and woke its chain (${before2.live} -> ${after4.live} awake)`);
await closeModal();

head('Restoration projects');
await set(() => {
  const g = window.__game, s = g.state(), b = g.cells();
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  s.proj.vela = 0; s.coins = 5000; s.cSince = { earth: 99, luna: 99, cindra: 99, nerith: 99, vela: 99 };
  const fr = []; for (let i = 0; i < b.length; i++) if (!b[i]) fr.push(i);
  b[fr[0]] = { id: 'cloudpuff' }; b[fr[1]] = { id: 'aurorasilk' };
  window.__board.sync(b);
});
await tab('rocket');
must(await page.locator('#rocketBody .pRow.cur').count() === 1, 'the Goals screen shows the current project');
await page.locator('#btnProject').click({ force: true }); await page.waitForTimeout(900);
s = await S();
must(s.proj.vela === 1, 'building it moves the world on to the next project');
must(!s.boards.vela.some(c => c && (c.id === 'cloudpuff' || c.id === 'aurorasilk')), 'and used up the items it asked for');
await closeModal();
await tab('board');

head('Chests and bubbles');
await set(() => {
  const g = window.__game, b = g.cells();
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  const fr = []; for (let i = 0; i < b.length; i++) if (!b[i]) fr.push(i);
  b[fr[0]] = { id: 'chest' };
  b[fr[fr.length - 1]] = { bub: 'cloudpuff', until: Date.now() + 60000 };
  window.__t = { chest: fr[0], bub: fr[fr.length - 1] };
  window.__board.sync(b);
});
const tcells = await page.evaluate(() => window.__t);
await closeModal();
await tapCell(tcells.chest); await page.waitForTimeout(900);
let items = await page.evaluate(() => window.__game.cells().filter(c => c && c.id).length);
must(items >= 3 && !(await S()).boards.vela.some(c => c && c.id === 'chest'), `tapping a chest spills ${items} things onto the board`);
await tapCell(tcells.bub); await page.waitForTimeout(600);
await page.evaluate(() => { window.__game.state().gems = 50; }); await page.locator('#btnBubbleGem').click({ force: true }); await page.waitForTimeout(600);
s = await S();
must(s.boards.vela[tcells.bub] && s.boards.vela[tcells.bub].id === 'cloudpuff', 'keeping a bubble for gems turns it into the real thing');
await closeModal();

head('Visitors bring a temporary producer');
await set(() => { const st = window.__game.state(); st.wlv[st.world] = 5; st.vis = null; st.visAt = 1; });
await closeModal(); await tab('board');
await page.waitForFunction(() => window.__game.cells().some(c => c && c.tmp), null, { timeout: 8000 }).catch(() => {});
s = await S();
must(s.boards.vela.some(c => c && c.tmp), 'a visitor landed with a producer of their own');
must(s.orders.some(o => o.vis && o.give === 'chest'), 'and put up a contract that pays a chest');
await closeModal();
// and leaves when the time is up, taking its producer and its contract with it
await set(() => { window.__game.state().vis.until = 1; });
await page.waitForTimeout(1500);
s = await S();
must(!s.boards.vela.some(c => c && c.tmp) && !s.orders.some(o => o.vis), 'and flew home when the time was up, producer and contract with it');
await set(() => { window.__game.state().visAt = Date.now() + 9e8; });
await closeModal();

head('Flying back is free');
await set(() => { window.__game.state().fuel = 0; });
await closeModal();
await page.evaluate(() => window.__game.fly('earth'));
await page.waitForFunction(() => window.__game.state().world === 'earth', null, { timeout: 15000 }).catch(() => {});
s = await S();
must(s.world === 'earth' && s.fuel === 0, 'back in Sunny Meadow without spending fuel');
await page.waitForTimeout(3200); await closeModal();
await travel('vela');
await closeModal();

head('Finishing a chain pays Bloom Essence');
await closeModal();
await set(() => {
  const g = window.__game, s = g.state(), b = g.cells();
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  s.firsts = {}; s.fed = {}; s.stage = {};
  const ch = g.chains.cloudc, last = ch.items[ch.items.length - 1], prev = ch.items[ch.items.length - 2];
  b[13] = { id: prev }; b[14] = { id: prev };
  window.__board.sync(b);
});
await drag(13, 14);
await page.waitForTimeout(1400);
s = await S();
const spark = await page.evaluate(() => window.__game.cells().some(c => c && c.id === 'bloomspark'));
must(s.firsts.cloudc === 1, 'the Cloud Bank chain is marked complete');
must(spark, 'and a Bloom Spark landed on the board');

head('Feeding the Heart wakes the world');
await closeModal();
await camp();
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('[data-ent="heart"]').click());
await page.waitForTimeout(900);
let feedTxt = await page.textContent('#feed2');
must(/Feed it/.test(feedTxt), `the Heart offers to eat: "${feedTxt.trim()}"`);
await set(() => {
  const g = window.__game, b = g.cells();
  let n = 0;
  for (let i = 0; i < b.length && n < 3; i++) if (!b[i]) { b[i] = { id: 'bloomcore' }; n++; }
  window.__board.sync(b);
});
await page.evaluate(() => document.querySelector('[data-ent="heart"]').click());
await page.waitForTimeout(900);
await page.locator('#feed2').click({ force: true }); await page.waitForTimeout(1200);
s = await S();
must(s.fed.vela >= 12, `the Heart took ${s.fed.vela} Bloom`);
must(s.stage.vela >= 1, 'and the world woke a stage');
must(await page.locator('#modal.open').count() === 1, 'with a story beat to mark it');
await closeModal();

head('Side games');
await set(() => { const s = window.__game.state(); s.energy = 60; s.mini = {}; });
await closeModal(); await tab('board');
await page.evaluate(() => window.__game.v9.funPop()); await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-fun="dig"]').click()); await page.waitForTimeout(800);
must(await page.locator('#mini.open').count() === 1, 'Crater Dig opens');
const digCells = await page.locator('.digCell').count();
must(digCells === 20, `with a ${digCells}-tile crater`);
let opened = 0;
for (const i of [0, 1, 2]) {
  await page.locator(`[data-d="${i}"]`).click({ force: true }).catch(() => {});
  await page.waitForTimeout(150);
  opened = await page.locator('.digCell.open').count();
}
must(opened >= 1, `digging revealed ${opened} tile(s)`);
await page.locator('#miniClose').click({ force: true }); await page.waitForTimeout(300);

await set(() => { const s = window.__game.state(); s.energy = 60; s.mini = {}; });
await closeModal(); await tab('board');
await page.evaluate(() => window.__game.v9.funPop()); await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-fun="brew"]').click()); await page.waitForTimeout(800);
must(await page.locator('.brewBar').count() === 1, 'Fuel Brewing opens with a needle');
for (let i = 0; i < 5; i++) { await page.locator('#brewTap').click({ force: true }).catch(() => {}); await page.waitForTimeout(200); }
must(await page.locator('#brewDone').count() === 1, 'and five stirs finish the brew');
await page.locator('#brewDone').click({ force: true }); await page.waitForTimeout(300);

await set(() => { const s = window.__game.state(); s.mini = {}; s.coins = 9000; });
await closeModal(); await tab('board');
await page.evaluate(() => window.__game.v9.funPop()); await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-fun="market"]').click()); await page.waitForTimeout(800);
must(await page.locator('.mktCrate').count() === 3, 'the Alien Market lays out three crates');
await page.locator('[data-m=\"0\"]').click({ force: true }); await page.waitForTimeout(200);
await page.locator('[data-m=\"1\"]').click({ force: true }); await page.waitForTimeout(200);
must(await page.locator('.mktCrate.open').count() === 2, 'two peeks, then no more');
await page.locator('[data-m=\"2\"]').click({ force: true }); await page.waitForTimeout(300);
must(await page.locator('#mktTake').count() === 1, 'and the third can still be taken blind');
await page.locator('#mktTake').click({ force: true }); await page.waitForTimeout(500);

head('Constellations spend Star Cores');
await closeModal();
await set(() => {
  const g = window.__game, s = g.state(), b = g.cells();
  s.stars = {};
  let n = 0;
  for (let i = 0; i < b.length && n < 2; i++) if (!b[i]) { b[i] = { id: 'starcore' }; n++; }
  window.__board.sync(b);
});
await closeModal(); await tab('board');
await set(() => { window.__game.state().seen.starcore = 1; });
await page.evaluate(() => window.__game.v9.funPop()); await page.waitForTimeout(500);
await page.evaluate(() => document.querySelector('[data-fun="stars"]').click()); await page.waitForTimeout(800);
await page.locator('[data-c="plough"]').click({ force: true }); await page.waitForTimeout(800);
must(await page.locator('.skyStar').count() === 7, 'the Plough has seven stars');
for (let i = 0; i < 7; i++) { await page.locator(`[data-s="${i}"]`).click({ force: true }); await page.waitForTimeout(120); }
s = await S();
must(s.stars.plough === 1, 'tracing it in order lights it');
const cores = await page.evaluate(() => window.__game.cells().filter(c => c && c.id === 'starcore').length);
must(cores === 0, 'and it ate the two Star Cores');
await page.locator('#skyDone').click().catch(() => {});
await page.waitForTimeout(300);

head('Catalogue is big and every item can be drawn');
const art = await page.evaluate(() => {
  const g = window.__game, ART = window.__art;
  const bad = [];
  Object.keys(g.items).forEach(id => { const svg = ART.item(id); if (!svg || svg.length < 120) bad.push(id); });
  return { n: Object.keys(g.items).length, chains: Object.keys(g.chains).length, bad };
});
must(art.n > 250, `${art.n} items across ${art.chains} chains`);
must(art.bad.length === 0, art.bad.length ? `items with no art: ${art.bad.join(', ')}` : 'all of them have art');

head('An old save survives the rewrite');
{
  // A v5 save is planted before the app boots (reloading a live page lets its
  // own unload handler write the current state back over the plant) and carries
  // item ids the v6 catalogue no longer has.
  const ctx = await browser.newContext({ viewport: { width: 430, height: 880 } });
  await ctx.addInitScript(() => {
    const board = new Array(48).fill(null);
    board[19] = { p: 'tree' }; board[22] = { p: 'rocks' }; board[20] = { p: 'goneProducer' };
    ['twig', 'branch', 'shroom', 'jam', 'ghostItem', 'dew'].forEach((id, i) => { board[i] = { id }; });
    localStorage.setItem('mergeRocket_v2', JSON.stringify({
      v: 5, world: 'earth', lvl: 12, xp: 30, coins: 2500, energy: 40, eAt: Date.now(),
      boards: { earth: board, luna: null, cindra: null }, orders: [], seen: { twig: 1 },
      parts: { hull: 1, engine: 1, nav: 1, tank: 1 }, fuel: 1, mp: {}, met: 1,
      unlocked: { luna: 1, cindra: 0 }, snackAt: 0, sound: 0, music: 0, tut: 1,
      up: { energy: 2 }, shop: { stock: null, at: 0 },
      lab: { disc: {}, clue: {}, slots: ['shroom', 'twig'], tries: 3, made: 1 },
      made: {}, bag: ['shroom', 'twig'], boost: {}, daily: { key: 0, day: 2 },
      streak: 0, streakAt: 0, ship: null, shipAt: 0, vault: { rich: 1 }, tasks: [], tasksAt: 0, tc: {},
      perkAt: 0, ordersAt: 0,
    }));
  });
  const old = await ctx.newPage();
  const oldErrs = [];
  old.on('pageerror', e => oldErrs.push(e.message));
  await old.goto(URL);
  await old.waitForFunction(() => window.__game, null, { timeout: 45000 });
  await old.waitForTimeout(2000);
  const m = await old.evaluate(() => {
    const g = window.__game, st = g.state(), b = g.cells();
    return {
      v: st.v, lvl: st.lvl, wlv: g.wlv('earth'), coins: st.coins, rich: st.vault.rich,
      ghosts: b.filter(c => c && ((c.id && !g.items[c.id]) || (c.p && !g.prods[c.p]))).length,
      bag: st.bag.length, slots: st.lab.slots.filter(x => x && !g.items[x]).length,
    };
  });
  must(m.v === 6 && m.lvl === 12 && m.coins >= 2500 && m.rich === 1, 'level, coins and vault perks come through');
  must(m.wlv > 1 && m.wlv <= 4, `its world level is seeded to ${m.wlv} — progress kept, something still to unlock`);
  must(m.ghosts === 0, 'items and producers that no longer exist are swept off the board');
  must(m.bag === 1 && m.slots === 0, 'and out of the bag and the lab bench');
  must(oldErrs.length === 0, oldErrs.length ? 'migration threw: ' + oldErrs[0] : 'with nothing thrown on the way');
  await ctx.close();
}

head('Most producers run on energy, a few on free charges');
await closeModal();
await tab('board');
const nrg = await page.evaluate(() => {
  const g = window.__game, b = g.cells();
  const i = b.findIndex(c => c && c.p && g.prods[c.p].mode === 'energy');
  return i < 0 ? null : { i, k: b[i].p, name: g.prods[b[i].p].name, cost: g.ecost(g.prods[b[i].p], 1) };
});
must(!!nrg, `this world has an energy producer (${nrg && nrg.name})`);
await set(() => {
  const g = window.__game, st = g.state(), b = g.cells();
  for (let k = 0; k < b.length; k++) if (b[k] && b[k].id) b[k] = null;
  st.energy = 6; st.eAt = Date.now(); st.visAt = Date.now() + 9e8; st.vis = null;          // no regen tick sneaking in mid-check
  const c = b.find(x => x && x.p && g.prods[x.p].mode === 'energy');
  c.lv = 1;
  window.__board.sync(b);
});
await tapCell(nrg.i); await page.waitForTimeout(300);
let e1 = (await S()).energy;
must(e1 === 6 - nrg.cost, `a tap costs ${nrg.cost} energy (6 -> ${e1})`);
must(await page.evaluate(() => window.__game.cells().filter(c => c && c.id).length) === 1, 'and it dropped something');
// unlimited taps: only energy stops you
await set(() => { const st = window.__game.state(); st.energy = 0; st.eAt = Date.now(); });
await tapCell(nrg.i); await page.waitForTimeout(300);
must((await S()).energy === 0, 'with no energy the tap is refused');
must(await page.evaluate(() => window.__game.cells().filter(c => c && c.id).length) === 1, 'and nothing was dropped');
await set(() => { window.__game.state().energy = 60; });
for (let i = 0; i < 12; i++) await tapCell(nrg.i);
await page.waitForTimeout(400);
must(await page.evaluate(() => window.__game.cells().filter(c => c && c.id).length) >= 8,
  'with energy in the tank it taps as often as you like');
must(await page.evaluate(p2 => window.__game.ecost(window.__game.prods[p2.k], 4)
  > window.__game.ecost(window.__game.prods[p2.k], 1), nrg), 'a maxed one costs more per tap');

head('A few patches hand out free charges instead');
await closeModal();
await tab('board');
// by now we are standing on Vela, so use whatever producer this world has
const prod = await page.evaluate(() => {
  const g = window.__game, b = g.cells();
  const i = b.findIndex(c => c && c.p && !c.tmp && g.prods[c.p].mode === 'battery');
  return { i, k: b[i].p };
});
await set(() => {
  const g = window.__game, st = g.state(), b = g.cells();
  for (let k = 0; k < b.length; k++) if (b[k] && b[k].id) b[k] = null;
  st.energy = 8;                         // deliberately low: taps must not need it
  const c = b.find(x => x && x.p && !x.tmp && g.prods[x.p].mode === 'battery');
  c.lv = 1; c.spent = 0; c.ch = g.capOf(g.prods[c.p], 1);
  window.__board.sync(b);
});
let bat = await page.evaluate(k => {
  const g = window.__game, c = g.cells().find(x => x && x.p === k);
  return { ch: c.ch, cap: g.capOf(g.prods[k], 1), mode: g.prods[k].mode, name: g.prods[k].name };
}, prod.k);
must(bat.mode === "battery" && bat.cap >= 10, `the ${bat.name} holds ${bat.cap} taps`);
const energyBefore = (await S()).energy;
for (let i = 0; i < 10; i++) await tapCell(prod.i);
await page.waitForTimeout(400);
let after2 = await S();
const charges = await page.evaluate(k => window.__game.cells().find(c => c && c.p === k).ch, prod.k);
must(charges <= bat.cap - 8, `ten taps in a row, no waiting (battery ${bat.cap} -> ${charges})`);
must(after2.energy >= energyBefore, 'and tapping a producer costs no energy at all');

head('Growing a producer');
await set(() => {
  const g = window.__game, st = g.state(), b = g.cells();
  for (let k = 0; k < b.length; k++) if (b[k] && b[k].id) b[k] = null;
  st.coins = 40000;
  window.__board.sync(b);
});
const grew = await page.evaluate(p2 => {
  const g = window.__game, before = g.plv(g.cells()[p2.i]);
  return { before, dropsBefore: [...new Set(g.dropsOf(g.prods[p2.k], before))].length };
}, prod);
await camp();
await page.waitForTimeout(400);
must(await page.locator('.spot[data-ent="rocket"]').count() === 1, 'the camp shows your rocket');
must(await page.locator('.spot[data-ent="heart"]').count() === 1, 'and the world Heart');
must(await page.locator('.spot[data-ent^="p"]').count() >= 2, 'and every producer you own');
// every button on a painted scene has to be the thing your thumb actually hits
const buried = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('#mapBody .sceneBtn, .rail .railBtn').forEach(b => {
    const r = b.getBoundingClientRect();
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!b.contains(t)) bad.push((b.dataset.pop || b.dataset.v) + ' under ' + (t ? t.className : 'nothing'));
  });
  return bad;
});
must(buried.length === 0, `nothing is buried under the scenery${buried.length ? ': ' + buried.join(', ') : ''}`);
await page.evaluate(i => document.querySelector(`[data-ent="p${i}"]`).click(), prod.i);
await page.waitForTimeout(900);
must((await page.textContent('#mTitle')) === bat.name, 'tapping one opens its panel');
await page.locator('#upProd').click({ force: true }); await page.waitForTimeout(900);
const after3 = await page.evaluate(p2 => {
  const g = window.__game, c = g.cells()[p2.i], lv = g.plv(c);
  return { lv, cap: g.capOf(g.prods[p2.k], lv), ch: c.ch,
    drops: [...new Set(g.dropsOf(g.prods[p2.k], lv))].length, coins: g.state().coins };
}, prod);
must(after3.lv === grew.before + 1, `it grew to level ${after3.lv}`);
must(after3.coins < 40000, 'and it cost coins');
must(after3.cap > bat.cap, `a bigger battery (${bat.cap} -> ${after3.cap})`);
must(after3.ch === after3.cap, 'handed over full');
must(after3.drops > grew.dropsBefore, `dropping ${after3.drops} different things now, up from ${grew.dropsBefore}`);
await closeModal();

head('A maxed producer stays on the board');
await tab('board');
// the producer tested above, by its cell: later levels plant more batteries
await page.evaluate(i => {
  const g = window.__game, b = g.cells(), st = g.state();
  const c = b[i];
  c.lv = 4; c.spent = 43; c.ch = 99;
  for (let k = 0; k < b.length; k++) if (b[k] && b[k].id) b[k] = null;
  st.coins = 0;
  window.__board.sync(b);
}, prod.i);
await page.evaluate(() => window.__game.hud());
for (let i = 0; i < 3; i++) await tapCell(prod.i);
await page.waitForTimeout(1400);
const seeded = await page.evaluate(i => {
  const g = window.__game, c = g.cells()[i];
  return { p: c && c.p, lv: c && g.plv(c), coins: g.state().coins };
}, prod.i);
must(seeded.p === prod.k && seeded.lv === 4, `a maxed ${seeded.p} keeps working instead of being swapped out (lv ${seeded.lv})`);
await closeModal();

head('The quest button and the "where do I get one?" panel');
await tab('board');
await set(() => { const st = window.__game.state(); st.mp = {}; st.proj[st.world] = 0; });
await page.waitForTimeout(300);
const qTxt = await page.textContent('#btnQuests .cwT');
must(/Ch\. \d+/.test(qTxt), `the chapter widget is always on screen: "${qTxt}"`);
await page.locator('#btnQuests').click({ force: true }); await page.waitForTimeout(700);
must(await page.locator('#pop.open .pNeed').count() >= 1, 'and tapping it shows what the chapter needs');
await page.evaluate(() => window.__game.v9.closePop());
await page.evaluate(() => window.__game.v9.questsPop()); await page.waitForTimeout(700);
must(await page.locator('.questRow').count() >= 15, `the quest list shows all ${await page.locator('.questRow').count()} of them`);
must(await page.locator('.questRow.now').count() === 1, 'with the current one called out');
await closeModal();
await tab('board');
const askedFor = await page.locator('#orders [data-need]').first().getAttribute('data-need');
const askedLen = await page.evaluate(id => window.__game.chains[window.__game.items[id].chain].items.length, askedFor);
await page.locator('#orders [data-need]').first().click({ force: true }); await page.waitForTimeout(900);
// it opens the contract sheet: each need with its chain path up to the item asked for
const askedTier = await page.evaluate(id => window.__game.items[id].tier, askedFor);
const pathLen = await page.locator('#pop.open .csNeed').first().locator('.csStep').count();
must(await page.locator('#pop.open.csheet').count() === 1, 'tapping a contract item opens the contract sheet');
must(pathLen === askedTier, `with its chain path up to the item (${pathLen} of ${askedLen} steps)`);
must(await page.locator('#pop.open .csStep.goal').count() >= 1, 'and the one they asked for highlighted');
const srcOn = await page.evaluate(id => { const g = window.__game, ch = g.items[id].chain;
  return g.cells().some(c => c && c.p && g.prods[c.p].drops.some(d => g.items[d].chain === ch)); }, askedFor);
const goBtn = await page.locator('#pop.open .csGo').count();
must(srcOn ? goBtn >= 1 : true, srcOn ? 'and a button that points at the producer' : 'its producer is not on this board');
await page.evaluate(() => window.__game.v9.closePop()); await page.waitForTimeout(400);

head('The guided intro');
{
  const ctx2 = await browser.newContext({ viewport: { width: 430, height: 880 } });
  await ctx2.addInitScript(() => localStorage.removeItem('mergeRocket_v2'));
  const t2 = await ctx2.newPage();
  const tErrs = [];
  t2.on('pageerror', e => tErrs.push(e.message));
  await t2.goto(URL);
  await t2.waitForFunction(() => window.__game, null, { timeout: 45000 });
  await t2.waitForTimeout(2600);
  must(await t2.locator('#tut.on').count() === 1, 'a fresh save opens straight into the intro');
  must(await t2.locator('#modal.open').count() === 0, 'and nothing else pops over it');
  const say2 = await t2.textContent('#tSay');
  await t2.waitForTimeout(1500);   // let the dimmers settle on a software renderer
  must(/Big Tree/.test(say2), 'the first step is something to do: tap the tree');
  // the hole has to be over the Big Tree, and everything else has to be dimmed
  const spot = await t2.evaluate(() => {
    const g = window.__game, i = g.cells().findIndex(c => c && c.p === 'tree');
    const cv = document.querySelector('#board canvas'), r = cv.getBoundingClientRect(), c = window.__board.center(i);
    const x = r.left + c.x, y = r.top + c.y;
    const hit = document.elementFromPoint(x, y);
    const off = document.elementFromPoint(r.left + 8, r.top + 8);
    return { onTarget: hit && hit.tagName, offTarget: off && off.className };
  });
  must(spot.onTarget === 'CANVAS', 'the thing you are told to tap is still tappable');
  must(String(spot.offTarget).includes('tDim'), 'everything else is behind the dimmer');
  // and it really does advance on the action, not a timer
  const tp = await t2.evaluate(() => {
    const i = window.__game.cells().findIndex(c => c && c.p === 'tree');
    const r = document.querySelector('#board canvas').getBoundingClientRect(), c = window.__board.center(i);
    return { x: r.left + c.x, y: r.top + c.y };
  });
  await t2.mouse.click(tp.x, tp.y); await t2.waitForTimeout(1300);
  must((await t2.textContent('#tSay')) !== say2, 'and tapping the tree moves it on by itself');
  await t2.locator('#tSkip').click({ force: true }); await t2.waitForTimeout(600);
  must(await t2.locator('#tut.on').count() === 0, 'Skip closes it');
  must((await t2.evaluate(() => window.__game.state().tut)) === 1, 'and it never comes back');
  must(tErrs.length === 0, tErrs.length ? 'intro threw: ' + tErrs[0] : 'with nothing thrown');
  await ctx2.close();
}

head('Sunny Meadow is a story');
await closeModal(); await tab('board');
await page.evaluate(() => window.__game.fly('earth'));
await page.waitForFunction(() => window.__game.state().world === 'earth', null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(800); await closeModal();
must((await S()).world === 'earth', 'back home in the meadow');
await set(() => {
  const g = window.__game, s = g.state(), b = g.cells();
  for (let i = 0; i < b.length; i++) if (b[i] && (b[i].id || (b[i].p && b[i].p !== 'tree'))) b[i] = null;
  s.proj.earth = 0; s.coins = 5000; s.cSince = { earth: 99, luna: 99, cindra: 99, nerith: 99, vela: 99 }; s.vis = null; s.guestBack = null; s.pendingPlant = null;
  const fr = []; for (let i = 0; i < b.length; i++) if (!b[i]) fr.push(i);
  b[fr[0]] = { id: 'branch' }; b[fr[1]] = { id: 'branch' };
  window.__board.sync(b);
});
await tab('rocket');
await page.evaluate(() => document.querySelector('#btnProject').click()); await page.waitForTimeout(1600);
await closeModal(); await tab('board');
s = await S();
must(s.proj.earth === 1, 'chapter 1 is done');
must(s.boards.earth.some(c => c && c.p === 'rocks'), 'and it planted the Rock Pile');
must(!s.boards.earth.some(c => c && c.p && c.p !== 'tree' && c.p !== 'rocks'), 'and nothing else');
await set(() => {
  const g = window.__game, s = g.state(), b = g.cells();
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  s.proj.earth = 2; s.cSince = { earth: 99 };
  const fr = []; for (let i = 0; i < b.length; i++) if (!b[i]) fr.push(i);
  const pj = window.__game.state().proj; void pj;
  ['jam', 'berries', 'berries'].forEach((id, k) => { b[fr[k]] = { id }; });
  window.__board.sync(b);
});
await tab('rocket');
await page.evaluate(() => document.querySelector('#btnProject').click()); await page.waitForTimeout(1800);
await closeModal(); await tab('board');
s = await S();
must(s.boards.earth.some(c => c && c.p === 'well'), 'chapter 3 plants the Old Well (water for good, no stand-in cloud)');
must(!s.boards.earth.some(c => c && c.p === 'windmill'), 'and no Windmill yet: that comes with the bakery');

head('Chapter 5 builds the Lab');
await set(() => {
  const g = window.__game, s = g.state(), b = g.cells();
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  s.proj.earth = 4; s.lab.built = 0; s.coins = 5000; s.cSince = { earth: 99, luna: 99, cindra: 99, nerith: 99, vela: 99 }; s.vis = null; s.guestBack = null;
  const fr = []; for (let i = 0; i < b.length; i++) if (!b[i]) fr.push(i);
  ['scrap', 'lumber', 'geode'].forEach((id, k) => { b[fr[k]] = { id }; });
  window.__board.sync(b);
});
await tab('rocket');
await page.evaluate(() => document.querySelector('#btnProject').click()); await page.waitForTimeout(1200);
must(await page.locator('#modal.open .mSay').count() === 1, 'finishing a chapter shows its closing line with the reward');
await closeModal(); await page.waitForTimeout(400); await closeModal(); await page.waitForTimeout(700);
s = await S();
await closeModal();
must(s.lab.built === 1 && s.proj.earth === 5, 'Bloop\'s Workshop opens the Lab');
must(s.talked.e6 === 1, 'and the next chapter introduces itself');

head('Science and research');
await tab('board');
await set(() => {
  const g = window.__game, s = g.state(), b = g.cells();
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  s.orders = []; s.sci = 0;
  const fr = []; for (let i = 0; i < b.length; i++) if (!b[i]) fr.push(i);
  b[fr[0]] = { id: 'geode' }; window.__t = fr[0];
  window.__board.sync(b);
});
const rcell = await page.evaluate(() => window.__t);
await tapCell(rcell); await page.waitForTimeout(300);
must(await page.locator('#btnRecycle').isVisible(), 'a selected item can be recycled once the Lab exists');
await page.locator('#btnRecycle').click({ force: true }); await page.waitForTimeout(400);
s = await S();
must(s.sci === 9 && !s.boards.earth.some(c => c && c.id === 'geode'), `recycling a tier-3 Geode gives 9 Science (${s.sci})`);
await set(() => { window.__game.state().sci = 100; });
const e0 = await page.evaluate(() => window.__game.maxEnergy());
await tab('lab');
await page.evaluate(() => window.__game.v9.labTab('research')); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('[data-res="battery"]').click()); await page.waitForTimeout(300);
s = await S();
must(s.res.battery === 1 && s.sci === 85, 'Bigger Battery research costs 15 Science');
must(await page.evaluate(() => window.__game.maxEnergy()) === e0 + 8, 'and adds 8 max energy');
await set(() => {
  const g = window.__game, b = g.cells();
  const fr = []; for (let i = 0; i < b.length; i++) if (!b[i]) fr.push(i);
  b[fr[0]] = { id: 'log' }; window.__board.sync(b);
});
await page.evaluate(() => window.__game.v9.labTab('acc')); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#accLoad').click()); await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('[data-acc="log"]').click()); await page.waitForTimeout(400);
s = await S();
must(s.acc && s.acc.id === 'log' && !s.boards.earth.some(c => c && c.id === 'log'), 'the accelerator takes a Log in');
await set(() => { window.__game.state().acc.at = Date.now() - 3600000; window.__game.v9.labTab('acc'); });
await page.evaluate(() => document.querySelector('#accGet').click()); await page.waitForTimeout(500);
s = await S();
must(!s.acc && s.boards.earth.some(c => c && c.id === 'lumber'), 'and hands back a Lumber Pile');
await tab('board');

head('Lucky Wheel, events and Alien Pairs');
await set(() => { const s = window.__game.state(); s.lvl = 6; s.spin = { day: 0, tok: 0 }; s.coins = 1000; s.energy = 0; });
await page.evaluate(() => window.__game.v9.spinPop()); await page.waitForTimeout(400);
before = await S();
await page.evaluate(() => document.querySelector('#spinGo').click()); await page.waitForTimeout(4600);
after = await S();
must(after.spin.day !== 0, 'the daily free spin is used');
must(after.energy > before.energy || after.coins > before.coins || Object.values(after.boost).some(n => n > 0) || after.boards.earth.some(c => c && (c.id === 'chest' || c.id === 'bigchest')), 'and pays something out');
await closeModal();
const evOn = await page.evaluate(() => !!window.__game.v9.evNow());
if (evOn) {
  await set(() => { window.__game.state().ev = { key: '', pts: 0, got: 0 }; });
  await set(() => {
    const g = window.__game, b = g.cells();
    for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
    const fr = []; for (let i = 0; i < b.length; i++) if (!b[i]) fr.push(i);
    b[fr[0]] = { id: 'log' }; b[fr[1]] = { id: 'log' }; window.__t = [fr[0], fr[1]];
    window.__board.sync(b);
  });
  const lc = await page.evaluate(() => window.__t);
  await drag(lc[0], lc[1]);
  s = await S();
  must(s.ev.pts >= 2, `a tier-4 merge earns event points (${s.ev.pts})`);
} else ok('(no event running right now — skipped the points check)');
await page.evaluate(() => window.__game.v9.closePop()); await page.waitForTimeout(300);
await set(() => { const s = window.__game.state(); s.mini.pairs = 0; });
await page.evaluate(() => window.__game.v9.playPairs()); await page.waitForTimeout(400);
must(await page.locator('#mini.open .pCard').count() === 16, 'Alien Pairs deals 16 cards');
const cards = await page.evaluate(() => [...document.querySelectorAll('.pCard')].map(c => c.querySelector('.pFace').innerHTML));
const pairOf = cards.findIndex((h, k) => k > 0 && h === cards[0]);
await page.locator('.pCard').nth(0).click(); await page.locator('.pCard').nth(pairOf).click(); await page.waitForTimeout(900);
must(await page.locator('.pCard.got').count() === 2, 'a matching pair stays face up');
await page.evaluate(() => document.querySelector('#miniClose').click()); await page.waitForTimeout(300);

head('New producers wait for the old ones to be maxed; old ones retire');
await page.evaluate(() => window.__game.view('board'));
await set(() => {
  const g = window.__game, s = g.state(), b = s.boards.earth;
  s.world = 'earth'; s.proj.earth = 5; s.talked = { e6: 1 }; s.coins = 99999; s.store = {};
  for (let i = 0; i < b.length; i++) b[i] = null;
  b[0] = { p: 'tree', lv: 1 }; b[1] = { p: 'rocks', lv: 1 }; b[2] = { p: 'bush', lv: 1, ch: 5, at: Date.now() }; b[3] = { p: 'well', lv: 1 };
  b[10] = { id: 'lumber' }; b[11] = { id: 'lumber' }; b[12] = { id: 'pie' };
  s.cSince = { earth: 9 };
  window.__board.sync(b);
});
await page.evaluate(() => window.__game.v9.chapterSheet()); await page.waitForTimeout(400);
const ups = await page.locator('#pop.open .upRow').count();
must(ups === 3, `chapter 6 asks for the Rock Pile, Berry Bush and Well at max level first, not the retiring tree (${ups})`);
must(await page.locator('#pop.open #btnProject.off').count() === 1, 'and cannot be built yet');
for (let k = 0; k < 6; k++) { const b = page.locator('#pop.open [data-upg]').first(); if (!(await b.count())) break; await b.click({ force: true }); await page.waitForTimeout(250); }
await page.evaluate(() => window.__game.v9.closePop());
await page.evaluate(() => window.__game.v9.buildProject()); await page.waitForTimeout(3000);
await closeModal();
const after6 = await S();
must(!after6.boards.earth.some(c => c && c.p === 'tree'), 'building chapter 6 retires the Big Tree');
must(after6.proj.earth === 6, 'and the chapter is built');
must(after6.boards.earth.some(c => c && c.p === 'rocks' && c.lv === 3), 'the maxed producers stay');

head('Clean-up Bingo');
await set(() => { const g = window.__game, s = g.state(); s.lvl = Math.max(5, s.lvl); s.bingo = null; const bg = g.v9.bingo();
  const b = s.boards[s.world]; let n = 0; for (let i = 0; i < b.length && n < 3; i++) if (!b[i]) { b[i] = { id: bg.cells[n] }; n++; } window.__board.sync(b); });
const c0 = (await S()).coins;
await page.evaluate(() => window.__game.v9.bingoPop()); await page.waitForTimeout(300);
for (let k = 0; k < 3; k++) { await page.evaluate((k) => document.querySelector(`[data-bg="${k}"]`).click(), k); await page.waitForTimeout(250); }
const bgS = await S();
must(bgS.bingo.done.slice(0, 3).every(Boolean), 'handing in three things marks the top row');
must(bgS.coins >= c0 + 60, `and a full row pays (${bgS.coins - c0} coins)`);
await page.evaluate(() => window.__game.v9.closePop());

head('Console');
must(errors.length === 0, errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');

await browser.close();
console.log(process.exitCode ? '\nFAILED' : '\nALL GOOD');
