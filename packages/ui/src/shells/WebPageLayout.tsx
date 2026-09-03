import React from 'react';
import { UserRole } from '@nestyk/types';
import { tokens } from '../theme/tokens';

export interface WebPageLayoutProps {
  role?: UserRole | 'services';
  navLinks?: Array<{ label: string; href: string; active?: boolean }>;
  userProfile?: { name: string; avatarUrl?: string };
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Universal Web Shell (WebPageLayout)
 * โครง Header, Brand Nav, Footer คงที่ 100% สลับเฉพาะ Body Slot
 * ใช้ฟอนต์หลักตาม CI Brand System ด้วยน้ำหนักที่ดูโปร่ง โมเดิร์น
 */
export const WebPageLayout: React.FC<WebPageLayoutProps> = ({
  role = 'guest',
  navLinks = [],
  userProfile,
  sidebar,
  children,
  footer,
}) => {
  const roleColor = tokens.colors.roles[role] || tokens.colors.brand[500];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: tokens.colors.background,
        color: tokens.colors.primary,
        fontFamily: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif',
        lineHeight: 1.5,
      }}
    >
      {/* Persistent Common Web Header */}
      <header
        style={{
          height: '64px',
          backgroundColor: '#FFFFFF',
          borderBottom: `1px solid ${tokens.colors.border}`,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: roleColor,
              }}
            />
            <span
              style={{
                fontSize: '20px',
                fontWeight: 600,
                fontFamily: 'var(--font-baloo2), "Baloo 2", cursive, sans-serif',
                color: tokens.colors.primary,
                letterSpacing: '0.3px',
              }}
            >
              NESTYK
            </span>
          </div>

          <nav style={{ display: 'flex', gap: '16px' }}>
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  fontSize: '14px',
                  fontFamily: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif',
                  fontWeight: link.active ? 500 : 400,
                  color: link.active ? tokens.colors.primary : tokens.colors.textSecondary,
                  textDecoration: 'none',
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {userProfile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif' }}>
              {userProfile.name}
            </span>
          </div>
        )}
      </header>

      {/* Main Container with Sidebar + Swappable Body Slot */}
      <div style={{ display: 'flex', flex: 1 }}>
        {sidebar && (
          <aside
            style={{
              width: '240px',
              backgroundColor: '#FFFFFF',
              borderRight: `1px solid ${tokens.colors.border}`,
              padding: '20px 16px',
            }}
          >
            {sidebar}
          </aside>
        )}

        <main style={{ flex: 1, padding: '24px' }}>{children}</main>
      </div>

      {/* Common Web Footer */}
      {footer ? (
        footer
      ) : (
        <footer
          style={{
            padding: '24px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 400,
            color: tokens.colors.textSecondary,
            borderTop: `1px solid ${tokens.colors.border}`,
            backgroundColor: '#FFFFFF',
            fontFamily: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif',
          }}
        >
          © {new Date().getFullYear()} NESTYK Ecosystem. All rights reserved.
        </footer>
      )}
    </div>
  );
};
