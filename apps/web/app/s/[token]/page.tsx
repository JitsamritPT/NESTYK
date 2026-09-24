'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

type ShareSections = {
  photos: boolean;
  price: boolean;
  facilities: boolean;
  location: boolean;
  contact: boolean;
};

type PublicRoom = {
  id: number;
  promoTitle: string | null;
  description: string | null;
  roomStatusCode: string | null;
  roomTypeCode: string | null;
  availableFromDate: string | null;
  layout: { code: string; value: string }[];
  medias: { id: number; mediaUrl: string; mediaType: string; isCover: boolean }[];
  prices: {
    contractTypeCode: string;
    termMonths: number | null;
    price: number;
  }[];
  facilityItems: { code: string; groupCode?: string }[];
  nearbyPlaces: { name: string; type?: string; distanceMeters?: number }[];
  property: {
    name: string;
    district: string | null;
    province: string | null;
  } | null;
  contacts: { name: string; phone: string }[];
  expiresAt: string;
  shareSections: ShareSections;
};

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://localhost:4000/api/v1';

function money(n: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function PublicRoomSharePage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API}/public/room-shares/${encodeURIComponent(token)}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof body?.message === 'string'
              ? body.message
              : res.status === 410
                ? 'ลิงก์นี้หมดอายุหรือถูกปิดแล้ว'
                : 'ไม่พบลิงก์แชร์',
          );
        }
        if (!cancelled) setRoom(body as PublicRoom);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'เปิดลิงก์ไม่สำเร็จ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const cover = useMemo(
    () => room?.medias?.find((m) => m.isCover) ?? room?.medias?.[0] ?? null,
    [room],
  );
  const lowest = useMemo(() => {
    if (!room?.prices?.length) return null;
    return [...room.prices].sort((a, b) => a.price - b.price)[0] ?? null;
  }, [room]);

  if (loading) {
    return (
      <main style={styles.shell}>
        <p style={styles.muted}>กำลังโหลด…</p>
      </main>
    );
  }

  if (error || !room) {
    return (
      <main style={styles.shell}>
        <h1 style={styles.title}>ลิงก์ใช้ไม่ได้</h1>
        <p style={styles.muted}>{error || 'ไม่พบลิงก์แชร์'}</p>
      </main>
    );
  }

  const location = [room.property?.district, room.property?.province]
    .filter(Boolean)
    .join(', ');

  return (
    <main style={styles.shell}>
      <meta name="robots" content="noindex, nofollow" />
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.mediaUrl} alt="" style={styles.hero} />
      ) : null}
      <div style={styles.card}>
        <h1 style={styles.title}>
          {room.promoTitle?.trim() || room.property?.name || `ห้อง #${room.id}`}
        </h1>
        {location ? <p style={styles.muted}>{location}</p> : null}
        {lowest ? (
          <p style={styles.price}>
            {money(lowest.price)}
            {lowest.termMonths != null ? ` · สัญญา ${lowest.termMonths} เดือน` : ''}
          </p>
        ) : null}
        {room.description ? <p style={styles.body}>{room.description}</p> : null}
        {room.facilityItems?.length ? (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>สิ่งอำนวยความสะดวก</h2>
            <ul style={styles.list}>
              {room.facilityItems.slice(0, 24).map((f) => (
                <li key={`${f.groupCode}-${f.code}`}>{f.code}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {room.nearbyPlaces?.length ? (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>สถานที่ใกล้เคียง</h2>
            <ul style={styles.list}>
              {room.nearbyPlaces.slice(0, 16).map((p, i) => (
                <li key={`${p.name}-${i}`}>
                  {p.name}
                  {p.distanceMeters != null ? ` · ${p.distanceMeters} m` : ''}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {room.contacts?.[0] ? (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>ติดต่อ</h2>
            <p style={styles.body}>
              {room.contacts[0].name}
              {room.contacts[0].phone ? ` · ${room.contacts[0].phone}` : ''}
            </p>
          </section>
        ) : null}
        <p style={styles.footnote}>
          ลิงก์หมดอายุ{' '}
          {new Date(room.expiresAt).toLocaleString('th-TH', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    background: '#F8FAFC',
    padding: '16px',
    maxWidth: 560,
    margin: '0 auto',
    fontFamily: 'Noto Sans Thai, system-ui, sans-serif',
  },
  hero: {
    width: '100%',
    aspectRatio: '4 / 3',
    objectFit: 'cover',
    borderRadius: 16,
    background: '#E2E8F0',
  },
  card: {
    marginTop: 16,
    background: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid #E5E7EB',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.35,
    color: '#211E1E',
  },
  price: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#211E1E',
  },
  body: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.5,
    color: '#334155',
    whiteSpace: 'pre-wrap',
  },
  muted: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.45,
    color: '#64748B',
  },
  section: { marginTop: 8 },
  sectionTitle: {
    margin: '0 0 6px',
    fontSize: 15,
    fontWeight: 700,
    color: '#334155',
  },
  list: {
    margin: 0,
    paddingLeft: 18,
    color: '#334155',
    fontSize: 14,
    lineHeight: 1.5,
  },
  footnote: {
    margin: '8px 0 0',
    fontSize: 12,
    lineHeight: 1.45,
    color: '#94A3B8',
  },
};
