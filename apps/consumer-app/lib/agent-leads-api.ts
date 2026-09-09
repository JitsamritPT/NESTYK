import type { AgentLead, AgentLeadsPage, CreateLeadInput } from '@nestyk/types';
import { apiGet, apiPost } from './api';
import { ensureAgentSession } from './agent-session';
export async function listAgentLeads(q: string, page: number): Promise<AgentLeadsPage> {
  await ensureAgentSession();
  return apiGet(`/agent/leads?${new URLSearchParams({ q, page: String(page), limit: '20' })}`);
}
export async function createAgentLead(body: CreateLeadInput): Promise<AgentLead> {
  await ensureAgentSession(); return apiPost('/agent/leads', body);
}
export async function fetchAgentVisaTypes(): Promise<Array<{ id: number; code: string }>> {
  await ensureAgentSession(); return apiGet('/agent/leads/visa-types');
}
