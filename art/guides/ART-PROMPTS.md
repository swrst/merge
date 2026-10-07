# Galaxy Adventure: art prompts (current wave)

This is the only prompt file. Older waves are in git history.

Send the SETUP message once, with STYLE-REFERENCE.png attached. Then send one numbered prompt per message. Save each picture in `chatgpt art` and tell me.

---

## SETUP (send once, attach STYLE-REFERENCE.png)

We're making art for my mobile game "Galaxy Adventure" (a Travel Town–style merge game on alien planets). Match the colours and lighting of the attached reference, but keep everything SIMPLER:
- bold, chunky, toy-like shapes with a big, clear silhouette
- few details: at most 2–3 small accents per object, no tiny clutter, no busy textures, no sparkles everywhere
- smooth glossy surfaces with soft shading and one soft white highlight from the upper left
- a thin, darker outline in the object's own colour, and a small soft shadow underneath
- three-quarter view from about 30° above
- everything is extraterrestrial (alien plants, planets, crystals, rockets, saucers, antennae, extra eyes), in a palette of purple, teal, magenta, lime and gold
- characters are funny, weird-looking ADULT cartoon aliens: never babies, never scary, never Earth animals

Every image: ONE object (or one sheet when I say grid), centred, on a plain pure-white or transparent background, square 1024×1024, no text, no frame. It must still read clearly at 48 px. On sheets the cells are equal and the objects don't touch.

Answer each of my next messages with exactly one image.

---

## Brand

**1. logo** (transparent, 1536×1024): the text "Galaxy Adventure" on two lines.
- "Galaxy" in chunky, rounded lime-to-teal letters; "Adventure" in rounded golden-orange letters.
- A thick dark-purple outline and a soft shadow.
- One small cartoon rocket swooshing around the letters, leaving a short curved trail.
- Clean and bold. No other text, no clutter.

**2. app_icon** (1024×1024, full bleed, no transparency, no text):
- One big friendly lime-green alien face with two antennae, peeking out of a round rocket porthole.
- A plain deep-purple background with a soft glow behind the alien and two or three stars.
- Very simple, so it reads at 48 px. No border and no rounded corners.

**3. loading_screen** (portrait, 1024×1792, no text):
- A small round alien planet seen from just above, with a few chunky purple trees and a rocket on a launch pad.
- A big ringed planet in a simple starry purple sky.
- Two or three of our alien characters waving in the lower half.
- Keep the top third almost empty for the logo. Simple shapes, not busy.

**4. feature_graphic** (wide, 1024×500, no text): the same scene for the Play Store banner, with the characters on the right and open sky on the left.

---

## Space UI kit (replaces the cream and wood panels)

Smooth dark-violet "space glass" with a thin gold rim and a faint cyan inner glow, readable with white text on top. Flat and simple: no rivets clutter, no texture.

**5. popup_frame** (transparent, 1024×944): a big empty rounded panel. No title ribbon.

**6. ribbon** (transparent, 1536×384): a teal title ribbon with a gold edge and folded tails. Empty middle.

**7. card_order** (transparent, 768×640): a small lilac glass card with a gold rim and a round porthole at the top. Empty.

**8. dock_bar** (transparent, 2048×384): a wide, low bottom bar in dark violet with rounded ends and a gold trim. Empty.

**9. chip_bg** (transparent, 1024×384): a pill-shaped counter in dark glass with a gold rim.

**10. sheet_tiles_meadow** (grid 3×1, flat square top-down tiles with rounded corners that tile seamlessly):
1. light tile: smooth mint alien moss
2. dark tile: the same moss a shade deeper
3. locked tile: the moss with a few purple crystals

**11. level_frame** (transparent, 1024×512): the player's HUD level box.
- A round portrait ring on the left in dark violet glass with a gold rim.
- On its lower-right edge, a small round level badge with an empty centre for the number.
- A slim empty XP bar track to the right of the ring, centred on it.
- All one piece, aligned and simple.

**12. sheet_buttons_round** (grid 3×2), round glossy buttons with a simple white symbol:
1. settings (a gear)
2. shop (a saucer stall)
3. close (an X on red)
4. info (an "i" on cyan)
5. sound (a speaker)
6. music (a note)

---

## The last earthy pieces (keep them simple)

**13. sheet_comet_lanterns** (grid 3×2):
1. a comet lantern
2. three star lanterns on a string
3. a flower lantern
4. a crystal lantern arch
5. a saucer carrying a lantern
6. lanterns rising over a floating island

**14. sheet_space_candy** (grid 3×2):
1. a planet gumdrop
2. a galaxy lollipop
3. a jar of star candies
4. alien cupcakes
5. a saucer carousel
6. a rocket candy castle

**15. sheet_rocket_parts** (grid 4×2):
1. a bolt with a glowing core
2. a star gear
3. a fin
4. a nose cone with a porthole
5. a booster
6. a green fuel cell
7. an engine with three nozzles
8. a mini rocket on a pad

**16. sheet_visitor_eggs** (grid 4×1):
1. a mint egg with star spots
2. a lilac egg with an eye peeking through a crack
3. a lilac egg with galaxy spots
4. the egg hatching, with a little blob leaning out

**17. sheet_producers_d** (grid 3×2, each on its own small round mound):
1. Glowbug Burrow
2. Scrap Hull, overgrown with alien plants
3. Lantern Stall with a saucer roof
4. Hovering Candy Cart
5. Crash Site: a saucer nose-down in purple moss
6. Falling Star in a crystal crater

---

## Redo: SIMPLE item icons (the board must read at a glance)

The items are too detailed: at board size (about 60 px) nobody can tell what they are. Redo the Meadow chains, starting with the ones a new player sees first.

Add this to EVERY sheet prompt:

> ICON STYLE, VERY SIMPLE: each object is one big chunky shape you can name in one word, with a bold dark outline, 2–3 main colours and one soft highlight. No small parts, no tiny sparkles, no stars or planets painted on it, no scenery and no ground under it. The object fills 80% of its cell. It must be recognisable at 40 px, like a mobile game inventory icon.

Each step of a chain must look clearly bigger or richer than the one before (more of the same thing, a bigger version, or the same thing with one new addition), never a different picture.

**18. sheet_simple_wood** (grid 4×2): a purple twig · a branch with 3 blue leaves · a short purple log · 3 planks tied together · a wooden crate · an open toolbox · a round purple tree · a wooden rocket

**19. sheet_simple_stone** (grid 4×2, last cell EMPTY): a grey pebble · a lumpy rock · a geode cut open with teal crystal · a cut purple gem · a stone idol with 3 eyes · an obelisk · a stone arch

**20. sheet_simple_berry** (grid 4×2, last cell EMPTY): one glowing pink berry · 3 berries on a sprig · a jar of pink jam · a pink pie · a 2-tier pink cake · a picnic basket of pies · a tiny pink jam house

**21. sheet_simple_water** (grid 4×2, last cell EMPTY): a teal water drop · a round puddle · a water jug · a barrel · a round fountain · a short arch bridge with water · a water tower

**22. sheet_simple_grass** (grid 3×2): a tuft of blue grass · a bundle of hay · a round hay bale · a straw hat with 2 antennae · a robot scarecrow · a cart full of hay

**23. sheet_simple_flower** (grid 4×2, last cell EMPTY): a seed · a sprout with 2 leaves · a closed pink bud · an open pink tentacle flower · a bouquet · a flower crown · a flower arch

**24. sheet_simple_honey** (grid 4×2, last cell EMPTY): a honey drop · a round honey bead · a piece of honeycomb · a honey pot · a round beehive · a golden jelly orb · a honey tower

**25. sheet_simple_mushroom** (grid 3×2, last cell EMPTY): a tiny mushroom button · a red mushroom with one eye · 3 mushrooms together · a ring of mushrooms · a mossy heart

---

## Next wave
- Tidal Shallows makeover: alien fish, a space dock instead of rope, anchor and wheel, crystal salt, a moon turtle, a sunken saucer instead of the galleon.
- Ember Hollow makeover: star-coal, fire pods, meteor iron.
