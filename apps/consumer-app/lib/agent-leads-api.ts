import type { AgentLead, AgentLeadsPage, CreateLeadInput, LeadFilters, LeadLocationCatalog } from '@nestyk/types';
import { apiGet, apiPost } from './api';
import { ensureAgentSession } from './agent-session';

export async function listAgentLeads(q: string, page: number, filters: LeadFilters = {}): Promise<AgentLeadsPage> {
  await ensureAgentSession();
  const params = new URLSearchParams({ q, page: String(page), limit: '20' });
  if (filters.province) params.set('province', filters.province);
  if (filters.locations?.length) params.set('locations', JSON.stringify(filters.locations));
  if (filters.includeUnspecified) params.set('includeUnspecified', 'true');
  return apiGet(`/agent/leads?${params}`);
}

export async function getAgentLead(id: number): Promise<AgentLead> {
  await ensureAgentSession();
  return apiGet(`/agent/leads/${id}`);
}

export async function createAgentLead(body: CreateLeadInput): Promise<AgentLead> {
  await ensureAgentSession();
  return apiPost('/agent/leads', body);
}

export async function fetchAgentVisaTypes(): Promise<Array<{ id: number; code: string }>> {
  await ensureAgentSession();
  return apiGet('/agent/leads/visa-types');
}

export async function fetchLeadLocations(): Promise<LeadLocationCatalog> {
  await ensureAgentSession();
  return apiGet('/agent/leads/locations');
}
