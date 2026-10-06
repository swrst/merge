/* A new-player bot: plays a fresh save the way a person would (contracts first,
   then chapters, then merges, then producer taps) and reports the pacing —
   how many actions and how much waiting each chapter takes, where coins come
   from, and anything that got stuck. Time is warped when the bot has to wait
   for energy or charges, so the report shows "minutes a real player waits".

   Usage:  npm run dev  (other shell)   then   node scripts/bot.mjs [chapters] */
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
let pw; try { pw = require_('playwright'); } catch { pw = require_('/home/claude/.npm-global/lib/node_modules/playwright'); }
const URL = process.env.URL || 'http://localhost:5173/';
const GOAL = +(process.argv[2] || 8);
const OUT = process.env.OUT || '/tmp/bot';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 400, height: 860 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts\.g|ERR_NAME/.test(m.text())) errs.push(m.text()); });
await page.addInitScript(() => {
  localStorage.clear();
  const real = Date.now.bind(Date); (window).__warp = 0;
  Date.now = () => real() + (window).__warp;
});
await page.goto(URL);
await page.waitForFunction(() => window.__game && window.__board, null, { timeout: 60000 });
await page.waitForTimeout(1500);
if (await page.locator('#tSkip').isVisible().catch(() => false)) await page.click('#tSkip');
await page.evaluate(() => { window.__game.state().tipsOff = 1; window.__game.v9.jitOff(); });

/* one decision per call, made inside the page so it sees exactly what the game sees */
const step = () => page.evaluate(() => {
  const g = window.__game, S = g.state(), b = g.cells(), bd = window.__board;
  const open = (sel) => !!document.querySelector(sel);
  if (open('#talk.open')) { document.querySelector('#talk').click(); return 'talk'; }
  if (open('#modal.open')) { document.querySelector('#mBtn').click(); return 'modal:' + document.querySelector('#mTitle').textContent; }
  if (open('#pop.open')) { g.v9.closePop(); return 'closepop'; }
  if (open('#mini.open')) { const c = document.querySelector('#miniClose'); if (c) c.click(); return 'closemini'; }
  if (document.querySelector('.screen.open')) { g.view('board'); return 'board'; }
  // a ready contract
  const rc = document.querySelector('#orders .order.ready');
  if (rc) { rc.click(); return 'deliver'; }
  // a chapter ready to build
  const q = document.querySelector('#btnQuests.ready');
  if (q) { q.click(); return 'build'; }
  // the chapter wants producers maxed first: upgrade one when the coins are there
  const pj0 = g.curProject ? g.curProject() : null;
  if (pj0) {
    const ups = g.v9.upNeeds(pj0);
    for (const u of ups) {
      const at = b.findIndex(c => c && c.p === u.k && !c.tmp);
      if (at >= 0 && S.coins >= g.v9.upCost(g.prods[u.k], u.lv)) { g.v9.upgradeProducer(at); return 'upgrade:' + u.k; }
    }
  }
  // what the open contracts and the chapter still want
  const want = new Set();
  S.orders.forEach(o => o.needs.forEach(nd => want.add(nd.id)));
  // the chapter's needs count as wanted too (that is what the strip tells you)
  const pj = g.curProject ? g.curProject() : null;
  if (pj) pj.needs.forEach(([id]) => want.add(id));
  // chests are presents: open them
  const chest = b.findIndex(c => c && c.id && /chest/.test(c.id) && !c.bub);
  if (chest >= 0 && b.filter(c => !c).length >= 3) { const nm = b[chest].id; bd.hooks.onTap(chest); return 'chest:' + nm; }
  const chainOf = id => g.items[id].chain;
  const wantedChains = new Set([...want].map(chainOf));
  // finished chains go on the trophy shelf instead of cluttering the board
  const crown = b.findIndex(c => c && c.id && !c.bub && !want.has(c.id) && !g.chains[g.items[c.id].chain].items[g.items[c.id].tier] && !/chest/.test(c.id));
  if (crown >= 0) { const nm = b[crown].id; bd.hooks.onTap(crown); const sb = document.querySelector('#btnShow'); if (sb && sb.style.display !== 'none') { sb.click(); return 'shelf:' + nm; } }
  // merge: prefer pairs in a chain someone wants, never merge away a wanted item
  const pos = {};
  b.forEach((c, i) => { if (c && c.id && !c.bub) (pos[c.id] = pos[c.id] || []).push(i); });
  let best = null;
  for (const id in pos) {
    if (pos[id].length < 2) continue;
    const nx = g.chains[chainOf(id)].items[g.items[id].tier];
    if (!nx) continue;
    const need = S.orders.reduce((a, o) => a + o.needs.filter(nd => nd.id === id).reduce((x, nd) => x + nd.qty, 0), 0)
      + (pj ? pj.needs.filter(([x]) => x === id).reduce((a2, [, q]) => a2 + q, 0) : 0);
    if (pos[id].length - need < 2 && want.has(id)) continue;
    const score = (wantedChains.has(chainOf(id)) ? 10 : 0) + (want.has(nx) ? 20 : 0) - g.items[id].tier;
    if (!best || score > best.score) best = { id, score };
  }
  if (best) { const [a, c] = pos[best.id].slice(-2); bd.hooks.onDrop(a, c); return 'merge:' + best.id; }
  // tap a producer that feeds a wanted chain, else any producer with charge
  const free = b.filter(c => !c).length;
  if (free > 0) {
    const prods = b.map((c, i) => c && c.p && !c.b ? i : -1).filter(i => i >= 0);
    const ok = i => {
      const c = b[i], p = g.prods[c.p];
      if (p.mode === 'energy') return S.energy >= g.ecost(p, g.plv(c));
      if (p.mode === 'battery') return (c.ch || 0) > 0;
      return true;
    };
    // what is still missing, weighted: a chain nobody has started counts most
    const have = id => b.filter(c => c && c.id === id).length + ((S.wal && S.wal[id]) || 0);
    const urgent = {};
    S.orders.forEach(o => o.needs.forEach(nd => { if (have(nd.id) < nd.qty) urgent[chainOf(nd.id)] = (urgent[chainOf(nd.id)] || 0) + 3; }));
    if (pj) pj.needs.forEach(([id, q]) => { if (have(id) < q) urgent[chainOf(id)] = (urgent[chainOf(id)] || 0) + 4; });
    const score = i => g.prods[b[i].p].drops.reduce((a, d) => a + (urgent[chainOf(d)] || 0) + (wantedChains.has(chainOf(d)) ? 0.5 : 0), 0) + Math.random();
    const pick = prods.filter(ok).sort((x, y) => score(y) - score(x))[0];
    if (pick !== undefined) { const nm = b[pick].p; bd.hooks.onTap(pick); return 'tap:' + nm; }
  }
  // stuck: sell the least useful item if the board is full
  if (free === 0) {
    const cand = b.map((c, i) => c && c.id && !want.has(c.id) ? i : -1).filter(i => i >= 0);
    if (cand.length) { const i = cand[0]; const nm = b[i].id; bd.hooks.onTap(i); const sb = document.querySelector('#btnSell'); if (sb) sb.click(); return 'sell:' + nm; }
    return 'fullstuck';
  }
  return 'wait';
});

const log = []; const _push = log.push.bind(log); log.push = (...x) => { x.forEach(l => console.log(l)); return _push(...x); };
let chap = 0, actions = 0, warp = 0, waits = 0, sells = 0, lastChapAt = { actions: 0, warp: 0, coins: 0 };
const t0 = Date.now();
const snap = async () => page.evaluate(() => { const S = window.__game.state(); return { coins: S.coins, energy: S.energy, lvl: S.lvl, proj: S.proj[S.world] || 0, free: window.__game.cells().filter(c => !c).length, orders: S.orders.length, gems: S.gems }; });
let stall = 0;
while (Date.now() - t0 < 25 * 60 * 1000) {
  const a = await step(); actions++;
  if (a === 'wait' || a === 'fullstuck') {
    // nothing to do: a real player waits. Jump time forward one minute.
    await page.evaluate(() => { window.__warp += 60000; }); warp++; waits++; stall++;
    await page.waitForTimeout(700);
    if (stall > 240) { log.push('STALLED for 4 virtual hours'); break; }
  } else stall = 0;
  if (a.startsWith('sell')) sells++;
  await page.waitForTimeout(a.startsWith('merge') || a.startsWith('tap') ? 160 : 420);
  const s = await snap();
  if (s.proj > chap) {
    chap = s.proj;
    log.push(`chapter ${chap} built: +${actions - lastChapAt.actions} actions, +${warp - lastChapAt.warp} min waiting, coins ${s.coins}, lvl ${s.lvl}, energy ${s.energy}, sells so far ${sells}`);
    lastChapAt = { actions, warp, coins: s.coins };
    await page.screenshot({ path: `${OUT}/ch${chap}.png` });
    if (chap >= GOAL) break;
  }
  if (actions % 150 === 0) {
    const diag = await page.evaluate(() => { const g = window.__game, S = g.state(), b = g.cells();
      const src = id => { const base = g.chains[g.items[id].chain].items[0]; return b.some(c => c && c.p && g.prods[c.p].drops.includes(base)) ? 'src' : 'NOSRC'; };
      const have = id => b.filter(c => c && c.id === id).length + ((S.wal && S.wal[id]) || 0);
      const pj = g.curProject();
      return S.orders.map(o => o.needs.map(nd => `${nd.id}(t${g.items[nd.id].tier}) ${have(nd.id)}/${nd.qty} ${src(nd.id)}`).join(' + ')).join(' | ')
        + ' || CH: ' + (pj ? pj.needs.map(([id, q]) => `${id} ${have(id)}/${q} ${src(id)}`).join(', ') + ' coins ' + pj.coins : '-'); });
    log.push('   orders: ' + diag);
    log.push(`… ${actions} actions, ${warp} min waited, ${JSON.stringify(s)}`); await page.screenshot({ path: `${OUT}/a${actions}.png` }); }
}

console.log(`\ntotal ${actions} actions, ${warp} virtual minutes waited, ${sells} sells, ${((Date.now() - t0) / 60000).toFixed(1)} real min`);
console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].slice(0, 10).join('\n') : 'no errors');
await page.screenshot({ path: `${OUT}/end.png` });
await browser.close();
