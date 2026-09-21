/* Worlds, the cast, and the Seed Vault story. */

export const WORLDS = [
  {
    key: 'earth', name: 'Sunny Meadow', subtitle: 'Home world', planet: 'earth',
    tapCost: 1, perk: 'rain',
    folks: ['pip', 'grandma', 'timmy', 'gigi', 'biscuit'],
    heart: 'Meadow Heart',
    /* what the Heart wants, stage by stage — each stage visibly wakes the world */
    bloom: [
      { need: 3, title: 'A Green Thread', text: 'Colour creeps back into the grass. Bloop says the soil remembers you.' },
      { need: 6, title: 'The Meadow Stirs', text: 'Seeds you never planted push up overnight. The Vault is answering.' },
      { need: 10, title: 'Full Bloom', text: 'The meadow is awake. One world down — and the sky is full of dark ones.' },
    ],
    intro: 'Everything grew from here once. Then the Bloom went quiet and the world forgot how. You still remember. Start small: a twig, a pebble, a berry.',
  },
  {
    key: 'luna', name: 'Crater Camp', subtitle: 'Luna', planet: 'luna',
    tapCost: 1, perk: 'gravity',
    folks: ['bloop', 'zib', 'luma', 'rokk', 'nix'],
    heart: 'Crater Heart',
    bloom: [
      { need: 3, title: 'Dust Remembers', text: 'Glow spores drift up out of the regolith. Nothing has grown here in an age.' },
      { need: 6, title: 'The Craters Sing', text: 'Light pools in the low places. Luma says it sounds like a choir tuning up.' },
      { need: 10, title: 'Luna Awake', text: 'The grey moon is silver now, and gardens ring every crater rim.' },
    ],
    intro: 'Luna went cold first — no air, no argument. But the Vault says a world only needs one living thing to start over. Find it.',
  },
  {
    key: 'cindra', name: 'Ember Hollow', subtitle: 'Cindra', planet: 'cinder',
    tapCost: 2, perk: 'eruption',
    folks: ['vulk', 'ember', 'rokk', 'zib'],
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
    folks: ['marin', 'kelpa', 'sirra', 'bloop'],
    heart: 'Shallow Heart',
    bloom: [
      { need: 4, title: 'The Water Clears', text: 'Silt settles. For the first time in centuries you can see the reef floor.' },
      { need: 8, title: 'Reefs Return', text: 'Coral climbing the old ruins, fish following it up. Sirra will not stop humming.' },
      { need: 12, title: 'Nerith Alive', text: 'A whole drowned world, breathing again through its gills.' },
    ],
    intro: 'Nerith drowned slowly and politely. The cities are still down there under the shallows, full of shells and nothing else. Wake the reef and the rest follows.',
  },
  {
    key: 'vela', name: 'Aurora Reach', subtitle: 'Vela', planet: 'vela',
    tapCost: 2, perk: 'aurora',
    folks: ['zephyr', 'halo', 'wren', 'luma'],
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
  2: [0, 1, 4, 5], 3: [2, 3, 42, 47], 4: [43, 46, 6, 11],
  5: [44, 45, 36, 41], 6: [12, 17, 30, 35],
};

export const CHARACTERS = {
  pip: { name: 'Pip', lines: ['Ooh, is that for me?', 'You are quick at this!', 'Perfect. Just perfect.'] },
  grandma: { name: 'Granny Fern', lines: ['Bless you, dear.', 'My garden thanks you.', 'Just like the old days.'] },
  timmy: { name: 'Timmy', lines: ['Whoa, cool!', 'Can I keep it?', 'You are the best!'] },
  gigi: { name: 'Gigi', lines: ['Darling, exquisite.', 'Simply divine.', 'You have taste.'] },
  biscuit: { name: 'Biscuit', lines: ['Woof!', 'Wag wag wag.', 'Arf! Arf!'] },
  bloop: {
    name: 'Bloop', lines: ['The Vault remembers this one.', 'Good. Keep going.', 'One more thread, re-woven.'],
    face: { kind: 'blob', mat: 'jade', accent: 'cream' },
  },
  zib: { name: 'Zib', lines: ['Beep! Trade good!', 'Zib approve.', 'Shiny! Very shiny!'], face: { kind: 'blob', mat: 'mint', accent: 'cream' } },
  luma: { name: 'Luma', lines: ['It glows just right.', 'The dark is smaller now.', 'Light travels. So do you.'], face: { kind: 'blob', mat: 'rose', accent: 'cream' } },
  rokk: { name: 'Rokk', lines: ['UNIT PLEASED.', 'CATALOGUED. THANK YOU.', 'STRUCTURAL INTEGRITY: LOVELY.'], face: { kind: 'robot', mat: 'steel', accent: 'sapphire' } },
  nix: { name: 'Nix', lines: ['Mmm. Acceptable.', 'I collect these, you know.', 'Do not tell the others.'], face: { kind: 'crystal', mat: 'amethyst', accent: 'lilac' } },
  vulk: { name: 'Vulk', lines: ['HOT WORK. GOOD WORK.', 'The forge approves.', 'Ash to soil. Ha!'], face: { kind: 'flame', mat: 'ember', accent: 'gold' } },
  ember: { name: 'Ember', lines: ['Still warm. I like that.', 'Careful — it bites.', 'Sparks are just small stars.'], face: { kind: 'blob', mat: 'flame', accent: 'gold' } },
  marin: { name: 'Marin', lines: ['The current brought you.', 'Salt and patience, friend.', 'The reef noticed that.'], face: { kind: 'fish', mat: 'sapphire', accent: 'mint' } },
  kelpa: { name: 'Kelpa', lines: ['Grows back. Always grows back.', 'Green under the blue.', 'Tangle it up, I do not mind.'], face: { kind: 'blob', mat: 'kelp', accent: 'jade' } },
  sirra: { name: 'Sirra', lines: ['Listen — the water is humming.', 'Pearls for patience.', 'You hear it too, do you not?'], face: { kind: 'fish', mat: 'coral', accent: 'pearl' } },
  zephyr: { name: 'Zephyr', lines: ['Caught on the updraft!', 'Lighter than that, even.', 'Whoosh. Straight up.'], face: { kind: 'cloud', mat: 'cloud', accent: 'mint' } },
  halo: { name: 'Halo', lines: ['The sky is stitching itself.', 'Colour, at last.', 'The Vault is singing back.'], face: { kind: 'crystal', mat: 'aurora', accent: 'star' } },
  wren: { name: 'Wren', lines: ['Chirrup! Lovely!', 'For the nest, for the nest.', 'Up we go!'], face: { kind: 'bird', mat: 'topaz', accent: 'gold' } },
};

/* The through-line. Beats fire on world level or on story flags. */
export const STORY = [
  { id: 's1', at: { world: 'earth', lvl: 1 }, who: 'bloop', title: 'The Last Vault',
    text: 'Every growing thing that ever was is asleep inside this ship. I am its curator — the last one. You are its gardener, apparently. Congratulations. Start with a twig.' },
  { id: 's2', at: { world: 'earth', lvl: 3 }, who: 'bloop', title: 'What the Bloom Was',
    text: 'The Bloom was not a plant. It was every world holding hands. When it let go, the worlds forgot how to grow. Merging is remembering — two small things recalling what they add up to.' },
  { id: 's3', at: { world: 'earth', lvl: 5 }, who: 'bloop', title: 'The Heart',
    text: 'Under this meadow is a Heart — dormant, not dead. Feed it Bloom Essence and the world wakes around it. Every world has one. Every one of them is cold right now.' },
  { id: 's4', at: { world: 'luna', lvl: 1 }, who: 'luma', title: 'Somebody Came Back',
    text: 'Nobody has landed here since the quiet. We stopped watching the sky. Then a ship full of seeds falls out of it. Forgive me if I follow you around a bit.' },
  { id: 's5', at: { world: 'cindra', lvl: 1 }, who: 'vulk', title: 'It Did Not Sleep',
    text: 'Other worlds got cold. Cindra got ANGRY. Burned its own gardens to cinders rather than watch them wilt. If you can grow something here, gardener, you can grow anything.' },
  { id: 's6', at: { world: 'nerith', lvl: 1 }, who: 'marin', title: 'Under the Shallows',
    text: 'Our cities are down there, full of shells. We did not drown all at once — we drowned politely, over centuries. Bring the reef back and the rest of us remember how.' },
  { id: 's7', at: { world: 'vela', lvl: 1 }, who: 'halo', title: 'Where It Was Last Seen',
    text: 'The Bloom ended here, in the light. No ground, no soil, nothing to bury. Whatever you grow in Vela you grow out of thin air and stubbornness.' },
  { id: 's8', at: { flag: 'allHearts' }, who: 'bloop', title: 'The Bloom Returns',
    text: 'Five hearts beating. Look at them from up here — lamps down a long hallway, all lit. The Vault is empty and the worlds are full. That was the whole idea.' },
];
