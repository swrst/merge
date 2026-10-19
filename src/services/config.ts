/* Every outside connection the game has, and how it is switched on.
 *
 *   'mock'  always the in-game stand-in (browser, tests, before accounts exist)
 *   'live'  the real SDK — only works in the Android/iOS build
 *   'auto'  live on a phone when the ids/keys below are filled in, mock otherwise
 *
 * Going live is filling in this file (see SERVICES.md), not editing game code. */
declare const __HAS_FIREBASE__: boolean;
export type Mode = 'mock' | 'live' | 'auto';
import VERSION from '../../version.json';

/** true in the store build (`npm run build:release`): no tester tools, real ads */
export const RELEASE = import.meta.env.VITE_RELEASE === '1';

export const SERVICES = {
  /** the app's identity in both stores — must match capacitor.config.ts appId */
  app: {
    androidPackage: 'dev.artursolak.galaxyadventure',
    iosAppStoreId: '',                  // ← numeric id from App Store Connect, once the app record exists
    privacyUrl: '',                     // ← your privacy policy page (required by both stores)
    supportEmail: 'artursolakdev@gmail.com',   // ← where "Send feedback" goes; empty = feedback is copied to the clipboard
    /** shown in Settings and stamped on every feedback report */
    build: VERSION.name + (RELEASE ? '' : ' test'),     // version.json is the one place the version lives
    /** test builds: tap the version line 5× in Settings for the tester tools */
    testerTools: !RELEASE,
  },

  ads: {
    mode: 'auto' as Mode,
    testing: !RELEASE,                  // test ads everywhere except the store build
    units: {
      // Android: Galaxy Adventure "Rewarded". iOS: still Google's test unit. Test builds always show test ads (ads.testing).
      rewardedAndroid: 'ca-app-pub-9488333769711990/3791200991',
      rewardediOS: 'ca-app-pub-3940256099942544/1712485313',
    },
    /** the mock video length, ms */
    mockMs: 2600,
  },

  iap: {
    mode: 'auto' as Mode,
    revenueCatKeys: { android: 'goog_GyFsCXwLUcsTfQgpFUSUYTZtjzQ', ios: '' },   // ← "goog_…" / "appl_…" public SDK keys
  },

  /** Play Games Services / Game Center: sign-in, leaderboards, achievements, cloud save */
  games: {
    mode: 'mock' as Mode,
    leaderboards: { level: '', events: '', weekly: '' },     // ← leaderboard ids from Play Console / App Store Connect
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

  /** Firebase Analytics + Crashlytics. On by itself once android/app/google-services.json
      is in place (docs/ANDROID-RELEASE.md step 5); until then events stay in memory. */
  analytics: { mode: 'auto' as Mode, firebase: __HAS_FIREBASE__ },
};
