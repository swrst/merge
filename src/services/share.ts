/* Sharing a picture (the album / profile brag card).
   On the phone it goes through the Capacitor Share sheet (WhatsApp, Instagram,
   Discord, Reddit…); in a browser it uses the Web Share API, or downloads the
   PNG when neither exists. Never throws: returns false if nothing worked. */
import { Capacitor } from '@capacitor/core';

export async function shareImage(dataUrl: string, text: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const path = 'galaxy-adventure-' + Date.now() + '.png';
      const r = await Filesystem.writeFile({ path, data: dataUrl.split(',')[1], directory: Directory.Cache });
      await Share.share({ title: 'Galaxy Adventure', text, files: [r.uri], dialogTitle: 'Share your progress' });
      return true;
    }
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'galaxy-adventure.png', { type: 'image/png' });
    const nav: any = navigator;
    if (nav.canShare && nav.canShare({ files: [file] })) { await nav.share({ files: [file], text, title: 'Galaxy Adventure' }); return true; }
    const a = document.createElement('a'); a.href = dataUrl; a.download = 'galaxy-adventure.png';
    document.body.appendChild(a); a.click(); a.remove();
    return true;
  } catch {
    return false;
  }
}
