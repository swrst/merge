import fs from 'node:fs';
const R = p => JSON.parse(fs.readFileSync('/root/merge/src/content/' + p));
const W = R('worlds.json').luna, PR = R('producers.json'), IT = R('items.json'), CH = R('chains.json'), CC = R('characters.json');
const have = new Set(W.start.map(x => x.producer)), seen = [];
W.projects.slice(0, 30).forEach(p => { [].concat(p.unlock || []).forEach(u => { have.add(u); seen.push(u); }); [].concat(p.retire || []).forEach(u => have.delete(u)); });
let active = [...have];
const all = [...new Set([...W.start.map(x => x.producer), ...seen])];
const back = all.filter(k => !active.includes(k));     // retired ones, oldest first
const chainsOf = k => [...new Set(PR[k].drops.map(d => IT[d].chain))];
const folks = ['luma', 'rokk', 'nix', 'zib', 'oops', 'glimmer', 'bloop'];
const nm = id => IT[id].name, plural = (n, s) => n > 1 ? `${n} ${s}` : `a ${s}`;
const NAMES = ['The {I} Run', 'More {I}s', '{C} Needs {I}s', 'A {I} for the Dome', 'Night Shift', 'The Long Crater', 'Dust Storm Ready', 'Moon Market Day', 'The Quiet Side',
  'Signal Boost', 'Under the Ice', 'Starlight Picnic', 'The Rover Parade', 'Crater Lights', 'Fix the Dome', 'Low-G Festival', 'The Big Dig', 'Moonrise', 'Echo Valley', 'Silver Morning',
  'The Comet Watch', 'A Gift for {C}', 'Pup Patrol', 'The Glow Garden', 'Midnight Repairs', 'The Helium Show', 'Bounce Week', 'The Lost Hatch', 'Crater Café', 'Spare Parts',
  'The Moon Choir', 'Tidy Base', 'The Deep Vent', 'Cargo Day', 'Lantern Walk', 'The Swirl Returns', 'Rescue Drill', 'The Kart Cup', 'Ice Cream Moon', 'Star Mail',
  'The Old Geyser', 'Glow Pod Season', 'Dust Flat Days', 'The Crystal Spire', 'Silver Seams', 'Comet Night', 'Scrapyard Treasures', 'Moth Migration', 'Burrow Party', 'Algae Bloom',
  'The Relay', 'The Second Base', 'Heater Weather', 'The Moon Library', 'Grand Tour', 'The Far Rim', 'Moonquake', 'Supply Run', 'The Shiny Week', 'Captain\'s Orders',
  'The Meteor Garden', 'A Bigger Dome', 'Moon Museum', 'The Bright Path', 'Space Stew', 'Pup Show', 'Night Market', 'The Last Crater', 'City Lights', 'Crater Camp Day'];
const HELLO = ['Busy day on the Moon!', 'We have a plan, and it needs you.', 'The camp keeps growing. So do my lists.', 'Something new for the base!', 'Big idea. Bigger shopping list.',
  'Let\'s make the Moon a little brighter.', 'You are getting good at this!', 'One more job before moonrise.', 'The pups are excited. So am I.', 'Back to work, captain!'];
const DONE = ['Done, and it looks great!', 'The camp cheers. Even the rocks look happy.', 'Another piece of Crater Camp, back to life.', 'Brilliant work. The Moon glows a bit brighter.',
  'Everyone gathers to look. Then everyone wants one.', 'It hums, it shines, it works!', 'The base feels bigger already.', 'A job well done. Snacks for everyone!'];
const out = [];
let ret = 0, lastNew = null;
for (let n = 31; n <= 100; n++) {
  const k = n - 31, ch = { id: 'l' + n };
  // every fifth chapter an old friend comes back and the longest-serving one gets ready to retire
  let newP = null;
  if (k % 5 === 0 && back.length) {
    newP = back.shift(); ch.unlock = [newP]; active.push(newP);
    if (active.length > 8) { const old = active.shift(); ch.retire = [old]; back.push(old); }
  }
  const avail = active.filter(x => x !== newP), chains = avail.flatMap(chainsOf);
  const pickCh = i => { const c = lastNew && i === 0 && avail.includes(lastNew) ? chainsOf(lastNew)[0] : chains[(k * 3 + i * 5) % chains.length]; return c; };
  const tgt = Math.min(6, 3 + Math.floor(k / 20));
  const nNeeds = k < 25 ? 2 : 3, used = new Set(), needs = [];
  for (let i = 0; i < nNeeds; i++) {
    let c = pickCh(i), g = 0; while (used.has(c) && g++ < 20) c = chains[(k + i * 7 + g) % chains.length]; used.add(c);
    const items = CH[c].items, t = Math.max(2, Math.min(items.length - 1, i === 0 ? tgt : tgt - 1));
    const id = items[t - 1];
    needs.push([id, i === 0 ? 1 + (k % 3 === 2 ? 1 : 0) : 2]);
  }
  ch.who = folks[k % folks.length]; if ((n % 10) === 0) ch.who = 'glimmer';
  ch.name = NAMES[k].replace('{I}s', ((w) => /[^aeiou]y$/i.test(w) ? w.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/i.test(w) ? w + 'es' : w + 's')(nm(needs[0][0]))).replace('{I}', nm(needs[0][0])).replace('{C}', CC[ch.who].name);
  ch.name = ch.name.replace(/\s+/g, ' ').trim();
  ch.needs = needs; ch.coins = 8710 + (n - 30) * 300; ch.xp = 726 + (n - 30) * 13;
  if (n % 25 === 0) ch.gift = 'bigchest'; else if (n % 5 === 0) ch.gift = 'chest';
  const pl = (w) => /[^aeiou]y$/i.test(w) ? w.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/i.test(w) ? w + 'es' : w + 's';
  const list = needs.map(([id, q]) => q > 1 ? `${q} ${pl(nm(id))}` : `${/^[aeiou]/i.test(nm(id)) ? 'an' : 'a'} ${nm(id)}`);
  const ask = list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0];
  ch.talk = [[ch.who, HELLO[k % HELLO.length] + (newP ? ` And look: the ${PR[newP].name} is back!` : '')], [ch.who, ask[0].toUpperCase() + ask.slice(1) + ', please.']];
  ch.text = DONE[k % DONE.length];
  out.push(ch); lastNew = newP;
}
fs.writeFileSync('/root/merge/scripts/content/projects-luna.mjs', `/* v95: Crater Camp grows to 100 chapters. Chapters 31-100: retired producers
   come back one at a time (every fifth chapter), asks climb slowly from step 3
   to step 6, two then three things per chapter. Generated from the content by
   a one-off script, then kept here as plain data. */
export const LUNA_MORE = ${JSON.stringify(out, null, 1)};\n`);
console.log(out.length, out[0].name, out[69].name, out.map(c => c.needs.map(n => IT[n[0]].tier).join('/')).slice(0, 8).join(' '), [...new Set(out.map(c=>c.name))].length);
