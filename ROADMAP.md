# Merge Rocket — roadmap

## 1. UI direction

**Done in v23**
- **One button system.**
  - Green pill = the action this screen is about.
  - Gold = spend something.
  - Cream "soft" = everything secondary, including Close.
  - All buttons share one height, are never wider than a thumb sweep, and move when pressed.
  - Stretched painted 9-slice buttons are gone.
- **Dialogs** have the same red ✕ corner as popups.
- **"Show me on the board"** banners are replaced by a tappable producer card with **Find it**: chain panel, rocket, contract sheet.
- **Settings** are switches. "Start a new game" asks twice.

**Next**

1. **Rewards screen.** ✅ The reward card exists (daily delivery, achievements, pup). Still to do: chests, event track, level-up.
2. **Contract cards.** Make the character bigger, put a progress ring around the card, and turn the card itself into a gold "GIVE" button when ready. Remove the separate tick.
3. **Board chrome.**
   - The event ribbon and bag chip above the board eat a row on small phones. Move them into the HUD as small chips.
   - Give the hint button a painted icon only, no label.
4. **Typography.** Fredoka for titles and numbers, a rounded sans for body text. Cap body copy at about 2 lines per card.
5. **Icons.** ✅ Emoji with a painted twin are swapped automatically (`EMO` in `game.ts`).
6. **Haptics + sound pass** on every button. Already wired, but should be checked on a real phone.

## 2. Next worlds

| World | State |
|---|---|
| Sunny Meadow | 22 chapters with dialogue, fully painted. |
| **Crater Camp (Moon)** | Fully painted. **Dialogue added to all 10 chapters in v23** (Nana Luma, Rokk, Nix, Zib, Dr. Zonk). |
| **Ember Hollow (Cindra)** | 15 chains / 101 items / 13 producers in the catalogue. **Dialogue for all 10 chapters added in v23** (Vulk, Ember, Rokk, Dr. Zonk). **Art prompts: `art/CINDRA-PROMPT.md`** (11 sheets). |
| Tidal Shallows, Aurora Reach | Fully painted, 10 chapters each with dialogue (v27). Next: 4–6 more chapters each. |

**Moon and Cindra depth.** Both have 10 chapters against the Meadow's 22. Add 4–6 each, using the chains no chapter asks for yet (Moon: helium, meteorite, moonmelon; Cindra: phoenix, steam, sulfur), and one new producer per 2 chapters.

## 3. New features, side games, events

Ordered by player value per effort.

1. **Weekly event pass (season track).**
   - 30 tiers of rewards filled by event points.
   - A free row plus a gem/IAP "golden" row.
   - This is the main retention and monetisation loop in this genre.
2. **Themed mini-events, 3 days each, rotating.**
   - **Harvest Rush**: double drops from one producer type.
   - **Merge Madness**: tier 5+ merges give tokens.
   - **Visitor Week**: a special guest with a 6-step story chain.
   - **Lucky Crates**: every chest has a chance at a gem crate.
3. **Friend help (async, no server needed at first).**
   - Share a link with a "help code"; opening it gives both players energy.
   - Later: real friends via Play Games / Game Center.
4. **Collections / album sets.**
   - Find all crowns of one world for a permanent perk (+5% drops in that world).
   - The trophy shelf already counts them.
5. **Daily tasks 2.0**: 3 tasks per day plus a weekly chest for 15 tasks. A daily loop exists; make it weekly.
6. **Pets**: ✅ the Moon Pup (level 6) fetches a gift every 20–40 minutes and grows through 5 sizes. Next: let it auto-deliver a contract at its biggest size.
7. **Decorations**: spend coins on camp decorations (fences, lamps, statues) shown on the camp scene. This is a coin sink that players actually enjoy.
8. **Seasonal skins**: Halloween / winter tile sets and producer hats. Cheap art, big perceived freshness.
9. **Side games to keep:** Alien Pairs, Crater Dig, Market.
10. **Side games to add:** Rocket Race (time-attack merges) and Delivery Run (fill 5 contracts in 10 minutes for a chest).

### v30 shortlist (fits the space story, small art cost)
1. **Meteor Shower weekend.** A meteor every couple of minutes for 48 h. Craters drop event tokens as well as scrap, and there is a "catch the falling star" tap mini-game on the board.
2. **Pet expeditions.** Send the alien pet to a world you already woke, for 1–4 h. It comes back with a rare item, a relic or Star Cores. It gives the pet a job after evolving.
3. **Postcards from home.** After you leave a world, its people send a postcard now and then: a request for one item from their world, paid in gems. It keeps old worlds alive and reuses their chains.
4. **Black Hole bin.** A tiny black hole beside the board swallows unwanted items for event points or Science instead of coins. It is a fun, visual way to clear the board.
5. **Zonk's Experiment of the Day.** One lab recipe a day is "hot": brewing it pays double and fills an event bar.
6. **Rocket Race.** A 90-second side game: make as many tier-4 items as possible from a fixed board. Weekly leaderboard against the bots that already exist.
7. **Camp decorations.** Coins buy lamps, fences, statues and flags placed on the camp painting, with one set per world. This needs only small painted props.
8. **Constellation sky.** The lit constellations are drawn across the map's sky, so the permanent perks are visible.
9. **Season track** (as in 1. above): a free and a golden row of 30 tiers, fed by every event.

## 3b. Done in v25–v26

- **Power ×2** (level 8): taps cost double energy, and drops arrive one step higher. This is Travel Town's "Power Boost".
- **Moon Pup** companion.
- **Late-Meadow chains:** Picnic, Alien Pets, Music, Weather, Rocket Parts.
- **Helpers:** Blorb, Glimmer, Oops, the Grub Brothers.
- **Tester build:** feedback, tester tools, `build-apk.bat`.

**Next, from the genre:**
- **Scissors booster** (split an item into two of the step below).
- **"Out of energy" offer** (energy + gems at a discount).
- **Album card sets:** 9 cards, set reward.
- **Special event board** with its own chains.

## 4. Store-ready plumbing (done in v23)

See `SERVICES.md`:

- Ads, purchases (with Restore), review prompt, update check, local notifications, games services (sign-in, leaderboard, cloud save) and analytics.
- Everything is mocked behind one config file, with a developer panel to drive the mocks.
- Going live means filling ids/keys, not changing code.

## 5. What players would want changed

From the playtest bot, screenshots and genre norms. ✅ = done now.

- ✅ **"Where do I get this?"** answered everywhere: contract sheet, chain panel, Find it.
- ✅ **Coming back:** the toast "while you were away: +40 ⚡, 3 producers refilled".
- ✅ **Coins mean something:** chapter costs ×4, selling is a clear-out, crowns go on the shelf.
- **Energy feels harsh around chapter 7** (about 50 minutes of waiting in the bot run). Options:
  - one more free energy source (the daily "snack" twice a day), or
  - chapter 7's needs cut to two items.
- **Board clutter in the mid-game.**
  - Auto-stack identical tier-1 items into a pile, shown as ×N on one tile.
  - Bigger bag earlier (the bag opens late).
- **No undo on a merge.** A one-step undo for 5 seconds after a merge, like the sell undo.
- **Story pacing.** Every 3rd chapter should unlock something visible on the camp scene, not only a producer.
- **Too many popups at level-up.** Fold level-up rewards into the level banner, without a dialog.
- **Notifications** must be opt-in after the first session, not at install. `notify.ts` asks the first time it schedules, which happens on going to background.
