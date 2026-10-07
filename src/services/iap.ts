/* In-app purchases through RevenueCat (Google Play Billing + Apple StoreKit,
 * receipts checked server-side, one dashboard for both stores).
 *
 *   live: @revenuecat/purchases-capacitor, once the public SDK keys are set.
 *   mock: an in-game "test purchase" sheet — buy / cancel / fail — so every
 *         branch of the shop can be tried. Nothing is ever charged. */
import { SERVICES } from './config';
import { platform, useLive, mockControls } from './platform';
import { analytics } from './analytics';

export type Product = {
  id: string; name: string; price: string; tag?: string; once?: boolean;
  gems?: number; energy?: number; coins?: number; boosts?: Record<string, number>; item?: string; adfree?: boolean;
};
export type BuyResult = 'ok' | 'cancelled' | 'failed';

/* ids must match the products created in Play Console / App Store Connect */
export const PRODUCTS: Product[] = [
  { id: 'starter', name: 'Starter Pack', price: '€1.99', once: true, tag: 'One time · -80%', gems: 120, energy: 100, boosts: { wand: 2, bomb: 2 }, item: 'bigchest' },
  { id: 'gems_s', name: 'Handful of Gems', price: '€0.99', gems: 80 },
  { id: 'gems_m', name: 'Pouch of Gems', price: '€4.99', gems: 450, tag: 'Popular' },
  { id: 'gems_l', name: 'Chest of Gems', price: '€9.99', gems: 1000 },
  { id: 'gems_xl', name: 'Vault of Gems', price: '€19.99', gems: 2200, tag: 'Best value' },
  { id: 'energy_pack', name: 'Energy Crate', price: '€2.99', energy: 300, coins: 500 },
  { id: 'coins_s', name: 'Bag of Coins', price: '€0.99', coins: 1500 },
  { id: 'coins_m', name: 'Sack of Coins', price: '€4.99', coins: 9000, tag: 'Popular' },
  { id: 'coins_l', name: 'Coin Vault', price: '€9.99', coins: 20000, tag: 'Best value' },
  { id: 'adfree', name: 'Ad-Free Pass', price: '€3.99', once: true, adfree: true, gems: 50, tag: 'Rewards without videos' },
];

let live = false;
let Purchases: any = null;
const storeProducts: Record<string, any> = {};

function mockSheet(p: Product): Promise<BuyResult> {
  if (mockControls.purchase === 'success') return Promise.resolve('ok');
  if (mockControls.purchase === 'cancel') return Promise.resolve('cancelled');
  if (mockControls.purchase === 'error') return Promise.resolve('failed');
  return new Promise(res => {
    const host = document.getElementById('app') || document.body;
    const o = document.createElement('div');
    o.className = 'mockSheet';
    o.innerHTML = `<div class="msBox"><div class="msHead">Test purchase</div>
      <div class="msName">${p.name}</div><div class="msPrice">${p.price}</div>
      <div class="msNote">Store billing is not connected yet. Nothing is charged.</div>
      <button class="big" data-r="ok">Buy (test)</button>
      <button class="big soft" data-r="cancelled">Cancel</button>
      <button class="msFail" data-r="failed">Simulate a payment error</button></div>`;
    host.appendChild(o);
    o.querySelectorAll<HTMLElement>('[data-r]').forEach(b => b.onclick = () => { o.remove(); res(b.dataset.r as BuyResult); });
  });
}

export const iap = {
  /** true when a real store is connected; false means purchases are test-only */
  get live() { return live; },
  async init() {
    const key = platform() === 'ios' ? SERVICES.iap.revenueCatKeys.ios : SERVICES.iap.revenueCatKeys.android;
    if (!useLive(SERVICES.iap.mode, !!key)) return;
    try {
      ({ Purchases } = await import('@revenuecat/purchases-capacitor'));
      await Purchases.configure({ apiKey: key });
      const res = await Purchases.getProducts({ productIdentifiers: PRODUCTS.map(p => p.id) });
      (res.products || []).forEach((sp: any) => {
        storeProducts[sp.identifier] = sp;
        const p = PRODUCTS.find(x => x.id === sp.identifier); if (p && sp.priceString) p.price = sp.priceString;
      });
      live = true;
    } catch { live = false; }
  },
  async buy(p: Product): Promise<BuyResult> {
    analytics.track('purchase_start', { product: p.id, live });
    let r: BuyResult;
    if (live && Purchases) {
      const sp = storeProducts[p.id];
      if (!sp) r = 'failed';
      else {
        try { await Purchases.purchaseStoreProduct({ product: sp }); r = 'ok'; }
        catch (e: any) { r = e && (e.userCancelled || e.code === '1') ? 'cancelled' : 'failed'; }
      }
    } else r = await mockSheet(p);
    analytics.track('purchase_end', { product: p.id, result: r, live });
    return r;
  },
  /** "Restore purchases" — required by Apple for one-time products (Ad-Free, Starter) */
  async restore(): Promise<string[]> {
    if (!(live && Purchases)) return [];
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      return Object.keys(customerInfo?.allPurchaseDatesByProduct || {});
    } catch { return []; }
  },
};
