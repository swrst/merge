/* In-app purchases.
 *
 * Like ads.ts, this is the seam a billing plugin drops into. Until one is
 * wired up every purchase runs in TEST mode: it asks "test purchase?" and
 * grants the goods, so the whole flow can be played and tuned on a phone.
 *
 * To go live (Android, Google Play Billing):
 *   npm i cordova-plugin-purchase && npx cap sync
 *   create the same product ids in Play Console → Monetise → Products
 *   then fill in init() / buy() below with CdvPurchase.store calls.
 * Prices here are display defaults; the store's localised price wins.
 */
export type Product = {
  id: string; name: string; price: string; tag?: string; once?: boolean;
  gems?: number; energy?: number; coins?: number; boosts?: Record<string, number>; item?: string; adfree?: boolean;
};

export const PRODUCTS: Product[] = [
  { id: 'starter', name: 'Starter Pack', price: '€1.99', once: true, tag: 'One time · -80%', gems: 120, energy: 100, boosts: { wand: 2, bomb: 2 }, item: 'bigchest' },
  { id: 'gems_s', name: 'Handful of Gems', price: '€0.99', gems: 80 },
  { id: 'gems_m', name: 'Pouch of Gems', price: '€4.99', gems: 450, tag: 'Popular' },
  { id: 'gems_l', name: 'Chest of Gems', price: '€9.99', gems: 1000 },
  { id: 'gems_xl', name: 'Vault of Gems', price: '€19.99', gems: 2200, tag: 'Best value' },
  { id: 'energy_pack', name: 'Energy Crate', price: '€2.99', energy: 300, coins: 500 },
  { id: 'adfree', name: 'Ad-Free Pass', price: '€3.99', once: true, adfree: true, gems: 50, tag: 'Rewards without videos' },
];

let live = false;

export const iap = {
  /** true when a real store is connected; false means purchases are test-only */
  get live() { return live; },
  async init() { live = false; /* TODO: CdvPurchase.store.register(...) / initialize() */ },
  /** resolves true when the purchase went through (or a test one was accepted) */
  async buy(p: Product): Promise<boolean> {
    if (live) { /* TODO: store.get(p.id).getOffer().order() and wait for 'approved' */ return false; }
    return window.confirm(`TEST PURCHASE\n\n${p.name} — ${p.price}\n\nNo money is charged until billing is set up. Grant it?`);
  },
};
