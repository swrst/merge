/* Producers — the sources that feed the chains.
 *
 * 'id|Name|art|mode|drops'
 *   art   — either a hand-drawn key from src/art.ts (tree, rocks, bush, ...)
 *           or 'shape:material[/ground]' to compose one from artgen primitives
 *   mode  — 'nrg:<energy>'  the common one: taps for ever, each tap spends
 *           that much energy, and a level or two up it costs one more and
 *           drops rarer things
 *           'bat:<charges>/<minutes>'  the patch kind, a minority: that many
 *           free taps with no wait at all and no energy, then that many
 *           minutes to refill from empty (it refills while you are away)
 *           'once:<uses>' for a producer that runs dry and vanishes
 *   drops — item ids at level 1, repeated for weight. Upgrading a producer
 *           adds the next tier of each chain it feeds, so a level-4 Big Tree
 *           hands out Lumber Piles as well as twigs.
 *
 * `at` is the world level the producer turns up at (1 = there from the start).
 */

export const PRODUCERS = [
  /* ---------------------------------------------------------- Sunny Meadow */
  ['earth', 1, 'tree|Big Tree|tree|nrg:1|twig twig twig branch'],
  ['earth', 1, 'rocks|Rock Pile|rocks|nrg:1|pebble pebble pebble rock'],
  ['earth', 2, 'bush|Berry Bush|bush|bat:20/30|berry berry berries'],
  ['earth', 2, 'well|Old Well|well|nrg:1|dew dew dew puddle'],
  ['earth', 3, 'meadow|Hay Meadow|meadow|nrg:1|grass grass grass hay'],
  ['earth', 3, 'flowerbed|Flower Bed|flower:rose/moss|nrg:1|bulbseed bulbseed sprig'],
  ['earth', 4, 'hive|Wild Hive|honey:honey/bark|bat:20/30|nectar nectar honeydrop'],
  ['earth', 4, 'mosslog|Mossy Log|log:moss/moss|nrg:1|caplet caplet toadstool'],
  ['earth', 5, 'cottonpatch|Cotton Patch|cloud:cream/moss|nrg:1|fibre fibre fibre thread'],
  ['earth', 5, 'nestbox|Nest Box|house:bark/moss|nrg:1|down down plume'],
  ['earth', 6, 'claypit|Clay Pit|pot:clay/clay|nrg:1|mud mud mud claylump'],
  ['earth', 7, 'grubmound|Grub Mound|cocoon:cream/moss|nrg:1|grub grub chrysalis'],

  /* ----------------------------------------------------------- Crater Camp */
  ['luna', 1, 'geyser|Moon Geyser|geyser|nrg:1|mrock mrock mrock mcrystal'],
  ['luna', 1, 'glowpod|Glow Pod|glowpod|bat:20/30|spore spore bulb'],
  ['luna', 2, 'dustflat|Dust Flat|boulder:sand/slate|nrg:1|dustpinch dustpinch dustpinch dustclump'],
  ['luna', 2, 'icevein|Ice Vein|ice:ice/slate|bat:20/30|frostchip frostchip iceshard'],
  ['luna', 3, 'crystalspire|Crystal Spire|crystal:crystal/slate|nrg:1|shardlet shardlet shardlet prismlet'],
  ['luna', 4, 'wickpod|Wick Pod|lantern:gold/slate|nrg:1|wick wick lampglass'],
  ['luna', 4, 'silverseam|Silver Seam|ore:silver/slate|nrg:1|silverore silverore silverore silvernug'],
  ['luna', 5, 'comettrail|Comet Trail|comet:star/slate|nrg:1|cometdust cometdust cometice'],
  ['luna', 6, 'mothpod|Moth Pod|butterfly:mint/slate|nrg:1|mothegg mothegg mothcocoon'],

  /* ---------------------------------------------------------- Ember Hollow */
  ['cindra', 1, 'lavavent|Lava Vent|lavavent|nrg:1|ember ember ember cinder'],
  ['cindra', 1, 'shroomlog|Shroom Log|shroomlog|bat:20/30|sporecap sporecap ashroom'],
  ['cindra', 2, 'ironseam|Iron Seam|ore:iron/obsidian|nrg:1|ironore ironore ironore ironnug'],
  ['cindra', 2, 'obsidslab|Obsidian Slab|boulder:obsidian/obsidian|nrg:1|obchip obchip obchip obshard'],
  ['cindra', 3, 'sandpit|Hot Sand Pit|pebble:sand/obsidian|nrg:1|sandpinch sandpinch moltenglass'],
  ['cindra', 4, 'coalpit|Coal Pit|ore:coal/obsidian|nrg:1|coallump coallump coallump coalbrick'],
  ['cindra', 4, 'spicevine|Spice Vine|berrycluster:rust/obsidian|bat:20/30|pepperpod pepperpod spicepouch'],
  ['cindra', 5, 'copperseam|Copper Seam|ore:copper/obsidian|nrg:1|copperore copperore copperore coppernug'],
  ['cindra', 6, 'ashnest|Ash Nest|feather:smoke/obsidian|nrg:1|ashfeather ashfeather emberegg'],

  /* -------------------------------------------------------- Tidal Shallows */
  ['nerith', 1, 'shellbed|Shell Bed|shell:shell/sand|nrg:1|shellchip shellchip shellchip seashell'],
  ['nerith', 1, 'kelpbed|Kelp Bed|fern:kelp/sand|bat:20/30|kelpleaf kelpleaf kelpfrond'],
  ['nerith', 2, 'oysterbed|Oyster Bed|shell:pearl/sand|bat:20/30|grit grit seedpearl'],
  ['nerith', 2, 'coralhead|Coral Head|coral:coral/sand|nrg:1|coralbud coralbud coralbud coralsprig'],
  ['nerith', 3, 'fishtrap|Fish Trap|basket:rope/sand|nrg:1|minnow minnow silverfish'],
  ['nerith', 3, 'tidepool|Tide Pool|bubble:water/sand|nrg:1|bubblet bubblet bubblet seafoam'],
  ['nerith', 4, 'saltpan|Salt Pan|ingot:cream/sand|nrg:1|saltgrain saltgrain saltcake'],
  ['nerith', 5, 'wrecksite|Wreck Site|boat:bone/sand|nrg:1|driftbit driftbit driftbit driftwood'],
  ['nerith', 6, 'lightvent|Light Vent|pearl:spore/deepsea|nrg:1|glowplankton glowplankton jellybell'],

  /* ----------------------------------------------------------- Aurora Reach */
  ['vela', 1, 'cloudbank|Cloud Bank|cloud:cloud/cloud|nrg:1|wisp wisp wisp cloudlet'],
  ['vela', 1, 'auroraloom|Aurora Loom|spiral:aurora/dusk|bat:20/30|aurorathread aurorathread aurorasilk'],
  ['vela', 2, 'starcradle|Star Cradle|star:star/dusk|nrg:1|stardust stardust stardust starspark'],
  ['vela', 2, 'windvanep|Wind Vane|compass:silver/cloud|nrg:1|breeze breeze gust'],
  ['vela', 3, 'skytree|Sky Orchard|fruit:topaz/cloud|bat:20/30|skyseed skyseed skybud'],
  ['vela', 3, 'chimepost|Chime Post|bell:silver/cloud|nrg:1|chimebit chimebit chimebit chimebell'],
  ['vela', 4, 'prismstand|Prism Stand|prism:glass/cloud|nrg:1|lightmote lightmote lightbeam'],
  ['vela', 5, 'skynestp|Sky Nest|egg:cream/cloud|nrg:1|skydown skydown skyfeather'],
  ['vela', 6, 'silkloom|Silk Loom|cloth:rose/cloud|nrg:1|silkscrap silkscrap silkbag'],

  /* ------------------------------------------------------ everywhere / ship */
  ['*', 0, 'wreck|Rocket Wreck|scrapwreck|bat:12/20|bolt spring wire glass bolt spring wire glass boltpack coil circuit tankglass'],
  ['*', 0, 'crater|Meteor Crater|crater|once:7|fuelore scrap fuelore fuelore scrap fuelore starcore'],
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
