import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.artursolak.mergerocket',
  appName: 'Merge Rocket',
  webDir: 'dist',
  android: {
    backgroundColor: '#7fd2fb',
  },
  ios: {
    backgroundColor: '#7fd2fb',
    contentInset: 'always',
  },
};

export default config;
