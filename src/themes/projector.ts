/* Pocket Buddy projector: every popup is a hologram the floating companion
   projects. The companion hovers under the open panel and a beam of light runs
   from its antenna to the panel's bottom edge; the panel "prints" upward out of
   the beam when it opens. Pure decoration: it never takes a tap.

   One element (#holoProj) is moved into whichever overlay is open, so it sits
   above that overlay's dim backdrop and under the panel itself. */
import { getUITheme } from './theme';

const OVERLAYS: [string, string][] = [['#npw', '.npCard'], ['#rwc', '.rwcCard'], ['#modal', '.mBoxW'], ['#mini', '.miniBox'], ['#pop', '.popBox']];
const NS = 'http://www.w3.org/2000/svg';
let el: HTMLDivElement | null = null, svg: SVGSVGElement | null = null, bot: HTMLDivElement | null = null;
let openBox: Element | null = null, ro: ResizeObserver | null = null, raf = 0;
let poseOf: (ov: Element, box: Element) => string = () => '';
let idleSrc = '';
let mode: 'pop' | 'screen' | 'toast' | 'bar' = 'pop';
const SCREENS = ['#sc-shop', '#sc-rocket', '#sc-book'];

function build(src: string) {
  el = document.createElement('div'); el.id = 'holoProj'; el.setAttribute('aria-hidden', 'true');
  svg = document.createElementNS(NS, 'svg') as SVGSVGElement; svg.classList.add('hpBeam');
  svg.innerHTML = `<defs>
      <linearGradient id="hpFill" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e6fffb" stop-opacity=".95"/><stop offset=".5" stop-color="#eeffdd" stop-opacity=".6"/><stop offset="1" stop-color="#e8ffd0" stop-opacity=".42"/></linearGradient>
      <linearGradient id="hpRay" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset="1" stop-color="#f6ffec" stop-opacity=".25"/></linearGradient>
    </defs>
    <polygon class="hpCone" fill="url(#hpFill)"/><polygon class="hpCore" fill="url(#hpFill)"/>
    <line class="hpRay a" stroke="url(#hpRay)"/><line class="hpRay b" stroke="url(#hpRay)"/>
    <line class="hpLand"/>`;
  bot = document.createElement('div'); bot.className = 'hpBot';
  bot.innerHTML = `<img src="${src}" alt="" draggable="false"><i class="hpLens"></i>`;
  el.append(svg, bot);
}

/** the beam follows the panel: called on open, on resize and while it animates in */
function place() {
  if (!el || !svg || !bot || !openBox || !el.parentElement) return;
  // the panel's own layout box (no transforms): the beam aims where the panel ends up, even mid-animation
  const host = el.parentElement as HTMLElement, pb = openBox as HTMLElement;
  let x = 0, y = 0;
  for (let n: HTMLElement | null = pb; n && n !== host; n = n.offsetParent as HTMLElement | null) { x += n.offsetLeft; y += n.offsetTop; if (!n.offsetParent) break; }
  const ov = { width: host.clientWidth, height: host.clientHeight };
  let bw = pb.offsetWidth, bh = pb.offsetHeight;
  if (mode !== 'pop') {                                            // a toast is centred with a transform: measure where it really is
    const hr = host.getBoundingClientRect(), r = pb.getBoundingClientRect(), k = hr.width / (host.clientWidth || hr.width) || 1;
    x = (r.left - hr.left) / k; y = (r.top - hr.top) / k; bw = r.width / k; bh = r.height / k;
  }
  if (!bw || !bh) { el.classList.remove('on'); return; }
  const bx = x, by = y + bh;
  const room = ov.height - by;                                     // space under the panel
  const small = mode === 'toast' || mode === 'bar';
  const size = small ? 56 : mode === 'screen' ? 68 : Math.max(60, Math.min(92, room - 14));
  // landing line of the light: two points on the edge of the panel facing the companion
  let p1x: number, p1y: number, p2x: number, p2y: number, cx: number, cy: number;
  const barEl = document.getElementById('infoBar');
  const barUp = mode === 'toast' && barEl && barEl.classList.contains('on') && getComputedStyle(barEl).display !== 'none';
  if (mode === 'bar') {
    // the item bar sits low: the companion floats beside its left end (where the storage button was) and lights it from the side
    cx = Math.max(size / 2 + 2, bx - size / 2 - 4); cy = by - bh / 2 + size * 0.12;
    p1x = bx + 2; p1y = by - bh + 5; p2x = bx + 2; p2y = by - 5;
  } else if (barUp) {
    // a message while the item bar is up: the companion stays in its spot beside the bar and lights the message from there
    const hr = host.getBoundingClientRect(), r = barEl!.getBoundingClientRect();
    const bl = r.left - hr.left, bt = r.top - hr.top;
    cx = Math.max(size / 2 + 2, bl - size / 2 - 4); cy = bt + r.height / 2 + size * 0.12;
    p1x = bx + bw * 0.06; p2x = bx + bw * 0.5; p1y = p2y = by - 3;
  } else {
    // popups, full screens and board messages: always BELOW the panel, under its left third, light up onto the bottom edge
    cx = Math.max(size / 2 + 6, Math.min(ov.width - size / 2 - 6, bx + bw * 0.22));
    cy = by + Math.max(size / 2 + 2, Math.min(room - size / 2 - 6, size / 2 + (mode === 'screen' ? 12 : 34)));
    p1x = bx + bw * 0.06; p2x = bx + bw * 0.62; p1y = p2y = by - 3;
  }
  bot.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px`;
  el.classList.toggle('tight', false);
  el.classList.toggle('small', small);
  const lx = cx + size * 0.14, ly = cy - size * 0.06;              // the drone's eye (the sprite is mirrored to face the panel)
  svg.setAttribute('viewBox', `0 0 ${ov.width} ${ov.height}`);
  svg.querySelector('.hpCone')!.setAttribute('points', `${lx},${ly} ${p1x},${p1y} ${p2x},${p2y}`);
  const mx = (p1x + p2x) / 2, my = (p1y + p2y) / 2, hx = (p2x - p1x) * 0.22, hy = (p2y - p1y) * 0.22;   // a brighter core down the middle
  svg.querySelector('.hpCore')!.setAttribute('points', `${lx},${ly} ${mx - hx},${my - hy} ${mx + hx},${my + hy}`);
  const set = (q: string, x1: number, y1: number, x2: number, y2: number) => {
    const l = svg!.querySelector(q)!; l.setAttribute('x1', String(x1)); l.setAttribute('y1', String(y1)); l.setAttribute('x2', String(x2)); l.setAttribute('y2', String(y2));
  };
  set('.hpRay.a', lx, ly, p1x, p1y); set('.hpRay.b', lx, ly, p2x, p2y); set('.hpLand', p1x, p1y, p2x, p2y);
  el.style.setProperty('--lx', lx + 'px'); el.style.setProperty('--ly', ly + 'px');
}

function follow(ms: number) {
  cancelAnimationFrame(raf);
  const until = performance.now() + ms;
  const step = () => { place(); if (performance.now() < until) raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step);
}

function update() {
  if (!el) return;
  let found: [Element, Element] | null = null;
  if (getUITheme() === 'buddy') for (const [o, bsel] of OVERLAYS) {
    const ov = document.querySelector(o);
    if (ov && ov.classList.contains('open')) { const bx = ov.querySelector(bsel); if (bx) { found = [ov, bx]; break; } }
  }
  let m: typeof mode = 'pop';
  if (!found && getUITheme() === 'buddy') {
    // nothing open: the companion projects the board's messages and the item bar instead
    const app = document.getElementById('app'), t = document.getElementById('toast'), bar = document.getElementById('infoBar');
    const sc = SCREENS.map(q => document.querySelector(q)).find(n => n && n.classList.contains('open'));
    if (app && sc) { found = [app, sc]; m = 'screen'; }
    else if (app && t && t.classList.contains('show') && t.textContent) { found = [app, t]; m = 'toast'; }
    else if (app && bar && bar.classList.contains('on') && getComputedStyle(bar).display !== 'none') { found = [app, bar]; m = 'bar'; }
  }
  if (!found) {
    if (openBox) { el.classList.remove('on'); openBox.classList.remove('hpProjected', 'hpBar'); openBox = null; ro?.disconnect(); }
    return;
  }
  const [ov, box] = found;
  if (box === openBox && m !== mode) { mode = m; place(); }
  if (m === 'toast' && openBox === box) place();
  mode = m;
  if (box === openBox && el.parentElement === ov) return;
  if (openBox) openBox.classList.remove('hpProjected', 'hpBar');
  openBox = box;
  if (el.parentElement !== ov) { if (mode === 'pop') ov.insertBefore(el, ov.firstChild); else ov.appendChild(el); }
  el.classList.toggle('onApp', mode !== 'pop');
  el.classList.remove('on'); void el.offsetWidth;                // restart the beam animation
  box.classList.remove('hpIn'); void (box as HTMLElement).offsetWidth;
  if (mode === 'screen') { const im = bot?.querySelector('img'); const w = poseOf(ov, box) || idleSrc; if (im && im.getAttribute('src') !== w) im.setAttribute('src', w); bot?.classList.toggle('noMirror', w.includes('bot_project')); el.classList.add('on'); ro?.disconnect(); ro = new ResizeObserver(() => place()); ro.observe(box); follow(600); return; }
  if (mode !== 'pop') { const im = bot?.querySelector('img'); if (im && im.getAttribute('src') !== idleSrc) im.setAttribute('src', idleSrc); bot?.classList.remove('noMirror'); box.classList.add('hpBar'); el.classList.add('on'); ro?.disconnect(); ro = new ResizeObserver(() => place()); ro.observe(box); follow(500); return; }
  box.classList.add('hpProjected', 'hpIn');
  // the companion's face suits the moment: happy for rewards, surprised for a new find, sleepy when energy runs out
  const img = bot?.querySelector('img'); if (img) { const want = poseOf(ov, box) || idleSrc; if (img.getAttribute('src') !== want) img.setAttribute('src', want); bot?.classList.toggle('noMirror', want.includes('bot_project')); }
  // the print-in must never leave a panel half-drawn (a paused or throttled animation): done after 0.6 s regardless
  const done = box; setTimeout(() => done.classList.remove('hpIn'), 600);
  el.classList.add('on');
  ro?.disconnect(); ro = new ResizeObserver(() => place()); ro.observe(box);
  follow(700);
}

export function startProjector(src: string, pose?: (ov: Element, box: Element) => string) {
  if (!src) return;
  idleSrc = src; if (pose) poseOf = pose;
  build(src);
  const mo = new MutationObserver(() => update());
  OVERLAYS.forEach(([o]) => { const n = document.querySelector(o); if (n) mo.observe(n, { attributes: true, attributeFilter: ['class'], childList: true }); });
  // #rwc is created on demand: watch the app for it to appear
  const app = document.getElementById('app');
  if (app) new MutationObserver(() => {
    OVERLAYS.forEach(([o]) => { const n = document.querySelector(o) as any; if (n && !n.__hp) { n.__hp = 1; mo.observe(n, { attributes: true, attributeFilter: ['class'], childList: true }); } });
    update();                                                      // it may have opened in the same moment it appeared
  }).observe(app, { childList: true });
  OVERLAYS.forEach(([o]) => { const n = document.querySelector(o) as any; if (n) n.__hp = 1; });
  ['toast', 'infoBar', 'sc-shop', 'sc-rocket', 'sc-book'].forEach(id => { const n = document.getElementById(id); if (n) mo.observe(n, { attributes: true, attributeFilter: ['class', 'style'], childList: true }); });
  window.addEventListener('resize', () => follow(200));
  window.addEventListener('ga:theme', () => update());
  update();
}
