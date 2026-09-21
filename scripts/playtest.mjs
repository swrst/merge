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
const set = (fn) => page.evaluate(fn);
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
await page.click('[data-v="shop"]'); await page.waitForTimeout(500);
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
await page.click('[data-v="shop"]'); await page.waitForTimeout(500);
must(await page.locator('#btnBuildLab').count() === 1, 'a build card appears once the rocket is whole');
await page.locator('#btnBuildLab').click(); await page.waitForTimeout(400);
must((await S()).lab.built !== 1, 'BUILD refuses without the materials');
must((await page.textContent('#toast')).toLowerCase().includes('star scrap'),
  'and says exactly what is missing instead of doing nothing');
await set(() => { const b = window.__game.state().boards.earth; b[14] = { id: 'scrap' }; b[15] = { id: 'scrap' }; });
await page.click('[data-v="board"]'); await page.waitForTimeout(250);
await page.click('[data-v="shop"]'); await page.waitForTimeout(400);
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
await page.click('[data-v="lab"]'); await page.waitForTimeout(500);
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
await page.click('[data-v="book"]'); await page.waitForTimeout(500);
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
await page.click('[data-v="shop"]'); await page.waitForTimeout(600);
const shopDiag = await page.evaluate(() => ({
  open: !!document.querySelector('#sc-shop.open'),
  lvl: window.__game.state().lvl,
  coins: window.__game.state().coins,
  rows: document.querySelectorAll('#shopBody [data-up]').length,
  bagBtn: !!document.querySelector('[data-up="bag"]'),
  disabled: document.querySelector('[data-up="bag"]')?.disabled,
}));
if (!shopDiag.open || !shopDiag.bagBtn || shopDiag.disabled) console.log('   [shop]', JSON.stringify(shopDiag));
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
  const ids = ['twig', 'branch', 'log', 'lumber', 'pebble', 'rock', 'geode', 'gem',
    'berry', 'berries', 'jam', 'pie', 'scrap', 'starcore', 'bolt', 'boltpack',
    'spring', 'coil', 'wire', 'circuit', 'glass', 'tankglass', 'fuelore', 'fuelcan',
    'cart', 'statue', 'cake', 'ember', 'cinder', 'lavablob', 'fireopal', 'suncore',
    'sporecap', 'shroom', 'bigshroom', 'glowcap', 'shroomtree', 'mrock', 'mcrystal',
    'mcore', 'mstar', 'moonorb', 'spore', 'bulb', 'glowflower', 'starbloom', 'glowtree', 'relic1'];
  for (let i = 0; i < b.length; i++) b[i] = { id: ids[i] };
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
await page.click('[data-v="map"]'); await page.waitForTimeout(500);
await page.locator('[data-go="luna"]').click();
await page.waitForTimeout(3600); await closeModal(); await page.waitForTimeout(400);
s = await S();
must(s.world === 'luna', 'landed on Luna');
await shot('luna');

head('And on to Cindra');
await closeModal();
await set(() => { const st = window.__game.state(); st.fuel = 3; });
await closeModal();
await page.click('[data-v="map"]'); await page.waitForTimeout(600);
await page.locator('[data-go="cindra"]').click();
await page.waitForTimeout(3600); await closeModal(); await page.waitForTimeout(400);
s = await S();
must(s.world === 'cindra', 'landed on Cindra');
must(s.boards.cindra.some(c => c && c.p === 'lavavent'), 'with a Lava Vent to tap');
await shot('cindra');

head('Console');
must(errors.length === 0, errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');

await browser.close();
console.log(process.exitCode ? '\nFAILED' : '\nALL GOOD');
