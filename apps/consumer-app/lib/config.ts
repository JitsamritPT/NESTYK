import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as
  | { apiUrl?: string; baseUrl?: string }
  | undefined;

/**
 * NESTYK Consumer App Environment & API Configuration
 */
export const APP_CONFIG = {
  baseUrl:
    extra?.baseUrl || process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:3000',
  apiUrl:
    extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  portals: {
    marketplace: 'http://localhost:3000',
    owner: 'http://localhost:3000/owner',
    agent: 'http://localhost:3000/agent',
    admin: 'http://localhost:3000/admin',
  },
} as const;
