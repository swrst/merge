/* Ads — Google AdMob through @capacitor-community/admob.
 *
 * Live on Android/iOS builds. In the browser there are no ads; game.ts then
 * plays a short fake "test video" (config.ads.simulate) so flows can be tried.
 *
 * Before release: put YOUR ad unit ids in AD_UNITS below, set TESTING=false,
 * and put your AdMob APP id in android/app/src/main/AndroidManifest.xml and
 * ios/App/App/Info.plist (see PUBLISHING.md). Never tap your own live ads.
 */
import { isNative } from './native';

export const TESTING = true;                      // ← false for the store build

export const AD_UNITS = {
  // Google's public TEST units — replace with your own from admob.google.com
  rewardedAndroid: 'ca-app-pub-3940256099942544/5224354917',
  rewardediOS: 'ca-app-pub-3940256099942544/1712485313',
};

export type Placement = 'energy' | 'doubleReward' | 'skipTimer' | 'bubble' | 'recharge' | 'spin' | 'gift' | 'disc';

let enabled = false;
let AdMob: any = null;
const platform = () => ((window as any).Capacitor?.getPlatform?.() || 'web');

export const ads = {
  /** true once AdMob is initialised on a phone */
  get available() { return enabled; },

  async init() {
    if (!isNative) return;
    try {
      ({ AdMob } = await import('@capacitor-community/admob'));
      await AdMob.initialize({ initializeForTesting: TESTING });
      // GDPR / UMP consent: shows Google's form in the EU when required
      try {
        const info = await AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
      } catch (e) { /* consent is best-effort */ }
      // iOS 14+: ask for tracking permission (personalised ads); a "no" still shows ads
      if (platform() === 'ios') { try { await AdMob.requestTrackingAuthorization(); } catch (e) { } }
      enabled = true;
    } catch (e) { enabled = false; }
  },

  /** Show a rewarded video. Resolves true only if the player actually earned it. */
  async rewarded(_placement: Placement): Promise<boolean> {
    if (!enabled || !AdMob) return false;
    try {
      const adId = platform() === 'ios' ? AD_UNITS.rewardediOS : AD_UNITS.rewardedAndroid;
      await AdMob.prepareRewardVideoAd({ adId, isTesting: TESTING });
      const reward = await AdMob.showRewardVideoAd();
      return !!reward;
    } catch (e) { return false; }
  },

  async interstitial() { /* not used: the game only shows ads the player asks for */ },
};
