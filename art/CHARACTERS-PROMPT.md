# Character prompts — v17 cast (paste into ChatGPT Images)

## Setup message (send first, once)
We're redoing the whole cast of my mobile merge game "Merge Rocket". Style of the PAINTING stays exactly like the attached reference (our producers/UI): soft glossy painterly semi-3D, saturated colour, warm light from upper left, thin warm-brown outline.
But the CHARACTERS change: funny, weird-looking ADULT cartoon aliens — think The Simpsons / Futurama / Rick and Morty energy: odd proportions, overbites, bulging or extra eyes, droopy stalks, sweaty, smug, tired, a visible personality flaw. Not cute, not babies, not a kids-show mascot. No humans, no dogs.
Rules for every image: one character, transparent background, 1024x1024, no text. For each character make TWO files:
1. `<id>.png` — head and shoulders, centred, face in the upper-middle (it's shown at 150px and at 36px in a circle, so the silhouette must read tiny).
2. `<id>_full.png` — full body standing, same pose language, feet at the bottom.
Keep the cast consistent with each other: same rendering, same light, same outline weight.

## Main cast (replaces old art — keep the filenames exactly)
- **Zorp** → `pip.png` + `pip_full.png`: a lanky teenage alien slacker, lime-green skin, three eyestalks of different lengths (one droopy), a huge overbite, a slouchy hoodie with the hood over the stalks, bored half-lidded eyes but a sneaky grin
- **Nana Gloop** → `grandma.png` + `grandma_full.png`: a tiny ancient purple blob grandmother with a towering beehive hairdo full of curlers, thick pop-bottle glasses that make her eyes enormous, one snaggle tooth, a knitted shawl and a suspicious squint
- **Gorbo** → `timmy.png` + `timmy_full.png`: a stocky orange alien kid-brother type, one giant eye in the middle of a wide flat head, a gap in his teeth, a propeller beanie, a slingshot in his back pocket, mischievous grin
- **Madame Fleeb** → `gigi.png` + `gigi_full.png`: a tall skinny pink alien fashion diva with four arms (one holding a long bubble-wand holder, one a hand mirror), a long neck, heavy blue eyeshadow, a giant feathered hat and a sneer of superiority
- **Mayor Snorb** → `biscuit.png` + `biscuit_full.png`: a pompous fat slug-like alien mayor, yellow-olive skin, tiny arms, a sash and a too-small top hat, a big droopy moustache made of tentacles, sweating, giving a fake politician smile
- **Dr. Zonk** → `bloop.png` + `bloop_full.png`: a frazzled blue alien scientist with an oversized brain bulging out of a cracked glass dome on his head, wild white eyebrows, a singed lab coat, mismatched goggles, one eye twitching
- **Chef Gubbo** → `mumbo.png` + `mumbo_full.png`: a huge round red alien cook with three chins, a tiny chef hat on top of two antennae, a stained apron, a ladle in one of his four hands, tasting from it with a giant purple tongue
- **Duchess Splatt** → `pim.png` + `pim_full.png`: a snooty teal octopus-like alien aristocrat with a pearl necklace on every tentacle, a lorgnette, a tiny tiara and a nose turned up so high you see the nostrils
- **You (the traveller)** → `player.png` + `player_full.png`: a scruffy space-trucker astronaut, chunky battered orange spacesuit with patches and duct tape, helmet off under one arm, stubble, a confident lopsided grin, a coffee thermos clipped to the belt

## Other worlds' folk (new art — same rules)
- **Zib** → `zib.png` + `zib_full.png`: a short mint-green junk-dealer alien with a crooked nose, a dozen mismatched wristwatches up both arms, brass goggles pushed up and a shifty salesman grin
- **Luma** → `luma.png` + `luma_full.png`: a glowing rose-pink jellyfish alien hippie, long dangling tentacles, a flower crown, dreamy spaced-out half-closed eyes and a peace-sign gesture
- **Rokk** → `rokk.png` + `rokk_full.png`: a dented steel-grey retro robot butler with one flickering sapphire eye, a bow tie, a rusty dent in his head and a deeply tired expression
- **Nix** → `nix.png` + `nix_full.png`: a lilac crystal alien snob collector, faceted bald head, a monocle, a pencil moustache and a very smug smile
- **Vulk** → `vulk.png` + `vulk_full.png`: a hulking lava-rock blacksmith alien, cracks glowing orange, a soot-streaked apron, a massive underbite and a hammer resting on one shoulder
- **Ember** → `ember.png` + `ember_full.png`: a tiny hyperactive flame gremlin, gold and orange, wide crazy eyes, sparks flying off, too many teeth
- **Marin** → `marin.png` + `marin_full.png`: a grumpy old sapphire fish-man harbourmaster, bulging fish eyes, a pipe, a captain's hat and a scraggly barnacle beard
- **Kelpa** → `kelpa.png` + `kelpa_full.png`: a lumpy kelp-green swamp alien gardener with seaweed comb-over, a tiny trowel and a goofy buck-toothed grin
- **Sirra** → `sirra.png` + `sirra_full.png`: a coral-pink fish-folk lounge singer, big pouty lips, heavy eyelashes, pearl earrings and a microphone shaped like a shell
- **Zephyr** → `zephyr.png` + `zephyr_full.png`: a puffy white cloud alien pilot with a long aviator scarf, goggles, a tiny moustache and puffed-out cheeks mid-blow
- **Halo** → `halo.png` + `halo_full.png`: a tall gaunt aurora-crystal mystic, teal-to-violet, three serene closed eyes, tiny stars orbiting the head, slightly creepy calm smile
- **Wren** → `wren.png` + `wren_full.png`: a scrawny topaz bird-alien gossip, long neck, beady eyes, a twig-nest hat and a beak open mid-chatter

Drop them into `src/sprites/chars/` and run `python scripts/art-optimize.py`.
