/* One import for every outside connection. Each service is mock-first: the
   game works the same in the browser, in tests and on a phone without
   accounts, and switches to the real SDK when SERVICES (config.ts) says so. */
export { SERVICES } from './config';
export { isNative, platform, mockControls } from './platform';
export { analytics } from './analytics';
export { ads } from './ads';
export type { Placement, AdResult } from './ads';
export { iap, PRODUCTS } from './iap';
export type { Product, BuyResult } from './iap';
export { store } from './store';
export { notify } from './notify';
export type { Note } from './notify';
export { games } from './games';

import { ads } from './ads';
import { iap } from './iap';
import { analytics } from './analytics';
import { platform } from './platform';

export async function initServices() {
  analytics.track('session_start', { platform: platform() });
  await Promise.all([ads.init().catch(() => { }), iap.init().catch(() => { })]);
}
