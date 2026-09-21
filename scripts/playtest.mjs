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
await page.waitForFunction(() => window.__game && window.__board, null, { timeout: 20000 });

const S = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__game.state())));
// A test that pokes state directly has to ask for a repaint; the game itself
// repaints off its own events.
const set = async (fn) => { await page.evaluate(fn); await page.evaluate(() => window.__game.hud()); };
const closeModal = async () => {
  let n = 0;
  while (await page.locator('#modal.open').count() && n++ < 4) {
    if (process.env.MODALS) console.log('   [modal] ' + await page.textContent('#mTitle'));
    await page.click('#mBtn'); await page.waitForTimeout(300);
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
/** switch tabs; story beats and level-ups can pop a modal at any moment */
const tab = async (v) => { await closeModal(); await page.click(`[data-v="${v}"]`); await page.waitForTimeout(500); };
/** fly somewhere and wait for the launch cutscene to finish clearing */
const travel = async (world) => {
  await closeModal();
  await set(() => { window.__game.state().fuel = 3; });
  await closeModal();
  await tab('map');
  // the galaxy is a sub-view of the World tab now
  await page.locator('[data-wt="galaxy"]').click({ force: true });
  await page.waitForTimeout(500);
  await page.locator(`[data-world="${world}"]`).click({ force: true });
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

/* ------------------------------------------------------------------ curve */
head('XP curve is a real climb');
const curve = await page.evaluate(() => {
  const c = window.__game.config;
  return Array.from({ length: 10 }, (_, k) => Math.round(c.xp.base + k * c.xp.perLevel + c.xp.growth * k * k));
});
must(curve[0] === 8 && curve[9] > 250, `levels 1..10 cost ${curve.join(', ')}`);
must(curve.reduce((a, b) => a + b, 0) > 1000, 'over 1000 XP to reach level 11');
const cfg = await page.evaluate(() => window.__game.config);
must(cfg.energy.regenMs >= 30000, `energy trickles back every ${cfg.energy.regenMs / 1000}s`);
must(cfg.meteor.everyMinMs >= 180000, `meteors are at least ${cfg.meteor.everyMinMs / 60000} min apart`);

/* ------------------------------------------------------- merging still works */
head('Producers and merging');
const prodCells = await page.evaluate(() => window.__game.cells().map((c, i) => c && c.p ? i : -1).filter(i => i >= 0));
must(prodCells.length >= 2, `${prodCells.length} producers on the board`);
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
must(maxTxt.endsWith('/85'), `max energy grew to ${maxTxt.split('/')[1]} (50 + 5x5 + 10)`);
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

head('Orders pay you back with rocket pieces');
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
must(await page.locator('#tabLab.hide').count() === 1, 'the Lab tab is hidden before it exists');
await tab('shop');
must(await page.locator('#btnBuildLab').count() === 1, 'a build card appears once the rocket is whole');
await page.locator('#btnBuildLab').click(); await page.waitForTimeout(400);
must((await S()).lab.built !== 1, 'BUILD refuses without the materials');
must((await page.textContent('#toast')).toLowerCase().includes('star scrap'),
  'and says exactly what is missing instead of doing nothing');
await set(() => { const b = window.__game.state().boards.earth; b[14] = { id: 'scrap' }; b[15] = { id: 'scrap' }; });
await tab('board');
await tab('shop');
before = (await S()).coins;
await page.click('#btnBuildLab'); await page.waitForTimeout(700); await closeModal(); await page.waitForTimeout(300);
after = await S();
must(after.lab.built === 1, 'lab built');
must(after.coins < before, `the build spent coins (${before} -> ${after.coins}, minus the mission payout)`);
must(after.boards.earth.filter(c => c && c.id === 'scrap').length === 0, 'the build ate 3 Star Scrap');
must(await page.locator('#tabLab.hide').count() === 0, 'the Lab tab appears once built');

head('Research Lab');
await page.click('#sc-shop .scClose'); await page.waitForTimeout(300);
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  b[12] = { id: 'gem' }; b[13] = { id: 'scrap' };
  s.coins = 4000;
});
await tab('lab');
must(await page.locator('#sc-lab.open').count() === 1, 'lab screen opens');
await shot('lab-empty');
const recipeCount = await page.evaluate(() => window.__game.recipes.length);
must(await page.locator('#labBody [data-learn]').count() === recipeCount, `all ${recipeCount} rumours listed, none spoiled`);

// a dud pair costs the bench fee and consumes nothing
await set(() => { const b = window.__game.state().boards.earth; b[14] = { id: 'twig' }; b[15] = { id: 'twig' }; });
await page.click('[data-slot="0"]'); await page.waitForTimeout(300);
await page.locator('[data-pick="twig"]').click(); await page.waitForTimeout(300);
await page.click('[data-slot="1"]'); await page.waitForTimeout(300);
await page.locator('[data-pick="twig"]').click(); await page.waitForTimeout(300);
before = (await S()).coins;
await page.click('#btnResearch'); await page.waitForTimeout(600);
after = await S();
must(after.coins === before - 40, `a dud costs the 40 coin bench fee (${before} -> ${after.coins})`);
must(after.boards.earth.filter(c => c && c.id === 'twig').length === 2, 'a dud does not eat your samples');

// the real recipe
await page.click('[data-slot="0"]'); await page.waitForTimeout(300);
await page.locator('[data-pick="gem"]').click(); await page.waitForTimeout(300);
await page.click('[data-slot="1"]'); await page.waitForTimeout(300);
await page.locator('[data-pick="scrap"]').click(); await page.waitForTimeout(300);
await shot('lab-loaded');
before = (await S()).coins;
await page.click('#btnResearch'); await page.waitForTimeout(900);
after = await S();
must(after.lab.disc.r1 === 1, 'Star Gem recipe discovered');
must(after.boards.earth.some(c => c && c.id === 'relic1'), 'a Star Gem is on the board');
must(!after.boards.earth.some(c => c && (c.id === 'gem' || c.id === 'scrap')), 'both samples were used up');
must(after.coins === before - 40, `discovering only costs the bench fee (${before} -> ${after.coins})`);
await closeModal(); await page.waitForTimeout(400);
await shot('lab-known');
must(await page.locator('#labBody [data-load="r1"]').count() === 1, 'the recipe is in the lab book, ready to brew again');

head('Fuel does not leave a ghost tile (regression)');
await page.click('#sc-lab .scClose'); await page.waitForTimeout(400);
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
await page.click('#sc-shop .scClose'); await page.waitForTimeout(500);
must(await page.locator('#tools .toolBtn').count() >= 1, 'the bag button appears above the board');
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
await tapUI('#tools .toolBtn'); await page.waitForTimeout(450);
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
await tapUI('#tools .toolBtn[title="Merge Wand"]'); await page.waitForTimeout(900);
after = await S();
const nowItems = await page.evaluate(() => window.__game.cells().filter(c => c && c.id).length);
must(nowItems < before, `the wand merged the board down (${before} -> ${nowItems} items)`);
must(after.boost.wand === 0, 'and used itself up');

await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  for (let i = 0; i < 6; i++) b[i] = { id: 'twig' };
  s.orders = []; s.ship = null;
  window.__board.sync(b);
});
await page.waitForTimeout(400);
before = (await S()).coins;
await tapUI('#tools .toolBtn[title="Tidy Bomb"]'); await page.waitForTimeout(800);
after = await S();
must(after.coins > before, `the bomb sold the clutter for coins (${before} -> ${after.coins})`);
must(after.boards.earth.filter(c => c && c.id === 'twig').length === 0, 'and cleared the board');

head('Rainbow Gem is a wildcard');
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i] && b[i].id) b[i] = null;
  b[20] = { id: 'rainbow' }; b[21] = { id: 'geode' };
  window.__board.sync(b);
});
await page.waitForTimeout(400);
await drag(20, 21);
must(await page.evaluate(() => window.__game.cells()[21]?.id) === 'gem', 'rainbow + geode makes a Gemstone');

head('Cargo ship');
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i]) b[i] = null;
  b[19] = { p: 'tree' }; b[22] = { p: 'rocks' };
  s.lvl = 9; s.ship = null; s.shipAt = Date.now() - 1;
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
await tapUI('.order.ship .btnDeliver'); await page.waitForTimeout(900);
after = await S();
must(after.coins > before && !after.ship, `loading the manifest paid out (${before} -> ${after.coins})`);
must(Object.values(after.boost).some(n => n > 0), 'and threw in a booster');

head('Daily rewards');
// clear it in memory: the game now saves when the tab hides, so a reload would
// otherwise write the live state straight back over a localStorage edit
await set(() => { const s = window.__game.state(); s.daily = { key: 0, day: 0 }; });
await page.reload();
await page.waitForFunction(() => window.__game && window.__board, null, { timeout: 20000 });
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

head('World levels unlock chains');
await set(() => {
  const g = window.__game, s = g.state();
  s.wlv[s.world] = 3; s.wxp[s.world] = 0;
});
await page.evaluate(() => {
  // nudge the world forward the way play would
  const g = window.__game, s = g.state();
  s.wxp[s.world] = 9999; g.hud();
});
await page.waitForTimeout(200);
live = await page.evaluate(() => {
  const g = window.__game, w = g.state().world;
  return Object.values(g.chains).filter(c => c.world === w && c.unlock <= g.wlv(w)).length;
});
must(live > 2, `at world level 3 there are ${live} chains awake`);

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
await tab('map');
await page.locator('[data-wt="camp"]').click({ force: true }); await page.waitForTimeout(400);
let feedTxt = await page.textContent('#btnFeed');
must(/Feed the Heart/.test(feedTxt), `the Heart offers to eat: "${feedTxt.trim()}"`);
await set(() => {
  const g = window.__game, b = g.cells();
  let n = 0;
  for (let i = 0; i < b.length && n < 3; i++) if (!b[i]) { b[i] = { id: 'bloomcore' }; n++; }
  window.__board.sync(b);
});
await page.evaluate(() => window.__game.world());
await page.locator('#btnFeed').click({ force: true }); await page.waitForTimeout(900);
s = await S();
must(s.fed.vela >= 12, `the Heart took ${s.fed.vela} Bloom`);
must(s.stage.vela >= 1, 'and the world woke a stage');
must(await page.locator('#modal.open').count() === 1, 'with a story beat to mark it');
await closeModal();

head('Side games');
await set(() => { const s = window.__game.state(); s.energy = 60; s.mini = {}; });
await tab('map');
await page.locator('[data-game="dig"]').click({ force: true }); await page.waitForTimeout(400);
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
await page.evaluate(() => window.__game.world());
await page.locator('[data-game="brew"]').click({ force: true }); await page.waitForTimeout(400);
must(await page.locator('.brewBar').count() === 1, 'Fuel Brewing opens with a needle');
for (let i = 0; i < 5; i++) { await page.locator('#brewTap').click({ force: true }).catch(() => {}); await page.waitForTimeout(200); }
must(await page.locator('#brewDone').count() === 1, 'and five stirs finish the brew');
await page.locator('#brewDone').click({ force: true }); await page.waitForTimeout(300);

await set(() => { const s = window.__game.state(); s.mini = {}; s.coins = 9000; });
await page.evaluate(() => window.__game.world());
await page.locator('[data-game="market"]').click({ force: true }); await page.waitForTimeout(400);
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
await tab('map');
await page.locator('[data-c="plough"]').click({ force: true }); await page.waitForTimeout(400);
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
  await old.waitForFunction(() => window.__game, null, { timeout: 20000 });
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

head('Producers are batteries, not drip feeds');
await closeModal();
await tab('board');
// by now we are standing on Vela, so use whatever producer this world has
const prod = await page.evaluate(() => {
  const g = window.__game, b = g.cells();
  const i = b.findIndex(c => c && c.p && g.prods[c.p].mode === 'battery');
  return { i, k: b[i].p };
});
await set(() => {
  const g = window.__game, st = g.state(), b = g.cells();
  for (let k = 0; k < b.length; k++) if (b[k] && b[k].id) b[k] = null;
  st.energy = 8;                         // deliberately low: taps must not need it
  const c = b.find(x => x && x.p && g.prods[x.p].mode === 'battery');
  c.lv = 1; c.spent = 0; c.ch = g.capOf(g.prods[c.p], 1);
  window.__board.sync(b);
});
let bat = await page.evaluate(k => {
  const g = window.__game, c = g.cells().find(x => x && x.p === k);
  return { ch: c.ch, cap: g.capOf(g.prods[k], 1), mode: g.prods[k].mode, name: g.prods[k].name };
}, prod.k);
must(bat.mode === 'battery' && bat.cap >= 20, `the ${bat.name} holds ${bat.cap} taps`);
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
await tab('map');
await page.locator('[data-wt="camp"]').click({ force: true }); await page.waitForTimeout(400);
must(await page.locator('.campEnt[data-ent="rocket"]').count() === 1, 'the camp shows your rocket');
must(await page.locator('.campEnt[data-ent="heart"]').count() === 1, 'and the world Heart');
must(await page.locator('.campEnt[data-ent^="p"]').count() >= 2, 'and every producer you own');
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

head('A maxed producer eventually goes to seed');
await tab('board');
await set(() => {
  const g = window.__game, b = g.cells(), st = g.state();
  const c = b.find(x => x && x.p && g.prods[x.p].mode === 'battery');
  c.lv = 4; c.spent = 43; c.ch = 99;
  for (let k = 0; k < b.length; k++) if (b[k] && b[k].id) b[k] = null;
  st.coins = 0;
  window.__board.sync(b);
});
for (let i = 0; i < 3; i++) await tapCell(prod.i);
await page.waitForTimeout(1400);
const seeded = await page.evaluate(i => {
  const g = window.__game, c = g.cells()[i];
  return { p: c && c.p, lv: c && g.plv(c), coins: g.state().coins };
}, prod.i);
must(seeded.lv === 1, `it went to seed and a level-1 ${seeded.p} took its place`);
must(seeded.coins > 0, `paying out ${seeded.coins} coins on the way`);
await closeModal();

head('The quest button and the "where do I get one?" panel');
await tab('board');
await set(() => { const st = window.__game.state(); st.mp = {}; });
const qTxt = await page.textContent('#questTxt');
must(qTxt.length > 4, `the quest button says what to do next: "${qTxt}"`);
await page.locator('#btnQuests').click({ force: true }); await page.waitForTimeout(900);
must(await page.locator('.questRow').count() >= 15, `the quest list shows all ${await page.locator('.questRow').count()} of them`);
must(await page.locator('.questRow.now').count() === 1, 'with the current one called out');
await closeModal();
await page.locator('#orders [data-need]').first().click({ force: true }); await page.waitForTimeout(900);
must(await page.locator('.chainWrap .chStep').count() >= 4, 'tapping a contract item draws its whole chain');
must(await page.locator('.chStep.want').count() === 1, 'with the one they asked for highlighted');
must(await page.locator('.srcBox').count() === 1, 'and points at the producer that starts it');
await closeModal();

head('The guided intro');
{
  const ctx2 = await browser.newContext({ viewport: { width: 430, height: 880 } });
  await ctx2.addInitScript(() => localStorage.removeItem('mergeRocket_v2'));
  const t2 = await ctx2.newPage();
  const tErrs = [];
  t2.on('pageerror', e => tErrs.push(e.message));
  await t2.goto(URL);
  await t2.waitForFunction(() => window.__game, null, { timeout: 20000 });
  await t2.waitForTimeout(2600);
  must(await t2.locator('#tut.on').count() === 1, 'a fresh save opens straight into the intro');
  must(await t2.locator('#modal.open').count() === 0, 'and nothing else pops over it');
  const say1 = await t2.textContent('#tSay');
  await t2.locator('#tNext').click({ force: true }); await t2.waitForTimeout(1200);
  const say2 = await t2.textContent('#tSay');
  must(say2 !== say1, 'it moves on when you press the button');
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

head('Console');
must(errors.length === 0, errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');

await browser.close();
console.log(process.exitCode ? '\nFAILED' : '\nALL GOOD');
