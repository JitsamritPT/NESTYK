export type PlaceSuggestion = {
  placeId: string;
  name: string;
  address: string;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  district: string;
  province: string;
  subdistrict: string;
  postalCode: string;
  latitude: number;
  longitude: number;
};
