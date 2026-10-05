# Merge Rocket: tester build (0.25)

## Making the build (Windows, Android)

1. Install **Android Studio** once. It brings the Android SDK and Java.
2. Double-click **`build-apk.bat`** in the project folder, or run it in a terminal.
3. It produces **`MergeRocket-test.apk`** in the same folder, in about 3–5 minutes (longer the first time).
4. Send the file to testers: Drive link, WhatsApp, email, anything.

If Gradle complains about the SDK: open the `android` folder in Android Studio once, let it sync, then run the script again.

**iPhone testers** need a Mac with Xcode (`npm run ios`) and TestFlight. There is no way around that.
Until then they can play the web version, `MergeRocket.html`, in Safari.

## What testers do

**Install**
- Open the APK on the phone.
- Android asks to "allow installing from this source": allow it once.
- The app icon is a rocket.

**Play**
- 20–30 minutes on the first day.
- Then come back 2–3 times over the next days. Producers refill while you are away, and the daily gift and wheel reset.

**Feedback**
- ⚙️ → **Send feedback**: pick a face and write a line.
- The report includes the build, phone model, where you are in the story and any errors.
- If no email address is set, it is copied to the clipboard; paste it to the developer.
- To send feedback by email instead, put your address in `src/services/config.ts` → `app.supportEmail` before building.

**Tester tools**
- ⚙️ → tap the version line (**Merge Rocket 0.25 test**) 5 times.
- You get buttons for energy, coins, gems, refilling producers, the current chapter's items and XP.
- Use them to see later content without waiting.
- Turn them off for the store build: `testerTools: false` in `config.ts`.

## Questions to ask testers

1. Did you understand what to do in the first 2 minutes? Where did you get stuck?
2. When did you first want to stop playing, and why? (Energy? Nothing to do? Confused?)
3. Which screen or button was unclear?
4. Did anything look broken, too small, or cut off on your phone?
5. Sound and music: nice, annoying, or did you mute it?
6. Would you open it again tomorrow? What would make you?

## Known gaps in this build

- **Ads and purchases are test mocks.**
  - Videos are a 3-second placeholder.
  - "Buying" gems opens a test sheet; no money moves.
- **Worlds 4 and 5** (Tidal Shallows, Aurora Reach) are playable with placeholder art.
- **Leaderboard** rivals are simulated.
- **Saving:** progress lives on the phone. Uninstalling the app erases it.
