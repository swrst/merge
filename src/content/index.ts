/* All game content lives in the JSON files next to this one. Nothing here is
   logic — add an item, a chain, a producer or a whole world by editing JSON.
   This module types it, derives a few lookups, and sanity-checks the lot. */
import itemsJson from './items.json';
import chainsJson from './chains.json';
import producersJson from './producers.json';
import worldsJson from './worlds.json';
import charactersJson from './characters.json';
import missionsJson from './missions.json';
import configJson from './config.json';
import researchJson from './research.json';
import shopJson from './shop.json';

export interface ItemDef {
  name: string;
  chain: string;
  tier: number;
  sell: number;
  /** finishing this item installs a rocket part instead of leaving it on the board */
  part?: string;
  /** finishing this item tops up the fuel tank */
  fuel?: boolean;
}
export interface ChainDef {
  name: string;
  /** 'earth' | 'luna' for world chains, 'ship' for rocket parts, 'any' for meteor drops */
  world: string;
  items: string[];
}
export interface ProducerDef {
  name: string;
  /** key into ART.producer() */
  art: string;
  /** 'tap' spends energy on demand, 'timer' refills itself and banks charges */
  mode: 'tap' | 'timer';
  cost?: number;
  every?: number;
  cap?: number;
  /** a producer that runs out: how many times it can be used before it vanishes */
  uses?: number;
  drops: string[];
}
export interface WorldDef {
  name: string;
  subtitle: string;
  /** key into ART.planet() */
  planet: string;
  chains: string[];
  start: { cell: number; producer: string }[];
  /** board cell index -> level that clears it */
  locks: Record<string, number>;
  /** characters who place orders here */
  folks: string[];
}
export interface CharacterDef { name: string; lines: string[] }
export interface MissionDef { id: string; need: number; text: string; hint: string; coins: number }

/** A lab recipe: two items + coins -> one rare item. Discovered by experimenting. */
export interface RecipeDef {
  id: string;
  /** item produced */
  result: string;
  /** the two item ids that go in the slots, in any order */
  inputs: string[];
  coins: number;
  /** riddle shown before the recipe is discovered */
  note: string;
}
export interface UpgradeDef {
  id: string; name: string; desc: string; icon: string;
  basePrice: number; step: number; max: number;
}
export interface CrateDef { id: string; name: string; desc: string; icon: string; price: number }
/** a one-shot helper bought with coins and fired from the board */
export interface BoosterDef { id: string; name: string; desc: string; icon: string; price: number }
export interface ShopDef {
  supplyStock: number;
  supplyRestockMs: number;
  supplyPriceMultiplier: number;
  upgrades: UpgradeDef[];
  crates: CrateDef[];
  boosters: BoosterDef[];
}

export interface Config {
  board: { cols: number; rows: number; starterItems: number };
  start: { coins: number; energy: number; world: string };
  energy: { base: number; perLevel: number; regenMs: number; snack: { amount: number; cooldownMs: number } };
  /** level curve: base + (l-1)·perLevel + growth·(l-1)² */
  xp: { base: number; perLevel: number; growth: number; perMerge: number; orderBase: number };
  orders: {
    slots: number; maxTierAtLevel: number; twoItemChanceFromLevel: number;
    /** chance an order also hands back a rocket piece while the rocket is unfinished */
    partRewardChance: number;
    /** chance an order hands back a regular item otherwise */
    itemRewardChance: number;
  };
  meteor: { firstAtLevel: number; everyMinMs: number; everyRandomMs: number; chance: number };
  rocket: { fuelToLaunch: number };
  hint: { idleMs: number };
  /** the level the shop appears at (the lab is built, not unlocked by level) */
  unlocks: { shopAtLevel: number };
  /** what one level of each shop upgrade is worth */
  upgrades: {
    energyPerStep: number; speedPerStep: number; ordersPerStep: number;
    snackPerStep: number; bagPerStep: number;
  };
  /** merge combos: how close together merges must be, and what a step pays */
  streak: { windowMs: number; minFor: number; coinPerStep: number; maxStep: number };
  /** the login calendar, one entry per day of the streak */
  daily: { rewards: { kind: string; n?: number; id?: string; label: string }[] };
  /** the timed cargo event */
  ship: {
    firstAtLevel: number; everyMs: number; windowMs: number;
    slots: number; coinMult: number; xpMult: number;
  };
  /** research lab: the build price, the bench fee, and how many duds earn a free clue */
  lab: { failFee: number; clueEvery: number; build: { coins: number; item: string; qty: number } };
}

export const ITEMS = itemsJson as Record<string, ItemDef>;
export const CHAINS = chainsJson as Record<string, ChainDef>;
export const PRODUCERS = producersJson as Record<string, ProducerDef>;
export const WORLDS = worldsJson as Record<string, WorldDef>;
export const CHARACTERS = charactersJson as Record<string, CharacterDef>;
export const MISSIONS = missionsJson as MissionDef[];
export const CONFIG = configJson as Config;
export const RECIPES = researchJson as RecipeDef[];
export const SHOP = shopJson as ShopDef;

/* ------------------------------------------------------------- lookups */

/** the next tier up, or null if this is the top of its chain */
export function nextOf(id: string): string | null {
  const d = ITEMS[id];
  if (!d) return null;
  const list = CHAINS[d.chain]?.items;
  if (!list) return null;
  const i = list.indexOf(id);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
}

/** every item id, handy for preloading textures */
export const ITEM_IDS = Object.keys(ITEMS);
/** every producer art key */
export const PRODUCER_ARTS = Object.values(PRODUCERS).map(p => p.art);

/* ---------------------------------------------------------- validation */

/** Cheap referential integrity check — catches typos the moment content changes.
 *  Returns a list of problems; empty means the content is consistent. */
export function validateContent(): string[] {
  const errs: string[] = [];
  const has = (map: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(map, key);

  for (const [id, it] of Object.entries(ITEMS)) {
    if (!has(CHAINS, it.chain)) errs.push(`item "${id}" points at unknown chain "${it.chain}"`);
    else if (CHAINS[it.chain].items.indexOf(id) < 0) errs.push(`item "${id}" is missing from chain "${it.chain}"`);
  }
  for (const [key, ch] of Object.entries(CHAINS)) {
    ch.items.forEach(id => { if (!has(ITEMS, id)) errs.push(`chain "${key}" lists unknown item "${id}"`); });
    ch.items.forEach((id, i) => {
      const t = ITEMS[id]?.tier;
      if (t !== undefined && t !== i + 1) errs.push(`item "${id}" has tier ${t} but sits at position ${i + 1} of "${key}"`);
    });
  }
  for (const [key, p] of Object.entries(PRODUCERS)) {
    p.drops.forEach(id => { if (!has(ITEMS, id)) errs.push(`producer "${key}" drops unknown item "${id}"`); });
    if (p.mode === 'timer' && (!p.every || !p.cap)) errs.push(`timer producer "${key}" needs "every" and "cap"`);
    if (p.mode === 'tap' && p.cost === undefined) errs.push(`tap producer "${key}" needs "cost"`);
    if (p.uses !== undefined && !(p.uses > 0)) errs.push(`producer "${key}" has a "uses" of ${p.uses}`);
  }
  const cells = CONFIG.board.cols * CONFIG.board.rows;
  for (const [key, w] of Object.entries(WORLDS)) {
    w.chains.forEach(c => { if (!has(CHAINS, c)) errs.push(`world "${key}" lists unknown chain "${c}"`); });
    w.folks.forEach(f => { if (!has(CHARACTERS, f)) errs.push(`world "${key}" lists unknown character "${f}"`); });
    w.start.forEach(s => {
      if (!has(PRODUCERS, s.producer)) errs.push(`world "${key}" starts with unknown producer "${s.producer}"`);
      if (s.cell < 0 || s.cell >= cells) errs.push(`world "${key}" places a producer on cell ${s.cell}, outside the board`);
    });
    Object.keys(w.locks).forEach(c => {
      if (+c < 0 || +c >= cells) errs.push(`world "${key}" locks cell ${c}, outside the board`);
    });
  }
  const ids = new Set<string>();
  MISSIONS.forEach(m => {
    if (ids.has(m.id)) errs.push(`duplicate mission id "${m.id}"`);
    ids.add(m.id);
  });
  const rids = new Set<string>();
  const pairs = new Set<string>();
  RECIPES.forEach(r => {
    if (rids.has(r.id)) errs.push(`duplicate recipe id "${r.id}"`);
    rids.add(r.id);
    if (!has(ITEMS, r.result)) errs.push(`recipe "${r.id}" makes unknown item "${r.result}"`);
    if (r.inputs.length !== 2) errs.push(`recipe "${r.id}" needs exactly 2 inputs`);
    r.inputs.forEach(id => { if (!has(ITEMS, id)) errs.push(`recipe "${r.id}" wants unknown item "${id}"`); });
    if (r.inputs.indexOf(r.result) >= 0) errs.push(`recipe "${r.id}" uses its own result as an input`);
    const key = r.inputs.slice().sort().join('+');
    if (pairs.has(key)) errs.push(`two recipes share the input pair "${key}"`);
    pairs.add(key);
    if (!(r.coins > 0)) errs.push(`recipe "${r.id}" needs a positive coin cost`);
  });
  const uids = new Set<string>();
  SHOP.upgrades.forEach(u => {
    if (uids.has(u.id)) errs.push(`duplicate upgrade id "${u.id}"`);
    uids.add(u.id);
    if (!(u.max > 0)) errs.push(`upgrade "${u.id}" needs a max above 0`);
    if (!(u.basePrice > 0)) errs.push(`upgrade "${u.id}" needs a price`);
    if (!Object.prototype.hasOwnProperty.call(CONFIG.upgrades, u.id + 'PerStep'))
      errs.push(`upgrade "${u.id}" has no "${u.id}PerStep" value in config.upgrades`);
  });
  const cids = new Set<string>();
  SHOP.boosters.forEach(b => {
    if (!(b.price > 0)) errs.push(`booster "${b.id}" needs a price`);
  });
  const bids = new Set<string>();
  SHOP.boosters.forEach(b => {
    if (bids.has(b.id)) errs.push(`duplicate booster id "${b.id}"`);
    bids.add(b.id);
  });
  CONFIG.daily.rewards.forEach((r, i) => {
    if (r.kind === 'booster' && !SHOP.boosters.some(b => b.id === r.id))
      errs.push(`daily reward ${i + 1} gives unknown booster "${r.id}"`);
  });
  if (!(CONFIG.ship.slots > 0)) errs.push('ship.slots must be at least 1');
  SHOP.crates.forEach(c => {
    if (cids.has(c.id)) errs.push(`duplicate crate id "${c.id}"`);
    cids.add(c.id);
    if (!(c.price > 0)) errs.push(`crate "${c.id}" needs a price`);
  });
  if (!has(ITEMS, CONFIG.lab.build.item)) errs.push(`lab build wants unknown item "${CONFIG.lab.build.item}"`);
  if (!(SHOP.supplyStock > 0)) errs.push('shop.supplyStock must be at least 1');
  if (!(SHOP.supplyPriceMultiplier >= 1)) errs.push('shop.supplyPriceMultiplier should be 1 or more');
  return errs;
}
