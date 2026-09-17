/* Ad hooks.
 *
 * Nothing is wired to a network yet — this is the seam the AdMob plugin drops
 * into later, so the game can already *ask* for a rewarded video without
 * caring whether one exists. On web (and before the plugin is installed)
 * every call is a no-op and `rewarded()` resolves false, which callers treat
 * as "no ad available, just give the player the thing".
 *
 * To go live:
 *   npm i @capacitor-community/admob && npx cap sync
 *   then fill in init() / rewarded() below with the plugin calls and set the
 *   real ad unit ids. Google's test ids are already here for development.
 */
import { isNative } from './native';

export const AD_UNITS = {
  // Google's public test units — safe to develop against, swap before release
  rewardedAndroid: 'ca-app-pub-3940256099942544/5224354917',
  rewardediOS: 'ca-app-pub-3940256099942544/1712485313',
  interstitialAndroid: 'ca-app-pub-3940256099942544/1033173712',
  interstitialiOS: 'ca-app-pub-3940256099942544/4411468910',
};

export type Placement = 'energy' | 'doubleReward' | 'skipTimer';

let enabled = false;

export const ads = {
  /** true once a network is wired up and initialised */
  get available() { return enabled; },

  async init() {
    if (!isNative) return;            // no ads in the browser build
    // TODO: AdMob.initialize({ initializeForTesting: true }) and set `enabled`
    enabled = false;
  },

  /** Show a rewarded video. Resolves true only if the player actually earned it. */
  async rewarded(_placement: Placement): Promise<boolean> {
    if (!enabled) return false;
    // TODO: AdMob.prepareRewardVideoAd(...) / showRewardVideoAd(...)
    return false;
  },

  /** Fire-and-forget interstitial between bigger beats (e.g. after a launch). */
  async interstitial() {
    if (!enabled) return;
    // TODO: AdMob.prepareInterstitial(...) / showInterstitial(...)
  },
};
