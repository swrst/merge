/* Every outside connection the game has, and how it is switched on.
 *
 *   'mock'  always the in-game stand-in (browser, tests, before accounts exist)
 *   'live'  the real SDK — only works in the Android/iOS build
 *   'auto'  live on a phone when the ids/keys below are filled in, mock otherwise
 *
 * Going live is filling in this file (see SERVICES.md), not editing game code. */
export type Mode = 'mock' | 'live' | 'auto';

export const SERVICES = {
  /** the app's identity in both stores — must match capacitor.config.ts appId */
  app: {
    androidPackage: 'dev.artursolak.mergerocket',
    iosAppStoreId: '',                  // ← numeric id from App Store Connect, once the app record exists
    privacyUrl: '',                     // ← your privacy policy page (required by both stores)
    supportEmail: '',                   // ← where "Send feedback" goes; empty = feedback is copied to the clipboard
    /** shown in Settings and stamped on every feedback report */
    build: '0.43 test',
    /** test builds: tap the version line 5× in Settings for the tester tools */
    testerTools: true,
  },

  ads: {
    mode: 'auto' as Mode,
    testing: true,                      // ← false for the store build (Google test units until then)
    units: {
      // Google's public TEST rewarded units — replace with your own from admob.google.com
      rewardedAndroid: 'ca-app-pub-3940256099942544/5224354917',
      rewardediOS: 'ca-app-pub-3940256099942544/1712485313',
    },
    /** the mock video length, ms */
    mockMs: 2600,
  },

  iap: {
    mode: 'auto' as Mode,
    revenueCatKeys: { android: '', ios: '' },   // ← "goog_…" / "appl_…" public SDK keys
  },

  /** Play Games Services / Game Center: sign-in, leaderboards, achievements, cloud save */
  games: {
    mode: 'mock' as Mode,
    leaderboards: { level: '', events: '' },     // ← leaderboard ids from Play Console / App Store Connect
    /* store achievements: the in-game id (<achievement>_<star>, e.g. merge_1) → the id
       Play Console / App Store Connect gives it. Empty = only unlocked in the game.
       The same names are used on both stores, so one table fills both. */
    achievements: {
      merge_1: '', merge_2: '', merge_3: '', merge_4: '',
      deliver_1: '', deliver_2: '', deliver_3: '', deliver_4: '',
      seen_1: '', seen_2: '', seen_3: '', seen_4: '',
      chest_1: '', chest_2: '', chest_3: '',
      story_1: '', story_2: '', story_3: '',
      friend_1: '', friend_2: '', friend_3: '', friend_4: '',
      level_1: '', level_2: '', level_3: '', level_4: '',
      world_luna: '', world_cindra: '', world_nerith: '', world_vela: '',
    } as Record<string, string>,
  },

  /** store-side extras: the in-app review sheet and update prompts */
  store: { mode: 'auto' as Mode, askReviewAfterChapter: 5 },

  /** local notifications (energy full, daily gift) — no server needed */
  notify: { mode: 'auto' as Mode },

  /** analytics: a mock that keeps the last events in memory until a provider is chosen */
  analytics: { mode: 'mock' as Mode },
};
