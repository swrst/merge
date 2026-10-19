# Publishing Galaxy Adventure on Google Play

Everything from "no accounts" to "live on the Play Store", in order. Steps marked **(code)** are already done in the repo; the rest you do in a browser or on your laptop.

App id (package name): **`dev.artursolak.galaxyadventure`**. It can never change once the app is on Play.

---

## 0. Accounts you need

| Account | Cost | What for | Where |
|---|---|---|---|
| Google account | free | owns everything below; use one you will keep forever | accounts.google.com |
| **Google Play Console** | **US$25 once** | publishing, testing tracks, in-app products, Play Games | play.google.com/console |
| **Firebase** project | free (Spark plan) | Analytics + Crashlytics | console.firebase.google.com |
| **AdMob** | free | rewarded video ads; pays you monthly | admob.google.com |
| **RevenueCat** | free up to US$2,500 monthly revenue | in-app purchases (gems, packs, ad-free) | app.revenuecat.com |
| Google Payments merchant profile | free | receiving purchase money (created from Play Console) | Play Console → Settings → Payments profile |
| A small website or page | free | privacy policy URL (and app-ads.txt for AdMob later) | GitHub Pages, Google Sites or Firebase Hosting |

**Personal or organization Play account?**
- **Personal**: quick to open, but Google requires a **closed test with at least 12 testers opted in for 14 days in a row** before you can apply for production.
- **Organization**: needs a **D-U-N-S number** for your business (your JDG can get one for free from Dun & Bradstreet; it takes a few days to a few weeks). No 12-tester rule, and the store shows your business name.
- Either way, because the game earns money, Play will ask you to declare **trader status** (EU Digital Services Act): your name/business, address, email and phone are shown on the store page. With a JDG, use the business details.
- Ask your accountant how Google Play and AdMob income is booked for the JDG (Google handles VAT on sales to consumers, but income tax and invoicing are yours). This guide is not tax advice.

---

## 1. Tools on the laptop

- Node 20+ and the repo (`npm install` after every pull).
- **Android Studio** (brings the Android SDK and a Java 21 runtime). Open the `android` folder once and let Gradle sync.
- A phone with USB debugging, for testing release builds.

---

## 2. App identity (code, done)

- `capacitor.config.ts` → `appId: 'dev.artursolak.galaxyadventure'`, name *Galaxy Adventure*.
- `android/app/build.gradle` → `namespace` and `applicationId` match; `targetSdk 36` and `compileSdk 36` (Google Play requires API 36 for new apps from 31 Aug 2026).
- Version: **`version.json`** is the single source. `npm run version:bump` raises it (`0.73.0 → 0.73.1`, versionCode +1). **Every upload to Play needs a higher versionCode.**
- `npm run build:release` makes the store build: tester tools hidden, ads not in test mode, no dev panel.

> Your old debug installs used `dev.artursolak.mergerocket`; that app stays on test phones as a separate app. Uninstall it.

---

## 3. The upload key (do once, keep forever)

Google re-signs the app with its own key (Play App Signing); you sign uploads with an **upload key**. Lose it and you have to ask Google to reset it, so back it up.

In a terminal in the repo (Android Studio's Java has `keytool`):

PowerShell:

```powershell
& "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore android\upload-key.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

(Command Prompt: `"%ProgramFiles%\Android\Android Studio\jbr\bin\keytool" -genkeypair ...` with the same arguments.)

Answer the questions (your name, city, country `PL`) and choose a strong password. Then create **`android/keystore.properties`**:

```properties
storeFile=upload-key.jks
storePassword=YOUR_PASSWORD
keyAlias=upload
keyPassword=YOUR_PASSWORD
```

Both files are in `.gitignore` and never go to GitHub. **Copy them to a password manager or a private cloud folder now.**

(code) `android/app/build.gradle` signs release builds with this file when it exists.

---

## 4. First release build

```bat
build-release.bat
```

It checks Java, builds the store web app, syncs Capacitor and runs `gradlew bundleRelease`. Result: **`GalaxyAdventure-0.73.0.aab`** next to the script. That `.aab` is what you upload to Play.

To try a signed release on your own phone first: `npm run apk:release` (or in Android Studio: Build → Generate Signed App Bundle / APK).

---

## 5. Firebase: Analytics + Crashlytics

1. console.firebase.google.com → **Add project** → name it *Galaxy Adventure* → keep Google Analytics **on** → pick or create an Analytics account (region: Poland).
2. In the project → **Add app** → Android → package name `dev.artursolak.galaxyadventure` → nickname *Galaxy Adventure Android* → you can skip the SHA-1.
3. **Download `google-services.json`** and put it at **`android/app/google-services.json`** (gitignored).
4. Skip the "add SDK" steps: (code) the Gradle plugins and the `@capacitor-firebase/analytics` + `@capacitor-firebase/crashlytics` packages are already in the project, and only switch on when that file exists.
5. Nothing to switch on: the build notices the file and turns Firebase on by itself.
6. Build and run on your phone. In Firebase → **Crashlytics**, the dashboard activates after the first launch. In **Analytics → DebugView** you see events live if you turn on debug mode for the device:
   `adb shell setprop debug.firebase.analytics.app dev.artursolak.galaxyadventure`

What the game sends (code): `session_start`, `tutorial_end`, `level_up`, `chapter_built`, `contract_done`, `world_travel`, `out_of_energy`, `expedition_open`, `album_pack`, `ad_start/ad_end`, `purchase_start/purchase_end`, `review_prompt`, `return`, `feedback`, plus screen views and user properties (level, world, chapter). Crashlytics gets crashes, JavaScript errors and the last events before them.

Useful Firebase reports once players arrive: **Retention** (day 1 / day 7), a **funnel** `tutorial_end → chapter_built (chapter 3) → world_travel`, and where `out_of_energy` happens by level.

---

## 6. Privacy policy (required)

The page lives in `site/` (`privacy-policy.html`, plus a small `index.html`) and is hosted on Firebase Hosting in the Firebase project.

1. Once: `npm run site:login` (opens the browser, sign in with the Google account that owns Firebase).
2. After any change to `site/`: `npm run site`.
3. URL: **https://galaxy-adventure-8545b.web.app/privacy-policy** (already in `app.privacyUrl`; the game links to it from Settings). Put the same URL in Play Console → App content → Privacy policy.

---

## 7. AdMob (rewarded videos)

1. admob.google.com → sign up with the same Google account → add your **payments info** (needed before you are paid).
2. **Apps → Add app** → Android → "Is the app listed on a supported app store?" **No** for now (link it after it is live) → name *Galaxy Adventure*.
3. Copy the **App ID** (`ca-app-pub-XXXXXXXX~YYYYYYYY`) into `android/app/src/main/AndroidManifest.xml` (replace Google's test id in `com.google.android.gms.ads.APPLICATION_ID`).
4. **Ad units → Rewarded** → name *Rewarded* → copy the unit id (`ca-app-pub-XXXXXXXX/ZZZZZZZZ`) into `src/services/config.ts` → `ads.units.rewardedAndroid`.
5. **Privacy & messaging → GDPR**: create a consent message for the EEA and UK and publish it. (code) The game shows it on first start through Google's UMP SDK.
6. Never tap your own live ads. Add your phone under **Settings → Test devices**.
7. After the game is live, link the app to its Play listing in AdMob and add an `app-ads.txt` on your developer website (AdMob shows the line to put in it).

Test builds (`npm run build`) always use test ads; only `build:release` serves real ones.

---

## 8. In-app purchases (RevenueCat + Google Play Billing)

The products the game sells (`src/services/iap.ts`), all **one-time (consumable) products**, except `starter` and `adfree` which can only be bought once:

| Product id | Name | Suggested price |
|---|---|---|
| `starter` | Starter Pack | €1.99 |
| `gems_s` / `gems_m` / `gems_l` / `gems_xl` | Gems 80 / 450 / 1000 / 2200 | €0.99 / €4.99 / €9.99 / €19.99 |
| `energy_pack` | Energy Crate | €2.99 |
| `coins_s` / `coins_m` / `coins_l` | Coins 1500 / 9000 / 20000 | €0.99 / €4.99 / €9.99 |
| `adfree` | Ad-Free Pass | €3.99 |

1. Play Console → **Settings → Payments profile**: create the merchant account (bank account, tax info).
2. Upload any build to the **Internal testing** track first (step 10): Play only lets you create products once an app with the Billing permission has been uploaded. (code) The RevenueCat plugin adds that permission.
3. Play Console → your app → **Monetize → Products → In-app products** → create each product above with **exactly** these ids, set prices, **Activate**.
4. RevenueCat → new project → **Add app → Play Store** → package `dev.artursolak.galaxyadventure` → follow its guide to give RevenueCat a **Google Cloud service account** with Play access (it takes a few hours to start working).
5. RevenueCat → **Products** → import the products. Then **API keys** → copy the **public Android key** (`goog_…`) into `src/services/config.ts` → `iap.revenueCatKeys.android`.
6. Play Console → **Settings → License testing**: add your Gmail and your testers. They can buy for free with test cards.

---

## 8b. Play Games Services (sign-in and cloud save)

Do this after the first build is in Internal testing (Play needs the app signing key first).

1. Play Console → your app → **Grow users → Play Games Services → Setup and management → Configuration** → *No, my game doesn't use Google APIs* → Create.
2. **Credentials → Add credential → Android**: it offers to create the OAuth client in Google Cloud. Package `dev.artursolak.galaxyadventure`, and the **SHA-1 of the app signing key** (Play Console → Test and release → App integrity → App signing). Add a second Android credential with your **upload key** SHA-1 too, so builds you install yourself can sign in:
   `& "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore android\upload-key.jks -alias upload`
3. **Properties**: turn **Saved games ON**.
4. Copy the **project id** (the number under the game's name on the Configuration page) into `android/app/src/main/res/values/strings.xml` → `game_services_project_id`. Until it is there, Play Games stays off.
5. **Testers**: add your Gmail and your testers' (while Play Games is unpublished, only testers can sign in). **Publish** the Play Games configuration when the game goes to production.

(code) `GameServicesPlugin.java` + `src/services/games.ts`: automatic sign-in, cloud save, leaderboards and achievements. Leaderboard / achievement ids, once created in Play Console, go in `src/services/config.ts` → `games`.

---

## 9. Store listing

Play Console → **Create app** → name *Galaxy Adventure*, default language English (add Polish later), **Game**, **Free**, accept the declarations. Then, under **Grow → Store presence → Main store listing**:

| Field | Value |
|---|---|
| App name | Galaxy Adventure (max 30 characters) |
| Short description (80) | *Merge alien treasures, rebuild cosy space camps and fly your rocket to new planets!* |
| Full description (4000) | write 4–6 short paragraphs: what you do, the worlds, the aliens, the Lab and pets, events, "no timers you have to pay to skip" etc. |
| App icon | `resources/store/icon_512.png` (512×512) |
| Feature graphic | `resources/store/feature_graphic.png` (1024×500) |
| Phone screenshots | at least 2, up to 8: `resources/store/screenshots/*.png` (1080×2160). Better: take your own on the phone mid-game with a full board. |
| Category | Games → **Puzzle** (or Casual) |
| Tags | Merge, Casual, Puzzle, Space |
| Contact email | your support email (shown publicly) |
| Privacy policy | the URL from step 6 |

Then **Policy → App content**, every item must be green:

- **Privacy policy**: the URL.
- **Ads**: *Yes, my app contains ads*.
- **App access**: *All functionality is available without special access*.
- **Content rating**: fill the IARC questionnaire (a cartoon merge game with no violence: usually PEGI 3 / Everyone; "in-app purchases" and "ads" are noted automatically).
- **Target audience**: choose **13+** (or 16–17 and 18+). Choosing under-13 puts the app in Google's *Families* program, which needs certified ad SDKs, no advertising ID and stricter rules. Do not tick "appeals to children" unless you want that.
- **Data safety**: see the answers below.
- **Government apps / Financial features / Health**: No.
- **Advertising ID**: *Yes* (AdMob and Firebase use it).

### Data safety answers

- Does your app collect or share user data? **Yes**. Is it encrypted in transit? **Yes**. Can users ask for deletion? **Yes**, by email (and they can uninstall to delete the local save).
- **Collected**:
  - *App activity → App interactions* (Firebase Analytics): analytics; not shared.
  - *App info and performance → Crash logs, Diagnostics* (Crashlytics): analytics; not shared.
  - *Device or other IDs* (advertising ID; Firebase app instance ID): advertising and analytics; **shared** with Google AdMob.
  - *Financial info → Purchase history* (Play Billing / RevenueCat): app functionality; not shared.
- **Not collected**: name, email, location, contacts, photos, messages. (The save game stays on the phone.)

---

## 10. Testing tracks

1. **Internal testing** (up to 100 people, no review, minutes to go live): Test and release → Testing → Internal testing → **Create release** → upload the `.aab` → release notes → **Save and roll out**. Add testers by email list, share the opt-in link. Use this for every build you want to try on real phones.
2. **Closed testing** (needed for personal accounts): create a closed track, upload the same `.aab`, add **at least 12 testers** (a Google Group or email list) and keep them **opted in for 14 days in a row**. Ask them to actually play a few times; Google checks engagement.
3. **Apply for production** (Dashboard → Apply for production): three short forms about the test, the game and your readiness. Review usually takes up to 7 days.

Every new build: `npm run version:bump` → `build-release.bat` → upload the new `.aab` to the track.

---

## 11. Production launch

1. Production → Create release → upload the `.aab` (or promote the closed-test release).
2. **Countries**: start with a few (e.g. Poland, Italy, Estonia, UK, Ireland) for a soft launch, then add the rest.
3. **Staged rollout**: 20% → watch Crashlytics and reviews for 2–3 days → 100%.
4. After launch: link the app in AdMob, publish `app-ads.txt`, reply to reviews, watch Firebase retention.

---

## 12. Before every store upload (checklist)

- [ ] `npm run content` prints *content OK*; `npm run check` is clean.
- [ ] `npm run dev` + `npm test` + `node scripts/ux-check.mjs` → ALL GOOD.
- [ ] `npm run version:bump`.
- [ ] `config.ts`: real AdMob unit, RevenueCat key, `firebase: true`, privacy URL, support email.
- [ ] `AndroidManifest.xml`: real AdMob app id.
- [ ] `build-release.bat` → install the `.aab` through Internal testing on your own phone, play 10 minutes, try one ad and one test purchase.
- [ ] Upload, release notes, roll out.
