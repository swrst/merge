/* Rewarded video ads. The game only ever shows ads the player asks for.
 *
 *   live: Google AdMob (@capacitor-community/admob) with UMP consent and,
 *         on iOS, the App Tracking Transparency prompt.
 *   mock: a short in-game "test video" — the dev panel can make it complete,
 *         get skipped, or have no ad to show, so every branch can be tried. */
import { SERVICES } from './config';
import { isNative, platform, useLive, mockControls } from './platform';
import { analytics } from './analytics';

export type Placement = 'energy' | 'doubleReward' | 'skipTimer' | 'bubble' | 'recharge' | 'spin' | 'gift' | 'disc';
export type AdResult = 'rewarded' | 'skipped' | 'nofill';

let live = false;
let AdMob: any = null;

async function initLive() {
  ({ AdMob } = await import('@capacitor-community/admob'));
  await AdMob.initialize({ initializeForTesting: SERVICES.ads.testing });
  try {
    const info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
  } catch { /* consent is best-effort */ }
  if (platform() === 'ios') { try { await AdMob.requestTrackingAuthorization(); } catch { } }
}

function mockVideo(): Promise<AdResult> {
  return new Promise(res => {
    if (mockControls.ad === 'nofill') { res('nofill'); return; }
    const host = document.getElementById('app') || document.body;
    const o = document.createElement('div');
    o.className = 'fakeAd';
    o.innerHTML = `<div><b>📺 Test video</b><i>${live ? '' : 'mock ad — real ads come with AdMob'}</i>
      <span class="fakeBar"><em style="animation-duration:${SERVICES.ads.mockMs}ms"></em></span>
      <button class="fakeSkip">Close early</button></div>`;
    host.appendChild(o);
    let done = false;
    const end = (r: AdResult) => { if (done) return; done = true; o.remove(); res(r); };
    (o.querySelector('.fakeSkip') as HTMLElement).onclick = () => end('skipped');
    setTimeout(() => end(mockControls.ad === 'skip' ? 'skipped' : 'rewarded'), SERVICES.ads.mockMs);
  });
}

export const ads = {
  /** true when real AdMob is running */
  get live() { return live; },
  async init() {
    if (!useLive(SERVICES.ads.mode)) return;
    try { await initLive(); live = true; } catch { live = false; }
  },
  /** show a rewarded video; only 'rewarded' means the player earned the reward */
  async rewarded(placement: Placement): Promise<AdResult> {
    analytics.track('ad_start', { placement, live });
    let r: AdResult;
    if (live && AdMob) {
      try {
        const adId = platform() === 'ios' ? SERVICES.ads.units.rewardediOS : SERVICES.ads.units.rewardedAndroid;
        await AdMob.prepareRewardVideoAd({ adId, isTesting: SERVICES.ads.testing });
        r = (await AdMob.showRewardVideoAd()) ? 'rewarded' : 'skipped';
      } catch { r = 'nofill'; }
    } else if (isNative && SERVICES.ads.mode === 'live') r = 'nofill';
    else r = await mockVideo();
    analytics.track('ad_end', { placement, result: r });
    return r;
  },
};
