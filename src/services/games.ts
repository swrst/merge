/* Play Games Services (Android) / Game Center (iOS): sign-in, leaderboards,
 * achievements and cloud save.
 *   live: the GameServices plugin in android/app/src/main/java/…/GameServicesPlugin.java
 *         (Play Games Services v2). It stays off until the Play Games project id
 *         is in android/app/src/main/res/values/strings.xml.
 *   mock: a local "player", scores and achievements kept in memory, and cloud
 *         save written to localStorage under its own key, so the flows
 *         (sign in, restore on a new phone) can be tried in the browser
 *         (Settings → developer panel → Games sign-in). */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { SERVICES } from './config';
import { useLive } from './platform';
import { analytics } from './analytics';

const CLOUD_KEY = 'mergeRocket_cloud_mock';
const SAVE_NAME = 'galaxy-adventure';
let signedIn = false, playerName = '';
const scores: Record<string, number> = {}, unlocked = new Set<string>();

const GS = registerPlugin<any>('GameServices');
const liveOn = () => useLive(SERVICES.games.mode, Capacitor.isPluginAvailable('GameServices'));

export const games = {
  get signedIn() { return signedIn; },
  get player() { return playerName; },
  get live() { return liveOn(); },
  get mockState() { return { scores: { ...scores }, achievements: [...unlocked] }; },
  /** silent: only picks up the automatic Play Games sign-in, never shows a sheet */
  async signIn(silent = false) {
    if (liveOn()) {
      try { const r = await GS.signIn({ silent }); signedIn = !!r?.signedIn; playerName = r?.player?.displayName || (signedIn ? 'Player' : ''); }
      catch { signedIn = false; }
    } else if (!silent) { signedIn = true; playerName = 'Test Traveller'; }
    if (!silent || signedIn) analytics.track('games_signin', { ok: signedIn, silent });
    return signedIn;
  },
  async submitScore(board: 'level' | 'events' | 'weekly', value: number) {
    const id = SERVICES.games.leaderboards[board];
    if (liveOn()) { if (id && signedIn) { try { await GS.submitScore({ leaderboardId: id, score: value }); } catch { } } return; }
    scores[board] = Math.max(scores[board] || 0, value);
  },
  /** the store's own leaderboard screen; false when there is none (web / mock / no id) */
  async showBoard(board: 'level' | 'events' | 'weekly') {
    const id = SERVICES.games.leaderboards[board];
    if (liveOn() && id && signedIn) { try { await GS.showLeaderboard({ leaderboardId: id }); return true; } catch { return false; } }
    return false;
  },
  async unlock(achievementId: string) {
    if (liveOn()) { if (signedIn) { try { await GS.unlockAchievement({ achievementId }); } catch { } } return; }
    unlocked.add(achievementId);
  },
  /** save the whole game to the player's account (only when signed in) */
  async cloudSave(json: string, description = 'Galaxy Adventure') {
    if (!signedIn) return false;
    if (liveOn()) { try { await GS.saveGame({ title: SAVE_NAME, data: json, description }); return true; } catch { return false; } }
    try { localStorage.setItem(CLOUD_KEY, JSON.stringify({ at: Date.now(), json })); return true; } catch { return false; }
  },
  /** the account's save, if any, with when it was made */
  async cloudLoad(): Promise<{ at: number; json: string } | null> {
    if (!signedIn) return null;
    if (liveOn()) { try { const r = await GS.loadGame({ title: SAVE_NAME }); return r?.data ? { at: r.modified || 0, json: r.data } : null; } catch { return null; } }
    try { const v = localStorage.getItem(CLOUD_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
  },
};
