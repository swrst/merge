import './style.css';
import { ART } from './art';
import { startGame } from './game';
import { hydrateSave, startSaveMirror, setupChrome } from './native';
import { ads } from './ads';

function paintHudIcons() {
  const coin = document.getElementById('icCoin');
  const energy = document.getElementById('icEnergy');
  if (coin) coin.innerHTML = ART.icon('coin');
  if (energy) energy.innerHTML = ART.icon('energy');
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
