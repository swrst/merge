/* Producers — the sources that feed the chains.
 *
 * 'id|Name|art|mode|drops|description'
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
 *   description — optional, for the art prompt only (art/notes.json).
 *
 * `at` is the world level the producer turns up at (1 = there from the start).
 * Keep it equal to the unlock level of the chain it feeds.
 */

export const PRODUCERS = [
  /* ---------------------------------------------------------- Sunny Meadow */
  ['earth', 1, 'tree|Big Tree|tree|nrg:1|twig twig twig branch|a big friendly round-crowned tree with a thick trunk, a few twigs at its roots'],
  ['earth', 1, 'rocks|Rock Pile|rocks|nrg:1|pebble pebble pebble rock|a heap of rounded grey boulders with a pickaxe leaning on it'],
  ['earth', 2, 'bush|Berry Bush|bush|bat:20/30|berry berry berries|a round leafy bush dotted with red berries'],
  ['earth', 2, 'well|Old Well|well|nrg:1|dew dew dew puddle|a round stone well with a little wooden roof and a bucket'],
  ['earth', 3, 'meadow|Hay Meadow|meadow|nrg:1|grass grass grass hay|a small patch of tall golden meadow grass with a hay fork stuck in it'],
  ['earth', 3, 'flowerbed|Flower Bed|flower:rose/moss|nrg:1|bulbseed bulbseed sprig|a raised wooden flower bed full of pink and yellow flowers'],
  ['earth', 4, 'hive|Wild Hive|honey:honey/bark|bat:20/30|nectar nectar honeydrop|a wild honeycomb hive hanging from a stump, bees buzzing round it'],
  ['earth', 4, 'mosslog|Mossy Log|log:moss/moss|nrg:1|caplet caplet toadstool|a fallen mossy log with little mushrooms growing on it'],
  ['earth', 5, 'cottonpatch|Cotton Patch|cloud:cream/moss|nrg:1|fibre fibre fibre thread|a low cotton bush with fluffy white bolls'],
  ['earth', 5, 'nestbox|Nest Box|house:bark/moss|nrg:1|down down plume|a wooden bird box on a post with a round hole'],
  ['earth', 6, 'claypit|Clay Pit|pot:clay/clay|nrg:1|mud mud mud claylump|a wet terracotta clay pit with a spade stuck in it'],
  ['earth', 7, 'grubmound|Grub Mound|cocoon:cream/moss|nrg:1|grub grub chrysalis|a grassy mound with little burrow holes'],
  ['earth', 8, 'vegpatch|Veggie Patch|sprout:leaf/clay|nrg:1|vegseed vegseed vegseed seedling|a small tilled veggie patch with carrot tops and a watering can'],
  ['earth', 9, 'tinkerbench|Tinker Bench|anvil:copper/wood|nrg:1|lenschip lenschip lenschip lens|a wooden workbench with a vice, lens grinder and a brass lamp'],
  ['earth', 10, 'crashsite|Crash Site|planet:steel/clay|bat:20/30|oddegg oddegg blinky|a small silver saucer nose-down in the dirt, dome cracked, little lights still blinking'],

  /* ----------------------------------------------------------- Crater Camp */
  ['luna', 1, 'geyser|Moon Geyser|geyser|nrg:1|mrock mrock mrock mcrystal|a crater vent puffing lilac moon dust with crystals around its rim'],
  ['luna', 1, 'glowpod|Glow Pod|glowpod|bat:20/30|spore spore bulb|a big glowing seed pod on a stalk, softly pulsing cyan'],
  ['luna', 2, 'dustflat|Dust Flat|boulder:sand/slate|nrg:1|dustpinch dustpinch dustpinch dustclump|a flat mound of fine moon dust with footprints and a shovel'],
  ['luna', 2, 'icevein|Ice Vein|ice:ice/slate|bat:20/30|frostchip frostchip iceshard|a boulder cracked open with pale-blue ice inside'],
  ['luna', 3, 'crystalspire|Crystal Spire|crystal:crystal/slate|nrg:1|shardlet shardlet shardlet prismlet|a tall cyan crystal growing out of moon rock'],
  ['luna', 4, 'wickpod|Wick Pod|lantern:gold/slate|nrg:1|wick wick lampglass|a little lamp-maker\'s stall with a hanging lantern'],
  ['luna', 4, 'silverseam|Silver Seam|ore:silver/slate|nrg:1|silverore silverore silverore silvernug|a moon rock with a bright silver seam and a pick'],
  ['luna', 5, 'comettrail|Comet Trail|comet:star/slate|nrg:1|cometdust cometdust cometice|a small crater where a comet landed, still sparkling'],
  ['luna', 6, 'mothpod|Moth Pod|butterfly:mint/slate|nrg:1|mothegg mothegg mothcocoon|a silvery shrub hung with cocoons, one moth resting on top'],
  ['luna', 7, 'pupnest|Critter Burrow|egg:lilac/slate|bat:20/30|wobbleegg wobbleegg blip|a round crater burrow with lilac eggs inside and a pair of eyes peeking out'],
  ['luna', 8, 'scrapyard|Rover Scrapyard|crate:steel/slate|nrg:1|screw screw screw wheel|a heap of old rover parts, wheels and a bent antenna'],
  ['luna', 9, 'gasvent|Helium Vent|bubble:glow/slate|nrg:1|gaswisp gaswisp gaswisp gasbubble|a steel-capped vent in the moon rock bubbling glowing gas'],
  ['luna', 10, 'impact|Impact Crater|rock:iron/slate|nrg:1|spacegrit spacegrit spacegrit meteorite|a fresh little impact crater with a dark meteorite in its middle'],
  ['luna', 11, 'relaymast|Relay Mast|compass:silver/slate|nrg:1|antwire antwire antwire antenna|a short radio mast with a small dish and a blinking red light'],
  ['luna', 12, 'melonvine|Melon Vine|fruit:mint/slate|bat:20/30|moonseed moonseed moonsprout|a curly lilac vine in a round planter with small melons'],

  /* ---------------------------------------------------------- Ember Hollow */
  ['cindra', 1, 'lavavent|Lava Vent|lavavent|nrg:1|ember ember ember cinder|a squat volcanic vent glowing orange, embers floating up'],
  ['cindra', 1, 'shroomlog|Shroom Log|shroomlog|bat:20/30|sporecap sporecap ashroom|a charred log sprouting grey-and-orange mushrooms'],
  ['cindra', 2, 'ironseam|Iron Seam|ore:iron/obsidian|nrg:1|ironore ironore ironore ironnug|a dark rock face with rusty iron veins'],
  ['cindra', 2, 'obsidslab|Obsidian Slab|boulder:obsidian/obsidian|nrg:1|obchip obchip obchip obshard|a glossy black-purple obsidian boulder'],
  ['cindra', 3, 'sandpit|Hot Sand Pit|pebble:sand/obsidian|nrg:1|sandpinch sandpinch moltenglass|a shallow pit of glowing orange sand'],
  ['cindra', 4, 'coalpit|Coal Pit|ore:coal/obsidian|nrg:1|coallump coallump coallump coalbrick|a pile of coal in a rock hollow with a mine cart'],
  ['cindra', 4, 'spicevine|Spice Vine|berrycluster:rust/obsidian|bat:20/30|pepperpod pepperpod spicepouch|a thorny vine hung with red peppers'],
  ['cindra', 5, 'copperseam|Copper Seam|ore:copper/obsidian|nrg:1|copperore copperore copperore coppernug|a rock with shiny copper veins'],
  ['cindra', 6, 'ashnest|Ash Nest|feather:smoke/obsidian|nrg:1|ashfeather ashfeather emberegg|a nest of ash-grey feathers on a warm rock'],
  ['cindra', 7, 'warmnest|Warm Nest|egg:ember/obsidian|bat:20/30|warmegg warmegg newt|a nest of warm stones around a small lava pool, orange eggs inside'],
  ['cindra', 8, 'basaltcliff|Basalt Cliff|prism:slate/obsidian|nrg:1|basaltchip basaltchip basaltchip basaltblock|a short cliff of hexagonal basalt columns'],
  ['cindra', 9, 'sulfurspring|Sulfur Spring|bubble:topaz/obsidian|nrg:1|sulfurdust sulfurdust sulfurdust sulfurcrystal|a bubbling pool crusted with bright yellow sulfur'],
  ['cindra', 10, 'steamvent|Steam Vent|cloud:smoke/obsidian|nrg:1|steampuff steampuff steampuff steampipe|a rock vent capped with a copper pipe puffing steam'],
  ['cindra', 11, 'charstump|Charred Stump|stump:coal/obsidian|bat:20/30|charseed charseed embersprout|a burnt stump with glowing orange shoots sprouting from it'],
  ['cindra', 12, 'rubyvein|Ruby Vein|ore:ruby/obsidian|nrg:1|redchip redchip redchip rubyshard|a dark rock studded with raw red rubies'],

  /* -------------------------------------------------------- Tidal Shallows */
  ['nerith', 1, 'shellbed|Shell Bed|shell:shell/sand|nrg:1|shellchip shellchip shellchip seashell|a sandbar heaped with pink shells'],
  ['nerith', 1, 'kelpbed|Kelp Bed|fern:kelp/sand|bat:20/30|kelpleaf kelpleaf kelpfrond|a clump of kelp waving from a sandy mound'],
  ['nerith', 2, 'oysterbed|Oyster Bed|shell:pearl/sand|bat:20/30|grit grit seedpearl|a cluster of oysters, one open showing a pearl'],
  ['nerith', 2, 'coralhead|Coral Head|coral:coral/sand|nrg:1|coralbud coralbud coralbud coralsprig|a rounded coral head with little branches'],
  ['nerith', 3, 'fishtrap|Fish Trap|basket:rope/sand|nrg:1|minnow minnow silverfish|a woven fish trap on a post in the shallows'],
  ['nerith', 3, 'tidepool|Tide Pool|bubble:water/sand|nrg:1|bubblet bubblet bubblet seafoam|a round rock pool full of bubbles and a starfish'],
  ['nerith', 4, 'saltpan|Salt Pan|ingot:cream/sand|nrg:1|saltgrain saltgrain saltcake|a shallow square pan of drying white salt'],
  ['nerith', 5, 'wrecksite|Wreck Site|boat:bone/sand|nrg:1|driftbit driftbit driftbit driftwood|the bleached ribs of an old boat half in the sand'],
  ['nerith', 6, 'lightvent|Light Vent|pearl:spore/deepsea|nrg:1|glowplankton glowplankton jellybell|a deep-water vent glowing with plankton'],
  ['nerith', 7, 'squidreef|Squid Reef|coral:rose/sand|bat:20/30|bubbleegg bubbleegg squidlet|a pink reef with clear jelly eggs tucked between the branches'],
  ['nerith', 8, 'nestbeach|Nesting Beach|egg:cream/sand|nrg:1|turtleegg turtleegg turtleegg hatchling|a sandy mound with turtle eggs and tiny tracks to the water'],
  ['nerith', 9, 'dock|Old Dock|plank:wood/sand|nrg:1|knot knot knot float|a short wooden jetty with coiled rope and a lantern post'],
  ['nerith', 10, 'glassbeach|Glass Beach|pebble:glass/sand|nrg:1|glasspebble glasspebble glasspebble seaglassbit|a patch of beach glittering with frosted sea glass'],
  ['nerith', 11, 'urchinrock|Urchin Rock|rock:plum/sand|nrg:1|urchinspine urchinspine urchinspine urchin|a tide rock covered in violet sea urchins'],
  ['nerith', 12, 'mantadeep|Manta Deep|wave:deepsea/sand|bat:20/30|mantaegg mantaegg babymanta|a round deep-blue pool with a manta shadow gliding in it'],

  /* ----------------------------------------------------------- Aurora Reach */
  ['vela', 1, 'cloudbank|Cloud Bank|cloud:cloud/cloud|nrg:1|wisp wisp wisp cloudlet|a big soft cloud bank, puffing little clouds from its top'],
  ['vela', 1, 'auroraloom|Aurora Loom|spiral:aurora/dusk|bat:20/30|aurorathread aurorathread aurorasilk|a golden loom weaving threads of aurora light'],
  ['vela', 2, 'starcradle|Star Cradle|star:star/dusk|nrg:1|stardust stardust stardust starspark|a crescent-shaped cradle holding a sleeping little star'],
  ['vela', 2, 'windvanep|Wind Vane|compass:silver/cloud|nrg:1|breeze breeze gust|a tall silver weathervane on a cloud, spinning'],
  ['vela', 3, 'skytree|Sky Orchard|fruit:topaz/cloud|bat:20/30|skyseed skyseed skybud|a small tree growing out of a cloud, heavy with golden fruit'],
  ['vela', 3, 'chimepost|Chime Post|bell:silver/cloud|nrg:1|chimebit chimebit chimebit chimebell|a silver post hung with wind chimes'],
  ['vela', 4, 'prismstand|Prism Stand|prism:glass/cloud|nrg:1|lightmote lightmote lightbeam|a glass prism on a stand throwing a small rainbow'],
  ['vela', 5, 'skynestp|Sky Nest|egg:cream/cloud|nrg:1|skydown skydown skyfeather|a big fluffy nest on a cloud with an egg inside'],
  ['vela', 6, 'silkloom|Silk Loom|cloth:rose/cloud|nrg:1|silkscrap silkscrap silkbag|a spinning wheel on a cloud with pink silk'],
  ['vela', 7, 'starden|Star Den|star:dusk/cloud|bat:20/30|stardustegg stardustegg glimmer|a cosy cloud cave glittering with stars, a little star-sprite peeking out'],
  ['vela', 8, 'solarfarm|Solar Array|plank:sapphire/cloud|nrg:1|solarcell solarcell solarcell solarpanel|a small tilted rack of blue solar panels on a cloud'],
  ['vela', 9, 'nebulapool|Nebula Pool|cloud:lilac/cloud|nrg:1|nebwisp nebwisp nebwisp nebpuff|a swirling pool of pink-violet nebula gas in a cloud hollow'],
  ['vela', 10, 'starbed|Star Bed|flower:star/cloud|bat:20/30|starseed starseed starsprout|a round cloud planter of glowing star-tipped sprouts'],
  ['vela', 11, 'gravwell|Gravity Well|planet:dusk/cloud|nrg:1|planetdust planetdust planetdust planetoid|a swirling vortex of violet light pulling tiny rocks into orbit'],
  ['vela', 12, 'kitepost|Kite Post|leaf:rose/cloud|nrg:1|kitetail kitetail kitetail kitediamond|a striped post on a cloud with ribbons and a kite tangled on top'],

  /* ------------------------------------------------------ everywhere / ship */
  ['*', 0, 'wreck|Rocket Wreck|scrapwreck|bat:12/20|bolt spring wire glass bolt spring wire glass boltpack coil circuit tankglass|a crashed little rocket on its side, panels loose, smoke wisp'],
  ['*', 0, 'crater|Meteor Crater|crater|once:7|fuelore scrap fuelore fuelore scrap fuelore starcore|a smoking meteor crater with a glowing rock in its centre'],
];

/* Where a world's producers get planted, in the order they unlock. Each entry
   is a list of candidate cells; the first free one is used. */
const EARLY = [[19], [22], [32, 31, 26], [27, 21, 15], [16, 10, 28], [33, 39, 38],
  [9, 14, 8], [20, 25, 13], [11, 17, 7]];
const LATE = [[34, 40, 41], [35, 29, 23], [37, 36, 30], [12, 18, 24], [6, 7, 13], [8, 14, 15]];
export const CELLS = {
  earth: [...EARLY, ...LATE], luna: [...EARLY, ...LATE], cindra: [...EARLY, ...LATE],
  nerith: [...EARLY, ...LATE], vela: [...EARLY, ...LATE],
};
