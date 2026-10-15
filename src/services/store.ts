/* Store-side extras.
 *   requestReview: the native review sheet (Play In-App Review / SKStoreReviewController)
 *                  via @capacitor-community/in-app-review. The OS decides whether it
 *                  actually shows, so ask once, at a happy moment, and move on.
 *   openStorePage: the game's own page, for "rate us" or an update.
 *   checkUpdate:   Play In-App Updates via @capawesome/capacitor-app-update (Android only). */
import { SERVICES } from './config';
import { platform, useLive } from './platform';
import { analytics } from './analytics';

export type StoreMsg = (text: string) => void;
let say: StoreMsg = () => { };

export const store = {
  /** the game passes its toast in, so mocks can show what would have happened */
  init(toast: StoreMsg) { say = toast; },
  pageUrl() {
    return platform() === 'ios' && SERVICES.app.iosAppStoreId
      ? `https://apps.apple.com/app/id${SERVICES.app.iosAppStoreId}`
      : `https://play.google.com/store/apps/details?id=${SERVICES.app.androidPackage}`;
  },
  async requestReview() {
    analytics.track('review_prompt');
    if (useLive(SERVICES.store.mode)) {
      try { const { InAppReview } = await import('@capacitor-community/in-app-review'); await InAppReview.requestReview(); return; } catch { }
    }
    say('⭐ (test) The store\'s "rate this game" sheet would open here.');
  },
  openStorePage() { window.open(this.pageUrl(), '_blank'); },
  async checkUpdate(): Promise<boolean> {
    if (!useLive(SERVICES.store.mode) || platform() !== 'android') return false;
    try {
      const { AppUpdate, AppUpdateAvailability } = await import('@capawesome/capacitor-app-update');
      const r = await AppUpdate.getAppUpdateInfo(); return r.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE;
    } catch { return false; }
  },
};
