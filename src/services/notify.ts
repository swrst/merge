/* Local notifications — scheduled on the phone, no server.
 *   live: @capacitor/local-notifications (asks permission the first time)
 *   mock: remembers what it would have scheduled (shown in the dev panel). */
import { SERVICES } from './config';
import { plugin, useLive } from './platform';

export type Note = { id: number; at: number; title: string; body: string };
const pending: Note[] = [];
let asked = false;

export const notify = {
  get pending() { return pending.slice().sort((a, b) => a.at - b.at); },
  /** replace everything scheduled with this list (call when the app goes to the background) */
  async schedule(list: Note[]) {
    pending.splice(0, pending.length, ...list.filter(n => n.at > Date.now()));
    const p = plugin<any>('LocalNotifications');
    if (!(useLive(SERVICES.notify.mode, !!p) && p)) return;
    try {
      if (!asked) { asked = true; const r = await p.requestPermissions(); if (r.display !== 'granted') return; }
      const old = await p.getPending(); if (old.notifications?.length) await p.cancel(old);
      if (pending.length) await p.schedule({ notifications: pending.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at) } })) });
    } catch { /* notifications are a nicety */ }
  },
};
