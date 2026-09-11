import type { AgentDashboardSnapshot } from './types';
import { addMinutesIso } from './types';

/** Deterministic Phase-1 preview fixture — never treat as live production data. */
export function createAgentDashboardDemoFixture(input: {
  greetingName: string;
  localDateLabel: string;
  now?: Date;
}): AgentDashboardSnapshot {
  const now = input.now ?? new Date();
  // Next slot at least 30 minutes ahead, snapped to :00/:30 — never overflows past midnight awkwardly.
  const next = new Date(now.getTime());
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() < 30 ? 30 : 60);
  if (next.getTime() <= now.getTime() + 15 * 60_000) {
    next.setTime(next.getTime() + 30 * 60_000);
  }

  const apt1 = addMinutesIso(next, 0);
  const apt2 = addMinutesIso(next, 3 * 60);
  const apt3 = addMinutesIso(next, 5 * 60 + 30);

  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return {
    isDemoPreview: true,
    greetingName: input.greetingName,
    localDateLabel: input.localDateLabel,
    business: {
      status: 'demo',
      availableListings: 20,
      totalListings: 32,
      openLeads: 18,
      currentClients: 17,
      tenantsCount: 12,
      commissionPending: 45000,
      currency: 'THB',
    },
    actionRequired: {
      status: 'demo',
      items: [
        {
          id: 'pay-overdue',
          kind: 'overdue_payment',
          count: 3,
          amount: 36000,
          deepLink: { type: 'tab', tab: 'clients', filter: { kind: 'work', work: 'overdue_payment' } },
        },
        {
          id: 'lead-fu',
          kind: 'lead_follow_up',
          count: 2,
          deepLink: { type: 'tab', tab: 'listingLead', filter: { kind: 'work', work: 'lead_follow_up' } },
        },
        {
          id: 'sign',
          kind: 'awaiting_signature',
          count: 1,
          deepLink: { type: 'tab', tab: 'clients', filter: { kind: 'work', work: 'awaiting_signature' } },
        },
        {
          id: 'renew',
          kind: 'renewal',
          count: 1,
          deepLink: { type: 'tab', tab: 'clients', filter: { kind: 'work', work: 'renewal' } },
        },
      ],
    },
    schedule: {
      status: 'demo',
      items: [
        {
          id: 'apt-1',
          startsAt: apt1,
          title: 'Life Asoke',
          contactName: 'Emily Chen',
          kind: 'viewing',
          status: 'confirmed',
        },
        {
          id: 'apt-2',
          startsAt: apt2,
          title: 'Noble Around Ari',
          contactName: 'David Cho',
          kind: 'viewing',
          status: 'pending',
        },
        {
          id: 'apt-3',
          startsAt: apt3,
          title: 'The Line Asoke',
          contactName: 'Ananya Wong',
          kind: 'follow_up',
          status: 'confirmed',
        },
      ],
    },
    inventory: {
      status: 'demo',
      available: 20,
      unavailable: 12,
      published: 24,
      private: 8,
      preview: [
        {
          id: 'demo-1',
          title: 'Life Asoke',
          beds: 1,
          area: 'Asoke',
          price: 24000,
          availability: 'available',
          visibility: 'published',
        },
        {
          id: 'demo-2',
          title: 'Noble Around Ari',
          beds: 1,
          area: 'Ari',
          price: 26000,
          availability: 'available',
          visibility: 'private',
        },
      ],
    },
    clients: {
      status: 'demo',
      draft: 4,
      signing: 1,
      tenants: 12,
      renewal: {
        id: 'renew-1',
        title: 'Life Asoke · Unit 1804',
        endsAt: `${year}-${String(month).padStart(2, '0')}-30`,
        daysLeft: 19,
      },
    },
    rent: {
      status: 'demo',
      periodYear: year,
      periodMonth: month,
      totalDue: 288000,
      received: 252000,
      overdue: 36000,
      currency: 'THB',
    },
    commission: {
      status: 'demo',
      periodYear: year,
      periodMonth: month,
      total: 117000,
      received: 72000,
      pending: 45000,
      currency: 'THB',
    },
    activity: {
      status: 'demo',
      items: [
        {
          id: 'act-1',
          kind: 'lead_added',
          subject: 'Emily Chen',
          at: addMinutesIso(now, -5 * 60),
          deepLink: { type: 'tab', tab: 'listingLead' },
        },
        {
          id: 'act-2',
          kind: 'contract_sent',
          subject: 'Life Asoke',
          at: addMinutesIso(now, -3 * 60),
          deepLink: { type: 'tab', tab: 'clients' },
        },
        {
          id: 'act-3',
          kind: 'payment_recorded',
          subject: 'Unit 1205',
          at: addMinutesIso(now, -60),
          deepLink: { type: 'tab', tab: 'clients', filter: { kind: 'work', work: 'overdue_payment' } },
        },
      ],
    },
  };
}
