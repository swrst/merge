/** Visual preferences are separate from the game save. Existing art and theme remain intact. */
export type UITheme = 'buddy' | 'classic';
const KEY = 'galaxyAdventure.uiTheme';
export function getUITheme(): UITheme {
  return document.documentElement.dataset.uiTheme === 'classic' ? 'classic' : 'buddy';
}
export function setUITheme(theme: UITheme) {
  document.documentElement.dataset.uiTheme = theme;
  try { localStorage.setItem(KEY, theme); } catch { /* session preference still works */ }
  document.querySelectorAll<HTMLImageElement>('img[data-orbital-src]').forEach(img => {
    img.src = (theme === 'buddy' ? img.dataset.orbitalSrc : img.dataset.classicSrc)!;
  });
  window.dispatchEvent(new CustomEvent('ga:theme'));
}
let initial: UITheme = 'buddy';
try { if (localStorage.getItem(KEY) === 'classic') initial = 'classic'; } catch { /* default */ }
document.documentElement.dataset.uiTheme = initial;
