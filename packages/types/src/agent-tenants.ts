import type { AgentContract } from "./agent-contracts";
export interface AgentTenant {
  id: number;
  leadId: number;
  name: string;
  phone: string;
  email: string | null;
  note: string | null;
  createdAt: string;
  property: string;
  room: string | null;
  contracts: AgentContract[];
}
export interface TenantLeadOption {
  id: number;
  name: string;
  phone: string;
  email: string | null;
}
export interface TenantRoomOption {
  id: number;
  property: string;
  room: string | null;
}
export interface CreateAgentTenant {
  leadId: number;
  rentRoomId: number;
  name: string;
  phone: string;
  email?: string;
  note?: string;
}
