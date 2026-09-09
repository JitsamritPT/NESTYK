export type NearbyPlace = {
  placeId: string;
  name: string;
  type: string;
  distanceMeters: number;
  latitude: number;
  longitude: number;
  vicinity?: string;
};

export type FacilityOption = {
  code: string;
  groupCode?: string;
  isExtraCharge?: boolean;
};
