/** Max ranked search pins per lead. */
export const LEAD_MAX_PINS = 3;

/** One ranked search pin — rank 1 is the lead's top-priority area. */
export type LeadPin = {
  rank: number;
  placeId: string | null;
  name: string;
  latitude: number;
  longitude: number;
  province: string;
  district: string | null;
};

/** Pin as sent by the client; rank follows array order. */
export type LeadPinInput = Omit<LeadPin, 'rank'> & { rank?: number };

export const LEAD_CONTACT_CHANNELS = ['line', 'whatsapp', 'wechat', 'facebook', 'telegram', 'other'] as const;
export type LeadContactChannel = (typeof LEAD_CONTACT_CHANNELS)[number];
/** Max extra contact channels per lead (phone and email excluded). */
export const LEAD_MAX_CONTACTS = 5;
export type LeadContact = { channel: LeadContactChannel; value: string };

export type CreateLeadInput = {
  /** Ordered by priority (index 0 = rank 1), up to {@link LEAD_MAX_PINS}. */
  pins?: LeadPinInput[];
  /** Search radius shared by every pin (1, 3 or 5 km). */
  radiusKm?: number | null;
  /** Derived from pin rank 1 when pins exist; legacy value otherwise. */
  province?: string | null;
  /** Derived from pin districts when pins exist; legacy value otherwise. */
  locations?: string[];
  name: string;
  phone: string;
  email?: string | null;
  /** Ordered list, up to {@link LEAD_MAX_CONTACTS}; no duplicate channel + value pairs. */
  otherContacts?: LeadContact[];
  nationality?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredLocation?: string | null;
  moveInPlan?: string | null;
  hasPets?: boolean | null;
  occupation?: string | null;
  visaTypeId?: number | null;
  leaseDurationMonths?: number | null;
  usesCar?: boolean | null;
  occupantCount?: number | null;
  isSmoker?: boolean | null;
  desiredRoomTypeId?: number | null;
  /** Free-text care notes, up to 500 characters. */
  notes?: string | null;
};
export type LeadStatus = 'new' | 'inprogress' | 'lost' | 'booked';

export type AgentLeadsSort =
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'name_asc'
  | 'budget_asc'
  | 'budget_desc'
  | 'status_asc'
  | 'status_desc';

export type AgentLead = Required<Omit<CreateLeadInput, 'budgetMin' | 'budgetMax' | 'province' | 'pins'>> & {
  province: string | null;
  pins: LeadPin[];
  id: number; budgetMin: number | null; budgetMax: number | null;
  desiredRoomTypeCode: string | null; visaTypeCode: string | null;
  status: LeadStatus; lostReason: string | null; createdAt: string;
};
export type AgentLeadsPage = { items: AgentLead[]; total: number; page: number; limit: number };

export type LeadLocationCatalog = { name: string; nameEn: string; locations: string[] }[];
export type LeadFilters = {
  province?: string;
  locations?: string[];
  includeUnspecified?: boolean;
  sort?: AgentLeadsSort;
};
