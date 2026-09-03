import { ServiceCategory, ServiceStatus, UserRole } from '@nestyk/types';
import { MobileNotificationItem } from '@nestyk/ui/native';
import type { AppIconName } from '@nestyk/ui';

export const MOCK_USER = {
  name: 'Jane Doe',
  initials: 'JD',
  email: 'jane.doe@email.com',
  phone: '081-234-5678',
  roleLabel: 'Room Seeker',
};

export const TAB_SCREEN_TITLES = {
  search: 'Discover',
  living: 'Living',
  listings: 'Listings',
  services: 'Services',
  menu: 'Menu',
} as const;

export const MOCK_ACTIVITY_NOTIFICATIONS: MobileNotificationItem[] = [
  {
    id: '1',
    text: 'Michael Tan confirmed your viewing for The Base Sukhumvit 77',
    time: 'Sep 7, 11:20',
    unread: true,
    icon: 'calendar' as AppIconName,
    iconColor: '#22C55E',
  },
  {
    id: '2',
    text: 'Rent bill for Sep 2026 is due in 3 days',
    time: 'Sep 6, 18:45',
    unread: true,
    icon: 'credit-card' as AppIconName,
    iconColor: '#DC2626',
  },
  {
    id: '3',
    text: 'Technician updated your AC repair ticket to In Progress',
    time: 'Yesterday, 09:10',
    unread: true,
    icon: 'wrench' as AppIconName,
    iconColor: '#F59E0B',
  },
  {
    id: '4',
    text: 'Digital lease for Room 1804 has been signed',
    time: 'Sep 5, 14:00',
    unread: false,
    icon: 'check' as AppIconName,
    iconColor: '#2563EB',
  },
];

export const MOCK_MESSAGE_NOTIFICATIONS: MobileNotificationItem[] = [
  {
    id: 'm1',
    text: 'Property Manager: Your move-in inspection is scheduled for Sep 5',
    time: 'Sep 7, 08:30',
    unread: true,
    icon: 'chat' as AppIconName,
    iconColor: '#0284C7',
  },
  {
    id: 'm2',
    text: 'NESTYK Support: Welcome to NESTYK Living Hub',
    time: 'Sep 6, 10:00',
    unread: false,
    icon: 'chat' as AppIconName,
    iconColor: '#0284C7',
  },
];

export const MOCK_LISTINGS = [
  {
    id: '1',
    title: 'The Base Sukhumvit 77 (Near BTS On Nut)',
    roomType: '1 Bedroom (32 sqm)',
    floor: 'Floor 18 · City View',
    price: '14,500',
    tag: 'Move-in Ready',
    badgeRole: 'guest' as UserRole,
  },
  {
    id: '2',
    title: 'Ideo Mobi Sukhumvit Eastpoint (BTS Bang Na)',
    roomType: 'Studio Duplex (29 sqm)',
    floor: 'Floor 12 · Pool View',
    price: '13,000',
    tag: 'Co-broke 3%',
    badgeRole: 'agent' as UserRole,
  },
  {
    id: '3',
    title: 'Ashton Asoke (MRT Sukhumvit / BTS Asok)',
    roomType: '2 Bedrooms (65 sqm)',
    floor: 'Floor 35 · High Floor',
    price: '45,000',
    tag: 'Panorama View',
    badgeRole: 'owner' as UserRole,
  },
];

export function getRoleSubtitle(role: UserRole | 'services'): string {
  const map: Record<UserRole | 'services', string> = {
    guest: 'Room Seeker',
    tenant: 'Tenant · Room 1804',
    owner: 'Owner · 3 Active Listings',
    agent: 'Agent · Co-Broke Partner',
    admin: 'Admin · Operations',
    assistant: 'Assistant · Operations',
    services: 'Services Hub',
  };
  return map[role];
}

export interface MockServiceTicket {
  id: string;
  category: ServiceCategory;
  title: string;
  status: ServiceStatus;
  time: string;
  icon: AppIconName;
}

export const MOCK_SERVICE_TICKETS: MockServiceTicket[] = [
  {
    id: 't1',
    category: 'maintenance',
    title: 'AC leak in Room 1804',
    status: 'in_progress',
    time: 'Updated 2h ago',
    icon: 'wrench',
  },
  {
    id: 't2',
    category: 'cleaning',
    title: 'Weekly cleaning · Room 1804',
    status: 'assigned',
    time: 'Tomorrow, 10:00',
    icon: 'sparkle',
  },
];
