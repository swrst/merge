# Play Console: answers for "Finish setting up your game"

What to pick in each section, matching what the game actually does and what the privacy policy says. If the game changes (accounts, chat, a new SDK), these answers change too.

## App content

**Privacy policy**: `https://galaxy-adventure-8545b.web.app/privacy-policy`

**App access (sign-in details)**: *All functionality is available without any special access.* There are no accounts.

**Ads**: *Yes, my app contains ads* (AdMob rewarded videos, only when the player chooses one).

**Content rating** (IARC questionnaire):
- Email: artursolakdev@gmail.com. Category: **Game**.
- Violence, fear, sexuality, language, drugs, gambling: **No** to all. (The lucky wheel and chests are not gambling: they cannot be bought with real money directly, and nothing can be cashed out.)
- Users interact or exchange content with each other: **No** (no chat, no user content).
- Shares the user's location: **No**.
- Digital purchases: **Yes**.
- Expected result: PEGI 3 / ESRB Everyone, with "In-App Purchases".

**Target audience and content**:
- Age groups: **13–15, 16–17, 18 and over**. Not under 13: the privacy policy says the game is not directed at children, and an under-13 audience brings the Families policy (stricter ad rules, a teacher-approved review).
- "Could your store listing unintentionally appeal to children?" Answer honestly. If Google decides it appeals to children, it may ask for the Families requirements anyway; then we turn off personalised ads for unknown ages.

**Data safety**:
- Does the app collect or share user data? **Yes**. Encrypted in transit: **Yes**. Account creation: **no accounts**. Users can request deletion: **Yes** (by email, as the policy says).
- Data types:

| Type | Collected | Shared | Why | Who |
|---|---|---|---|---|
| Location → Approximate location (from IP) | Yes | Yes | Advertising, Analytics, Fraud prevention | AdMob, Firebase |
| Financial info → Purchase history | Yes | No | App functionality | Google Play Billing, RevenueCat |
| App activity → App interactions | Yes | Yes | Analytics, Advertising | Firebase, AdMob |
| App info and performance → Crash logs, Diagnostics | Yes | No | Analytics, App functionality | Crashlytics |
| Device or other IDs | Yes | Yes | Advertising, Analytics, Fraud prevention | AdMob, Firebase, RevenueCat |

  All of it is collected automatically (not optional) and processed ephemerally: no. Nothing else (name, email, contacts, photos, precise location) is collected.

**Advertising ID**: *Yes*, used for **Advertising** and **Analytics** (AdMob adds the permission itself).

**Government apps / Financial features / Health / News**: No, none.

## Store settings

- App category: **Game → Casual**. Tags: merge, casual, puzzle, space.
- Contact email: artursolakdev@gmail.com (later support@galaxyadventure.com). Website: `https://galaxy-adventure-8545b.web.app`.

## Main store listing

- App name: **Galaxy Adventure**
- Short description (80 characters max):
  > Merge alien wonders, rebuild your rocket and wake up five sleeping planets!
- Full description:
  > Crash-landed on a sleepy little planet, you meet Dr. Zonk, a brilliant (and slightly broken) alien scientist whose ship is scattered across the meadow. Merge, build and explore to wake up the galaxy, one planet at a time!
  >
  > MERGE EVERYTHING
  > Drag two of the same thing together to make something bigger and better. Meteor chips become metal plates, glow spores become pod cities, tiny eggs hatch into very odd critters. Over 1000 items in 155 chains to discover.
  >
  > FILL CONTRACTS FOR THE LOCALS
  > Grumpy mayors, fabulous stylists, a robot who shouts everything: every alien wants something. Fill their orders for coins, XP and gifts.
  >
  > REBUILD THE ROCKET, VISIT NEW WORLDS
  > Finish chapters to bring the meadow back to life, rebuild Dr. Zonk's rocket and fly to the Moon, a fire planet, an ocean world and islands in the sky. Every world has its own story, producers and creatures.
  >
  > SO MUCH TO DO
  > Dr. Zonk's lab, pets to hatch, a seasonal sticker album, constellations to light, monthly Star Expeditions, timed events, a lucky wheel and side games.
  >
  > Play at your own pace. Free to play, with optional in-app purchases. Ads only when you choose to watch one for a reward.
- Graphics: `resources/store/icon_512.png`, `resources/store/feature_graphic.png`, phone screenshots in `resources/store/screenshots/` (2 to 8). These screenshots are from before the hologram UI: fine for internal testing, retake them before the public release.
