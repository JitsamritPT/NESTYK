import { useLocale } from '@nestyk/i18n';
import { formatKm } from '../lib/lead-format';
import type { CompareKey, LeadRoomComparison } from '../lib/lead-room-compare';

/** Shared wording for match issues on the room card (C1) and the comparison page (C3). */
export function useMatchCopy() {
  const { t, locale } = useLocale();
  const m = t.agent.leads.matchRoom;

  const roomTypeName = (code: string | null) =>
    code ? t.masters.roomTypes[code as keyof typeof t.masters.roomTypes] || code : null;
  const months = (value: number | string) => t.agent.createRoom.contractMonths.replace('{months}', String(value));

  /** One-line reason, e.g. "ต้องการ 3 ห้องนอน · ห้องนี้ สตูดิโอ". */
  const reason = (key: CompareKey, c: LeadRoomComparison): string => {
    switch (key) {
      case 'location':
        return m.reasonLocation.replace('{km}', formatKm(c.location.overKm));
      case 'roomType':
        return m.reasonRoomType
          .replace('{want}', roomTypeName(c.roomType.want) ?? '—')
          .replace('{have}', roomTypeName(c.roomType.have) ?? '—');
      case 'lease':
        return m.reasonLease
          .replace('{want}', c.lease.want != null ? months(c.lease.want) : '—')
          .replace('{have}', months(c.lease.terms.join(', ')));
      case 'moveIn':
        return m.reasonMoveIn.replace('{days}', String(c.moveIn.daysLate));
      default:
        return '';
    }
  };

  /** Short chip label for the verdict row. */
  const issueLabel = (key: CompareKey, c: LeadRoomComparison): string => {
    switch (key) {
      case 'location':
        return m.issueLocation.replace('{km}', formatKm(c.location.overKm));
      case 'roomType':
        return m.issueRoomType;
      case 'lease':
        return m.issueLease;
      case 'moveIn':
        return m.issueMoveIn.replace('{days}', String(c.moveIn.daysLate));
      default:
        return '';
    }
  };

  return { t, locale, m, roomTypeName, months, reason, issueLabel };
}
