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
    SERVICES_TAB,
    { key: 'search', icon: 'search' },
    MENU_TAB,
  ],
  tenant: [
    { key: 'dashboard', icon: 'grid' },
    { key: 'living', icon: 'home' },
    SERVICES_TAB,
    { key: 'bills', icon: 'credit-card' },
    MENU_TAB,
  ],
  owner: [
    { key: 'dashboard', icon: 'grid' },
    { key: 'listings', icon: 'key' },
    SERVICES_TAB,
    { key: 'income', icon: 'credit-card' },
    MENU_TAB,
  ],
  agent: [
    { key: 'dashboard', icon: 'grid' },
    { key: 'listingRoom', icon: 'key' },
    { key: 'listingLead', icon: 'clipboard' },
    SERVICES_TAB,
    { key: 'calendar', icon: 'calendar' },
    { key: 'contracts', icon: 'clipboard' },
  ],
  admin: [
    { key: 'dashboard', icon: 'grid' },
    SERVICES_TAB,
    { key: 'tickets', icon: 'ticket' },
    MENU_TAB,
  ],
};

const DEFAULT_TAB: Record<ExtendedTabRole, MobileAppTab> = {
  guest: 'home',
  tenant: 'dashboard',
  owner: 'dashboard',
  agent: 'dashboard',
  admin: 'dashboard',
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
