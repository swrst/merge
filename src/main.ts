import './style.css';
import { ART } from './art';
import { startGame } from './game';
import { hydrateSave, startSaveMirror, setupChrome } from './native';
import { initServices } from './services';

function paintHudIcons() {
  ['icCoin', 'shopCoinIc', 'labCoinIc'].forEach(id => {
    const e = document.getElementById(id); if (e) e.innerHTML = ART.icon('coin');
  });
  const energy = document.getElementById('icEnergy');
  if (energy) energy.innerHTML = ART.icon('energy');
  const gem = document.getElementById('icGem');
  if (gem) gem.innerHTML = ART.icon('gem');
}

if (import.meta.env.DEV) {
  (window as any).__art = ART;                          // test hooks, dev builds only
  import('./artgen').then(m => { (window as any).__artgen = m; });
}

/* One layout, any screen. The game is designed for a 400 x 860 phone; on
   anything else the whole shell is CSS-zoomed so it fills the height, and on a
   wide screen (a tablet on its side, a desktop) it stays a tall column with the
   world painted around it. */
const BASE_W = 400, BASE_H = 860, MAX_W = 470;
function fit() {
  const app = document.getElementById('app'); if (!app) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  const k = Math.max(0.8, Math.min(2.6, Math.min(vw / BASE_W, vh / BASE_H)));
  const w = Math.min(vw / k, MAX_W), h = vh / k;
  (window as any).__zk = k;
  app.style.width = w + 'px'; app.style.height = h + 'px'; app.style.maxHeight = 'none';
  (app.style as any).zoom = String(k);
  document.body.classList.toggle('wide', w * k < vw - 2);
}
fit();
window.addEventListener('resize', fit);

async function main() {
  await hydrateSave();      // pull a native save back into localStorage before boot
  paintHudIcons();
  setupChrome();
  startSaveMirror();
  initServices();
  startGame();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { main(); });
else main();
