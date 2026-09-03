import React from 'react';
import { Mitr, Baloo_2, Noto_Sans_Thai } from 'next/font/google';
import { WebPageLayout } from '@nestyk/ui';

const mitr = Mitr({
  subsets: ['thai', 'latin'],
  weight: ['400', '500'],
  variable: '--font-mitr',
  display: 'swap',
});

const baloo2 = Baloo_2({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-baloo2',
  display: 'swap',
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-noto-sans-thai',
  display: 'swap',
});

export const metadata = {
  title: 'NESTYK Admin & Operations Portal — ศูนย์ควบคุมงานปฏิบัติการ',
  description: 'พอร์ทัลสำหรับทีม Assistant และ Admin จัดการคำขอบริการ สัญญา บิล และตรวจห้อง',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${mitr.variable} ${baloo2.variable} ${notoSansThai.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --font-mitr: ${mitr.style.fontFamily};
            --font-baloo2: ${baloo2.style.fontFamily};
            --font-noto-sans-thai: ${notoSansThai.style.fontFamily};
          }
          * {
            box-sizing: border-box;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          body, button, input, select, textarea {
            font-family: var(--font-noto-sans-thai), "Noto Sans Thai", -apple-system, BlinkMacSystemFont, sans-serif;
            font-weight: 400;
            line-height: 1.5;
          }
          h1, h2, h3, h4, h5, h6 {
            font-family: var(--font-mitr), "Mitr", sans-serif;
            font-weight: 500;
            line-height: 1.45;
          }
        `}} />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#F8FAFC' }}>
        <WebPageLayout
          role="admin"
          navLinks={[
            { label: 'แดชบอร์ดภาพรวม', href: '/', active: true },
            { label: 'ศูนย์รับเรื่อง Tickets', href: '/tickets' },
            { label: 'สัญญาและบิล', href: '/contracts' },
            { label: 'ตรวจรับสภาพห้อง', href: '/inspections' },
          ]}
          userProfile={{ name: 'Admin Operations Hub' }}
        >
          {children}
        </WebPageLayout>
      </body>
    </html>
  );
}
