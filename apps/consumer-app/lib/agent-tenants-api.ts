import type {
  AgentTenant,
  CreateAgentTenant,
  TenantLeadOption,
  TenantRoomOption,
} from "@nestyk/types";
import { apiGet, apiPost } from "./api";
import { ensureAgentSession } from "./agent-session";
export async function listAgentTenants(): Promise<AgentTenant[]> {
  await ensureAgentSession();
  return apiGet("/agent/tenants");
}
export async function getAgentTenant(id: number): Promise<AgentTenant> {
  await ensureAgentSession();
  return apiGet(`/agent/tenants/${id}`);
}
export async function tenantLeadOptions(
  q: string,
): Promise<TenantLeadOption[]> {
  await ensureAgentSession();
  return apiGet(`/agent/tenants/leads?q=${encodeURIComponent(q)}`);
}
export async function tenantRoomOptions(
  q: string,
): Promise<TenantRoomOption[]> {
  await ensureAgentSession();
  return apiGet(`/agent/tenants/rooms?q=${encodeURIComponent(q)}`);
}
export async function createAgentTenant(
  body: CreateAgentTenant,
): Promise<AgentTenant> {
  await ensureAgentSession();
  return apiPost("/agent/tenants", body);
}
