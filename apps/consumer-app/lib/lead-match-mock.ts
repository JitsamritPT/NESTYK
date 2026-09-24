import type { AgentLead } from '@nestyk/types';

export type LeadMatchSummary = {
  /** 0–100 best-room match score. */
  score: number;
  /** Rooms passing the hard filter set. */
  roomCount: number;
};

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Placeholder until the matching API exists (docs/new-project/agent/leads/matching.md).
 * Stable per lead id; `null` when the hard set (budget_max + province) is incomplete.
 */
export function mockLeadMatch(lead: AgentLead): LeadMatchSummary | null {
  if (!lead.budgetMax || !lead.province) return null;
  const h = hashId(String(lead.id));
  return {
    score: 20 + (h % 79),
    roomCount: (h >>> 8) % 13,
  };
}
