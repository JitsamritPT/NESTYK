'use client';

import React from 'react';
import {
  MagnifyingGlass,
  House,
  Key,
  SquaresFour,
  List,
  Bell,
  Moon,
  CaretLeft,
  CaretRight,
  CaretDown,
  X,
  Heart,
  DotsThreeVertical,
  Trash,
  Calendar,
  Sparkle,
  Wrench,
  ClipboardText,
  ChatCircle,
  Ticket,
  BellRinging,
  Package,
  Handshake,
  Shield,
  User,
  Users,
  UserPlus,
  CreditCard,
  Gear,
  Globe,
  Check,
  CalendarPlus,
  QrCode,
  Buildings,
  Bed,
  Bathtub,
  StackSimple,
  FrameCorners,
  Camera,
  Coins,
  MapPin,
  NotePencil,
  WarningCircle,
  Envelope,
  Phone,
  GoogleLogo,
  FacebookLogo,
  AppleLogo,
  ArrowsLeftRight,
  Funnel,
  Lock,
  Plus,
  IconProps,
} from 'phosphor-react';
import { tokens } from '../theme/tokens';
import { AppIconName, AppIconTone } from './types';

const ICON_MAP: Record<Exclude<AppIconName, 'house-plus'>, React.ComponentType<IconProps>> = {
  search: MagnifyingGlass,
  home: House,
  key: Key,
  grid: SquaresFour,
  'list-rows': List,
  menu: List,
  bell: Bell,
  moon: Moon,
  'chevron-left': CaretLeft,
  'chevron-right': CaretRight,
  'chevron-down': CaretDown,
  close: X,
  heart: Heart,
  'dots-vertical': DotsThreeVertical,
  trash: Trash,
  calendar: Calendar,
  sparkle: Sparkle,
  wrench: Wrench,
  clipboard: ClipboardText,
  chat: ChatCircle,
  ticket: Ticket,
  siren: BellRinging,
  package: Package,
  handshake: Handshake,
  shield: Shield,
  user: User,
  users: Users,
  'user-plus': UserPlus,
  'credit-card': CreditCard,
  gear: Gear,
  globe: Globe,
  check: Check,
  'calendar-plus': CalendarPlus,
  'qr-code': QrCode,
  buildings: Buildings,
  bed: Bed,
  bath: Bathtub,
  stairs: StackSimple,
  'room-size': FrameCorners,
  camera: Camera,
  coins: Coins,
  'map-pin': MapPin,
  note: NotePencil,
  warning: WarningCircle,
  envelope: Envelope,
  phone: Phone,
  google: GoogleLogo,
  facebook: FacebookLogo,
  apple: AppleLogo,
  swap: ArrowsLeftRight,
  funnel: Funnel,
  lock: Lock,
  plus: Plus,
};

const TONE_COLORS: Record<AppIconTone, string> = {
  active: tokens.colors.icon.dark,
  inactive: tokens.colors.icon.secondary,
  brand: tokens.colors.icon.brand,
  white: tokens.colors.icon.white,
  muted: tokens.colors.icon.muted,
  danger: tokens.colors.danger,
  accent: tokens.colors.accent,
  success: tokens.colors.success,
  warning: tokens.colors.warning,
};

export interface AppIconProps {
  name: AppIconName;
  size?: number;
  tone?: AppIconTone;
  color?: string;
  weight?: IconProps['weight'];
  className?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 22,
  tone = 'inactive',
  color,
  weight = 'regular',
  className,
}) => {
  if (name === 'house-plus') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M12 20H3V10L12 2L20 9M19 13V21M15 17H23"
          stroke={color ?? TONE_COLORS[tone]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return (
    <Icon
      size={size}
      color={color ?? TONE_COLORS[tone]}
      weight={weight}
      className={className}
      aria-hidden
    />
  );
};
