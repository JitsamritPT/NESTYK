import type { AgentLead } from '@nestyk/types';

/**
 * Lead vs room on the criteria of the lead form's "จับคู่ห้อง" tab (matching.md §5.1).
 * Every field added to that tab must get a row here and join the average.
 */

export type CompareStatus =
  | 'pass'
  | 'near'
  | 'mismatch'
  | 'later'
  /** The lead did not fill this in. */
  | 'unspecified'
  /** The room has no data for this. */
  | 'unknown'
  /** The lead's value cannot be compared (free-text move-in). */
  | 'notEvaluable';

type Row<S extends CompareStatus, T> = T & {
  status: S;
  /** 0–100, or null when excluded from the average. */
  score: number | null;
};

export type LeadRoomComparison = {
  budget: Row<'pass', { price: number }>;
  location: Row<'pass' | 'near', { distanceKm: number; overKm: number; pinName: string; pinRank: number }>;
  roomType: Row<CompareStatus, { want: string | null; have: string | null }>;
  lease: Row<CompareStatus, { want: number | null; terms: number[] }>;
  moveIn: Row<CompareStatus, { want: string | null; availableFrom: string | null; daysLate: number }>;
};

export type CompareKey = keyof LeadRoomComparison;

export const COMPARE_KEYS: CompareKey[] = ['budget', 'location', 'roomType', 'lease', 'moveIn'];

/** Where the room sits relative to the lead's pins (from the matching step). */
export type LocatedRoom = {
  price: number;
  locationScore: number;
  distanceKm: number;
  withinRadius: boolean;
  pin: { name: string; rank: number };
};

export type RoomFacts = {
  roomTypeCode?: string | null;
  availableFromDate?: string | null;
  prices: Array<{ termMonths?: number | null }>;
};

export const MOVE_IN_GRACE_DAYS = 30;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const DAY_MS = 86_400_000;

export function roomLayoutValue(room: { layout: Array<{ code: string; value: string }> } | null, code: string): string | null {
  return room?.layout.find((item) => item.code === code)?.value?.trim() || null;
}

function isoDay(value: string): number {
  return Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
}

export function compareLeadRoom(lead: AgentLead, located: LocatedRoom, room: RoomFacts): LeadRoomComparison {
  const roomTypeWant = lead.desiredRoomTypeCode ?? null;
  const roomTypeHave = room.roomTypeCode ?? null;
  const roomTypeStatus: CompareStatus = !roomTypeWant
    ? 'unspecified'
    : !roomTypeHave
      ? 'unknown'
      : roomTypeWant === roomTypeHave
        ? 'pass'
        : 'mismatch';

  const terms = [
    ...new Set(room.prices.map((p) => p.termMonths).filter((m): m is number => m != null && m > 0)),
  ].sort((a, b) => a - b);
  const leaseWant = lead.leaseDurationMonths ?? null;
  const leaseStatus: CompareStatus =
    leaseWant == null ? 'unspecified' : !terms.length ? 'unknown' : terms.includes(leaseWant) ? 'pass' : 'mismatch';

  const moveInWant = lead.moveInPlan?.trim() || null;
  const availableFrom = room.availableFromDate ? room.availableFromDate.slice(0, 10) : null;
  let moveInStatus: CompareStatus;
  let daysLate = 0;
  if (!moveInWant) moveInStatus = 'unspecified';
  else if (!ISO_DATE.test(moveInWant)) moveInStatus = 'notEvaluable';
  else if (!availableFrom || !ISO_DATE.test(availableFrom)) moveInStatus = 'unknown';
  else {
    daysLate = Math.max(0, Math.round((isoDay(availableFrom) - isoDay(moveInWant)) / DAY_MS));
    moveInStatus = daysLate === 0 ? 'pass' : 'later';
  }

  const binary = (status: CompareStatus) => (status === 'pass' ? 100 : status === 'mismatch' ? 0 : null);
  const radius = lead.radiusKm ?? 0;

  return {
    budget: { status: 'pass', score: 100, price: located.price },
    location: {
      status: located.withinRadius ? 'pass' : 'near',
      score: located.locationScore,
      distanceKm: located.distanceKm,
      overKm: Math.max(0, located.distanceKm - radius),
      pinName: located.pin.name,
      pinRank: located.pin.rank,
    },
    roomType: { status: roomTypeStatus, score: binary(roomTypeStatus), want: roomTypeWant, have: roomTypeHave },
    lease: { status: leaseStatus, score: binary(leaseStatus), want: leaseWant, terms },
    moveIn: {
      status: moveInStatus,
      score:
        moveInStatus === 'pass' || moveInStatus === 'later'
          ? Math.max(0, 100 * (1 - daysLate / MOVE_IN_GRACE_DAYS))
          : null,
      want: moveInWant,
      availableFrom,
      daysLate,
    },
  };
}

/** Equal-weight average of the criteria that could be judged. */
export function overallScore(comparison: LeadRoomComparison): number {
  const scores = COMPARE_KEYS.map((key) => comparison[key].score).filter((s): s is number => s != null);
  return scores.length ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : 0;
}

export type ComparisonSummary = {
  passed: number;
  /** Judged criteria that did not fully pass, in display order. */
  issues: CompareKey[];
  /** Filled in by the lead but not comparable yet. */
  unknown: CompareKey[];
};

export function summarizeComparison(comparison: LeadRoomComparison): ComparisonSummary {
  const summary: ComparisonSummary = { passed: 0, issues: [], unknown: [] };
  for (const key of COMPARE_KEYS) {
    const status = comparison[key].status;
    if (status === 'pass') summary.passed += 1;
    else if (status === 'near' || status === 'mismatch' || status === 'later') summary.issues.push(key);
    else if (status === 'unknown' || status === 'notEvaluable') summary.unknown.push(key);
  }
  return summary;
}
