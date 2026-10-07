/* The catalogue redo: what each chain becomes so that NOTHING looks like Earth
   (no trees, berries, fruit, bread, fish, ropes…). Same number of steps as the
   chain has now, so item ids stay and only names + art change when the new
   sheets land. Chains not listed keep their concept and just get redrawn.
   Used by scripts/item-prompts.mjs. */
export const REDO = {
  // ---------------------------------------------------------------- Meadow
  wood: ['Meteor Metal', ['a small meteor chip', 'a glowing meteor chunk', 'a metal ingot', 'a stack of metal plates', 'a metal cargo crate', 'an open tool chest', 'a hover sled', 'a little shuttle']],
  berry: ['Space Snacks', ['a nutrient pellet', 'a snack cube', 'an astronaut food tube', 'a ration tray', 'a jelly dome dessert', 'a snack vending pod', 'a rocket diner']],
  water: ['Moonwater', ['a glowing water drop', 'a crater puddle', 'a water canister', 'a water tank', 'an orb fountain', 'a hydro tower', 'an ice comet']],
  grass: ['Solar Power', ['a solar chip', 'a solar cell', 'a solar panel', 'a panel array', 'a power station', 'a solar satellite']],
  flower: ['Nebula Lights', ['a tiny spark', 'a glow bulb', 'a space lamp', 'a lantern', 'a string of lights', 'a neon sign', 'a light tower']],
  honey: ['Star Nectar', ['a nectar drop', 'a nectar bubble', 'a glowing hex cell', 'a nectar pot', 'a buzzbot hive pod', 'a royal nectar orb', 'a nectar palace']],
  cloth: ['Space Suits', ['a spool of star thread', 'a suit patch', 'a space glove', 'a space helmet', 'moon boots', 'a jetpack backpack', 'a full spacesuit']],
  feather: ['Jet Gear', ['a fuel puff', 'a small thruster', 'a jet boot', 'a jetpack', 'a hoverboard', 'a jet bike']],
  clay: ['Moon Goo', ['a blob of orange goo', 'a goo lump', 'a goo pot', 'an orbit urn', 'a rocket kiln', 'a nebula vase']],
  veggie: ['Hydroponics', ['a seed capsule', 'a sprout in a test tube', 'a grow tube', 'a hydro tray', 'a grow rack', 'a greenhouse dome', 'a hydro tower']],
  bakery: ['Moon Cheese', ['a cheese crumb', 'a cheese cube', 'a cheese wedge', 'a crater cheese wheel', 'a cheese stack', 'a cheese cart', 'a whole cheese moon']],
  tea: ['Zero-G Drinks', ['a fizz drop', 'a drink pouch with a straw', 'a soda can', 'a fizz bottle', 'a drink dispenser', 'a soda fountain']],
  pond: ['Slime Pool', ['a slime drop', 'a slime puddle', 'a slime jar', 'a slime frog alien', 'a slime fountain', 'a slime pool', 'a slime volcano']],
  picnic: ['Cargo', ['a small box', 'a parcel', 'a cargo crate', 'a crate stack', 'a cargo container', 'a cargo drone', 'a cargo ship', 'a space freighter']],
  // ---------------------------------------------------------------- other worlds
  glow: ['Glow Pods', ['a glow spore', 'a glow pod', 'a pod cluster', 'a pod lamp', 'a pod tower', 'a pod city']],
  moonmelon: ['Algae Farm', ['an algae drop', 'an algae jar', 'an algae tank', 'an algae crate', 'an algae dome', 'an algae farm']],
  spice: ['Fire Gel', ['a fire drop', 'a gel pouch', 'a gel jar', 'a gel crate', 'a gel barrel', 'a gel refinery']],
  emberfruit: ['Lava Lamps', ['a lava drop', 'a lava bulb', 'a lava lamp', 'a big lava lamp', 'a lava lamp stand', 'a lava light tower']],
  forge: ['Star Forge', ['a star-coal lump', 'a star-coal brick', 'a forge flame', 'a bellows', 'a great forge', 'a star foundry']],
  kelp: ['Bubble Tech', ['a bubble', 'a bubble cluster', 'a bubble jar', 'a bubble helmet', 'a bubble pod', 'a bubble dome', 'a bubble city']],
  fishc: ['Swimmer Critters', ['a tiny glowing swimmer critter', 'a three-eyed swimmer critter', 'a big swimmer critter', 'a critter tank', 'an aquarium of critters', 'an aqua dome']],
  shroom: ['Ash Shrooms', ['an ash spore', 'an ash mushroom', 'a great ash mushroom', 'a glowing cap', 'a mushroom tower', 'a mushroom hollow', 'a mushroom castle']],
  balloonc: ['Drift Yards', ['a silk scrap', 'a balloon envelope', 'a drift balloon', 'a balloon airship', 'a glowing sky heart']],
  salt: ['Sea Crystals', ['a crystal grain', 'a crystal cube', 'a crystal brick', 'a crystal pillar', 'a crystal temple', 'a crystal lighthouse']],
  sunkn: ['Sunken Saucer', ['a scrap bit', 'a hull piece', 'a porthole', 'a sunken pod', 'a sunken robot', 'a sunken saucer', 'a sunken station']],
  harbour: ['Sub Dock', ['a cable coil', 'a float', 'a beacon buoy', 'a tractor hook', 'a helm console', 'a diving pod', 'a submarine']],
  skyfruit: ['Cloud Jelly', ['a jelly wisp', 'a jelly blob', 'a jelly jar', 'a jelly cake', 'a jelly feast', 'a jelly isle']],
  kite: ['Drones', ['a rotor', 'a mini drone', 'a drone', 'a cargo drone']],
  starflower: ['Glow Orbs', ['an orb seed', 'a small orb', 'an orb pair', 'an orb pot', 'an orb garden', 'an orb field']],
  // ---------------------------------------------------------------- creatures (Bob / Bloop style)
  mush: ['Eyeshrooms', ['a tiny one-eyed mushroom critter', 'a two-eyed mushroom critter', 'three mushroom critters together', 'a ring of mushroom critters', 'a big glowing mushroom critter']],
  garden: ['Glowbugs', ['a glowing grub alien', 'a glowing cocoon', 'a winged glowbug alien', 'a jar full of glowbugs', 'a glowbug queen']],
  lunamoth: ['Crater Wings', ['a pale blue egg', 'a silk cocoon', 'a fluffy winged moon critter', 'a bigger winged moon critter', 'a glowing winged moon queen']],
  moonpup: ['Moon Critters', ['a wobbly egg', 'a tiny blob critter', 'a round three-eyed moon pup', 'a hopping moon critter', 'a six-legged crater critter', 'a star critter', 'a big friendly moon guardian']],
  phoenix: ['Flame Wings', ['a glowing ember feather', 'an ember egg', 'a little flame critter', 'a winged flame critter', 'a big fiery guardian']],
  salamander: ['Fire Critters', ['a warm egg', 'a tiny flame blob', 'a fire critter', 'a lava critter', 'a small magma dragon-alien', 'a big ember dragon-alien']],
  turtle: ['Shell Critters', ['a shell egg', 'a tiny shell critter', 'a shell critter', 'a giant island-shell critter']],
  manta: ['Gliders', ['a glowing egg', 'a baby glider alien', 'a glider alien', 'a star glider', 'a sky glider']],
  starling: ['Star Critters', ['a starlit egg', 'a glimmer blob', 'a star sprite', 'a nebula kitten-alien', 'a comet critter', 'an aurora critter', 'a celestial critter', 'a constellation beast']],
  skynest: ['Cloud Critters', ['a fluffy wisp', 'a sky plume', 'a cloud nest', 'a sky egg', 'a winged cloud critter', 'a giant cloud glider']],
  urchin: ['Spike Critters', ['a spike', 'a spiky blob alien', 'a star-spiked alien', 'a crown of spiky aliens']],
  lumin: ['Deep Lights', ['a glowing mote', 'a jelly blob alien', 'a lantern alien', 'an abyss orb', 'a glowing deep heart']],
};
/* chains of living things: drawn as cute, round, funny alien creatures in the
   style of Bob and Bloop, never Earth animals */
export const CREATURES = new Set(['fishc', 'lumin', 'pets', 'visitor', 'garden', 'mush', 'moonpup', 'lunamoth', 'phoenix', 'salamander', 'squid', 'turtle', 'manta', 'starling', 'skynest', 'urchin', 'pond']);
