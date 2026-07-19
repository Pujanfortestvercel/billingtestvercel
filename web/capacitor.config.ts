import type { CapacitorConfig } from '@capacitor/cli';

// Wraps the existing web build (the `dist` folder produced by `npm run build`)
// into a native Android app. No changes to the React source are needed.
const config: CapacitorConfig = {
  appId: 'com.billingapp.app',
  appName: 'BillingApp',
  webDir: 'dist',
};

export default config;
