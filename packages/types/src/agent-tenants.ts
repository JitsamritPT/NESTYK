import type { AgentContract } from "./agent-contracts";
export interface AgentTenant {
  id: number;
  leadId: number;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  note: string | null;
  identityNumber: string | null;
  nationality: string | null;
  createdAt: string;
  property: string;
  room: string | null;
  fullAddress: string | null;
  contracts: AgentContract[];
}
export interface TenantLeadOption {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  nationality: string | null;
}
export interface TenantRoomOption {
  id: number;
  property: string;
  room: string | null;
  /** The lead asked about (`leadId`) has a viewing of this room that was not cancelled. */
  viewed?: boolean;
  /** Name of the lead that already booked this room; null while it is free. */
  bookedBy?: string | null;
}
export interface UpdateAgentTenant {
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  note?: string;
  identityNumber?: string;
  nationality?: string;
}
export interface CreateAgentTenant extends UpdateAgentTenant {
  leadId: number;
  rentRoomId: number;
}
