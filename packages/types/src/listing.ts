export type ListingStatus = 'draft' | 'pending_review' | 'published' | 'rented' | 'inactive';
export type PropertyType = 'condo' | 'apartment' | 'house' | 'townhome';

export interface ListingAmenity {
  code: string;
  icon?: string;
}

export interface ListingPriceOption {
  durationMonths: 1 | 3 | 6 | 12;
  pricePerMonth: number;
  depositAmount: number;
}

export interface ListingItem {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  floor?: number;
  buildingName?: string;
  address: string;
  latitude: number;
  longitude: number;
  nearestStation?: {
    type: 'BTS' | 'MRT';
    stationName: string;
    distanceMeters: number;
  };
  pricing: ListingPriceOption[];
  images: string[];
  amenities: ListingAmenity[];
  status: ListingStatus;
  coBrokeCommissionPercent?: number;
  createdAt: string;
  updatedAt: string;
}
