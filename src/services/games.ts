/* Play Games Services (Android) / Game Center (iOS): sign-in, leaderboards,
 * achievements and cloud save.
 *   live: a games-services plugin registered as "GameServices" (e.g.
 *         @openforge/capacitor-game-connect or a small custom plugin).
 *   mock: a local "player", scores and achievements kept in memory, and cloud
 *         save written to localStorage under its own key — so the flows
 *         (sign in, restore on a new phone) can be built and tried now. */
import { SERVICES } from './config';
import { plugin, useLive } from './platform';
import { analytics } from './analytics';

const CLOUD_KEY = 'mergeRocket_cloud_mock';
let signedIn = false, playerName = '';
const scores: Record<string, number> = {}, unlocked = new Set<string>();

const gs = () => plugin<any>('GameServices');
const liveOn = () => useLive(SERVICES.games.mode, !!gs());

export const games = {
  get signedIn() { return signedIn; },
  get player() { return playerName; },
  get mockState() { return { scores: { ...scores }, achievements: [...unlocked] }; },
  async signIn() {
    if (liveOn()) { try { const r = await gs().signIn(); signedIn = true; playerName = r?.player?.displayName || 'Player'; } catch { signedIn = false; } }
    else { signedIn = true; playerName = 'Test Traveller'; }
    analytics.track('games_signin', { ok: signedIn });
    return signedIn;
  },
  async submitScore(board: 'level' | 'events', value: number) {
    const id = SERVICES.games.leaderboards[board];
    if (liveOn() && id) { try { await gs().submitScore({ leaderboardId: id, score: value }); } catch { } return; }
    scores[board] = Math.max(scores[board] || 0, value);
  },
  async unlock(achievementId: string) {
    if (liveOn()) { try { await gs().unlockAchievement({ achievementId }); } catch { } return; }
    unlocked.add(achievementId);
  },
  /** save the whole game to the player's account */
  async cloudSave(json: string) {
    if (liveOn()) { try { await gs().saveGame({ title: 'merge-rocket', data: json }); } catch { } return; }
    try { localStorage.setItem(CLOUD_KEY, JSON.stringify({ at: Date.now(), json })); } catch { }
  },
  /** the account's save, if any, with when it was made */
  async cloudLoad(): Promise<{ at: number; json: string } | null> {
    if (liveOn()) { try { const r = await gs().loadGame({ title: 'merge-rocket' }); return r?.data ? { at: r.modified || 0, json: r.data } : null; } catch { return null; } }
    try { const v = localStorage.getItem(CLOUD_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
  },
};
