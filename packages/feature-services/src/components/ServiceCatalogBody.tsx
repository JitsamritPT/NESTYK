'use client';

import React from 'react';
import { UserRole, ServiceCategory } from '@nestyk/types';
import { AppButton, AppBadge, tokens } from '@nestyk/ui';
import { servicesMatrix } from '../matrix';

export interface ServiceCatalogBodyProps {
  currentRole: UserRole;
  onRequestService?: (category: ServiceCategory) => void;
}

/**
 * Pure Body Component for Service Catalog (Shared across Mobile Shell & Web Shell)
 */
export const ServiceCatalogBody: React.FC<ServiceCatalogBodyProps> = ({
  currentRole,
  onRequestService,
}) => {
  const availableServices = servicesMatrix.filter((s) => s.allowedRoles.includes(currentRole));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '720px', margin: '0 auto', fontFamily: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 500, margin: 0, color: tokens.colors.textHeading, fontFamily: 'var(--font-mitr), "Mitr", sans-serif', lineHeight: 1.45 }}>
            ศูนย์บริการส่วนกลาง (Services Hub)
          </h2>
          <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, margin: '4px 0 0 0', lineHeight: 1.5, fontWeight: 400 }}>
            บริการ On-Demand สำหรับผู้ใช้ในบทบาทของคุณ
          </p>
        </div>
        <AppBadge role="services" label="NESTYK Services" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {availableServices.map((service) => (
          <div
            key={service.category}
            style={{
              padding: '16px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: `1px solid ${tokens.colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 6px 0', color: tokens.colors.textHeading, fontFamily: 'var(--font-mitr), "Mitr", sans-serif', lineHeight: 1.45 }}>
                {service.titleTh}
              </h3>
              <p style={{ fontSize: '13px', color: tokens.colors.textSecondary, margin: 0, lineHeight: 1.5, fontWeight: 400 }}>
                {service.descriptionTh}
              </p>
            </div>

            <AppButton
              variant="outline"
              onClick={() => onRequestService?.(service.category)}
            >
              เรียกใช้บริการ
            </AppButton>
          </div>
        ))}
      </div>
    </div>
  );
};
