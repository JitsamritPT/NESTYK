import type { NearbyPlace } from '@nestyk/types';
export type CreateRoomMediaInput = {
  mediaUrl: string;
  mediaType?: 'image' | 'video';
  category?: 'room' | 'common' | 'floorplan';
  isCover?: boolean;
  sortOrder?: number;
};

export type CreateRoomLayoutInput = {
  code: string;
  value: string;
};

export type CreateRoomFacilityInput = {
  code: string;
  groupCode?: string;
};

export type CreateRoomDocumentInput = {
  kind: 'id_passport' | 'bookbank' | 'ownership' | 'other';
  mediaUrl: string;
  sortOrder?: number;
};

export type CreateRoomPropertyInput = {
  name?: string;
  propertyTypeId: number;
  address: string;
  subdistrict?: string;
  district: string;
  province: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
};

export type CreateRoomContactInput = {
  name: string;
  phone: string;
  email?: string;
  note?: string;
};

export type CreateRoomPriceInput = {
  contractTypeId: number;
  price: number;
};

export type CreateRoomBody = {
  visibility?: 'private' | 'published';
  contactId?: number;
  contact?: CreateRoomContactInput;
  propertyId?: number;
  property?: CreateRoomPropertyInput;
  listingTitle?: string;
  listingDescription?: string;
  roomTypeId?: number;
  listingSourceCode?: 'co_agent' | 'owner';
  roomId?: string;
  availableFromDate?: string;
  waterRatePerUnit?: number;
  electricRatePerUnit?: number;
  prices?: CreateRoomPriceInput[];
  advanceRentMonths?: number;
  depositMonths?: number;
  latitude?: number;
  longitude?: number;
  nearbyOther?: string;
  nearbyPlaces?: NearbyPlace[];
  customFacilities?: string[];
  layout?: CreateRoomLayoutInput[];
  facilities?: CreateRoomFacilityInput[];
  medias?: CreateRoomMediaInput[];
  documents?: CreateRoomDocumentInput[];
};
