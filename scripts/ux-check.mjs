/* Merge-feel regression: swap, magnet drop, double-tap merge, match glow while
   dragging, rewards flying to the HUD, and the new sound files. Fast (~1 min).
   Usage:  npm run dev   (in another shell)   then  node scripts/ux-check.mjs   */
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
let pw; try { pw = require_('playwright'); } catch { pw = require_('/home/claude/.npm-global/lib/node_modules/playwright'); }
const { chromium } = pw;

const URL = process.env.URL || 'http://localhost:5173/';
const errors = [];
const ok = (m) => console.log(`  ✓ ${m}`);
function must(cond, msg) { if (!cond) { console.error(`  ✗ ${msg}`); process.exitCode = 1; } else ok(msg); }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 440, height: 900 } });
const IGNORE = /ERR_TUNNEL_CONNECTION_FAILED|fonts\.googleapis|ERR_NAME_NOT_RESOLVED/;
page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.addInitScript(() => localStorage.clear());
await page.goto(URL);
await page.waitForFunction(() => window.__game && window.__board, null, { timeout: 45000 });
await page.waitForTimeout(1500);
if (await page.locator('#tSkip').isVisible().catch(() => false)) await page.click('#tSkip');
const shoo = async () => {
  // a new producer flying in, or a reward card: take them
  for (let k = 0; k < 4 && await page.locator('#npw.open #npGo, #rwc.open #rwcGo').count(); k++) { await page.locator('#npw.open #npGo, #rwc.open #rwcGo').first().click({ force: true }); await page.waitForTimeout(900); }
  for (let k = 0; k < 12 && await page.locator('#talk.open').count(); k++) { await page.click('#talk'); await page.waitForTimeout(250); }
  if (await page.locator('#pop.open').count()) { await page.click('#popX', { force: true }); await page.waitForTimeout(250); }
  for (let n = 0; n < 4 && await page.locator('#modal.open').count(); n++) { await page.click('#mBtn'); await page.waitForTimeout(650); }
};
await page.waitForTimeout(2500); await shoo();
// the just-in-time tips dim the screen; this run is about dragging, so mark them seen
await page.evaluate(() => { const s = window.__game.state(); s.tipsOff = 1; window.__game.v9.jitOff(); });

const ids = await page.evaluate(() => {
  const g = window.__game, ch = Object.values(g.chains).find(c => c.world === 'earth' && c.items.length >= 4);
  const other = Object.values(g.chains).find(c => c.world === 'earth' && c !== ch);
  return { a: ch.items[0], a2: ch.items[1], b: other.items[0] };
});
const setBoard = (cells) => page.evaluate(cells => {
  const s = window.__game.state(), b = s.boards[s.world];
  for (let i = 0; i < b.length; i++) b[i] = null;
  for (const [i, c] of Object.entries(cells)) b[+i] = c;
  s.orders = [];
  window.__board.sync(b); window.__game.hud();
}, cells);
const pt = (i) => page.evaluate(i => { const c = window.__board.center(i); const r = document.querySelector('#board canvas').getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y }; }, i);
const cell = (i) => page.evaluate(i => window.__game.cells()[i], i);
const dragTo = async (from, x, y, hold) => {
  const a = await pt(from);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + x) / 2, (a.y + y) / 2, { steps: 5 });
  await page.mouse.move(x, y, { steps: 5 });
  if (hold) await hold();
  await page.mouse.up(); await page.waitForTimeout(600);
};

console.log('\n1. Swap');
await setBoard({ 13: { id: ids.a }, 14: { id: ids.b } });
let p = await pt(14); await dragTo(13, p.x, p.y);
must((await cell(14))?.id === ids.a && (await cell(13))?.id === ids.b, 'dropping on a different item swaps the two');

console.log('\n2. Match glow while dragging');
await setBoard({ 13: { id: ids.a }, 27: { id: ids.a }, 33: { id: ids.a }, 20: { id: ids.b } });
p = await pt(16);
let glows = 0;
await dragTo(13, p.x, p.y, async () => { glows = await page.evaluate(() => window.__board.glows.length); });
must(glows === 2, `both twins glow while one is dragged (${glows})`);
must(await page.evaluate(() => window.__board.glows.length) === 0, 'the glow goes when the drag ends');

console.log('\n3. Magnet drop');
await setBoard({ 0: { id: ids.a }, 15: { id: ids.a }, 16: { id: ids.b } });
// let go over the item next door (16), just off the twin's edge
const t15 = await pt(15), t16 = await pt(16);
await dragTo(0, t16.x - (t16.x - t15.x) * 0.35, t16.y);
must((await cell(15))?.id === ids.a2, 'a near miss onto a neighbour still merges with the twin');
await setBoard({ 0: { id: ids.a }, 15: { id: ids.a } });
{ const q = await pt(16); await dragTo(0, q.x + 4, q.y); }
must((await cell(16))?.id === ids.a && (await cell(15))?.id === ids.a, 'dropping squarely on an empty tile next to the twin just moves it');

console.log('\n4. Double-tap merge');
await setBoard({ 2: { id: ids.a }, 40: { id: ids.a }, 9: { id: ids.a } });
p = await pt(2);
await page.mouse.click(p.x, p.y); await page.waitForTimeout(120); await page.mouse.click(p.x, p.y);
await page.waitForTimeout(700);
must((await cell(9))?.id === ids.a2 && !(await cell(2)) && (await cell(40))?.id === ids.a, 'double-tap merges with the NEAREST twin');
await page.waitForTimeout(500);

console.log('\n5. Rewards fly to the HUD');
await setBoard({ 5: { id: ids.b } });
p = await pt(5);
await page.mouse.click(p.x, p.y); await page.waitForTimeout(450);
await page.locator('#btnSell').click({ force: true });
await page.waitForTimeout(150);
must(await page.locator('.flyIc').count() > 0, 'selling sends coins flying to the counter');
await page.waitForTimeout(3000);
must(await page.locator('.flyIc').count() === 0, 'and they are cleaned up when they land');

console.log('\n6. Sound files');
const missing = await page.evaluate(async () => {
  const out = [];
  for (const n of ['lift', 'land', 'swap', 'hover', 'click', 'nope']) {
    const r = await fetch('/src/audio/' + n + '.ogg'); if (!r.ok) out.push(n);
  }
  return out;
});
must(missing.length === 0, 'lift / land / swap / hover / click / nope are all there' + (missing.length ? ' (missing ' + missing + ')' : ''));

console.log('\n7. One dialog at a time');
await page.evaluate(() => { window.__game.v9.modal('pip', 'First', 'one', 'OK'); window.__game.v9.modal('pip', 'Second', 'two', 'OK'); });
await page.waitForTimeout(300);
must(await page.textContent('#mTitle') === 'First', 'a second dialog does not replace the open one');
await page.click('#mBtn'); await page.waitForTimeout(900);
must(await page.textContent('#mTitle') === 'Second' && await page.locator('#modal.open').count() === 1, 'it shows once the first is closed');
await page.click('#mBtn'); await page.waitForTimeout(500);

console.log('\n8. Contract sheet');
await page.evaluate(() => { const s = window.__game.state(); s.orders = []; window.__game.roll && s.orders.push(window.__game.roll()); window.__game.hud(); });
const oid = await page.evaluate(() => window.__game.state().orders[0]?.id);
await page.evaluate(id => window.__game.v9.contractSheet(id), oid);
await page.waitForTimeout(500);
must(await page.locator('#pop.open.csheet .csNeed').count() >= 1, 'tapping a contract opens the sheet with what it needs');
await page.evaluate(() => window.__game.v9.closePop()); await page.waitForTimeout(400);

console.log('\n9. Just-in-time tips');
await page.evaluate(() => { const s = window.__game.state(); s.coach = {}; s.tipsOff = 0; const b = s.boards[s.world]; for (let i = 0; i < b.length; i++) if (b[i] && !b[i].b) b[i] = null; b[20] = { id: 'chest' }; s.orders = []; window.__board.sync(b); window.__game.hud(); });
await page.waitForFunction(() => window.__game.v9.jitOn(), null, { timeout: 8000 }).catch(() => {});
must(await page.evaluate(() => window.__game.v9.jitOn()), 'a tip lights up the first chest');
await page.mouse.click(10, 500); await page.waitForTimeout(500);
must(!(await page.evaluate(() => window.__game.v9.jitOn())), 'tapping the dark area closes it');

console.log('\n10. Mocked ads and store');
await page.evaluate(() => { const s = window.__game.state(); s.energy = 5; s.adc = { day: 0, n: {} }; window.__game.v9.services.mockControls.ad = 'complete'; window.__game.v9.energyPop(); });
await page.waitForTimeout(500);
await page.locator('#enAd').click({ force: true });
await page.waitForTimeout(3600);
must(await page.evaluate(() => window.__game.state().energy) > 5, 'a finished test video pays out');
await page.evaluate(() => { window.__game.v9.closePop(); const s = window.__game.state(); s.energy = 5; window.__game.v9.services.mockControls.ad = 'skip'; window.__game.v9.energyPop(); });
await page.waitForTimeout(500);
await page.locator('#enAd').click({ force: true });
await page.waitForTimeout(3600);
must(await page.evaluate(() => window.__game.state().energy) === 5, 'a skipped one does not');
await page.evaluate(() => window.__game.v9.closePop());
const g0 = await page.evaluate(() => { const s = window.__game.state(); s.lvl = Math.max(s.lvl, 8); window.__game.v9.services.mockControls.purchase = 'ask'; window.__game.view('shop'); return s.gems; });
await page.waitForTimeout(900);
await page.locator('[data-iap="gems_s"]').click({ force: true }); await page.waitForTimeout(400);
must(await page.locator('.mockSheet').count() === 1, 'buying opens the test purchase sheet');
await page.locator('.mockSheet [data-r="cancelled"]').click(); await page.waitForTimeout(400);
must(await page.evaluate(() => window.__game.state().gems) === g0, 'cancel grants nothing');
await page.locator('[data-iap="gems_s"]').click({ force: true }); await page.waitForTimeout(400);
await page.locator('.mockSheet [data-r="ok"]').click(); await page.waitForTimeout(600);
must(await page.evaluate(() => window.__game.state().gems) === g0 + 80, 'buy grants the gems');
must(await page.evaluate(() => window.__game.v9.services.analytics.recent.some(e => e.name === 'purchase_end')), 'and analytics saw it');
await page.evaluate(() => window.__game.view('board')); await page.waitForTimeout(400);

console.log('\n11. Something to claim is visible');
await shoo();
await page.evaluate(() => { const s = window.__game.state(); s.tipsOff = 1; window.__game.v9.jitOff(); s.pup = s.pup || { at: Date.now(), n: 0 }; s.spin.tok = (s.spin.tok || 0) + 2; s.lvl = Math.max(s.lvl, 10); window.__game.hud(); });
await page.waitForFunction(() => document.querySelector('#ribbon.show'), null, { timeout: 5000 }).catch(async () => console.log('   state:', await page.evaluate(() => ({ view: document.querySelector('.screen.open')?.id, pop: document.querySelector('#pop.open') ? 1 : 0, modal: document.querySelector('#modal.open') ? 1 : 0, talk: document.querySelector('#talk.open') ? 1 : 0, rwc: document.querySelector('#rwc')?.className, rb: document.querySelector('#ribbon')?.className, claims: window.__claims() }))));
must(await page.locator('#ribbon.show').count() === 1, 'a new claimable slides in as a ribbon');
must((await page.textContent('#dotFun')).trim().length > 0 && await page.locator('#dotFun').isVisible(), 'and the dock badge shows a count');
const rbText = (await page.textContent('#ribbon')).trim(); await page.locator('#ribbon .rbGo').click(); await page.waitForTimeout(700);
must(await page.locator('#pop.open, .screen.open').count() >= 1, 'tapping the ribbon goes straight there (' + rbText + ')');
await page.evaluate(() => { window.__game.v9.closePop(); window.__game.view('board'); }); await page.waitForTimeout(400);
const snd = await page.evaluate(async () => { const out = []; for (const n of ['open', 'close', 'tab', 'unlock', 'ready', 'collect', 'blip1', 'amb_earth', 'music_earth_1']) { const r = await fetch('/src/audio/' + n + '.ogg'); if (!r.ok) out.push(n); } return out; });
must(snd.length === 0, 'new ui sounds, voices and music phrases exist' + (snd.length ? ' (missing ' + snd + ')' : ''));

console.log('\n12. Power x2 and the Moon Pup');
const bx = await page.evaluate(() => {
  const g = window.__game, s = g.state(), b = s.boards[s.world];
  for (let i = 0; i < b.length; i++) if (b[i] && !b[i].b) b[i] = null;
  b[10] = { p: 'tree' }; s.lvl = 9; s.boost2 = 1; s.energy = 20; window.__board.sync(b); g.hud();
  return 10;
});
await page.waitForTimeout(600);
{ const q = await pt(bx); await page.mouse.click(q.x, q.y); await page.waitForTimeout(700); }
const after = await page.evaluate(() => { const s = window.__game.state(); return { e: s.energy, items: s.boards[s.world].filter(c => c && c.id).map(c => window.__game.items[c.id].tier) }; });
must(after.e <= 18 && after.items.length === 1 && after.items[0] >= 2, `⚡×2 tap costs double and drops a step higher (energy ${after.e}, tier ${after.items[0]})`);
await page.evaluate(() => { const s = window.__game.state(); s.boost2 = 0; s.pup = { at: 0, n: 4 }; window.__game.hud(); });
await page.waitForTimeout(1200);
await page.locator('.qChip.pup').click({ force: true }); await page.waitForTimeout(900);
must(await page.locator('#rwc.open').count() === 1, 'a ready pup brings a reward card');
await page.locator('#rwcGo').click(); await page.waitForTimeout(700);
must(await page.evaluate(() => window.__game.state().pup.n) === 5, 'collecting it counts toward growing (5 = Puppy)');

console.log('\n13. Console');
must(errors.length === 0, 'no console errors' + (errors.length ? ':\n    ' + errors.slice(0, 5).join('\n    ') : ''));
await page.screenshot({ path: '/tmp/ux-end.png' });
await browser.close();
console.log(process.exitCode ? '\nFAILED' : '\nALL GOOD');
