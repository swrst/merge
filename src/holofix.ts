/* The hologram look is dark glass. Dozens of older popups were drawn for light
   panels: white cards, dark text. Rather than chase every class, this pass looks
   at what the browser actually painted inside a dark panel and fixes it:
   - a near-white card or chip becomes a translucent glass card;
   - dark text that ends up on dark glass becomes light.
   Coloured things (gold, green, red buttons, item art) are left alone. */
const ROOTS = '#pop .popBox, #modal .mBoxW, .screen:not(.scene), #rwc .rwcCard, #xpScr, #mini .miniBox';
const lum = (r: number, g: number, b: number) => {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const parse = (c: string) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b, a = 1] = m.map(Number); return { r, g, b, a }; };
const sat = (c: { r: number; g: number; b: number }) => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return mx ? (mx - mn) / mx : 0; };
/** a pale, unsaturated fill: the old white / pastel cards */
function paleFill(cs: CSSStyleDeclaration) {
  const bc = parse(cs.backgroundColor);
  if (bc && bc.a > 0.4 && lum(bc.r, bc.g, bc.b) > 0.55 && sat(bc) < 0.3) return true;
  const bi = cs.backgroundImage;
  if (bi && bi.includes('gradient') && !bi.includes('url(')) {
    const cols = (bi.match(/rgba?\([^)]*\)/g) || []).map(parse).filter(Boolean) as any[];
    const solid = cols.filter(c => c.a > 0.4);
    if (solid.length && solid.every(c => lum(c.r, c.g, c.b) > 0.55 && sat(c) < 0.35)) return true;
  }
  return false;
}
/** a coloured fill a dark word can sit on (a gold or green button, a pill) */
function colouredFill(cs: CSSStyleDeclaration) {
  const bc = parse(cs.backgroundColor);
  if (bc && bc.a > 0.5 && lum(bc.r, bc.g, bc.b) > 0.25) return true;
  const bi = cs.backgroundImage;
  if (bi && bi.includes('gradient') && !bi.includes('url(') && !bi.includes('conic')) {
    const cols = (bi.match(/rgba?\([^)]*\)/g) || []).map(parse).filter(Boolean) as any[];
    const solid = cols.filter(c => c.a > 0.5);
    if (solid.length && solid.reduce((t, c) => t + lum(c.r, c.g, c.b), 0) / solid.length > 0.25) return true;
  }
  return false;
}
function fix(root: Element) {
  root.querySelectorAll<HTMLElement>('*').forEach(el => {
    if (el.dataset.hf || el instanceof SVGElement || el.tagName === 'IMG' || el.tagName === 'CANVAS') return;
    const cs = getComputedStyle(el);
    if (paleFill(cs)) {
      el.classList.add('hfCard'); el.dataset.hf = '1';
      el.style.setProperty('background', 'linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.03))', 'important');
      el.style.setProperty('box-shadow', 'inset 0 0 0 1px rgba(200,170,255,.30),inset 0 1px 0 rgba(255,255,255,.10)', 'important');
    }
  });
  root.querySelectorAll<HTMLElement>('*').forEach(el => {
    if (el.tagName === 'IMG' || el instanceof SVGElement) return;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && (n.textContent || '').trim().length > 0);
    if (!own) return;
    const c = parse(getComputedStyle(el).color); if (!c || lum(c.r, c.g, c.b) > 0.18) return;
    // dark words: fine on a coloured button or pill, wrong on the dark glass
    for (let e: HTMLElement | null = el; e && e !== root.parentElement; e = e.parentElement) {
      if (e.classList.contains('hfCard')) break;
      if (colouredFill(getComputedStyle(e))) return;
    }
    el.classList.add('hfInk');
    el.style.setProperty('color', '#f3eeff', 'important');
  });
}
let queued = false;
function run() {
  queued = false;
  document.querySelectorAll(ROOTS).forEach(r => { const st = getComputedStyle(r); if (st.display !== 'none' && st.visibility !== 'hidden') fix(r); });
}
export function startHoloFix() {
  const mo = new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => requestAnimationFrame(run)); } });
  mo.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  run();
}
