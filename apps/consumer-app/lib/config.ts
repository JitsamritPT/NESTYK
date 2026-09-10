import Constants from 'expo-constants';
import type { UserRole } from '@nestyk/types';

const ROLES: UserRole[] = ['guest', 'tenant', 'owner', 'agent', 'admin'];

const extra = Constants.expoConfig?.extra as
  | { apiUrl?: string; baseUrl?: string; defaultRole?: string }
  | undefined;

function resolveDefaultRole(): UserRole {
  const raw = (extra?.defaultRole || process.env.EXPO_PUBLIC_DEFAULT_ROLE || 'guest')
    .trim()
    .toLowerCase();
  return (ROLES.includes(raw as UserRole) ? raw : 'guest') as UserRole;
}

/**
 * NESTYK Consumer App Environment & API Configuration
 */
export const APP_CONFIG = {
  baseUrl:
    extra?.baseUrl || process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:3000',
  apiUrl:
    extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  /** Cold-start shell role (`EXPO_PUBLIC_DEFAULT_ROLE`) */
  defaultRole: resolveDefaultRole(),
  portals: {
    marketplace: 'http://localhost:3000',
    owner: 'http://localhost:3000/owner',
    agent: 'http://localhost:3000/agent',
    admin: 'http://localhost:3000/admin',
  },
} as const;
