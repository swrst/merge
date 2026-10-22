/** The game has one look: the hologram UI ("buddy" in the CSS selectors). */
export type UITheme = 'buddy';
export function getUITheme(): UITheme { return 'buddy'; }
document.documentElement.dataset.uiTheme = 'buddy';
try { localStorage.removeItem('galaxyAdventure.uiTheme'); } catch { /* nothing stored */ }
