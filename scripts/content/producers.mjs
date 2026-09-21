/* Producers — the sources that feed the chains.
 *
 * 'id|Name|art|mode|drops'
 *   art   — either a hand-drawn key from src/art.ts (tree, rocks, bush, ...)
 *           or 'shape:material[/ground]' to compose one from artgen primitives
 *   mode  — 'tap:<energyCost>' or 'timer:<seconds>/<charges>'
 *   drops — item ids, repeated for weight
 *
 * `at` is the world level the producer turns up at (1 = there from the start).
 */

export const PRODUCERS = [
  /* ---------------------------------------------------------- Sunny Meadow */
  ['earth', 1, 'tree|Big Tree|tree|tap:1|twig twig twig branch'],
  ['earth', 1, 'rocks|Rock Pile|rocks|tap:1|pebble pebble pebble rock'],
  ['earth', 2, 'bush|Berry Bush|bush|timer:15/3|berry berry berries'],
  ['earth', 2, 'well|Old Well|well|timer:14/4|dew dew dew puddle'],
  ['earth', 3, 'meadow|Hay Meadow|meadow|tap:1|grass grass grass hay'],
  ['earth', 3, 'flowerbed|Flower Bed|flower:rose/moss|timer:16/3|bulbseed bulbseed sprig'],
  ['earth', 4, 'hive|Wild Hive|honey:honey/bark|timer:18/3|nectar nectar honeydrop'],
  ['earth', 4, 'mosslog|Mossy Log|log:moss/moss|timer:17/3|caplet caplet toadstool'],
  ['earth', 5, 'cottonpatch|Cotton Patch|cloud:cream/moss|tap:1|fibre fibre fibre thread'],
  ['earth', 5, 'nestbox|Nest Box|house:bark/moss|timer:20/2|down down plume'],
  ['earth', 6, 'claypit|Clay Pit|pot:clay/clay|tap:1|mud mud mud claylump'],
  ['earth', 7, 'grubmound|Grub Mound|cocoon:cream/moss|timer:22/2|grub grub chrysalis'],

  /* ----------------------------------------------------------- Crater Camp */
  ['luna', 1, 'geyser|Moon Geyser|geyser|tap:1|mrock mrock mrock mcrystal'],
  ['luna', 1, 'glowpod|Glow Pod|glowpod|timer:15/3|spore spore bulb'],
  ['luna', 2, 'dustflat|Dust Flat|boulder:sand/slate|tap:1|dustpinch dustpinch dustpinch dustclump'],
  ['luna', 2, 'icevein|Ice Vein|ice:ice/slate|timer:16/3|frostchip frostchip iceshard'],
  ['luna', 3, 'crystalspire|Crystal Spire|crystal:crystal/slate|tap:2|shardlet shardlet shardlet prismlet'],
  ['luna', 4, 'wickpod|Wick Pod|lantern:gold/slate|timer:18/3|wick wick lampglass'],
  ['luna', 4, 'silverseam|Silver Seam|ore:silver/slate|tap:2|silverore silverore silverore silvernug'],
  ['luna', 5, 'comettrail|Comet Trail|comet:star/slate|timer:24/2|cometdust cometdust cometice'],
  ['luna', 6, 'mothpod|Moth Pod|butterfly:mint/slate|timer:22/2|mothegg mothegg mothcocoon'],

  /* ---------------------------------------------------------- Ember Hollow */
  ['cindra', 1, 'lavavent|Lava Vent|lavavent|tap:1|ember ember ember cinder'],
  ['cindra', 1, 'shroomlog|Shroom Log|shroomlog|timer:16/3|sporecap sporecap ashroom'],
  ['cindra', 2, 'ironseam|Iron Seam|ore:iron/obsidian|tap:2|ironore ironore ironore ironnug'],
  ['cindra', 2, 'obsidslab|Obsidian Slab|boulder:obsidian/obsidian|tap:2|obchip obchip obchip obshard'],
  ['cindra', 3, 'sandpit|Hot Sand Pit|pebble:sand/obsidian|timer:15/4|sandpinch sandpinch moltenglass'],
  ['cindra', 4, 'coalpit|Coal Pit|ore:coal/obsidian|tap:1|coallump coallump coallump coalbrick'],
  ['cindra', 4, 'spicevine|Spice Vine|berrycluster:rust/obsidian|timer:18/3|pepperpod pepperpod spicepouch'],
  ['cindra', 5, 'copperseam|Copper Seam|ore:copper/obsidian|tap:2|copperore copperore copperore coppernug'],
  ['cindra', 6, 'ashnest|Ash Nest|feather:smoke/obsidian|timer:24/2|ashfeather ashfeather emberegg'],

  /* -------------------------------------------------------- Tidal Shallows */
  ['nerith', 1, 'shellbed|Shell Bed|shell:shell/sand|tap:1|shellchip shellchip shellchip seashell'],
  ['nerith', 1, 'kelpbed|Kelp Bed|fern:kelp/sand|timer:15/3|kelpleaf kelpleaf kelpfrond'],
  ['nerith', 2, 'oysterbed|Oyster Bed|shell:pearl/sand|timer:18/3|grit grit seedpearl'],
  ['nerith', 2, 'coralhead|Coral Head|coral:coral/sand|tap:1|coralbud coralbud coralbud coralsprig'],
  ['nerith', 3, 'fishtrap|Fish Trap|basket:rope/sand|timer:17/3|minnow minnow silverfish'],
  ['nerith', 3, 'tidepool|Tide Pool|bubble:water/sand|tap:1|bubblet bubblet bubblet seafoam'],
  ['nerith', 4, 'saltpan|Salt Pan|ingot:cream/sand|timer:16/4|saltgrain saltgrain saltcake'],
  ['nerith', 5, 'wrecksite|Wreck Site|boat:bone/sand|tap:2|driftbit driftbit driftbit driftwood'],
  ['nerith', 6, 'lightvent|Light Vent|pearl:spore/deepsea|timer:22/2|glowplankton glowplankton jellybell'],

  /* ----------------------------------------------------------- Aurora Reach */
  ['vela', 1, 'cloudbank|Cloud Bank|cloud:cloud/cloud|tap:1|wisp wisp wisp cloudlet'],
  ['vela', 1, 'auroraloom|Aurora Loom|spiral:aurora/dusk|timer:16/3|aurorathread aurorathread aurorasilk'],
  ['vela', 2, 'starcradle|Star Cradle|star:star/dusk|tap:2|stardust stardust stardust starspark'],
  ['vela', 2, 'windvanep|Wind Vane|compass:silver/cloud|timer:15/4|breeze breeze gust'],
  ['vela', 3, 'skytree|Sky Orchard|fruit:topaz/cloud|timer:18/3|skyseed skyseed skybud'],
  ['vela', 3, 'chimepost|Chime Post|bell:silver/cloud|tap:1|chimebit chimebit chimebit chimebell'],
  ['vela', 4, 'prismstand|Prism Stand|prism:glass/cloud|timer:20/3|lightmote lightmote lightbeam'],
  ['vela', 5, 'skynestp|Sky Nest|egg:cream/cloud|timer:22/2|skydown skydown skyfeather'],
  ['vela', 6, 'silkloom|Silk Loom|cloth:rose/cloud|timer:20/3|silkscrap silkscrap silkbag'],

  /* ------------------------------------------------------ everywhere / ship */
  ['*', 0, 'wreck|Rocket Wreck|scrapwreck|tap:1|bolt spring wire glass bolt spring wire glass boltpack coil circuit tankglass'],
  ['*', 0, 'crater|Meteor Crater|crater|tap:1/7|fuelore scrap fuelore fuelore scrap fuelore starcore'],
];

/* Where a world's producers get planted, in the order they unlock. */
export const CELLS = {
  earth: [[19], [22], [32, 31, 26], [27, 21, 15], [16, 10, 28], [33, 39, 38],
    [9, 14, 8], [20, 25, 13], [11, 17, 7], [34, 40, 41], [35, 29, 23], [37, 36, 30]],
  luna: [[19], [22], [32, 31, 26], [27, 21, 15], [16, 10, 28], [33, 39, 38],
    [9, 14, 8], [20, 25, 13], [11, 17, 7]],
  cindra: [[19], [22], [32, 31, 26], [27, 21, 15], [16, 10, 28], [33, 39, 38],
    [9, 14, 8], [20, 25, 13], [11, 17, 7]],
  nerith: [[19], [22], [32, 31, 26], [27, 21, 15], [16, 10, 28], [33, 39, 38],
    [9, 14, 8], [20, 25, 13], [11, 17, 7]],
  vela: [[19], [22], [32, 31, 26], [27, 21, 15], [16, 10, 28], [33, 39, 38],
    [9, 14, 8], [20, 25, 13], [11, 17, 7]],
};
