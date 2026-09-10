export type CreateLeadInput = {
  locationPlaceId?: string | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number | null;
  province?: string | null;
  locations?: string[];
  name: string;
  phone: string;
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
};
export type AgentLead = Required<Omit<CreateLeadInput, 'budgetMin' | 'budgetMax' | 'province'>> & {
  province: string | null;
  id: number; budgetMin: number | null; budgetMax: number | null;
  desiredRoomTypeCode: string | null; visaTypeCode: string | null; status: string; createdAt: string;
};
export type AgentLeadsPage = { items: AgentLead[]; total: number; page: number; limit: number };

export type LeadLocationCatalog = { name: string; nameEn: string; locations: string[] }[];
export type LeadFilters = { province?: string; locations?: string[]; includeUnspecified?: boolean };
