# Putting Merge Rocket on a phone

The game is a web app wrapped with Capacitor, so the phone builds are the same
code you already run with `npm run dev`. Nothing here publishes to a store —
these are the steps to get the game onto a handset you own.

Both native projects are committed (`android/`, `ios/`), so you do not have to
generate them. They only need the current web build copied in, which is what
`cap sync` does.

---

## Android

**What you need:** Android Studio (it brings the SDK, the platform tools and a
JDK). Nothing else.

### The easy way — Android Studio

```bash
npm run android      # build, sync, and open the project in Android Studio
```

Then in Android Studio:

1. Let it finish the Gradle sync the first time (a few minutes, once).
2. Plug the phone in with **USB debugging** on, or start an emulator.
3. Press **Run ▶**. The game installs and launches.

USB debugging lives in Settings → About phone → tap *Build number* seven times →
Developer options → USB debugging.

### The command-line way — a debug APK

```bash
npm run apk
```

That builds the web app, syncs it, and runs Gradle. The file lands at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Copy it to the phone however you like (USB, Drive, email) and open it. Android
will ask you to allow installing from that source — that is expected for a debug
APK, it is not signed by the Play Store.

Already have the phone connected?

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

> `npm run apk` calls `./gradlew`. On Windows use `npm run build && npx cap sync android`
> and then `cd android && gradlew.bat assembleDebug`.

### If Gradle cannot find the SDK

Create `android/local.properties` with the path Android Studio uses:

```
sdk.dir=C\:\\Users\\Lenovo\\AppData\\Local\\Android\\Sdk
```

(The file is gitignored on purpose — it is machine-specific.)

---

## iPhone

**What you need:** a Mac with Xcode. This is Apple's rule, not Capacitor's — an
iOS binary can only be produced on macOS.

```bash
npm run ios          # build, sync, and open the project in Xcode
```

Then in Xcode:

1. Select the **App** target → **Signing & Capabilities**.
2. Set **Team** to your own Apple ID (a free account is enough for a device you
   own). Xcode will pick a bundle id automatically if `dev.artursolak.mergerocket`
   is taken.
3. Pick your iPhone from the device list and press **Run ▶**.
4. On the phone: Settings → General → VPN & Device Management → trust the
   developer certificate.

A free certificate expires after **7 days**; re-run to reinstall. A paid Apple
Developer account ($99/yr) extends that to a year and is what you would need to
use TestFlight for other testers.

No Mac? A cloud macOS runner builds this repo unchanged — Codemagic and GitHub
Actions' macOS runners both work, and both can hand back an `.ipa`.

---

## What the native build adds

- The shell drops its rounded-card chrome and fills the screen (`body.native`).
- The HUD clears the notch and the dock clears the gesture bar
  (`env(safe-area-inset-*)`).
- **Back button** on Android closes a modal, then the bag, then an open screen,
  and only then minimises the app — it never drops you out of a session.
- Progress is saved when the app goes to the background, and mirrored into
  Capacitor Preferences so the OS cannot evict it the way it can `localStorage`.
- Haptics fire on merges, part installs, level-ups and boosters.
- Audio: the pack is bundled, so there is no network dependency in flight mode.

## Icons and the splash screen

`resources/` holds a 1024×1024 icon and a 2732×2732 splash. After changing
either:

```bash
npm run icons        # regenerates every Android density (and iOS if present)
```

## Before it would ever go to a store

- Google Play: a signed **App Bundle** (*Build → Generate Signed App Bundle*),
  a $25 one-time developer fee, a privacy policy, and a content rating.
- App Store: the $99/yr program, screenshots at several device sizes, and a
  review pass.
- Ads are stubbed in `src/ads.ts` and would need a real AdMob app id plus the
  consent flow for EEA users before either store would accept them.
