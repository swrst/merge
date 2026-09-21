/* Thin wrapper over the Capacitor bits, so the game code stays platform-agnostic. */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNative = Capacitor.isNativePlatform();

export function haptic(kind: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isNative) return;
  const style = kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
  Haptics.impact({ style }).catch(() => { });
}

/** Saves live in localStorage (sync, simple). On a phone we mirror them into
 *  Capacitor Preferences, which the OS will not evict, and restore on launch. */
const SAVE_KEY = 'mergeRocket_v2';

export async function hydrateSave() {
  if (!isNative) return;
  try {
    const local = localStorage.getItem(SAVE_KEY);
    if (local) return;                                   // local copy wins
    const { value } = await Preferences.get({ key: SAVE_KEY });
    if (value) localStorage.setItem(SAVE_KEY, value);
  } catch (e) { /* first run, or storage blocked */ }
}

export function startSaveMirror() {
  if (!isNative) return;
  let last = '';
  setInterval(() => {
    try {
      const v = localStorage.getItem(SAVE_KEY);
      if (v && v !== last) { last = v; Preferences.set({ key: SAVE_KEY, value: v }).catch(() => { }); }
    } catch (e) { /* ignore */ }
  }, 5000);
}

export async function setupChrome() {
  if (!isNative) return;
  // on a phone the game is the whole screen, so the shell drops its card chrome
  document.body.classList.add('native');
  try {
    await StatusBar.setStyle({ style: Style.Dark });     // dark icons on the light sky
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#7fd2fb' });
  } catch (e) { /* iOS ignores some of these */ }
  try {
    // Android's back button should step out of a screen, not kill the app
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', () => {
      const modal = document.querySelector('#modal.open') as HTMLElement | null;
      if (modal) { (document.querySelector('#mBtn') as HTMLElement)?.click(); return; }
      const tray = document.querySelector('.tray.open') as HTMLElement | null;
      if (tray) { (document.querySelector('#bagClose') as HTMLElement)?.click(); return; }
      const open = document.querySelector('.screen.open') as HTMLElement | null;
      if (open) { (open.querySelector('.scClose') as HTMLElement)?.click(); return; }
      App.minimizeApp();
    });
    // save the moment the player switches away, never on the way to being killed
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) window.dispatchEvent(new Event('mr:save'));
    });
  } catch (e) { /* the plugin is optional */ }
}
