import React from 'react';
import { UserRole } from '@nestyk/types';
import { tokens } from '../theme/tokens';

export interface AppBadgeProps {
  role?: UserRole | 'services';
  label?: string;
  variant?: 'solid' | 'subtle';
  children?: React.ReactNode;
}

export const AppBadge: React.FC<AppBadgeProps> = ({
  role = 'guest',
  label,
  variant = 'subtle',
  children,
}) => {
  const roleColor = tokens.colors.roles[role] || tokens.colors.brand[500];

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 9px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'var(--font-mitr), "Mitr", sans-serif',
    backgroundColor: variant === 'solid' ? roleColor : `${roleColor}18`,
    color: variant === 'solid' ? (role === 'guest' ? tokens.colors.primary : '#FFFFFF') : roleColor,
  };

  return <span style={style}>{label || children}</span>;
};
