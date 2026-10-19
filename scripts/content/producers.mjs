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
  ['earth', 1, 'tree|Meteor Heap|tree|nrg:1|twig twig twig branch|a big friendly round-crowned tree with a thick trunk, a few twigs at its roots'],
  ['earth', 2, 'rocks|Starstone Pile|rocks|nrg:1|pebble pebble pebble rock|a heap of rounded grey boulders with a pickaxe leaning on it'],
  ['earth', 2, 'bush|Snack Cart|bush|bat:12/40|berry berry berry berry berries|a round leafy bush dotted with red berries'],
  ['earth', 2, 'well|Moonwater Well|well|nrg:1|dew dew dew dew puddle|a round stone well with a little wooden roof and a bucket'],
  ['earth', 3, 'meadow|Solar Farm|meadow|nrg:1|grass grass grass grass hay|a small patch of tall golden meadow grass with a hay fork stuck in it'],
  ['earth', 3, 'flowerbed|Light Stall|flowerbed|nrg:1|bulbseed bulbseed bulbseed bulbseed sprig|a raised wooden flower bed full of pink and yellow flowers'],
  ['earth', 4, 'hive|Buzzbot Hive|honey:honey/bark|bat:12/45|nectar nectar nectar honeydrop|a wild honeycomb hive hanging from a stump, bees buzzing round it'],
  ['earth', 4, 'mosslog|Eyeshroom Log|log:moss/moss|nrg:1|caplet caplet caplet caplet toadstool|a fallen mossy log with little mushrooms growing on it'],
  ['earth', 5, 'cottonpatch|Suit Loom|cottonpatch|nrg:1|fibre fibre fibre fibre thread|a low cotton bush with fluffy white bolls'],
  ['earth', 5, 'nestbox|Jet Wreck|nestbox|nrg:1|down down mapscrap down plume|a wooden bird box on a post with a round hole'],
  ['earth', 6, 'claypit|Goo Pit|pot:clay/clay|nrg:1|mud mud mud mud claylump|a wet terracotta clay pit with a spade stuck in it'],
  ['earth', 7, 'grubmound|Glowbug Burrow|cocoon:cream/moss|nrg:1|grub grub grub grub chrysalis|a grassy mound with little burrow holes'],
  ['earth', 8, 'vegpatch|Hydro Bed|sprout:leaf/clay|nrg:1|vegseed vegseed vegseed vegseed seedling|a small tilled veggie patch with carrot tops and a watering can'],
  ['earth', 9, 'tinkerbench|Lens Workbench|anvil:copper/wood|nrg:1|lenschip lenschip lenschip clockgear lens|a wooden workbench with a vice, lens grinder and a brass lamp'],
  ['earth', 10, 'crashsite|Crash Site|planet:steel/clay|bat:10/60|blinky blinky blinky pricetag alienkid|a small silver saucer nose-down in the dirt, dome cracked, little lights still blinking'],

  /* story guests: never planted by level, only by a chapter of the story */
  ['earth', 99, 'raincloud|Weather Cloud|cloud:water/cloud|bat:10/30|raindrop raindrop raindrop raindrop puffcloud|a fat grey-blue rain cloud drizzling onto a little puddle'],

  /* v16: story unlocks for the later Meadow chapters */
  ['earth', 99, 'windmill|Cheese Mill|tower:wood/grass|nrg:1|flour flour flour flour dough|a small stone windmill with turning cloth sails'],
  ['earth', 99, 'teabush|Fizz Vent|teabush|bat:10/60|tealeaf tealeaf tealeaf icescoop teabundle|a neat round tea bush with fresh green tips'],
  ['earth', 99, 'lilypond|Slime Pond|wave:water/moss|nrg:1|ponddrop ponddrop ponddrop ponddrop lilypad|a small round pond with lily pads and a reed'],
  ['earth', 99, 'toychest|Space Toy Chest|chest:cherry/moss|bat:10/60|block block block block spintop|a painted toy chest, lid open, toys peeking out'],
  /* v25 */
  ['earth', 99, 'picnichamper|Cargo Pod|basket:straw/moss|nrg:1|crumb crumb crumb crumb sandwich|a picnic hamper on little legs with a checked cloth'],
  ['earth', 99, 'eggnest|Pet Egg Nest|egg:lilac/moss|bat:10/60|petegg petegg petegg windupmouse hatchegg|a grassy nest of lilac spotted eggs'],
  ['earth', 99, 'buskbot|Busker Bot|totem:steel/moss|nrg:1|notepebble notepebble notepebble notepebble whistle|a little robot playing guitar next to a speaker'],
  ['earth', 99, 'rockethull|Scrap Hull|tower:steel/moss|nrg:1|hexbolt hexbolt hexbolt hexbolt gear|an old rocket hull lying in the grass, full of parts'],
  ['earth', 99, 'weatherballoon|Weather Balloon|balloon:sapphire/moss|bat:12/45|raindrop raindrop raindrop kitespool puffcloud|a striped weather balloon tied to a crate'],

  /* v68: new producers, each unlocked by a chapter */
  ['earth', 99, 'seedvault|Star Seed Vault|seedvault|nrg:1|starseedpod starseedpod starseedpod glowsprout|a round glass seed vault on a little mound, glowing seeds floating inside'],
  ['earth', 99, 'paintpod|Paint Pod|paintpod|nrg:1|glowpaint glowpaint glowpaint paintpods|a round pod spilling glowing paint of many colours'],
  ['earth', 99, 'tinkershed|Tinker Shed|tinkershed|nrg:1|circuitchip circuitchip holochip holochip chipboard|a small round workshop shed with antennas and sparks'],
  ['earth', 99, 'hatstand|Hat Stand|hatstand|nrg:1|antennacap antennacap antennacap propcap|a tall hat stand on a little mound with alien hats hanging on it'],
  ['earth', 99, 'labcart|Lab Cart|labcart|nrg:1|testtube testtube testtube tuberack|a small rolling lab cart with bubbling flasks'],
  ['earth', 99, 'toybox|Pet Toy Box|toybox|bat:10/60|chewbolt chewbolt chewbolt squeakstar|a round toy box for pets with toys peeking out'],
  ['luna', 99, 'baseyard|Base Yard|baseyard|nrg:1|basebolt basebolt basebolt wallpanel|a construction yard with a small crane and stacked panels'],
  ['luna', 99, 'orevein|Ore Vein|orevein|nrg:1|orechunk orechunk orechunk orecart|a rocky outcrop with glowing blue ore veins'],
  ['luna', 99, 'cauldron|Bubble Cauldron|cauldron|nrg:1|starvial starvial starvial bubblebrew|a round cauldron on little legs bubbling with glowing brew'],
  ['luna', 99, 'swirlrift|Swirl Rift|swirlrift|nrg:1|darkspeck darkspeck darkspeck tinyswirl|a crack in the ground swirling with space light'],
  ['luna', 99, 'rescuehut|Rescue Hut|rescuehut|nrg:1|flare flare flare beacon2|a little rescue hut with a flashing light on top'],
  ['luna', 99, 'bouncepad|Bounce Pad|bouncepad|bat:10/60|springpad springpad springpad bouncemat|a springy bounce pad on the moon dust'],
  ['luna', 99, 'kartgarage|Kart Garage|kartgarage|nrg:1|kartwheel kartwheel kartwheel gokart|a small garage with a checkered flag'],
  ['cindra', 99, 'dragonroost|Dragon Roost|dragonroost|bat:10/60|dragonegg dragonegg dragonegg crackedegg|a rocky roost with a glowing nest on top'],
  ['cindra', 99, 'armoranvil|Armor Anvil|armoranvil|nrg:1|armorplate armorplate armorplate gauntlet|an anvil on a lava rock with a hammer'],
  ['cindra', 99, 'golempit|Golem Pit|golempit|nrg:1|facepebble facepebble facepebble pebblegolem|a stone pit with a glowing rune'],
  ['cindra', 99, 'heatwell|Heat Well|heatwell|nrg:1|heatcoil heatcoil heatcoil lavapump|a metal well over a lava vent with a pressure gauge'],
  ['cindra', 99, 'lavaoven|Lava Oven|lavaoven|nrg:1|emberbite emberbite emberbite lavacookie|a stone oven built into a small volcano'],
  ['cindra', 99, 'surfshack|Surf Shack|surfshack|nrg:1|lavafin lavafin lavafin lavaboard|a little shack with surfboards on a lava shore'],
  ['nerith', 99, 'ruinsite|Sunken Ruin|ruinsite|nrg:1|relicshard relicshard relicshard oldcoin|a broken stone arch half buried in sand with bubbles rising'],
  ['nerith', 99, 'anemonebed|Anemone Bed|anemonebed|bat:10/60|anemonebud anemonebud anemonebud glowanemone|a rock covered in colourful anemones'],
  ['nerith', 99, 'ponyreef|Pony Reef|ponyreef|bat:10/60|ponyegg ponyegg ponyegg ponyfoal|a curved reef with a little pony-shaped hole'],
  ['nerith', 99, 'sonarbuoy|Sonar Buoy|sonarbuoy|nrg:1|sonarping sonarping sonarping sonarbox|a floating buoy with a sonar dish'],
  ['nerith', 99, 'wavegen|Wave Generator|wavegen|nrg:1|wavecoil wavecoil wavecoil tidecell|a striped buoy generator bobbing on the waves'],
  ['nerith', 99, 'bottlebeach|Bottle Beach|bottlebeach|nrg:1|tinybottle tinybottle tinybottle msgbottle|a sandy mound with bottles sticking out'],
  ['vela', 99, 'drydock|Dry Dock|drydock|nrg:1|shiphull shiphull shiphull wingfin|a floating dock frame with a crane arm'],
  ['vela', 99, 'whalecloud|Whale Cloud|whalecloud|bat:10/60|whaleegg whaleegg whaleegg whalecalf|a big cloud shaped like a sleeping whale'],
  ['vela', 99, 'isleanchor|Isle Anchor|isleanchor|nrg:1|skypebble skypebble skypebble floatrock|a chained anchor holding a small floating rock'],
  ['vela', 99, 'sailloom|Sail Loom|sailloom|nrg:1|sailscrap sailscrap sailscrap minisail|a loom weaving glowing sail cloth'],
  ['vela', 99, 'cometramp|Comet Ramp|cometramp|bat:10/60|boarddeck boarddeck boarddeck cometboard|a curved ramp of light with a comet streak'],
  ['earth', 99, 'gummachine|Gum Machine|gummachine|bat:10/60|gumblob gumblob gumblob gumbubble|a round gumball machine full of glowing space gum'],
  ['nerith', 99, 'shellphonebed|Shell Exchange|shellphonebed|nrg:1|shellphone shellphone shellphone shellradio|a rock covered in spiral shells with tiny antennas'],
  ['vela', 99, 'skystation|Sky Platform|skystation|nrg:1|railpiece railpiece railpiece railloop|a floating train platform with a little sign post'],
  ['earth', 99, 'botdock|Farm Bot Dock|botdock|nrg:1|canbot canbot canbot seedbot|a charging dock with little farm robots plugged in'],
  ['earth', 99, 'snapbed|Snap Plant Bed|snapbed|nrg:1|sleepyseed sleepyseed sleepyseed handsprout|a raised bed of toothy alien plants snapping at the air'],
  ['earth', 99, 'postbeacon|Post Beacon|postbeacon|nrg:1|postcard postcard postcard postbag|a tall blinking mail beacon with a parcel chute'],
  ['earth', 99, 'arcadepod|Arcade Pod|arcadepod|nrg:1|arcadetoken arcadetoken craterball craterball joystick|a round arcade pod with glowing buttons and a screen'],
  ['earth', 99, 'photobot|Photo Bot|photobot|nrg:1|filmroll filmroll filmroll instaphoto|a little robot with a big camera lens for a face'],
  ['earth', 99, 'bubblestage|Bubble Stage|bubblestage|nrg:1|bubblewhistle bubblewhistle bubblewhistle crystalxylo|a small stage blowing musical bubbles'],

  /* event guests: planted while an event runs, gone when it ends */
  ['*', 0, 'fallingstar|Falling Star|star:star/slate|bat:12/45|starbit starbit starbunch|a fallen glowing star sitting in a little crater'],
  ['*', 0, 'lanternstall|Lantern Stall|house:rose/moss|bat:12/45|paperlantern paperlantern lanternstring|a festival stall hung with paper lanterns'],
  ['*', 0, 'candycart|Candy Cart|crate:cherry/moss|bat:12/45|candydrop candydrop lollipop|a striped candy cart with a little awning'],

  /* ----------------------------------------------------------- Crater Camp */
  ['luna', 1, 'geyser|Moon Geyser|geyser|nrg:1|mrock mrock mrock mcrystal|a crater vent puffing lilac moon dust with crystals around its rim'],
  ['luna', 1, 'glowpod|Glow Pod|glowpod|bat:10/60|spore spore bulb|a big glowing seed pod on a stalk, softly pulsing cyan'],
  ['luna', 2, 'dustflat|Dust Flat|boulder:sand/slate|nrg:1|dustpinch dustpinch dustpinch dustclump|a flat mound of fine moon dust with footprints and a shovel'],
  ['luna', 2, 'icevein|Ice Vein|ice:ice/slate|bat:10/60|frostchip frostchip iceshard|a boulder cracked open with pale-blue ice inside'],
  ['luna', 3, 'crystalspire|Crystal Spire|crystal:crystal/slate|nrg:1|shardlet shardlet shardlet prismlet|a tall cyan crystal growing out of moon rock'],
  ['luna', 4, 'wickpod|Wick Pod|lantern:gold/slate|nrg:1|wick wick lampglass|a little lamp-maker\'s stall with a hanging lantern'],
  ['luna', 4, 'silverseam|Silver Seam|ore:silver/slate|nrg:1|silverore silverore silverore silvernug|a moon rock with a bright silver seam and a pick'],
  ['luna', 5, 'comettrail|Comet Trail|comet:star/slate|nrg:1|cometdust cometdust cometice|a small crater where a comet landed, still sparkling'],
  ['luna', 6, 'mothpod|Moth Pod|butterfly:mint/slate|nrg:1|mothegg mothegg mothcocoon|a silvery shrub hung with cocoons, one moth resting on top'],
  ['luna', 7, 'pupnest|Critter Burrow|egg:lilac/slate|bat:10/60|wobbleegg wobbleegg blip|a round crater burrow with lilac eggs inside and a pair of eyes peeking out'],
  ['luna', 8, 'scrapyard|Rover Scrapyard|crate:steel/slate|nrg:1|screw screw boltbug boltbug wheel|a heap of old rover parts, wheels and a bent antenna'],
  ['luna', 9, 'gasvent|Helium Vent|bubble:glow/slate|nrg:1|gaswisp gaswisp gaswisp gasbubble|a steel-capped vent in the moon rock bubbling glowing gas'],
  ['luna', 10, 'impact|Impact Crater|rock:iron/slate|nrg:1|spacegrit spacegrit spacegrit meteorite|a fresh little impact crater with a dark meteorite in its middle'],
  ['luna', 11, 'relaymast|Relay Mast|compass:silver/slate|nrg:1|antwire antwire stampchip stampchip antenna|a short radio mast with a small dish and a blinking red light'],
  ['luna', 12, 'melonvine|Algae Pods|fruit:mint/slate|bat:10/60|moonseed moonseed moonsprout|a curly lilac vine in a round planter with small melons'],

  /* ---------------------------------------------------------- Ember Hollow */
  ['cindra', 1, 'lavavent|Lava Vent|lavavent|nrg:1|ember ember ember cinder|a squat volcanic vent glowing orange, embers floating up'],
  ['cindra', 1, 'shroomlog|Shroom Log|shroomlog|bat:10/60|sporecap sporecap ashroom|a charred log sprouting grey-and-orange mushrooms'],
  ['cindra', 2, 'ironseam|Iron Seam|ore:iron/obsidian|nrg:1|ironore ironore ironore ironnug|a dark rock face with rusty iron veins'],
  ['cindra', 2, 'obsidslab|Obsidian Slab|boulder:obsidian/obsidian|nrg:1|obchip obchip obchip obshard|a glossy black-purple obsidian boulder'],
  ['cindra', 3, 'sandpit|Hot Sand Pit|pebble:sand/obsidian|nrg:1|sandpinch sandpinch moltenglass|a shallow pit of glowing orange sand'],
  ['cindra', 4, 'coalpit|Coal Pit|ore:coal/obsidian|nrg:1|coallump coallump coallump coalbrick|a pile of coal in a rock hollow with a mine cart'],
  ['cindra', 4, 'spicevine|Fire Gel Spring|spicevine|bat:10/60|pepperpod pepperpod spicepouch|a thorny vine hung with red peppers'],
  ['cindra', 5, 'copperseam|Copper Seam|ore:copper/obsidian|nrg:1|copperore copperore copperore coppernug|a rock with shiny copper veins'],
  ['cindra', 6, 'ashnest|Ash Nest|feather:smoke/obsidian|nrg:1|ashfeather ashfeather emberegg|a nest of ash-grey feathers on a warm rock'],
  ['cindra', 7, 'warmnest|Warm Nest|egg:ember/obsidian|bat:10/60|warmegg warmegg snailegg snailegg newt|a nest of warm stones around a small lava pool, orange eggs inside'],
  ['cindra', 8, 'basaltcliff|Basalt Cliff|prism:slate/obsidian|nrg:1|basaltchip basaltchip basaltchip basaltblock|a short cliff of hexagonal basalt columns'],
  ['cindra', 9, 'sulfurspring|Sulfur Spring|bubble:topaz/obsidian|nrg:1|sulfurdust sulfurdust fwspark fwspark sulfurcrystal|a bubbling pool crusted with bright yellow sulfur'],
  ['cindra', 10, 'steamvent|Steam Vent|cloud:smoke/obsidian|nrg:1|steampuff steampuff steampuff warmpebble steampipe|a rock vent capped with a copper pipe puffing steam'],
  ['cindra', 11, 'charstump|Lava Vent Stump|stump:coal/obsidian|bat:10/60|charseed charseed embersprout|a burnt stump with glowing orange shoots sprouting from it'],
  ['cindra', 12, 'rubyvein|Ruby Vein|ore:ruby/obsidian|nrg:1|redchip redchip redchip rubyshard|a dark rock studded with raw red rubies'],

  /* -------------------------------------------------------- Tidal Shallows */
  ['nerith', 1, 'shellbed|Shell Bed|shell:shell/sand|nrg:1|shellchip shellchip shellchip seashell|a sandbar heaped with pink shells'],
  ['nerith', 1, 'kelpbed|Bubble Bed|fern:kelp/sand|bat:10/60|kelpleaf kelpleaf kelpfrond|a clump of kelp waving from a sandy mound'],
  ['nerith', 2, 'oysterbed|Oyster Bed|shell:pearl/sand|bat:10/60|grit grit seedpearl|a cluster of oysters, one open showing a pearl'],
  ['nerith', 2, 'coralhead|Coral Head|coral:coral/sand|nrg:1|coralbud coralbud coralbud coralsprig|a rounded coral head with little branches'],
  ['nerith', 3, 'fishtrap|Critter Trap|basket:rope/sand|nrg:1|minnow minnow silverfish|a woven fish trap on a post in the shallows'],
  ['nerith', 3, 'tidepool|Tide Pool|bubble:water/sand|nrg:1|bubblet bubblet bubblet seafoam|a round rock pool full of bubbles and a starfish'],
  ['nerith', 4, 'saltpan|Crystal Pan|ingot:cream/sand|nrg:1|saltgrain saltgrain saltcake|a shallow square pan of drying white salt'],
  ['nerith', 5, 'wrecksite|Saucer Wreck|boat:bone/sand|nrg:1|driftbit driftbit driftbit driftwood|the bleached ribs of an old boat half in the sand'],
  ['nerith', 6, 'lightvent|Light Vent|pearl:spore/deepsea|nrg:1|glowplankton glowplankton jellyegg jellyegg jellybell|a deep-water vent glowing with plankton'],
  ['nerith', 7, 'squidreef|Squid Reef|coral:rose/sand|bat:10/60|bubbleegg bubbleegg squidlet|a pink reef with clear jelly eggs tucked between the branches'],
  ['nerith', 8, 'nestbeach|Nesting Beach|egg:cream/sand|nrg:1|turtleegg turtleegg turtleegg hatchling|a sandy mound with turtle eggs and tiny tracks to the water'],
  ['nerith', 9, 'dock|Sub Dock|plank:wood/sand|nrg:1|knot knot racebubble racebubble float|a short wooden jetty with coiled rope and a lantern post'],
  ['nerith', 10, 'glassbeach|Glass Beach|pebble:glass/sand|nrg:1|glasspebble glasspebble glasspebble seaglassbit|a patch of beach glittering with frosted sea glass'],
  ['nerith', 11, 'urchinrock|Urchin Rock|rock:plum/sand|nrg:1|urchinspine urchinspine urchinspine urchin|a tide rock covered in violet sea urchins'],
  ['nerith', 12, 'mantadeep|Manta Deep|wave:deepsea/sand|bat:10/60|mantaegg mantaegg babymanta|a round deep-blue pool with a manta shadow gliding in it'],

  /* ----------------------------------------------------------- Aurora Reach */
  ['vela', 1, 'cloudbank|Cloud Bank|cloud:cloud/cloud|nrg:1|wisp wisp wisp cloudlet|a big soft cloud bank, puffing little clouds from its top'],
  ['vela', 1, 'auroraloom|Aurora Loom|spiral:aurora/dusk|bat:10/60|aurorathread aurorathread aurorasilk|a golden loom weaving threads of aurora light'],
  ['vela', 2, 'starcradle|Star Cradle|star:star/dusk|nrg:1|stardust stardust stardust starspark|a crescent-shaped cradle holding a sleeping little star'],
  ['vela', 2, 'windvanep|Wind Vane|compass:silver/cloud|nrg:1|breeze breeze gust|a tall silver weathervane on a cloud, spinning'],
  ['vela', 3, 'skytree|Jelly Cloud|fruit:topaz/cloud|bat:10/60|skyseed skyseed starsweet starsweet skybud|a small tree growing out of a cloud, heavy with golden fruit'],
  ['vela', 3, 'chimepost|Chime Post|bell:silver/cloud|nrg:1|chimebit chimebit chimebit chimebell|a silver post hung with wind chimes'],
  ['vela', 4, 'prismstand|Prism Stand|prism:glass/cloud|nrg:1|lightmote lightmote lightbeam|a glass prism on a stand throwing a small rainbow'],
  ['vela', 5, 'skynestp|Sky Nest|egg:cream/cloud|nrg:1|skydown skydown skyfeather|a big fluffy nest on a cloud with an egg inside'],
  ['vela', 6, 'silkloom|Silk Loom|cloth:rose/cloud|nrg:1|silkscrap silkscrap silkbag|a spinning wheel on a cloud with pink silk'],
  ['vela', 7, 'starden|Star Den|star:dusk/cloud|bat:10/60|stardustegg stardustegg glimmer|a cosy cloud cave glittering with stars, a little star-sprite peeking out'],
  ['vela', 8, 'solarfarm|Solar Array|plank:sapphire/cloud|nrg:1|solarcell solarcell rivetplate rivetplate solarpanel|a small tilted rack of blue solar panels on a cloud'],
  ['vela', 9, 'nebulapool|Nebula Pool|cloud:lilac/cloud|nrg:1|nebwisp nebwisp nebwisp nebpuff|a swirling pool of pink-violet nebula gas in a cloud hollow'],
  ['vela', 10, 'starbed|Star Bed|flower:star/cloud|bat:10/60|starseed starseed starsprout|a round cloud planter of glowing star-tipped sprouts'],
  ['vela', 11, 'gravwell|Gravity Well|planet:dusk/cloud|nrg:1|planetdust planetdust planetdust planetoid|a swirling vortex of violet light pulling tiny rocks into orbit'],
  ['vela', 12, 'kitepost|Drone Pad|leaf:rose/cloud|nrg:1|kitetail kitetail kitetail kitediamond|a striped post on a cloud with ribbons and a kite tangled on top'],

  /* ------------------------------------------------------ everywhere / ship */
  ['*', 0, 'wreck|Rocket Wreck|scrapwreck|bat:16/8|bolt spring wire glass bolt spring wire glass boltpack coil circuit tankglass|a crashed little rocket on its side, panels loose, smoke wisp'],
  ['*', 0, 'crater|Meteor Crater|crater|once:7|scrap junkbolt fuelore scrap junkbolt scrap starcore junkbolt|a smoking meteor crater with a glowing rock in its centre'],
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
