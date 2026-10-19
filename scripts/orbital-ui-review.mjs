/** Real-game visual review. Uses a fresh isolated browser context, never a player's save.
 * npm run dev, then node scripts/orbital-ui-review.mjs (requires Playwright).
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('ui-review', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 440, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.URL || 'http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__game && window.__board, null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  if (await page.locator('#tSkip').isVisible()) await page.locator('#tSkip').click({ force: true });
  await page.evaluate(() => {
    const g = window.__game, s = g.state();
    s.tipsOff = 1; s.tut = 1; s.lvl = 12; s.coins = 2000; s.sci = 50;
    s.lab.built = 1; s.lab.offered = 1; s.shopSeen = 1; s.story.stars = 1;
    g.v9.achOff(); g.v9.jitOff(); g.hud();
  });
  await page.waitForTimeout(1500);
  async function clear() {
    await page.evaluate(() => {
      const g = window.__game;
      g.v9.closePop(); g.v9.xp.hide(); g.view('board');
      // Dismiss presentation-only queued story overlays in this test fixture.
      document.querySelectorAll('#talk,#modal,#pop,#npw,#rwc,#chFan,#skyChart,#mini,#xpPanel').forEach(e => e.classList.remove('open'));
    });
  }
  async function shot(name) {
    await page.waitForTimeout(450);
    await page.evaluate(() => Promise.race([
      Promise.all([...document.images].filter(i => i.getBoundingClientRect().width && i.getBoundingClientRect().height).map(i => i.complete ? null : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))),
      new Promise(r => setTimeout(r, 5000)),
    ]));
    await page.screenshot({ path: `ui-review/${name}.png` });
    const info = await page.evaluate(() => ({
      theme: document.documentElement.dataset.uiTheme,
      bodyOverflow: document.body.scrollWidth > innerWidth + 1,
      brokenImages: [...document.images].filter(i => i.getBoundingClientRect().width && i.getBoundingClientRect().height && i.complete && !i.naturalWidth).map(i => i.getAttribute('src')),
    }));
    checks.push({ name, ...info });
    assert.equal(info.bodyOverflow, false, `${name}: horizontal page overflow`);
    assert.equal(info.brokenImages.length, 0, `${name}: broken visible image`);
    console.log('Captured', name);
  }
  await clear(); await shot('01-board');
  await page.evaluate(() => { const g=window.__game,s=g.state(),b=g.cells();s.orders[0].needs=[{id:'twig',qty:1}];const i=b.findIndex(c=>!c);if(i>=0)b[i]={id:'twig'};g.hud(); });
  await shot('01b-ready-contract');
  const ready=page.locator('.order.ready .oTick').first();
  const style=await ready.evaluate(e=>({filter:getComputedStyle(e).filter,radius:getComputedStyle(e).borderRadius,glyph:getComputedStyle(e,'::after').content}));
  assert.equal(style.filter,'none');assert.equal(style.radius,'50%');assert.ok(style.glyph.includes('✓'));
  const xp=await page.locator('.hud .lvlBox .xpwrap').evaluate(e=>({background:getComputedStyle(e).backgroundColor,shadow:getComputedStyle(e).boxShadow}));
  assert.equal(xp.background,'rgba(0, 0, 0, 0)');assert.equal(xp.shadow,'none');
  const coins=await page.evaluate(()=>window.__game.state().coins);await ready.click();assert.ok(await page.evaluate(()=>window.__game.state().coins)>coins);

  for (const [v,n] of [['rocket','02-missions'],['shop','03-shop'],['book','04-collection'],['map','05-camp'],['lab','07-lab']]) {
    await clear(); await page.evaluate(v => window.__game.view(v), v); await shot(n);
    if (v === 'map') { await page.locator('[data-pop="galaxy"]').click(); await shot('06-galaxy'); }
  }
  for (const [name,fn] of [['08-album','albumPop'],['09-achievements','achPop'],['10-storage','storagePop'],['11-energy','energyPop'],['12-profile','profilePop'],['13-star-chart','starChart'],['14-chapter','chapterSheet'],['15-quests','questsPop'],['16-games','funPop'],['17-wheel','spinPop']]) {
    await clear(); await page.evaluate(fn => window.__game.v9[fn](), fn); await shot(name);
  }
  for (const [n,t] of [['18-lab-upgrades','research'],['19-lab-time-boost','acc']]) {
    await clear(); await page.evaluate(t => window.__game.v9.labTab(t), t); await shot(n);
  }
  await clear(); await page.evaluate(() => window.__game.v9.xp.show()); await page.waitForTimeout(500); if (await page.locator('#xpPClose').isVisible()) await page.locator('#xpPClose').click(); await shot('20-expedition');
  for (const [id,name] of [['xpLog','21-expedition-log'],['xpGoals','22-expedition-medals'],['xpHelp','23-expedition-help']]) {
    await page.locator('#'+id).click(); await shot(name);
    await page.locator('#xpPClose').click();
  }
  await clear(); await page.locator('#btnGear').click(); await shot('24-settings');
  async function switchTheme() {
    await page.waitForFunction(() => typeof document.querySelector('#themeBtn')?.onclick === 'function');
    const result = await page.evaluate(() => {
      const snapshot = () => { const s=window.__game.state();return JSON.stringify([s.coins,s.gems,s.lvl,s.boards]); };
      const before = snapshot(), saved = localStorage.getItem('mergeRocket_v2');
      document.querySelector('#themeBtn').click();
      return { before, after: snapshot(), saved, savedAfter: localStorage.getItem('mergeRocket_v2') };
    });
    assert.equal(result.after,result.before,'theme switch preserves inventory and balances');
    assert.equal(result.savedAfter,result.saved,'theme switch leaves the game save untouched');
  }
  await switchTheme();
  assert.equal(await page.locator('html').getAttribute('data-ui-theme'),'classic');
  await shot('25-classic-preserved');
  await page.reload(); await page.waitForFunction(() => window.__game && window.__board, null, { timeout: 90000 });
  assert.equal(await page.locator('html').getAttribute('data-ui-theme'),'classic');
  await clear(); await page.locator('#btnGear').click(); await switchTheme();
  assert.equal(await page.locator('html').getAttribute('data-ui-theme'),'buddy');
  await clear(); await shot('26-buddy-restored');
  await page.setViewportSize({width:360,height:740});
  await page.evaluate(()=>window.__game.view('rocket'));await shot('27-small-missions');
  await clear();await page.locator('#btnGear').click();await shot('28-small-settings');
  await clear(); await page.evaluate(()=>window.__game.view('map')); await page.locator('[data-pop="galaxy"]').click(); await shot('29-small-galaxy');
  await clear(); await page.evaluate(()=>window.__game.v9.starChart()); await shot('30-small-star-chart');
  assert.equal(errors.length,0,errors.join('\n'));
} finally {
  await writeFile('ui-review/report.json',JSON.stringify({errors,checks},null,2));
  await browser.close();
}
