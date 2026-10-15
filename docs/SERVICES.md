# Services: ads, purchases, analytics, crashes, notifications, review

Every outside connection lives in `src/services/`. The game only talks to these modules, and each one has two faces:

- **mock**: in the browser, in tests, and on a phone before the account exists.
- **live**: the real SDK, Android/iOS builds only.

Which face runs is set in **`src/services/config.ts`**:

| `mode` | Behaviour |
|---|---|
| `'mock'` | always the stand-in |
| `'live'` | always the real SDK (phone builds only) |
| `'auto'` | live on a phone, mock elsewhere (the default) |

`RELEASE` (true only in `npm run build:release`) hides the tester tools and turns off test ads.

## The modules

| Module | Live | Mock | Used for |
|---|---|---|---|
| `ads.ts` | Google AdMob (`@capacitor-community/admob`) with UMP consent (EEA/UK) and the iOS tracking prompt | in-game test video: complete / skip / no fill | rewarded videos only (energy, double rewards, skips) |
| `iap.ts` | RevenueCat (`@revenuecat/purchases-capacitor`) → Google Play Billing / StoreKit | a test purchase sheet | gems, coins, energy, starter pack, ad-free, **Restore purchases** |
| `analytics.ts` | Firebase Analytics + Crashlytics (`@capacitor-firebase/*`) | last 200 events in memory, console in dev | events, screens, user properties, non-fatal errors |
| `notify.ts` | `@capacitor/local-notifications` | list of what would be scheduled | "energy is full", "daily gift waiting" (scheduled when the app goes to the background) |
| `store.ts` | Play In-App Review (`@capacitor-community/in-app-review`), Play In-App Updates (`@capawesome/capacitor-app-update`) | a toast | one review ask after Meadow chapter 5; "a new version is out" toast |
| `games.ts` | a `GameServices` plugin (not installed yet) | local player, scores, achievements, cloud save in localStorage | Play Games sign-in, leaderboards, achievements (later) |
| `share.ts` | Capacitor Share + Filesystem | Web Share or a download | the album / profile brag card |

## Going live

| Service | What to fill in | Where |
|---|---|---|
| Firebase | `android/app/google-services.json`, then `analytics.firebase: true` | docs/ANDROID-RELEASE.md step 5 |
| AdMob | app id in `AndroidManifest.xml`, rewarded unit in `ads.units.rewardedAndroid` | step 7 |
| Purchases | product ids in Play Console, RevenueCat Android key in `iap.revenueCatKeys.android` | step 8 |
| App identity | `app.privacyUrl`, `app.supportEmail` | step 6 |
| Play Games (optional, later) | a games-services plugin, leaderboard and achievement ids in `games` | — |

Nothing else in the game changes when a service goes live.

## Analytics events

`session_start`, `tutorial_end`, `level_up {level, world}`, `chapter_built {world, chapter, level}`, `contract_done {coins, needs}`, `world_travel {to, from, first}`, `out_of_energy {level}`, `expedition_open`, `album_pack {kind}`, `ad_start/ad_end {placement, result}`, `purchase_start/purchase_end {product, result}`, `review_prompt`, `return {minutes}`, `feedback {mood}`.
Screens: `board`, `shop`, `lab`, `rocket`, `book`, `map`, `expedition`. User properties: `level`, `world`, `chapter`.

Add an event anywhere with `analytics.track('name', { key: value })`. Names are cleaned to Firebase's rules automatically (letters, digits, underscores, 40 characters).

## The developer panel

In `npm run dev`, open **Settings**: the *Developer · services* box cycles the mock ad and purchase results, fires the review prompt, signs in to the mock games account, simulates going to the background, and lists scheduled notifications and the last analytics events. It is never in store builds.

`node scripts/ux-check.mjs` covers the mock flows (finished / skipped videos, cancelled / successful purchases, analytics records).
