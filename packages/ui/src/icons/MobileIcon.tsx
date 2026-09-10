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
  Siren,
  Package,
  Handshake,
  Shield,
  User,
  CreditCard,
  Gear,
  Globe,
  CheckCircle,
  CalendarPlus,
  QrCode,
  Buildings,
  Bed,
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
  IconProps,
} from 'phosphor-react-native';
import { tokens } from '../theme/tokens';
import { AppIconName, AppIconTone } from './types';

const ICON_MAP: Record<AppIconName, React.ComponentType<IconProps>> = {
  search: MagnifyingGlass,
  home: House,
  key: Key,
  grid: SquaresFour,
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
  siren: Siren,
  package: Package,
  handshake: Handshake,
  shield: Shield,
  user: User,
  'credit-card': CreditCard,
  gear: Gear,
  globe: Globe,
  check: CheckCircle,
  'calendar-plus': CalendarPlus,
  'qr-code': QrCode,
  buildings: Buildings,
  bed: Bed,
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

export interface MobileIconProps {
  name: AppIconName;
  size?: number;
  tone?: AppIconTone;
  color?: string;
  weight?: IconProps['weight'];
}

export const MobileIcon: React.FC<MobileIconProps> = ({
  name,
  size = 22,
  tone = 'inactive',
  color,
  weight = 'regular',
}) => {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} color={color ?? TONE_COLORS[tone]} weight={weight} />;
};
