import './style.css';
import { ART } from './art';
import { startGame } from './game';
import { hydrateSave, startSaveMirror, setupChrome } from './native';
import { ads } from './ads';

function paintHudIcons() {
  ['icCoin', 'shopCoinIc', 'labCoinIc'].forEach(id => {
    const e = document.getElementById(id); if (e) e.innerHTML = ART.icon('coin');
  });
  const energy = document.getElementById('icEnergy');
  if (energy) energy.innerHTML = ART.icon('energy');
}

if (import.meta.env.DEV) {
  (window as any).__art = ART;                          // test hooks, dev builds only
  import('./artgen').then(m => { (window as any).__artgen = m; });
}

async function main() {
  await hydrateSave();      // pull a native save back into localStorage before boot
  paintHudIcons();
  setupChrome();
  startSaveMirror();
  ads.init();
  startGame();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { main(); });
else main();
