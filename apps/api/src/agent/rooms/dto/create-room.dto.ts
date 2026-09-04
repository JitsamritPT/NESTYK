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
  categoryCode?: string;
  address: string;
  subdistrict?: string;
  district: string;
  province: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
};

export type CreateRoomPropertyOwnerInput = {
  name: string;
  phone: string;
  email?: string;
  note?: string;
};

export type CreateRoomPriceInput = {
  contractTypeCode: string;
  price: number;
};

export type CreateRoomBody = {
  visibility?: 'private' | 'published';
  propertyOwnerId?: number;
  propertyOwner?: CreateRoomPropertyOwnerInput;
  propertyId?: number;
  property?: CreateRoomPropertyInput;
  listingTitle?: string;
  listingDescription?: string;
  roomId?: string;
  availableFromDate?: string;
  waterRatePerUnit?: number;
  electricRatePerUnit?: number;
  prices?: CreateRoomPriceInput[];
  latitude?: number;
  longitude?: number;
  nearbyOther?: string;
  nearbyPlaces?: unknown[];
  customFacilities?: string[];
  layout?: CreateRoomLayoutInput[];
  facilities?: CreateRoomFacilityInput[];
  medias?: CreateRoomMediaInput[];
  documents?: CreateRoomDocumentInput[];
};
