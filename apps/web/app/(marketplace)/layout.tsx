import React from 'react';
import { WebPageLayout } from '@nestyk/ui';
import { MOCK_NAV_LINKS, MOCK_USER } from '../../lib/mock-data';

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WebPageLayout
      role="guest"
      navLinks={[...MOCK_NAV_LINKS]}
      userProfile={{ name: MOCK_USER.name }}
    >
      {children}
    </WebPageLayout>
  );
}
