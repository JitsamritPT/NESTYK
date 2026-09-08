import { CreateRoomWizardSubmitData } from '@nestyk/feature-listing';
import { apiGet, apiPost } from './api';
import { ensureAgentSession } from './agent-session';

export type AgentListingCard = {
  id: number;
  listingTitle: string | null;
  visibility: 'private' | 'published' | null;
  isScoutRoom: boolean;
  listingSourceCode?: 'co_agent' | 'owner' | null;
  roomStatusCode: string | null;
  property: {
    id: number;
    name: string;
    district: string;
    province: string;
  } | null;
  contact?: {
    id: number;
    name: string;
    phone: string;
  } | null;
  propertyOwner: {
    id: number;
    name: string;
    phone: string;
  } | null;
  prices: Array<{ contractTypeId?: number; contractTypeCode: string; price: number }>;
  coverMediaUrl: string | null;
};

export type AgentListingsResponse = {
  items: AgentListingCard[];
  total: number;
  page: number;
  limit: number;
};

export type CreateRoomResponse = {
  id: number;
  propertyId: number;
  contactId: number;
  listingSourceCode: 'co_agent' | 'owner';
  isScoutRoom: true;
  visibility: 'private' | 'published';
};

export async function fetchMyAgentListings(): Promise<AgentListingsResponse> {
  await ensureAgentSession();
  return apiGet<AgentListingsResponse>('/agent/listings');
}

export async function fetchAgentPropertyTypes(): Promise<
  Array<{ id: number; code: string }>
> {
  await ensureAgentSession();
  return apiGet('/agent/rooms/property-types');
}

export async function fetchAgentContacts(): Promise<
  Array<{
    id: number;
    name: string;
    phone: string;
    note: string | null;
    roomCount: number;
  }>
> {
  await ensureAgentSession();
  return apiGet('/agent/rooms/contacts');
}

export async function fetchAgentContractTypes(): Promise<
  Array<{ id: number; code: string; termMonths: number }>
> {
  await ensureAgentSession();
  return apiGet('/agent/rooms/contract-types');
}

export async function fetchAgentRoomTypes(): Promise<
  Array<{ id: number; code: string; bedroomCount: number | null }>
> {
  await ensureAgentSession();
  return apiGet('/agent/rooms/room-types');
}

export async function createAgentScoutRoom(
  data: CreateRoomWizardSubmitData,
): Promise<CreateRoomResponse> {
  await ensureAgentSession();
  const { isScoutRoom: _scout, ...body } = data;
  return apiPost<CreateRoomResponse>('/agent/rooms', body);
}
