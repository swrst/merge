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
  try {
    await StatusBar.setStyle({ style: Style.Dark });     // dark icons on the light sky
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#7fd2fb' });
  } catch (e) { /* iOS ignores some of these */ }
}
