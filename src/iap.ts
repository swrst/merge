/* In-app purchases — RevenueCat (@revenuecat/purchases-capacitor).
 *
 * RevenueCat talks to Google Play Billing and Apple StoreKit for us, checks
 * receipts on its servers, and gives one dashboard for both stores. Free up
 * to $2.5k monthly revenue.
 *
 * Until REVENUECAT_KEYS are filled in (see PUBLISHING.md) every purchase runs
 * in TEST mode: it asks "grant it?" and nothing is charged.
 * Product ids below must match the products you create in Play Console /
 * App Store Connect (and import into RevenueCat). Prices shown are fallbacks;
 * the store's localised price replaces them when live.
 */
import { isNative } from './native';

export const REVENUECAT_KEYS = {
  android: '',        // ← "goog_..." public SDK key from RevenueCat → Project → API keys
  ios: '',            // ← "appl_..."
};

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
let Purchases: any = null;
const storeProducts: Record<string, any> = {};

export const iap = {
  /** true when a real store is connected; false means purchases are test-only */
  get live() { return live; },
  async init() {
    if (!isNative) return;
    const platform = (window as any).Capacitor?.getPlatform?.();
    const apiKey = platform === 'ios' ? REVENUECAT_KEYS.ios : REVENUECAT_KEYS.android;
    if (!apiKey) return;
    try {
      ({ Purchases } = await import('@revenuecat/purchases-capacitor'));
      await Purchases.configure({ apiKey });
      const res = await Purchases.getProducts({ productIdentifiers: PRODUCTS.map(p => p.id) });
      (res.products || []).forEach((sp: any) => {
        storeProducts[sp.identifier] = sp;
        const p = PRODUCTS.find(x => x.id === sp.identifier); if (p && sp.priceString) p.price = sp.priceString;
      });
      live = true;
    } catch (e) { live = false; }
  },
  /** resolves true when the purchase went through (or a test one was accepted) */
  async buy(p: Product): Promise<boolean> {
    if (live && Purchases) {
      const sp = storeProducts[p.id]; if (!sp) return false;
      try { await Purchases.purchaseStoreProduct({ product: sp }); return true; }
      catch (e) { return false; }               // cancelled or failed
    }
    return window.confirm(`TEST PURCHASE\n\n${p.name} — ${p.price}\n\nNo money is charged until billing is set up. Grant it?`);
  },
};
