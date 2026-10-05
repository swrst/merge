# Services: ads, store, accounts (mock-first)

Every outside connection lives in `src/services/`. The game only talks to these modules, and each one has two faces:

- **mock**: runs in the browser and in tests, and on a phone before the accounts exist.
- **live**: the real SDK, used only in the Android/iOS build.

Which face runs is set in one file, `src/services/config.ts`:

| `mode` | Behaviour |
|---|---|
| `'mock'` | Always the stand-in. |
| `'live'` | Always the real SDK (phone builds only). |
| `'auto'` | Live on a phone once its ids/keys are filled in, mock otherwise. This is the default. |

## What is there

| Module | Live | Mock | Used for |
|---|---|---|---|
| `ads.ts` | Google AdMob (`@capacitor-community/admob`, installed), UMP consent, iOS tracking prompt | in-game test video (complete / skipped / no fill) | rewarded videos: energy, double rewards, skip timers |
| `iap.ts` | RevenueCat (`@revenuecat/purchases-capacitor`, installed) → Play Billing + StoreKit | bottom sheet: Buy (test) / Cancel / payment error | gem packs, starter pack, ad-free, **Restore purchases** |
| `store.ts` | in-app review sheet (`InAppReview` plugin), Play in-app updates (`AppUpdate` plugin) | toast saying what would open | one review ask after Meadow chapter 5 |
| `notify.ts` | `@capacitor/local-notifications` | list of what would be scheduled | "energy is full", "daily gift waiting" on going to background |
| `games.ts` | Play Games Services / Game Center via a `GameServices` plugin | local player, scores, achievements, cloud save in localStorage | sign-in, level leaderboard, cloud backup on going to background |
| `analytics.ts` | (provider of your choice) | last 200 events in memory | session_start, level_up, chapter_built, contract_done, ad_*, purchase_*, review_prompt, return, tutorial_end |

Plugins that are not npm-installed are reached through Capacitor's plugin registry, so the web build never needs them. Until a plugin is installed and synced, its service stays mock.

## The developer panel

In `npm run dev`, open **Settings**. Under the switches there is a **Developer · services** box:

- Cycle the mock ad result: complete / skip / nofill.
- Cycle the mock purchase result: ask / success / cancel / error.
- Fire the review prompt.
- Sign in to the mock games account.
- Simulate the app going to the background. This schedules the notifications and writes the cloud save.
- See the scheduled notifications and the last analytics events.

The panel is not in store builds.

`node scripts/ux-check.mjs` covers the mock flows:

- A finished video pays out.
- A skipped video does not, and does not use up one of the day's views.
- Cancelling a purchase grants nothing.
- A test purchase grants the gems.
- Analytics records the purchase.

## Going live — checklist

1. **Ads**
   - In `config.ts`, put your rewarded unit ids in `ads.units` and set `ads.testing: false`.
   - Put your AdMob **app** ids in `android/app/src/main/AndroidManifest.xml` and `ios/App/App/Info.plist` (the test ids are there now).
2. **Purchases**
   - Create the products below in Play Console and App Store Connect, with **exactly** these ids: `starter`, `gems_s`, `gems_m`, `gems_l`, `gems_xl`, `energy_pack`, `adfree`.
   - Import them into RevenueCat.
   - Put the public SDK keys in `iap.revenueCatKeys`.
3. **Review / updates / notifications**
   - Install the plugins, then run `npx cap sync`:
     ```
     npm i @capacitor-community/in-app-review @capawesome/capacitor-app-update @capacitor/local-notifications
     ```
   - Android 13+ also needs `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>`.
4. **Games services**
   - Create the game in Play Console (Play Games Services) and in Game Center.
   - Add a games-services Capacitor plugin that registers as `GameServices`.
   - Put the leaderboard ids in `games.leaderboards` and set `games.mode: 'auto'`.
5. **App identity**: fill `app.iosAppStoreId`, `app.privacyUrl` and `app.supportEmail`.
6. **Analytics**: pick a provider and fill in `send()` in `analytics.ts`. Set `analytics.mode: 'auto'`.

Nothing else in the game changes when a service goes live.
