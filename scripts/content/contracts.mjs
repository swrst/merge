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
  wood: ['The porch needs mending.', 'Firewood for tonight!', 'Building a bird table.'],
  stone: ['Fixing the garden wall.', 'For my rock collection!', 'The path is all mud.'],
  berry: ['Sunday baking!', 'Snacks for the picnic.', 'The birds are hungry.'],
  water: ['The garden is thirsty.', 'Bath day for Mayor Marin!', 'Tea for everyone.'],
  grass: ['Bedding for the barn.', 'The goats are hungry.', 'Thatching the roof.'],
  flower: ['For my window box.', 'A gift for the new neighbour.', 'The bees need these.'],
  honey: ['Honey cake time!', 'For my sore throat.', 'Sweetening the jam.'],
  mush: ['Mushroom soup tonight.', 'For the forest tea.', 'Grandma knows a recipe.'],
  cloth: ['Patching my coat.', 'Curtains for the cottage.', 'A scarf for winter.'],
  feather: ['A nest for the chicks.', 'For my new hat!', 'Stuffing a pillow.'],
  clay: ['Pots for the seedlings.', 'A new tea set.', 'The kiln is warm!'],
  garden: ['Butterflies for the garden.', 'The meadow needs life.'],
  veggie: ['Stew for the whole village.', 'Market day tomorrow!', 'For my rabbit.'],
  stargaze: ['I saw a light in the sky...', 'Star charts need lenses.', 'For the night watch.'],
  bakery: ['Breakfast for the village!', 'The oven is hungry.', 'Bread for the picnic.'],
  tea: ['Tea time at four.', 'Guests are coming!', 'A calming cup, please.'],
  pond: ['The pond looks empty.', 'For the koi garden.', 'The frogs want friends.'],
  toys: ['The Blinkies are bored!', 'A present for Ember.', 'Toy day tomorrow!'],
  visitor: ['Our visitors look lost.', 'They want to go home.', 'Making friends from space!'],

  /* ----------------------------------------------------------- Crater Camp */
  moon: ['Moonstone for the dome.', 'Samples for the lab.', 'The craters need filling.'],
  glow: ['Our lamps are fading.', 'Light for the night shift.', 'Glow for the garden.'],
  dust: ['Bricks for the new wall.', 'Patching the habitat.', 'Dust to build with.'],
  ice: ['Water for the base.', 'Keeping the melons cool.', 'Ice for the reactor.'],
  crystal: ['Crystals hum when tuned.', 'For the signal array.', 'Luma collects these.'],
  lantern: ['The dark side is scary.', 'Lanterns for the path.', 'Light for the landing pad.'],
  silver: ['Wiring the antenna.', 'Silver for the trophy!', 'Polish for the hull.'],
  comet: ['Comets carry old seeds.', 'For the star map.', 'Catching a falling wish.'],
  lunamoth: ['The moths guide travellers.', 'Wings for the garden.'],
  moonpup: ['This pup needs a home!', 'A friend for the crew.', 'Walkies on the rim!'],
  rover: ['The rover lost a wheel.', 'Scouting the far craters.', 'Spare parts, please.'],
  helium: ['Fuel for the heaters.', 'Filling the balloons.', 'The reactor is hungry.'],
  meteorite: ['Star metal for the forge.', 'A space rock for science!', 'Museum piece, please.'],
  dish: ['We lost the signal.', 'Calling home, again.', 'Listening to the stars.'],
  moonmelon: ['Lunch for the crew.', 'Melon party tonight!', 'Seeds for the next dome.'],

  /* ---------------------------------------------------------- Ember Hollow */
  magma: ['The forge went cold.', 'Heat for the hollow.', 'A spark to start with.'],
  shroom: ['Ash-shroom stew!', 'Spores for the garden.', 'Light for the caves.'],
  iron: ['Tools for the forge.', 'Nails, lots of nails.', 'Mending the bridge.'],
  obsid: ['A blade for the ceremony.', 'Obsidian for the mirror.', 'Sharp and shiny, please.'],
  glassw: ['Bottles for the market.', 'Windows for the hut.', 'A vase for Ember.'],
  forge: ['The bellows need coal.', 'Fire for the smithy.', 'Big order at the forge.'],
  spice: ['Hot stew, extra hot!', 'Spice for the traders.', 'Warming the travellers.'],
  copper: ['Pipes for the steamworks.', 'Wire for the bells.', 'Copper shines best.'],
  phoenix: ['The firebird is nesting.', 'Feathers for luck.'],
  salamander: ['This little one is cold!', 'Newts keep the vents clean.', 'A pet for the forge.'],
  basalt: ['Columns for the new hall.', 'Paving the lava path.', 'Stepping stones, please.'],
  sulfur: ['Sulfur for the fireworks!', 'The springs need tending.'],
  steam: ['The engine is sputtering.', 'Power for the hollow.', 'Pressure is dropping!'],
  emberfruit: ['Fire fruit for the feast.', 'A warm snack, please.', 'Seeds for the orchard.'],
  rubyc: ['A gift for the queen.', 'Rubies for the crown.', 'Something that glows.'],

  /* -------------------------------------------------------- Tidal Shallows */
  shellc: ['Shells for the wind chime.', 'Decorating the reef hut.', 'For my collection.'],
  kelp: ['Kelp soup for supper.', 'Rope for the boats.', 'Mending the nets.'],
  pearlc: ['A pearl for the bride!', 'Pearls for the market.', 'Something shiny, please.'],
  coralc: ['Regrowing the reef.', 'Coral for the garden.', 'The fish need a home.'],
  fishc: ['Dinner for the village.', 'The market opens soon.', 'Feeding the gulls.'],
  tide: ['Reading the tides.', 'The pools are drying.', 'Sea foam for the bath.'],
  salt: ['Salting the catch.', 'Salt for the traders.', 'Preserving for winter.'],
  sunkn: ['Treasure from the wreck!', 'Wood for a new boat.', 'History from the deep.'],
  lumin: ['Light for the deep dive.', 'The lanterns went dark.'],
  squid: ['This one followed me home.', 'A friend for the reef.', 'Squid games tonight!'],
  turtle: ['The hatchlings need help.', 'Guiding them to the sea.'],
  harbour: ['The harbour needs a buoy.', 'Rigging the boat.', 'Setting sail tomorrow!'],
  seaglass: ['For the lamp maker.', 'Sea glass is lucky.', 'Windows for the dome.'],
  urchin: ['Urchins keep the reef tidy.', 'A crown for the festival!'],
  manta: ['The mantas are migrating.', 'A ride across the bay!'],

  /* ---------------------------------------------------------- Aurora Reach */
  cloudc: ['Clouds for the new island.', 'Soft landing, please.', 'Rain for the orchard.'],
  aurorac: ['Weaving the sky back.', 'Thread for the loom.', 'The aurora is fraying.'],
  starc: ['A star for the dark patch.', 'Stars for the nursery.', 'Wishing on this one.'],
  wind: ['Wind for the sails.', 'Turning the windmills.', 'The kites need a breeze.'],
  skyfruit: ['Breakfast in the clouds.', 'Sky pie tonight!', 'Seeds for the orchard isle.'],
  chime: ['The bells are out of tune.', 'Music for the festival.', 'Chimes call the birds home.'],
  prismv: ['Splitting the light.', 'A rainbow for the kids.', 'Light for the array.'],
  skynest: ['A nest for the sky birds.', 'The roc is back!'],
  balloonc: ['Patching the balloon.', 'A ride to the next island.', 'Silk for the sails.'],
  starling: ['This star-kit is lost.', 'A friend who glows!', 'The sprites want to play.'],
  satellite: ['Our signal is weak.', 'Mapping the sky.', 'Power for the station.'],
  nebula: ['Bottling a nebula!', 'Colour for the dark sky.', 'For the stargazers.'],
  starflower: ['Planting the sky garden.', 'Flowers that glow at night.'],
  planets: ['A little world for my shelf.', 'For the orrery.', 'Every sky needs planets.'],
  kite: ['Kite day tomorrow!', 'The wind is perfect.'],

  /* ---------------------------------------------------------- every world */
  star: ['Star scrap for the Vault.', 'Bits from the sky.'],
  relic: ['A true treasure!', 'For the Vault collection.'],
  hull: ['Patching the rocket.'], engine: ['The engine needs parts.'],
  nav: ['The nav dish is dark.'], tank: ['A tank for the fuel.'], fuel: ['Topping up the tank.'],
};

/* Each character's favourite chains, in no particular order. They can live
   in more than one world; a contract only picks from chains awake right here. */
export const LIKES = {
  pip: ['wood', 'stone', 'veggie', 'visitor', 'water'],
  grandma: ['berry', 'honey', 'flower', 'cloth', 'mush', 'clay'],
  timmy: ['stone', 'stargaze', 'visitor', 'feather', 'garden', 'wood', 'toys', 'pond'],
  gigi: ['flower', 'cloth', 'clay', 'feather', 'honey', 'berry'],
  biscuit: ['wood', 'berry', 'water', 'grass', 'veggie', 'toys'],
  mumbo: ['bakery', 'berry', 'honey', 'veggie', 'grass', 'water'],
  pim: ['tea', 'flower', 'clay', 'pond', 'honey', 'cloth'],
  bloop: ['star', 'relic', 'glow', 'crystal', 'garden', 'aurorac', 'starc'],
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
