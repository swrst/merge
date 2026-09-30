/* Restoration projects — the main thread of every world.
 *
 * Travel Town has you rebuild a place task by task; Merge Rocket has you wake
 * a world the same way. Each project asks for a few specific things (and a
 * little money), and finishing it pays well, moves the story on and makes the
 * camp a little more alive. They come in order: the next one opens when the
 * last is done.
 *
 * `launch: true` marks the project that repairs the way off this world. Until
 * it is done the next planet stays locked on the star map, so a world takes a
 * few hours to leave, not ten minutes.
 *
 *   id, name, who (character), text (said when it is done),
 *   needs: [[itemId, qty], ...], coins (cost), xp (world XP reward), gift
 *   (optional: an item or 'chest' dropped on the board as a reward)
 *
 * Needs are picked so each project only uses chains that are awake by the
 * time you reach it.
 */

export const PROJECTS = {
  earth: [
    { id: 'e1', name: 'Clear the Path', who: 'pip', needs: [['branch', 2], ['rock', 1]], coins: 20, xp: 20,
      text: 'You can see the road to the village again! Pip is already running down it.' },
    { id: 'e2', name: 'Mend the Old Well', who: 'grandma', needs: [['log', 1], ['rock', 2], ['puddle', 1]], coins: 40, xp: 30,
      text: 'Fresh water, first time in years. Granny Fern cried a little. Happy tears, she says.' },
    { id: 'e3', name: 'Granny\'s Kitchen', who: 'grandma', needs: [['jam', 1], ['jug', 1]], coins: 60, xp: 45, gift: 'chest',
      text: 'The kitchen smells of jam again. The whole village has found a reason to walk past.' },
    { id: 'e4', name: 'Fix the Fences', who: 'biscuit', needs: [['lumber', 2], ['bale', 1]], coins: 90, xp: 60,
      text: 'Biscuit has a yard to guard now, and he takes the job VERY seriously.' },
    { id: 'e5', name: 'The Flower Market', who: 'gigi', needs: [['bouquet', 1], ['honeycomb', 1], ['geode', 1]], coins: 130, xp: 80, gift: 'chest',
      text: 'Colour on every stall. Gigi says it is almost, almost fashionable.' },
    { id: 'e6', name: 'Repair the Launch Pad', who: 'bloop', launch: true, needs: [['cart', 1], ['statue', 1], ['barrel', 1]], coins: 200, xp: 110, gift: 'chest',
      text: 'Blorp! The pad holds! With fuel in the tank, the rocket can reach Luna now. The meadow will be here when you come back.' },
    { id: 'e7', name: 'The Weaving Circle', who: 'gigi', needs: [['clothbolt', 1], ['nest', 1], ['honeypot', 1]], coins: 240, xp: 130,
      text: 'Quilts for every bed in the village, and one very small one for Biscuit.' },
    { id: 'e8', name: 'The Potter\'s Shed', who: 'grandma', needs: [['claypot', 2], ['fairyring', 1]], coins: 300, xp: 160, gift: 'chest',
      text: 'Pots for seedlings, cups for tea. The shed hums with the kiln.' },
    { id: 'e9', name: 'Market Day', who: 'pip', needs: [['vegcrate', 1], ['pie', 1], ['aqueduct', 1]], coins: 380, xp: 200,
      text: 'Stalls from here to the river. The first market day since the Bloom went quiet.' },
    { id: 'e10', name: 'The Observatory', who: 'timmy', needs: [['telescope', 1], ['obelisk', 1]], coins: 460, xp: 240, gift: 'chest',
      text: 'Timmy has not slept. He has found three new stars and named them all after Biscuit.' },
    { id: 'e11', name: 'Send the Visitors Home', who: 'timmy', needs: [['saucer', 1], ['treehouse', 1]], coins: 600, xp: 320, gift: 'chest',
      text: 'The little saucer lifts off, blinking thank-you in every colour it has. Sunny Meadow is fully awake.' },
  ],
  luna: [
    { id: 'l1', name: 'Light the Camp', who: 'luma', needs: [['mcrystal', 2], ['bulb', 1]], coins: 60, xp: 30,
      text: 'A little ring of glow around the tents. The dark is smaller already.' },
    { id: 'l2', name: 'Build a Dust Wall', who: 'rokk', needs: [['regolith', 2], ['iceshard', 1]], coins: 90, xp: 45,
      text: 'WALL: STANDING. WIND: BLOCKED. ROKK: PROUD.' },
    { id: 'l3', name: 'The Crystal Garden', who: 'nix', needs: [['prismcore', 1], ['glowflower', 1]], coins: 130, xp: 60, gift: 'chest',
      text: 'Nix has arranged the crystals by colour, then by size, then by mood.' },
    { id: 'l4', name: 'Lanterns for the Dark Side', who: 'rokk', needs: [['moonlamp', 1], ['silveringot', 1]], coins: 180, xp: 80,
      text: 'Rokk walks the far side at night now. Humming. Rokk does not hum. Rokk is humming.' },
    { id: 'l5', name: 'Catch a Comet', who: 'luma', needs: [['cometcore', 1], ['icecore', 1]], coins: 240, xp: 100, gift: 'chest',
      text: 'The comet\'s ice was full of old seeds. Luma planted every one.' },
    { id: 'l6', name: 'Moon Launch Pad', who: 'zib', launch: true, needs: [['moonbrick', 1], ['mstar', 1], ['beacon', 1]], coins: 320, xp: 140, gift: 'chest',
      text: 'Beep! Pad ready! Zib tested it. Zib only exploded a little. Ember Hollow is in range now!' },
    { id: 'l7', name: 'A Home for the Pups', who: 'nix', needs: [['moonpup', 1], ['lunamothi', 1]], coins: 380, xp: 170,
      text: 'The pups have a burrow with a view. They bounce off the walls. Literally.' },
    { id: 'l8', name: 'The Rover Garage', who: 'zib', needs: [['toyrover', 1], ['silvercup', 1]], coins: 460, xp: 210, gift: 'chest',
      text: 'Six wheels, one drill, zero brakes. Zib loves it.' },
    { id: 'l9', name: 'Fuel the Heaters', who: 'rokk', needs: [['gascan', 1], ['glacier', 1]], coins: 540, xp: 250,
      text: 'WARM. The whole crew slept through the night for the first time.' },
    { id: 'l10', name: 'Call Home', who: 'zib', needs: [['radar', 1], ['pallasite', 1], ['glowtree', 1]], coins: 700, xp: 340, gift: 'chest',
      text: 'The dish turns, the stars answer. Crater Camp is part of the sky again.' },
  ],
  cindra: [
    { id: 'c1', name: 'Rekindle the Forge', who: 'vulk', needs: [['cinder', 2], ['ashroom', 1]], coins: 80, xp: 35,
      text: 'The forge breathes. Vulk pretends it was nothing. It was not nothing.' },
    { id: 'c2', name: 'New Tools', who: 'vulk', needs: [['ironingot', 1], ['obshard', 2]], coins: 120, xp: 50,
      text: 'Hammers, tongs and one very large spoon. Vulk will not explain the spoon.' },
    { id: 'c3', name: 'The Glass Stall', who: 'ember', needs: [['glassbead', 2], ['bigshroom', 1]], coins: 170, xp: 70, gift: 'chest',
      text: 'Ember sells beads to travellers who have not arrived yet. She says they will.' },
    { id: 'c4', name: 'Stew for Everyone', who: 'ember', needs: [['spicejar', 1], ['forgefire', 1]], coins: 230, xp: 90,
      text: 'Very, very spicy. Nobody complained. Nobody could speak.' },
    { id: 'c5', name: 'The Bell Tower', who: 'vulk', needs: [['copperbell', 1], ['fireopal', 1]], coins: 300, xp: 120, gift: 'chest',
      text: 'The bell rings at sunset. The vents seem to quieten when it does.' },
    { id: 'c6', name: 'Heat-Proof Launch Pad', who: 'bloop', launch: true, needs: [['ironanvil', 1], ['obmirror', 1], ['bellows', 1]], coins: 380, xp: 160, gift: 'chest',
      text: 'It will not melt. Probably. Blorp. Tidal Shallows is next — pack a towel.' },
    { id: 'c7', name: 'Nests for the Salamanders', who: 'ember', needs: [['salamander', 1], ['emberegg', 1]], coins: 450, xp: 200,
      text: 'Tiny flames curled in warm stone. They follow Ember everywhere now.' },
    { id: 'c8', name: 'The Basalt Hall', who: 'vulk', needs: [['columnstack', 1], ['coppercog', 1]], coins: 540, xp: 240, gift: 'chest',
      text: 'A hall of stone columns, cool inside, warm outside. Meetings happen there now.' },
    { id: 'c9', name: 'Steam Power', who: 'rokk', needs: [['boiler', 1], ['sulfurcrystal', 2]], coins: 640, xp: 290,
      text: 'PRESSURE: NOMINAL. HOLLOW: POWERED. ROKK: ALSO NOMINAL.' },
    { id: 'c10', name: 'The Ember Orchard', who: 'ember', needs: [['fruitbasket', 1], ['greatforge', 1], ['rubyshard', 1]], coins: 800, xp: 380, gift: 'chest',
      text: 'Fire and garden at the same time, without either winning. Cindra is reborn.' },
  ],
  nerith: [
    { id: 'n1', name: 'Clean the Beach', who: 'kelpa', needs: [['seashell', 2], ['kelpfrond', 1]], coins: 100, xp: 40,
      text: 'Sand you can actually walk on. Kelpa made a sandcastle. Then another. Then eleven.' },
    { id: 'n2', name: 'Replant the Reef', who: 'kelpa', needs: [['coralsprig', 2], ['seedpearl', 1]], coins: 150, xp: 55,
      text: 'Little corals in neat rows. The first fish arrived an hour later.' },
    { id: 'n3', name: 'The Fish Market', who: 'marin', needs: [['silverfish', 2], ['seafoam', 1]], coins: 210, xp: 75, gift: 'chest',
      text: 'The market smells of salt and gossip. Exactly right.' },
    { id: 'n4', name: 'Salt the Catch', who: 'marin', needs: [['saltbrick', 1], ['kelpcoil', 1]], coins: 270, xp: 95,
      text: 'Enough stores for the whole winter. Marin counted twice.' },
    { id: 'n5', name: 'Raise the Wreck', who: 'marin', needs: [['driftboat', 1], ['pearl', 1]], coins: 340, xp: 125, gift: 'chest',
      text: 'The old skiff floats again. Sirra swears it is the same boat her grandmother sailed.' },
    { id: 'n6', name: 'The Floating Launch Pad', who: 'bloop', launch: true, needs: [['nautilus', 1], ['coralfan', 1], ['jellybell', 1]], coins: 420, xp: 170, gift: 'chest',
      text: 'It bobs a bit. The rocket does not mind. Aurora Reach — the last world — is in range.' },
    { id: 'n7', name: 'Guard the Hatchlings', who: 'kelpa', needs: [['hatchling', 1], ['tentapal', 1]], coins: 500, xp: 210,
      text: 'Every hatchling made it to the water. Kelpa counted every single one, out loud.' },
    { id: 'n8', name: 'The Harbour', who: 'marin', needs: [['anchor', 1], ['saltpillar', 1]], coins: 600, xp: 260, gift: 'chest',
      text: 'Boats come and go. Some of them from worlds you woke.' },
    { id: 'n9', name: 'Sea-Glass Lamps', who: 'sirra', needs: [['glasslamp', 1], ['pearlstrand', 1]], coins: 700, xp: 310,
      text: 'The shallows glow green at night. The humming is louder now.' },
    { id: 'n10', name: 'Wake the Drowned City', who: 'sirra', needs: [['sunkenidol', 1], ['coralpalace', 1], ['starurchin', 1]], coins: 880, xp: 400, gift: 'chest',
      text: 'The domes break the surface, glittering. Nerith breathes again.' },
  ],
  vela: [
    { id: 'v1', name: 'Solid Ground', who: 'zephyr', needs: [['cloudpuff', 1], ['aurorasilk', 1]], coins: 120, xp: 45,
      text: 'A cloud you can stand on. Zephyr has been jumping on it for an hour.' },
    { id: 'v2', name: 'Stitch the Sky', who: 'halo', needs: [['auroraveil', 1], ['starlet', 2]], coins: 180, xp: 60,
      text: 'One stripe of colour across the dark. Halo keeps looking up.' },
    { id: 'v3', name: 'The Sky Orchard', who: 'wren', needs: [['skyfruit', 1], ['windcoil', 1]], coins: 250, xp: 85, gift: 'chest',
      text: 'Golden fruit on floating branches. The birds found it before anyone.' },
    { id: 'v4', name: 'Tune the Chimes', who: 'wren', needs: [['chimeset', 1], ['prismlens', 1]], coins: 320, xp: 110,
      text: 'The chimes play a tune nobody taught them. Halo says it is the Vault singing back.' },
    { id: 'v5', name: 'Nests on the Wind', who: 'wren', needs: [['skyplume', 1], ['starcluster', 1]], coins: 400, xp: 140, gift: 'chest',
      text: 'Nests on every cloud. The sky birds are home.' },
    { id: 'v6', name: 'The Drift Yards', who: 'zephyr', needs: [['driftballoon', 1], ['windvane', 1], ['thundercloud', 1]], coins: 480, xp: 180, gift: 'chest',
      text: 'Balloons between the islands. Everyone can visit everyone now.' },
    { id: 'v7', name: 'A Den for the Star-Kits', who: 'halo', needs: [['starsprite', 1], ['auroracloak', 1]], coins: 560, xp: 220,
      text: 'The little star-kits have a den of their own. They glow brighter when you visit.' },
    { id: 'v8', name: 'The Orbital Station', who: 'zib', needs: [['commsat', 1], ['nebjar', 1]], coins: 660, xp: 270, gift: 'chest',
      text: 'Every camp on every world can talk to every other. Zib has not stopped beeping.' },
    { id: 'v9', name: 'The Celestial Garden', who: 'halo', needs: [['starpot', 1], ['ringplanet', 1]], coins: 760, xp: 320,
      text: 'Flowers that glow, planets that spin, a garden in the sky.' },
    { id: 'v10', name: 'The Bloom Returns', who: 'bloop', needs: [['skytreehouse', 1], ['prismarray', 1], ['boxkite', 1]], coins: 950, xp: 420, gift: 'chest',
      text: 'Five worlds, all lit. The Vault is empty and the galaxy is full. That was the whole idea.' },
  ],
};
