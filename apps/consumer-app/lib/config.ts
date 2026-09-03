/**
 * NESTYK Consumer App Environment & API Configuration
 * Unified Path Routing Strategy
 */
export const APP_CONFIG = {
  // Base Web Domain (Unified Path Routing)
  baseUrl: process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:3000',

  // Unified Backend API Endpoint
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api',

  // Webview / Portal Deep Links
  portals: {
    marketplace: 'http://localhost:3000',
    owner: 'http://localhost:3000/owner',
    agent: 'http://localhost:3000/agent',
    admin: 'http://localhost:3000/admin',
  },
} as const;
