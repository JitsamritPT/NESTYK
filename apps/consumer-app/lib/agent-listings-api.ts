import { CreateRoomWizardSubmitData } from '@nestyk/feature-listing';
import { apiGet, apiPost, apiRequest } from './api';
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
  prices: Array<{ contractTypeId?: number; contractTypeCode: string; price: number; advanceRentMonths?: number; depositMonths?: number }>;
  coverMediaUrl: string | null;
  bedroomCount?: string | null;
  roomSizeSqm?: string | null;
  updatedAt?: string | null;
};

export type AgentListingsSort = 'updated_desc' | 'updated_asc' | 'price_asc' | 'price_desc';

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
  contactIds?: number[];
  listingSourceCode: 'co_agent' | 'owner';
  isScoutRoom: true;
  visibility: 'private' | 'published';
};

export async function fetchMyAgentListings(query: {
  page?: number;
  q?: string;
  visibility?: string;
  roomStatus?: string;
  listingSource?: string;
  sort?: AgentListingsSort;
} = {}): Promise<AgentListingsResponse> {
  await ensureAgentSession();
  const params = new URLSearchParams({ page: String(query.page ?? 1), limit: '20' });
  if (query.q) params.set('q', query.q);
  if (query.visibility) params.set('visibility', query.visibility);
  if (query.roomStatus) params.set('roomStatus', query.roomStatus);
  if (query.listingSource) params.set('listingSource', query.listingSource);
  if (query.sort) params.set('sort', query.sort);
  return apiGet<AgentListingsResponse>(`/agent/listings?${params}`);
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

export async function fetchAgentRoom(id: number): Promise<import('@nestyk/feature-listing').AgentRoomDetail> {
  await ensureAgentSession();
  return apiGet(`/agent/listings/${id}`);
}

export async function updateAgentRoom(id: number, data: CreateRoomWizardSubmitData): Promise<CreateRoomResponse> {
  await ensureAgentSession();
  const { isScoutRoom: _scout, ...body } = data;
  return apiRequest(`/agent/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function fetchAgentFacilities(): Promise<import('@nestyk/types').FacilityOption[]> {
  await ensureAgentSession();
  return apiGet('/agent/rooms/facilities');
}
