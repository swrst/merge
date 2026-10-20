import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/lilita-one/latin-400.css';
import './style.css';
import './themes/projector.css';
import './themes/holo.css';
import './themes/theme';
import { ART } from './art';
import { startGame } from './game';
import { startProjector } from './themes/projector';
import { hydrateSave, startSaveMirror, setupChrome } from './native';
import { initServices, analytics } from './services';
import { startHoloFix } from './holofix';

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

/* If anything breaks while the game boots, say so on the loading screen and offer
   a way out, instead of leaving the player staring at it forever. "Start fresh"
   keeps the old save under a backup key so it can still be recovered. */
function bootFailed(err: any) {
  const scr = document.getElementById('bootScr'); if (!scr || scr.classList.contains('gone')) return;
  if (scr.querySelector('.bootErr')) return;
  const msg = String((err && (err.message || err.reason || err)) || 'unknown error').slice(0, 160);
  const box = document.createElement('div'); box.className = 'bootErr';
  box.innerHTML = `<b>The game could not start.</b><i>${msg.replace(/</g, '&lt;')}</i>
    <button id="bootRetry">Try again</button><button id="bootFresh" class="soft">Start fresh (your save is backed up)</button>`;
  scr.appendChild(box);
  (document.getElementById('bootRetry') as HTMLElement).onclick = () => location.reload();
  (document.getElementById('bootFresh') as HTMLElement).onclick = () => {
    try { const s = localStorage.getItem('mergeRocket_v2'); if (s) localStorage.setItem('mergeRocket_v2_backup_' + Date.now(), s); localStorage.removeItem('mergeRocket_v2'); } catch (e) { }
    location.reload();
  };
}
window.addEventListener('error', e => { analytics.error(e.error || e.message, 'window'); bootFailed(e.error || e.message); });
window.addEventListener('unhandledrejection', e => { analytics.error((e as any).reason, 'promise'); bootFailed((e as any).reason); });
if (import.meta.env.PROD) setTimeout(() => bootFailed('Loading is taking too long.'), 45000);

async function main() {
  try {
    await hydrateSave();      // pull a native save back into localStorage before boot
    paintHudIcons();
    setupChrome();
    startSaveMirror();
    initServices();
    await startGame();
    startHoloFix();
    startProjector(ART.spriteUi('bot_idle') || ART.spriteUi('pp_buddy') || '', (ov, box) => {
      const k = ov.id === 'rwc' ? 'bot_happy' : ov.id === 'npw' ? 'bot_surprised'
        : ov.classList.contains('csheet') || box.querySelector('.chHead2') ? 'bot_project' : box.querySelector('.enBig') ? 'bot_sleep' : box.querySelector('.cfStamp,.hint,.tipBox') ? 'bot_think' : '';
      return k ? ART.spriteUi(k) : '';
    });
  } catch (err) { console.error(err); analytics.error(err, 'boot'); bootFailed(err); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { main(); });
else main();
