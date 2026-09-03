import { UserRole } from '@nestyk/types';
import { AppIconName } from '../icons/types';
import { MobileAppTab } from '../components/MobileBottomTabBar';

export type ExtendedTabRole = UserRole;

export interface MobileTabConfig {
  key: MobileAppTab;
  icon: AppIconName;
}

const SERVICES_TAB: MobileTabConfig = { key: 'services', icon: 'grid' };
const MENU_TAB: MobileTabConfig = { key: 'menu', icon: 'menu' };

const TAB_MATRIX: Record<ExtendedTabRole, MobileTabConfig[]> = {
  guest: [
    { key: 'home', icon: 'home' },
    { key: 'search', icon: 'search' },
    SERVICES_TAB,
    MENU_TAB,
  ],
  tenant: [
    { key: 'dashboard', icon: 'grid' },
    { key: 'living', icon: 'home' },
    { key: 'bills', icon: 'credit-card' },
    SERVICES_TAB,
    MENU_TAB,
  ],
  owner: [
    { key: 'dashboard', icon: 'grid' },
    { key: 'listings', icon: 'key' },
    { key: 'income', icon: 'credit-card' },
    SERVICES_TAB,
    MENU_TAB,
  ],
  agent: [
    { key: 'dashboard', icon: 'grid' },
    { key: 'listings', icon: 'handshake' },
    { key: 'deals', icon: 'ticket' },
    SERVICES_TAB,
    MENU_TAB,
  ],
  admin: [
    { key: 'dashboard', icon: 'grid' },
    { key: 'tickets', icon: 'ticket' },
    SERVICES_TAB,
    MENU_TAB,
  ],
  assistant: [
    { key: 'dashboard', icon: 'grid' },
    { key: 'tickets', icon: 'ticket' },
    SERVICES_TAB,
    MENU_TAB,
  ],
};

const DEFAULT_TAB: Record<ExtendedTabRole, MobileAppTab> = {
  guest: 'home',
  tenant: 'dashboard',
  owner: 'dashboard',
  agent: 'dashboard',
  admin: 'dashboard',
  assistant: 'dashboard',
};

export function getTabsForRole(role: ExtendedTabRole): MobileTabConfig[] {
  return TAB_MATRIX[role] ?? TAB_MATRIX.guest;
}

export function getDefaultTabForRole(role: ExtendedTabRole): MobileAppTab {
  return DEFAULT_TAB[role] ?? 'home';
}

export function isTabAvailableForRole(role: ExtendedTabRole, tab: MobileAppTab): boolean {
  return getTabsForRole(role).some((item) => item.key === tab);
}
