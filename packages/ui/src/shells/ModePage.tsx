import React from 'react';
import { UserRole } from '@nestyk/types';
import { NestykLogo } from '../components/NestykLogo';
import { tokens } from '../theme/tokens';

export interface ModePageProps {
  role: UserRole | 'services';
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  bottomBar?: React.ReactNode;
}

/**
 * Universal Mobile Shell (ModePage)
 * โครง Header, Navigation, Bottom Bar คงที่ 100% ป้องกัน Shell Flicker
 */
export const ModePage: React.FC<ModePageProps> = ({
  role,
  title,
  subtitle,
  headerRight,
  children,
  bottomBar,
}) => {
  const roleColor = tokens.colors.roles[role] || tokens.colors.brand[500];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: tokens.colors.background,
        maxWidth: '480px',
        margin: '0 auto',
        position: 'relative',
        boxShadow: '0 0 20px rgba(0,0,0,0.05)',
      }}
    >
      {/* Persistent Mode Hero Header */}
      <header
        style={{
          padding: '16px 20px',
          backgroundColor: roleColor,
          color: role === 'guest' ? tokens.colors.primary : '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div>
          {title ? (
            <h1 style={{ fontSize: '18px', margin: 0, fontWeight: 700, fontFamily: tokens.typography.fonts.headingTh }}>
              {title}
            </h1>
          ) : (
            <NestykLogo
              variant={role === 'guest' ? 'wordmark' : 'mark'}
              height={role === 'guest' ? 24 : 32}
            />
          )}
          {subtitle && (
            <p style={{ fontSize: '12px', margin: '2px 0 0 0', opacity: 0.9 }}>
              {subtitle}
            </p>
          )}
        </div>
        {headerRight && <div>{headerRight}</div>}
      </header>

      {/* Swappable Pure Body Slot */}
      <main
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
        }}
      >
        {children}
      </main>

      {/* Persistent Bottom Tab Bar */}
      {bottomBar && (
        <nav
          style={{
            position: 'sticky',
            bottom: 0,
            backgroundColor: '#FFFFFF',
            borderTop: `1px solid ${tokens.colors.border}`,
            padding: '10px 16px',
            zIndex: 50,
          }}
        >
          {bottomBar}
        </nav>
      )}
    </div>
  );
};
