/* Worlds, the cast, and the Seed Vault story. */

export const WORLDS = [
  {
    key: 'earth', name: 'Sunny Meadow', subtitle: 'Home world', planet: 'earth',
    tapCost: 1, perk: 'rain',
    folks: ['pip', 'grandma', 'timmy', 'gigi', 'biscuit', 'mumbo', 'pim', 'blorb', 'grubs'],
    heart: 'Meadow Heart',
    /* what the Heart wants, stage by stage — each stage visibly wakes the world */
    bloom: [
      { need: 3, title: 'A Green Thread', text: 'Colour creeps back into the grass. Dr. Zonk says the soil remembers you.' },
      { need: 6, title: 'The Meadow Stirs', text: 'Seeds you never planted push up overnight. The Vault is answering.' },
      { need: 10, title: 'Full Bloom', text: 'The meadow is awake. One world down — and the sky is full of dark ones.' },
    ],
    intro: 'Everything grew from here once. Then the Bloom went quiet and the world forgot how. You still remember. Start small: a twig, a pebble, a berry.',
  },
  {
    key: 'luna', name: 'Crater Camp', subtitle: 'Luna', planet: 'luna',
    tapCost: 1, perk: 'gravity',
    folks: ['bloop', 'zib', 'luma', 'rokk', 'nix', 'oops', 'glimmer'],
    heart: 'Crater Heart',
    bloom: [
      { need: 3, title: 'Dust Remembers', text: 'Glow spores drift up out of the regolith. Nothing has grown here in an age.' },
      { need: 6, title: 'The Craters Sing', text: 'Light pools in the low places. Moonbeam says it sounds like a choir tuning up.' },
      { need: 10, title: 'Luna Awake', text: 'The grey moon is silver now, and gardens ring every crater rim.' },
    ],
    intro: 'Luna went cold first — no air, no argument. But the Vault says a world only needs one living thing to start over. Find it.',
  },
  {
    key: 'cindra', name: 'Ember Hollow', subtitle: 'Cindra', planet: 'cinder',
    tapCost: 2, perk: 'eruption',
    folks: ['vulk', 'ember', 'rokk', 'zib', 'grubs', 'glimmer'],
    heart: 'Hollow Heart',
    bloom: [
      { need: 4, title: 'Ash to Soil', text: 'Where the ash cooled, something soft is growing through it.' },
      { need: 8, title: 'The Hollow Breathes', text: 'The vents sigh instead of roaring. Vulk has not seen that in his lifetime.' },
      { need: 12, title: 'Cindra Reborn', text: 'Fire and garden, at the same time, without either winning. That is the whole trick.' },
    ],
    intro: 'Cindra never went dormant — it went furious. The Bloom here did not die of cold. It burned. Ash is still soil, if you are patient.',
  },
  {
    key: 'nerith', name: 'Tidal Shallows', subtitle: 'Nerith', planet: 'nerith',
    tapCost: 2, perk: 'tide',
    folks: ['marin', 'kelpa', 'sirra', 'bloop', 'blorb', 'oops'],
    heart: 'Shallow Heart',
    bloom: [
      { need: 4, title: 'The Water Clears', text: 'Silt settles. For the first time in centuries you can see the reef floor.' },
      { need: 8, title: 'Reefs Return', text: 'Coral climbing the old ruins, fish following it up. Pearl will not stop humming.' },
      { need: 12, title: 'Nerith Alive', text: 'A whole drowned world, breathing again through its gills.' },
    ],
    intro: 'Nerith drowned slowly and politely. The cities are still down there under the shallows, full of shells and nothing else. Wake the reef and the rest follows.',
  },
  {
    key: 'vela', name: 'Aurora Reach', subtitle: 'Vela', planet: 'vela',
    tapCost: 2, perk: 'aurora',
    folks: ['zephyr', 'halo', 'wren', 'luma', 'blorb', 'glimmer'],
    heart: 'Reach Heart',
    bloom: [
      { need: 5, title: 'First Light', text: 'A thread of aurora, thin as a hair, stitched across the dark.' },
      { need: 10, title: 'The Sky Weaves', text: 'Whole curtains of it now. Halo says the Vault is singing back.' },
      { need: 15, title: 'The Bloom Returns', text: 'Every world you woke is visible from here, lit up like lamps in a long hallway. You did that.' },
    ],
    intro: 'The last place the Bloom was seen alive. There is no ground here — only cloud, light and whatever you can grow on them. This is where it ends, or begins again.',
  },
];

/* Cells unlock as the world levels up. Same shape everywhere: the board opens
   outward from the middle, so early play is cosy and late play is roomy. */
export const LOCKS = {
  2: [0, 5, 42, 47], 3: [1, 4, 43, 46], 4: [2, 3, 44, 45],
};

export const CHARACTERS = {
  pip: { name: 'Zib', lines: ['Ooh, is that for me?', 'You are quick at this!', 'Perfect. Just perfect.'] },
  grandma: { name: 'Nana Luma', lines: ['Bless you, dear.', 'My garden thanks you.', 'Just like the old days.'] },
  timmy: { name: 'Ember', lines: ['Whoa, cool!', 'Can I keep it?', 'You are the best!'] },
  gigi: { name: 'Sirra', lines: ['Darling, exquisite.', 'Simply divine.', 'You have taste.'] },
  biscuit: { name: 'Mayor Marin', lines: ['On behalf of the council: thanks.', 'This will look great in my speech.', 'Vote Marin!'] },
  mumbo: {
    name: 'Chef Gubbo', lines: ['Fresh from the oven!', 'Smells like home.', 'One more batch!'],
    face: { kind: 'blob', mat: 'peach', accent: 'cream' },
  },
  pim: {
    name: 'Duchess Splatt', lines: ['How delightful.', 'Tea solves most things.', 'Pinkies up, dear.'],
    face: { kind: 'crystal', mat: 'rose', accent: 'gold' },
  },
  bloop: {
    name: 'Dr. Zonk', lines: ['The Vault remembers this one.', 'Good. Keep going.', 'One more thread, re-woven.'],
    face: { kind: 'blob', mat: 'jade', accent: 'cream' },
  },
  zib: { name: 'Kix', lines: ['Beep! Trade good!', 'Kix approve.', 'Shiny! Very shiny!'], face: { kind: 'blob', mat: 'mint', accent: 'cream' } },
  luma: { name: 'Moonbeam', lines: ['It glows just right.', 'The dark is smaller now.', 'Light travels. So do you.'], face: { kind: 'blob', mat: 'rose', accent: 'cream' } },
  rokk: { name: 'Rokk', lines: ['UNIT PLEASED.', 'CATALOGUED. THANK YOU.', 'STRUCTURAL INTEGRITY: LOVELY.'], face: { kind: 'robot', mat: 'steel', accent: 'sapphire' } },
  nix: { name: 'Nix', lines: ['Mmm. Acceptable.', 'I collect these, you know.', 'Do not tell the others.'], face: { kind: 'crystal', mat: 'amethyst', accent: 'lilac' } },
  vulk: { name: 'Vulk', lines: ['HOT WORK. GOOD WORK.', 'The forge approves.', 'Ash to soil. Ha!'], face: { kind: 'flame', mat: 'ember', accent: 'gold' } },
  ember: { name: 'Fizz', lines: ['Still warm. I like that.', 'Careful — it bites.', 'Sparks are just small stars.'], face: { kind: 'blob', mat: 'flame', accent: 'gold' } },
  marin: { name: 'Harbourmaster Brine', lines: ['The current brought you.', 'Salt and patience, friend.', 'The reef noticed that.'], face: { kind: 'fish', mat: 'sapphire', accent: 'mint' } },
  kelpa: { name: 'Kelpa', lines: ['Grows back. Always grows back.', 'Green under the blue.', 'Tangle it up, I do not mind.'], face: { kind: 'blob', mat: 'kelp', accent: 'jade' } },
  sirra: { name: 'Pearl', lines: ['Listen — the water is humming.', 'Pearls for patience.', 'You hear it too, do you not?'], face: { kind: 'fish', mat: 'coral', accent: 'pearl' } },
  zephyr: { name: 'Zephyr', lines: ['Caught on the updraft!', 'Lighter than that, even.', 'Whoosh. Straight up.'], face: { kind: 'cloud', mat: 'cloud', accent: 'mint' } },
  halo: { name: 'Halo', lines: ['The sky is stitching itself.', 'Colour, at last.', 'The Vault is singing back.'], face: { kind: 'crystal', mat: 'aurora', accent: 'star' } },
  wren: { name: 'Wren', lines: ['Chirrup! Lovely!', 'For the nest, for the nest.', 'Up we go!'], face: { kind: 'bird', mat: 'topaz', accent: 'gold' } },
  /* v25: the helpers who run the side things */
  blorb: { name: 'Postie Blorb', lines: ['Parcel! Sign here. Any leg.', 'Phew. Six legs, still late.', 'Special delivery!'], face: { kind: 'blob', mat: 'sapphire', accent: 'gold' } },
  oops: { name: 'Madame Oops', lines: ['I foresaw this! Mostly.', 'The ball is cracked but the vibes are clear.', 'Oops. I mean: destiny!'], face: { kind: 'blob', mat: 'lilac', accent: 'gold' } },
  grubs: { name: 'The Grub Brothers', lines: ['Deal! (He means deal.)', 'Best prices on the planet. Only prices on the planet.', 'One of us is happy.'], face: { kind: 'blob', mat: 'mint', accent: 'honey' } },
  glimmer: { name: 'Captain Glimmer', lines: ['MAGNIFICENT!', 'Another triumph — for ME. And you.', 'The crowd goes wild!'], face: { kind: 'robot', mat: 'gold', accent: 'cherry' } },
};

/* The through-line. Beats fire on world level or on story flags. */
export const STORY = [
  { id: 's1', at: { flag: 'met' }, who: 'bloop', title: 'The Last Vault',
    text: 'Blorp. Right. Where to start. My ship — wherever its pieces landed — is a <b>Seed Vault</b> — every growing thing that ever was, asleep inside it. I am its curator. The last one. And you, judging by that meadow, are its gardener. Congratulations. Help me rebuild it and I will show you what that means. No pressure. Some pressure.' },
  { id: 's2', at: { world: 'earth', lvl: 4 }, who: 'bloop', title: 'What the Bloom Was',
    text: 'The Bloom was not a plant. It was every world holding hands. When it let go, the worlds forgot how to grow. Merging is remembering — two small things recalling what they add up to.' },
  { id: 's3', at: { world: 'earth', lvl: 6 }, who: 'bloop', title: 'The Heart',
    text: 'Under this meadow is a Heart — dormant, not dead. Feed it Bloom Essence and the world wakes around it. Every world has one. Every one of them is cold right now.' },
  { id: 's4', at: { world: 'luna', lvl: 1 }, who: 'luma', title: 'Somebody Came Back',
    text: 'Nobody has landed here since the quiet. We stopped watching the sky. Then a ship full of seeds falls out of it. Forgive me if I follow you around a bit.' },
  { id: 's5', at: { world: 'cindra', lvl: 1 }, who: 'vulk', title: 'It Did Not Sleep',
    text: 'Other worlds got cold. Cindra got ANGRY. Burned its own gardens to cinders rather than watch them wilt. If you can grow something here, gardener, you can grow anything.' },
  { id: 's6', at: { world: 'nerith', lvl: 1 }, who: 'marin', title: 'Under the Shallows',
    text: 'Our cities are down there, full of shells. We did not drown all at once — we drowned politely, over centuries. Bring the reef back and the rest of us remember how.' },
  { id: 's7', at: { world: 'vela', lvl: 1 }, who: 'halo', title: 'Where It Was Last Seen',
    text: 'The Bloom ended here, in the light. No ground, no soil, nothing to bury. Whatever you grow in Vela you grow out of thin air and stubbornness.' },
  /* --- Sunny Meadow, as it wakes --- */
  { id: 'e3', at: { world: 'earth', lvl: 3 }, who: 'grandma', title: 'The Old Recipes',
    text: 'I have not baked a proper pie since the Bloom went quiet. Berries, honey, a bit of luck... Bring me the makings and this kitchen will smell like home again.' },
  { id: 'e8', at: { world: 'earth', lvl: 8 }, who: 'pip', title: 'Market Day',
    text: 'The whole village is coming out of their houses! If we get the veggie patch going, we can have a proper market day — the first in years.' },
  { id: 'e9', at: { world: 'earth', lvl: 9 }, who: 'timmy', title: 'Lights in the Sky',
    text: 'I saw something fall behind the hill last night. Not a meteor — it was blinking. Blinking on purpose! I need a telescope. Please?' },
  { id: 'e10', at: { world: 'earth', lvl: 10 }, who: 'timmy', title: 'Little Visitors',
    text: 'It was a SAUCER. A tiny one. And there is an egg in it, and the egg is humming. Dr. Zonk says they are travellers who got lost when the Bloom went dark. We have to help them get home!' },
  /* --- Crater Camp --- */
  { id: 'l4', at: { world: 'luna', lvl: 4 }, who: 'rokk', title: 'Night Shift',
    text: 'LIGHT LEVELS: INSUFFICIENT. CREW MORALE: ALSO INSUFFICIENT. Request: lanterns. Many lanterns. Rokk does not like the dark side. Rokk will deny saying that.' },
  { id: 'l7', at: { world: 'luna', lvl: 7 }, who: 'nix', title: 'Something in the Burrow',
    text: 'There is a nest in the old crater. The eggs wobble when you sing to them. I have been singing to them. Do not tell Kix.' },
  { id: 'l11', at: { world: 'luna', lvl: 11 }, who: 'zib', title: 'Calling Home',
    text: 'Beep! Old dishes still work! Kix fix, Kix point at sky... and sky answers! Other camps out there. Other worlds, waking up. Because of you!' },
  /* --- Ember Hollow --- */
  { id: 'c4', at: { world: 'cindra', lvl: 4 }, who: 'ember', title: 'A Warm Welcome',
    text: 'Vulk growls, but he is happy — the forge has not been this busy in an age. Stay for stew. It is very, very spicy. That is how you know it is love.' },
  { id: 'c7', at: { world: 'cindra', lvl: 7 }, who: 'vulk', title: 'Little Flames',
    text: 'The salamanders came back. Tiny ones, in the warm nests. When the Hollow burned, they went deep. Now they come up to see what we are making. Be gentle with them.' },
  { id: 'c10', at: { world: 'cindra', lvl: 10 }, who: 'vulk', title: 'Fire That Builds',
    text: 'Steam, not smoke. Engines, not eruptions. Cindra always had the power — it just never had a reason. You gave it one, gardener.' },
  /* --- Tidal Shallows --- */
  { id: 'n4', at: { world: 'nerith', lvl: 4 }, who: 'sirra', title: 'The Humming Reef',
    text: 'Do you hear it? The reef is humming again, very low. My grandmother said it did that before the drowning. It means the sea remembers the song.' },
  { id: 'n8', at: { world: 'nerith', lvl: 8 }, who: 'kelpa', title: 'Hatchlings',
    text: 'Turtle eggs! On the old beach! Nobody has seen a hatchling here in three generations. We are guarding that beach day and night. Well, mostly day.' },
  { id: 'n9', at: { world: 'nerith', lvl: 9 }, who: 'marin', title: 'Setting Sail',
    text: 'With a proper harbour we can reach the drowned cities. Whatever is down there, it has waited long enough. Rig the boats.' },
  /* --- Aurora Reach --- */
  { id: 'v4', at: { world: 'vela', lvl: 4 }, who: 'wren', title: 'Birds Come Home',
    text: 'Chirrup! The sky birds are back — they follow the light, and you made light. They want nests. Lots of nests. Up we go!' },
  { id: 'v7', at: { world: 'vela', lvl: 7 }, who: 'halo', title: 'Star-Kits',
    text: 'Little sprites made of starlight, curled up in the cloud dens. They were born when the Bloom ended — they have never seen a sky full of colour. Show them.' },
  { id: 'v11', at: { world: 'vela', lvl: 11 }, who: 'bloop', title: 'The Long Hallway',
    text: 'Look down through the clouds. Every world you touched is glowing. The Vault is nearly empty — which is exactly what a Seed Vault is for. One last Heart to wake.' },
  { id: 's8', at: { flag: 'allHearts' }, who: 'bloop', title: 'The Bloom Returns',
    text: 'Five hearts beating. Look at them from up here — lamps down a long hallway, all lit. The Vault is empty and the worlds are full. That was the whole idea.' },
];
