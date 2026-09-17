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
const tapCell = async (i) => {
  const p = await page.evaluate(i => { const c = window.__board.center(i); const r = document.querySelector('#board canvas').getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, i);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(90);
};
const pt = (i) => page.evaluate(i => { const c = window.__board.center(i); const r = document.querySelector('#board canvas').getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, i);
const drag = async (from, to) => {
  const a = await pt(from), b = await pt(to);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(500);
};
const closeModal = async () => {
  if (await page.locator('#modal.open').count()) { await page.click('#mBtn'); await page.waitForTimeout(250); }
};
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
await page.locator('#shopBody [data-up="orders"]').click(); await page.waitForTimeout(500);
must((await page.locator('.order').count()) === 4, 'Order Board adds a 4th order card');

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
must(await page.locator('#btnBuildLab[disabled]').count() === 1, 'BUILD is blocked without the materials');
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
must(await page.locator('#labBody [data-learn]').count() === 6, '6 rumours listed, none spoiled');

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
await set(() => {
  const s = window.__game.state(), b = s.boards.earth;
  for (let i = 0; i < b.length; i++) if (b[i]) b[i] = null;
  s.energy = 60;
  b[10] = { p: 'crater', u: 6 };
  window.__board.sync(b);
});
await page.waitForTimeout(300);
for (let n = 0; n < 6; n++) await tapCell(10);
await page.waitForTimeout(900);
const crater = await page.evaluate(() => {
  const g = window.__game, out = { gone: !g.cells()[10], ore: 0, scrap: 0 };
  g.cells().forEach(c => { if (c && c.id === 'fuelore') out.ore++; if (c && c.id === 'scrap') out.scrap++; });
  return out;
});
must(crater.gone, 'the crater collapses after its last dig');
must(crater.ore >= 2, `it gave ${crater.ore} Fuel Ore and ${crater.scrap} Star Scrap`);
must(await page.evaluate(() => !window.__game.prods.fuelpod), 'the free Fuel Pod producer is gone from the game');

head('Catalogue');
await page.click('[data-v="book"]'); await page.waitForTimeout(500);
must((await page.locator('#bookBody .catBar').count()) === 1, 'collection bar shown');
must((await page.textContent('#bookBody')).includes('Relics'), 'the Relics chain appears once unlocked');
await shot('book');
await page.click('#sc-book .scClose'); await page.waitForTimeout(300);

/* --------------------------------------------------------------- full arc */
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

head('Console');
must(errors.length === 0, errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');

await browser.close();
console.log(process.exitCode ? '\nFAILED' : '\nALL GOOD');
