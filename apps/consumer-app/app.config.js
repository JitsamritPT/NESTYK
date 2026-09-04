const path = require('path');
const fs = require('fs');

// Load monorepo root `.env` (frontend) so EXPO_PUBLIC_* are available
const rootEnv = path.join(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: 'NESTYK',
  slug: 'nestyk-consumer-app',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'nestyk',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#F8B615',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.nestyk.consumer',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F8B615',
    },
    package: 'com.nestyk.consumer',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-router', 'expo-localization'],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
    baseUrl: process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:3000',
  },
};
