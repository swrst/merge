/* Where we are running, and a safe way to reach a native plugin that may not
   be installed. Plugins are reached through Capacitor's registry rather than
   imported, so the web build never needs their JS packages. */
import { Capacitor } from '@capacitor/core';
import type { Mode } from './config';

export const isNative = Capacitor.isNativePlatform();
export const platform = (): 'android' | 'ios' | 'web' => (Capacitor.getPlatform() as any) || 'web';

/** a registered native plugin, or null */
export function plugin<T = any>(name: string): T | null {
  try { return Capacitor.isPluginAvailable(name) ? ((Capacitor as any).Plugins?.[name] ?? null) : null; } catch { return null; }
}

/** should this service talk to the real thing? */
export function useLive(mode: Mode, ready = true): boolean {
  if (mode === 'mock') return false;
  if (mode === 'live') return isNative;
  return isNative && ready;
}

/** what the mocks do — the developer panel in Settings changes these */
export const mockControls = {
  ad: 'complete' as 'complete' | 'skip' | 'nofill',
  purchase: 'ask' as 'ask' | 'success' | 'cancel' | 'error',
};
