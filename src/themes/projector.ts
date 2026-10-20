/* Pocket Buddy projector: every popup is a hologram the floating companion
   projects. The companion hovers under the open panel and a beam of light runs
   from its antenna to the panel's bottom edge; the panel "prints" upward out of
   the beam when it opens. Pure decoration: it never takes a tap.

   One element (#holoProj) is moved into whichever overlay is open, so it sits
   above that overlay's dim backdrop and under the panel itself. */
import { getUITheme } from './theme';

const OVERLAYS: [string, string][] = [['#rwc', '.rwcCard'], ['#modal', '.mBoxW'], ['#mini', '.miniBox'], ['#pop', '.popBox']];
const NS = 'http://www.w3.org/2000/svg';
let el: HTMLDivElement | null = null, svg: SVGSVGElement | null = null, bot: HTMLDivElement | null = null;
let openBox: Element | null = null, ro: ResizeObserver | null = null, raf = 0;

function build(src: string) {
  el = document.createElement('div'); el.id = 'holoProj'; el.setAttribute('aria-hidden', 'true');
  svg = document.createElementNS(NS, 'svg') as SVGSVGElement; svg.classList.add('hpBeam');
  svg.innerHTML = `<defs>
      <linearGradient id="hpFill" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e6fffb" stop-opacity=".95"/><stop offset=".5" stop-color="#9ffff2" stop-opacity=".6"/><stop offset="1" stop-color="#8ffff0" stop-opacity=".42"/></linearGradient>
      <linearGradient id="hpRay" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset="1" stop-color="#b8fff3" stop-opacity=".25"/></linearGradient>
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
  const bw = pb.offsetWidth, bh = pb.offsetHeight;
  if (!bw || !bh) { el.classList.remove('on'); return; }
  const bx = x, by = y + bh;
  const room = ov.height - by;                                     // space under the panel
  const size = Math.max(60, Math.min(92, room - 18));
  // the companion hovers under the panel's left third; tight on space, it tucks against the corner
  const cx = Math.max(size / 2 + 6, Math.min(ov.width - size / 2 - 6, bx + bw * 0.2));
  const cy = room > size + 30 ? by + Math.min(room - size / 2 - 10, 24 + size / 2 + 26) : by + size * 0.15;
  bot.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px`;
  el.classList.toggle('tight', room <= size + 30);
  const lx = cx + size * 0.14, ly = cy - size * 0.06;              // the drone's eye (the sprite is mirrored to face the panel)
  const ax = bx + bw * 0.05, bxr = bx + bw * 0.62, ty = by - 3;    // where the light lands
  svg.setAttribute('viewBox', `0 0 ${ov.width} ${ov.height}`);
  svg.querySelector('.hpCone')!.setAttribute('points', `${lx},${ly} ${ax},${ty} ${bxr},${ty}`);
  const m = (ax + bxr) / 2, hw = (bxr - ax) * 0.22;                 // a brighter core down the middle
  svg.querySelector('.hpCore')!.setAttribute('points', `${lx},${ly} ${m - hw},${ty} ${m + hw},${ty}`);
  const set = (q: string, x1: number, y1: number, x2: number, y2: number) => {
    const l = svg!.querySelector(q)!; l.setAttribute('x1', String(x1)); l.setAttribute('y1', String(y1)); l.setAttribute('x2', String(x2)); l.setAttribute('y2', String(y2));
  };
  set('.hpRay.a', lx, ly, ax, ty); set('.hpRay.b', lx, ly, bxr, ty); set('.hpLand', ax, ty, bxr, ty);
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
  if (!found) {
    if (openBox) { el.classList.remove('on'); openBox.classList.remove('hpProjected'); openBox = null; ro?.disconnect(); }
    return;
  }
  const [ov, box] = found;
  if (box === openBox && el.parentElement === ov) return;
  if (openBox) openBox.classList.remove('hpProjected');
  openBox = box;
  if (el.parentElement !== ov) ov.insertBefore(el, ov.firstChild);
  el.classList.remove('on'); void el.offsetWidth;                // restart the beam animation
  box.classList.remove('hpIn'); void (box as HTMLElement).offsetWidth;
  box.classList.add('hpProjected', 'hpIn');
  // the print-in must never leave a panel half-drawn (a paused or throttled animation): done after 0.6 s regardless
  const done = box; setTimeout(() => done.classList.remove('hpIn'), 600);
  el.classList.add('on');
  ro?.disconnect(); ro = new ResizeObserver(() => place()); ro.observe(box);
  follow(700);
}

export function startProjector(src: string) {
  if (!src) return;
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
  window.addEventListener('resize', () => follow(200));
  window.addEventListener('ga:theme', () => update());
  update();
}
