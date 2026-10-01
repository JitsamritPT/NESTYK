import type { AgentLead, LeadPin } from '@nestyk/types';
import { fetchMyAgentListings, type AgentListingCard } from './agent-listings-api';
import { compareLeadRoom, overallScore, type LeadRoomComparison } from './lead-room-compare';

/**
 * Client-side preview of docs/new-project/agent/leads/matching.md §5.1 until
 * `GET /agent/leads/:id/matches` exists.
 */

export const PIN_RANK_WEIGHTS: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.7 };

export type LeadRoomMatch = {
  room: AgentListingCard;
  /** 0–100 average of the matching-tab criteria (see lead-room-compare). */
  score: number;
  /** 0–100 weighted distance score of the best pin (`distanceScore` × `pinWeight`). */
  locationScore: number;
  distanceScore: number;
  pinWeight: number;
  /** Monthly rent compared with the budget. */
  price: number;
  termMonths: number | null;
  pin: LeadPin;
  distanceKm: number;
  withinRadius: boolean;
  comparison: LeadRoomComparison;
};

export type LeadMatchSummary = { score: number | null; roomCount: number };

export function leadMatchReady(lead: AgentLead): boolean {
  return !!lead.budgetMax && lead.budgetMax > 0 && lead.pins.length > 0 && lead.radiusKm != null;
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Price for the lead's lease term when the room offers it, otherwise the cheapest price
 * (a missing term is scored by the lease criterion, not filtered out).
 */
function comparablePrice(room: AgentListingCard, lead: AgentLead) {
  const prices = room.prices.filter((p) => Number.isFinite(p.price) && p.price > 0);
  const forTerm =
    lead.leaseDurationMonths != null ? prices.filter((p) => p.termMonths === lead.leaseDurationMonths) : [];
  const best = (forTerm.length ? forTerm : prices).sort((a, b) => a.price - b.price)[0];
  return best ? { price: best.price, termMonths: best.termMonths ?? null } : null;
}

export function matchLeadRooms(lead: AgentLead, rooms: AgentListingCard[]): LeadRoomMatch[] {
  if (!leadMatchReady(lead)) return [];
  const radius = lead.radiusKm!;
  const budget = lead.budgetMax!;
  const matches: LeadRoomMatch[] = [];
  for (const room of rooms) {
    if (room.latitude == null || room.longitude == null) continue;
    const priced = comparablePrice(room, lead);
    if (!priced || priced.price > budget) continue;
    let best: {
      locationScore: number;
      distanceScore: number;
      pinWeight: number;
      pin: LeadPin;
      distanceKm: number;
      withinRadius: boolean;
    } | null = null;
    for (const pin of lead.pins) {
      const d = distanceKm(pin.latitude, pin.longitude, room.latitude, room.longitude);
      if (d > radius * 2) continue;
      const distanceScore = d <= radius ? 100 : 100 * (1 - (d - radius) / radius);
      const pinWeight = PIN_RANK_WEIGHTS[pin.rank] ?? 0.7;
      const locationScore = distanceScore * pinWeight;
      if (!best || locationScore > best.locationScore) {
        best = { locationScore, distanceScore, pinWeight, pin, distanceKm: d, withinRadius: d <= radius };
      }
    }
    if (best) {
      const located = {
        ...priced,
        ...best,
        locationScore: Math.round(best.locationScore),
        distanceScore: Math.round(best.distanceScore),
      };
      const comparison = compareLeadRoom(lead, located, room);
      matches.push({ room, ...located, comparison, score: overallScore(comparison) });
    }
  }
  return matches.sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
}

export function summarizeLeadMatch(lead: AgentLead, rooms: AgentListingCard[] | null): LeadMatchSummary | null {
  if (!leadMatchReady(lead) || !rooms) return null;
  const matches = matchLeadRooms(lead, rooms);
  return { score: matches[0]?.score ?? null, roomCount: matches.length };
}

const POOL_TTL_MS = 60_000;
const POOL_MAX_PAGES = 4;
let pool: { at: number; promise: Promise<AgentListingCard[]> } | null = null;

/** Available rooms of the current agent (up to 200), cached briefly and shared by list + detail. */
export function loadMatchRoomPool(force = false): Promise<AgentListingCard[]> {
  if (!force && pool && Date.now() - pool.at < POOL_TTL_MS) return pool.promise;
  const promise = (async () => {
    const rooms: AgentListingCard[] = [];
    for (let page = 1; page <= POOL_MAX_PAGES; page += 1) {
      const res = await fetchMyAgentListings({ page, limit: 50, roomStatus: 'available', sort: 'price_asc' });
      rooms.push(...res.items);
      if (rooms.length >= res.total || !res.items.length) break;
    }
    return rooms;
  })();
  pool = { at: Date.now(), promise };
  promise.catch(() => {
    if (pool?.promise === promise) pool = null;
  });
  return promise;
}
