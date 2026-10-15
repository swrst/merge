/* Analytics and crash reports. One call shape for the whole game:
     analytics.track('event', { props })      an event
     analytics.screen('shop')                  which screen the player is on
     analytics.user({ level: 7 })              a user property (level, world, chapter…)
     analytics.error(err, 'where')             a non-fatal error for Crashlytics

   Live (the Android/iOS build with Firebase set up, see docs/SERVICES.md):
   Firebase Analytics + Firebase Crashlytics through @capacitor-firebase.
   Everywhere else: the last 200 events stay in memory (the dev panel shows
   them) and dev builds log them to the console. Nothing here ever throws. */
import { SERVICES } from './config';
import { useLive } from './platform';

export type Ev = { t: number; name: string; props?: Record<string, any> };
const log: Ev[] = [];

let FA: any = null, CR: any = null, booting: Promise<void> | null = null;
const live = () => useLive(SERVICES.analytics.mode, SERVICES.analytics.firebase);

/** load the native plugins once, the first time something is sent */
function boot(): Promise<void> {
  if (!booting) booting = (async () => {
    try { FA = (await import('@capacitor-firebase/analytics')).FirebaseAnalytics; await FA.setEnabled({ enabled: true }); } catch { FA = null; }
    try { CR = (await import('@capacitor-firebase/crashlytics')).FirebaseCrashlytics; await CR.setEnabled({ enabled: true }); } catch { CR = null; }
    try { if (CR) await CR.setCustomKey({ key: 'build', value: SERVICES.app.build, type: 'string' }); } catch { /* optional */ }
  })();
  return booting;
}

/* Firebase rules: names and keys up to 40 chars of [a-zA-Z0-9_], starting with a letter;
   string values up to 100 chars; at most 25 params. */
const clean = (s: string) => (s.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z]+/, '') || 'x').slice(0, 40);
function params(p?: Record<string, any>) {
  if (!p) return undefined;
  const out: Record<string, string | number> = {};
  Object.entries(p).slice(0, 25).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    out[clean(k)] = typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : String(v).slice(0, 100);
  });
  return out;
}

export const analytics = {
  get recent() { return log.slice(-50).reverse(); },
  get live() { return live(); },
  track(name: string, props?: Record<string, any>) {
    const ev = { t: Date.now(), name, props };
    log.push(ev); if (log.length > 200) log.splice(0, log.length - 200);
    if (!live()) { if (import.meta.env.DEV) console.debug('[analytics]', name, props || ''); return; }
    boot().then(() => {
      FA?.logEvent({ name: clean(name), params: params(props) }).catch(() => { });
      // the last events ride along with any crash report
      CR?.log({ message: name + (props ? ' ' + JSON.stringify(props).slice(0, 180) : '') }).catch(() => { });
    }).catch(() => { });
  },
  screen(name: string) {
    if (live()) boot().then(() => FA?.setCurrentScreen({ screenName: clean(name), screenClassOverride: 'Game' }).catch(() => { })).catch(() => { });
  },
  user(props: Record<string, string | number>) {
    if (!live()) return;
    boot().then(async () => {
      for (const [k, v] of Object.entries(props)) {
        await FA?.setUserProperty({ key: clean(k).slice(0, 24), value: String(v).slice(0, 36) }).catch(() => { });
        await CR?.setCustomKey({ key: clean(k), value: String(v), type: 'string' }).catch(() => { });
      }
    }).catch(() => { });
  },
  error(err: unknown, where = '') {
    const e = err instanceof Error ? err : new Error(String(err));
    if (import.meta.env.DEV) console.warn('[error]', where, e);
    if (!live()) return;
    boot().then(() => CR?.recordException({ message: (where ? where + ': ' : '') + e.message }).catch(() => { })).catch(() => { });
  },
};
