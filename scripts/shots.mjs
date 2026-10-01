/* Dev helper: screenshots of the main screens.  node scripts/shots.mjs <outdir> */
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
let pw; try { pw = require_('playwright'); } catch { pw = require_('/home/claude/.npm-global/lib/node_modules/playwright'); }
const OUT = process.argv[2] || '/tmp/shots';
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(process.env.URL || 'http://localhost:5173/');
await page.waitForFunction(() => window.__game && window.__board, null, { timeout: 60000 });
await page.locator('#tSkip').click({ force: true }).catch(() => {});
await page.waitForTimeout(800);
const setup = process.env.SETUP;
if (setup) { await page.evaluate(setup); await page.evaluate(() => window.__game.hud()); await page.waitForTimeout(800); }
const shot = async (n) => { await page.waitForTimeout(1600); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const close = async () => { await page.evaluate(() => { document.querySelectorAll('.modal.open,#modal.open').forEach(m => m.classList.remove('open')); }); };
await close(); await shot('board');
for (const v of (process.env.VIEWS || 'rocket,shop,lab,book,map').split(',')) {
  await page.evaluate(v => window.__game.view ? window.__game.view(v) : document.querySelector(`[data-v="${v}"]`)?.click(), v);
  await shot(v); await page.evaluate(() => window.__game.view('board'));
}
for (const [n, js] of (process.env.EXTRA ? JSON.parse(process.env.EXTRA) : [])) { await page.evaluate(js); await shot(n); }
console.log(errs.join('\n') || 'ok');
await browser.close();
