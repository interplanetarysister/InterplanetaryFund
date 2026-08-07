import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.interplanetarysister.interplanetaryfund',
  appName: 'Interplanetary Fund',
  webDir: 'dist',
  server: {
    // For production, point to the Vercel URL so the APK loads the live web app
    // For local dev, use http://localhost:5173
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
  },
};

export default config;
