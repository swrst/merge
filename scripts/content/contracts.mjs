/* Why people want things.
 *
 * A contract used to be a random character wanting a random item with a
 * random catch-phrase. Now each character has favourite chains (LIKES), asks
 * for things from those first, and says what the thing is for (ASKS, one line
 * picked per contract). Two-item contracts pair chains the same person likes,
 * so "a Log and a Pebble" reads as "fixing the garden wall", not a shopping
 * list from nowhere.
 *
 * Lines are short: they sit under the name on a 148px card.
 */

export const ASKS = {
  /* --------------------------------------------------------- Sunny Meadow */
  wood: ['The hangar needs mending.', 'Metal for my ship!', 'Building a landing pad.'],
  stone: ['Fixing the garden wall.', 'For my rock collection!', 'The path is all mud.'],
  berry: ['Snack time!', 'Lunch for the crew.', 'My antennae crave snacks.'],
  water: ['The base is thirsty.', 'Bath day for Mayor Marin!', 'Refill the tanks!'],
  grass: ['The lights went out.', 'Power for the dome.', 'Charging my rover.'],
  flower: ['It is too dark out here.', 'Lights for the party!', 'For my window pod.'],
  honey: ['Nectar time!', 'Buzzbot-approved, please.', 'Sweet fuel, please.'],
  mush: ['Eyeshroom friends for my garden.', 'They stare back. I like it.', 'Nana knows these.'],
  cloth: ['My suit has a hole.', 'Spacewalk tomorrow!', 'Gear for the crew.'],
  feather: ['I want to fly!', 'Race day on the rim!', 'My jetpack broke.'],
  clay: ['Pots for the goo.', 'A new vase, please.', 'The kiln is warm!'],
  garden: ['Glowbugs for the garden.', 'The night needs light.'],
  veggie: ['Greens for the station.', 'Market day tomorrow!', 'Seeds for the dome.'],
  stargaze: ['I saw a light in the sky...', 'Star charts need lenses.', 'For the night watch.'],
  bakery: ['Cheese for breakfast!', 'The cheese mill is hungry.', 'Moon cheese, still warm.'],
  tea: ['Fizz at four. Earth time. Whatever that is.', 'Guests from orbit!', 'Something bubbly, please.'],
  pond: ['The pool looks empty.', 'Slime for my bath.', 'The slime frogs want friends.'],
  toys: ['The Blinkies are bored!', 'A present for Ember.', 'Toy launch day tomorrow!'],
  picnic: ['Delivery to orbit!', 'Cargo for the crew.', 'Pack it up, we fly!'],
  pets: ['A friend for the Blinkies.', 'Pets need a home.', 'Look how fluffy!'],
  music: ['The dance is tonight!', 'A song for the launch.', 'Music for the parade.'],
  parts: ['The rocket needs this!', 'Spare parts, please.', 'Zonk dropped another bolt.'],
  weather: ['Will it rain tomorrow?', 'Rain for the hydro beds.', 'Clouds for the kids.'],
  visitor: ['Our visitors look lost.', 'They want to go home.', 'Making friends from space!'],

  /* ----------------------------------------------------------- Crater Camp */
  moon: ['Moonstone for the dome.', 'Samples for the lab.', 'The craters need filling.', 'Madame Oops wants a new ball.'],
  glow: ['Our lamps are fading.', 'Light for the night shift.', 'Pods for the garden.'],
  dust: ['Bricks for the new wall.', 'Patching the habitat.', 'Dust to build with.'],
  ice: ['Water for the base.', 'Keeping the melons cool.', 'Ice for the reactor.'],
  crystal: ['Crystals hum when tuned.', 'For the signal array.', 'Moonbeam collects these, man.'],
  lantern: ['The dark side is scary.', 'Lanterns for the path.', 'Light for the landing pad.'],
  silver: ['Wiring the antenna.', 'Silver for the trophy!', 'Polish for the hull.'],
  comet: ['Comets carry old seeds.', 'For the star map.', 'Catching a falling wish.', 'For the grand finale!'],
  lunamoth: ['The moths guide travellers.', 'Wings for the garden.'],
  moonpup: ['This pup needs a home!', 'A friend for the crew.', 'Walkies on the rim!'],
  rover: ['The rover lost a wheel.', 'Scouting the far craters.', 'Spare parts, please.'],
  helium: ['Fuel for the heaters.', 'Filling the balloons.', 'The reactor is hungry.'],
  meteorite: ['Star metal for the forge.', 'A space rock for science!', 'Museum piece, please.'],
  dish: ['We lost the signal.', 'Calling home, again.', 'Listening to the stars.'],
  moonmelon: ['Lunch for the crew.', 'Algae shake tonight!', 'Feed for the next dome.'],

  /* ---------------------------------------------------------- Ember Hollow */
  magma: ['The forge went cold.', 'Heat for the hollow.', 'A spark to start with.', 'Fireworks need a spark!'],
  shroom: ['Ash-shroom stew!', 'Spores for the garden.', 'Light for the caves.'],
  iron: ['Tools for the forge.', 'Nails, lots of nails.', 'Mending the bridge.'],
  obsid: ['A blade for the ceremony.', 'Obsidian for the mirror.', 'Sharp and shiny, please.'],
  glassw: ['Bottles for the market.', 'Windows for the hut.', 'A vase for Fizz.', 'For the stall counter.'],
  forge: ['The forge went cold.', 'Star coal, please.', 'Smelting day!'],
  spice: ['Fuel for the furnace.', 'Hot gel, please!', 'Warming the hollow.', 'Two crates. No, three. (Two.)'],
  copper: ['Pipes for the steamworks.', 'Wire for the bells.', 'Copper shines best.', 'The clock tower is ticking slow.'],
  phoenix: ['The firebird is nesting.', 'Feathers for luck.'],
  salamander: ['This little one is cold!', 'Newts keep the vents clean.', 'A pet for the forge.'],
  basalt: ['Columns for the new hall.', 'Paving the lava path.', 'Stepping stones, please.'],
  sulfur: ['Sulfur for the fireworks!', 'The springs need tending.'],
  steam: ['The engine is sputtering.', 'Power for the hollow.', 'Pressure is dropping!'],
  emberfruit: ['Light for the caves.', 'A lamp for my den.', 'It is too dark down here.'],
  rubyc: ['A gift for the queen.', 'Rubies for the crown.', 'Something that glows.', 'A jewel fit for a star (me).'],

  /* -------------------------------------------------------- Tidal Shallows */
  shellc: ['Shells for the wind chime.', 'Decorating the reef hut.', 'For my collection.'],
  kelp: ['Bubbles for the dome.', 'Air for the divers.', 'Fixing the bubble city.'],
  pearlc: ['A pearl for the bride!', 'Pearls for the market.', 'Something shiny, please.'],
  coralc: ['Regrowing the reef.', 'Coral for the garden.', 'The fish need a home.'],
  fishc: ['A pet for my tank.', 'The swimmers want friends.', 'Look how it wiggles!', 'Gerald needs a friend.'],
  tide: ['Reading the tides.', 'The pools are drying.', 'Sea foam for the bath.', 'The tides told me to ask.'],
  salt: ['Crystals for the traders.', 'Building the lighthouse.', 'Shiny for the temple.'],
  sunkn: ['Treasure from the wreck!', 'Parts from the old saucer.', 'History from the deep.'],
  lumin: ['Light for the deep dive.', 'The lanterns went dark.'],
  squid: ['This one followed me home.', 'A friend for the reef.', 'Tentacle hugs, please.'],
  turtle: ['The shellkins need help.', 'A home for the little ones.'],
  harbour: ['The dock needs a buoy.', 'Fixing the sub.', 'Diving tomorrow!', 'Parcel for the deep end!'],
  seaglass: ['For the lamp maker.', 'Sea glass is lucky.', 'Windows for the dome.'],
  urchin: ['Urchins keep the reef tidy.', 'A crown for the festival!'],
  manta: ['The mantas are migrating.', 'A ride across the bay!'],

  /* ---------------------------------------------------------- Aurora Reach */
  cloudc: ['Clouds for the new island.', 'Soft landing, please.', 'Rain for the orchard.'],
  aurorac: ['Weaving the sky back.', 'Thread for the loom.', 'The aurora is fraying.'],
  starc: ['A star for the dark patch.', 'Stars for the nursery.', 'Wishing on this one.'],
  wind: ['Wind for the sails.', 'Turning the windmills.', 'The kites need a breeze.'],
  skyfruit: ['Breakfast in the clouds.', 'Jelly for the party!', 'Something wobbly, please.'],
  chime: ['The bells are out of tune.', 'Music for the festival.', 'Chimes call the birds home.'],
  prismv: ['Splitting the light.', 'A rainbow for the kids.', 'Light for the array.'],
  skynest: ['A nest for the sky birds.', 'The roc is back!'],
  balloonc: ['Patching the balloon.', 'A ride to the next island.', 'Silk for the sails.', 'Mail goes up today.'],
  starling: ['This star-kit is lost.', 'A friend who glows!', 'The sprites want to play.', 'For the parade!'],
  satellite: ['Our signal is weak.', 'Mapping the sky.', 'Power for the station.'],
  nebula: ['Bottling a nebula!', 'Colour for the dark sky.', 'For the stargazers.', 'I see your future in this jar.'],
  starflower: ['Orbs for the sky garden.', 'Lights that float at night.'],
  planets: ['A little world for my shelf.', 'For the orrery.', 'Every sky needs planets.', 'For the grand orrery.'],
  kite: ['Delivery by drone!', 'The drone needs a rotor.', 'Express delivery, please.'],

  /* ---------------------------------------------------------- every world */
  star: ['Star scrap for the Vault.', 'Bits from the sky.'],
  relic: ['A true treasure!', 'For the Vault collection.'],
  hull: ['Patching the rocket.'], engine: ['The engine needs parts.'],
  nav: ['The nav dish is dark.'], tank: ['A tank for the fuel.'], fuel: ['Topping up the tank.'],
};

/* Each character's favourite chains, in no particular order. They can live
   in more than one world; a contract only picks from chains awake right here. */
export const LIKES = {
  pip: ['wood', 'stone', 'veggie', 'visitor', 'water', 'parts'],
  grandma: ['berry', 'honey', 'flower', 'cloth', 'mush', 'clay', 'weather', 'picnic'],
  timmy: ['stone', 'stargaze', 'visitor', 'feather', 'garden', 'wood', 'toys', 'pond', 'pets', 'music'],
  gigi: ['flower', 'cloth', 'clay', 'feather', 'honey', 'berry'],
  biscuit: ['wood', 'berry', 'water', 'grass', 'veggie', 'toys', 'weather', 'music'],
  mumbo: ['bakery', 'berry', 'honey', 'veggie', 'grass', 'water', 'picnic'],
  pim: ['tea', 'flower', 'clay', 'pond', 'honey', 'cloth', 'picnic', 'pets'],
  blorb: ['picnic', 'bakery', 'parts', 'weather', 'wood', 'cloth', 'harbour', 'sunkn', 'seaglass', 'balloonc', 'kite', 'satellite'],
  grubs: ['veggie', 'berry', 'mush', 'pets', 'garden', 'honey', 'spice', 'shroom', 'glassw', 'emberfruit', 'skyfruit'],
  oops: ['moon', 'crystal', 'glow', 'ice', 'dust', 'tide', 'pearlc', 'lumin', 'nebula', 'comet'],
  glimmer: ['moon', 'dust', 'glow', 'crystal', 'ice', 'magma', 'rubyc', 'copper', 'starling', 'chime', 'silver', 'starc'],
  bloop: ['star', 'relic', 'glow', 'crystal', 'garden', 'aurorac', 'starc', 'parts', 'weather'],
  zib: ['silver', 'dust', 'rover', 'dish', 'meteorite', 'iron', 'copper'],
  luma: ['glow', 'lantern', 'comet', 'lunamoth', 'crystal', 'starc', 'planets', 'nebula'],
  rokk: ['stone', 'wood', 'clay', 'dust', 'ice', 'rover', 'meteorite', 'helium', 'iron', 'steam', 'basalt'],
  nix: ['stone', 'flower', 'stargaze', 'crystal', 'moon', 'silver', 'meteorite', 'moonpup', 'moonmelon'],
  vulk: ['wood', 'clay', 'bakery', 'magma', 'iron', 'forge', 'steam', 'basalt', 'copper', 'obsid'],
  ember: ['shroom', 'spice', 'phoenix', 'emberfruit', 'salamander', 'glassw', 'rubyc', 'sulfur'],
  marin: ['fishc', 'harbour', 'salt', 'sunkn', 'turtle', 'kelp'],
  kelpa: ['water', 'pond', 'veggie', 'garden', 'kelp', 'coralc', 'urchin', 'squid', 'tide', 'seaglass'],
  sirra: ['pearlc', 'shellc', 'tide', 'lumin', 'seaglass', 'manta'],
  zephyr: ['feather', 'flower', 'grass', 'tea', 'cloudc', 'wind', 'kite', 'balloonc', 'skyfruit'],
  halo: ['aurorac', 'prismv', 'starc', 'nebula', 'starflower', 'planets'],
  wren: ['skynest', 'skyfruit', 'chime', 'starling', 'cloudc'],
};
