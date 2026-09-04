import { CreateRoomWizardSubmitData } from '@nestyk/feature-listing';
import { apiGet, apiPost } from './api';
import { ensureAgentSession } from './agent-session';

export type AgentListingCard = {
  id: number;
  listingTitle: string | null;
  visibility: 'private' | 'published' | null;
  isScoutRoom: boolean;
  roomStatusCode: string | null;
  property: {
    id: number;
    name: string;
    district: string;
    province: string;
  } | null;
  propertyOwner: {
    id: number;
    name: string;
    phone: string;
  } | null;
  prices: Array<{ contractTypeCode: string; price: number }>;
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
  propertyOwnerId: number;
  isScoutRoom: true;
  visibility: 'private' | 'published';
};

export async function fetchMyAgentListings(): Promise<AgentListingsResponse> {
  await ensureAgentSession();
  return apiGet<AgentListingsResponse>('/agent/listings');
}

export async function fetchAgentPropertyOwners(): Promise<
  Array<{
    id: number;
    name: string;
    phone: string;
    note: string | null;
    roomCount: number;
  }>
> {
  await ensureAgentSession();
  return apiGet('/agent/rooms/property-owners');
}

export async function createAgentScoutRoom(
  data: CreateRoomWizardSubmitData,
): Promise<CreateRoomResponse> {
  await ensureAgentSession();
  const { isScoutRoom: _scout, ...body } = data;
  return apiPost<CreateRoomResponse>('/agent/rooms', body);
}
