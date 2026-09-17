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

export interface Config {
  board: { cols: number; rows: number; starterItems: number };
  start: { coins: number; energy: number; world: string };
  energy: { base: number; perLevel: number; regenMs: number; snack: { amount: number; cooldownMs: number } };
  xp: { base: number; perLevel: number; perMerge: number; orderBase: number };
  orders: { slots: number; maxTierAtLevel: number; twoItemChanceFromLevel: number };
  meteor: { firstAtLevel: number; everyMinMs: number; everyRandomMs: number; chance: number };
  rocket: { fuelToLaunch: number };
  hint: { idleMs: number };
}

export const ITEMS = itemsJson as Record<string, ItemDef>;
export const CHAINS = chainsJson as Record<string, ChainDef>;
export const PRODUCERS = producersJson as Record<string, ProducerDef>;
export const WORLDS = worldsJson as Record<string, WorldDef>;
export const CHARACTERS = charactersJson as Record<string, CharacterDef>;
export const MISSIONS = missionsJson as MissionDef[];
export const CONFIG = configJson as Config;

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
  return errs;
}
