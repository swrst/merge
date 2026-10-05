/* Analytics. One call site shape for the whole game: track('event', {props}).
   The mock keeps the last 50 events (visible in the dev panel) and logs them in
   dev builds; a real provider (Firebase, GameAnalytics…) slots in behind send(). */
import { SERVICES } from './config';
import { useLive } from './platform';

export type Ev = { t: number; name: string; props?: Record<string, any> };
const log: Ev[] = [];

export const analytics = {
  get recent() { return log.slice(-50).reverse(); },
  track(name: string, props?: Record<string, any>) {
    const ev = { t: Date.now(), name, props };
    log.push(ev); if (log.length > 200) log.splice(0, log.length - 200);
    if (useLive(SERVICES.analytics.mode)) send(ev);
    else if (import.meta.env.DEV) console.debug('[analytics]', name, props || '');
  },
};
/* the real provider goes here, e.g. FirebaseAnalytics.logEvent({ name, params }) */
function send(_ev: Ev) { /* not wired yet */ }
