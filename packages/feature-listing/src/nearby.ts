import type { NearbyPlace } from "@nestyk/types";
export type { NearbyPlace } from "@nestyk/types";
export const nearbyCategories = [
  "transit",
  "education",
  "health",
  "shopping",
  "recreation",
  "other",
] as const;
export type NearbyCategory = (typeof nearbyCategories)[number];
export const categoryColors: Record<NearbyCategory, string> = {
  transit: "#2563eb",
  education: "#7c3aed",
  health: "#dc2626",
  shopping: "#d97706",
  recreation: "#15803d",
  other: "#db2777",
};
export function nearbyCategory(type: string): NearbyCategory {
  if (
    [
      "subway_station",
      "train_station",
      "transit_station",
      "bus_station",
    ].includes(type)
  )
    return "transit";
  if (["university", "school"].includes(type)) return "education";
  if (type === "hospital") return "health";
  if (["shopping_mall", "supermarket", "convenience_store"].includes(type))
    return "shopping";
  if (type === "park") return "recreation";
  return "other";
}
export const isCustomPlace = (place: NearbyPlace) =>
  place.type === "custom_nearby" || place.placeId.startsWith("custom-");
export function distanceMeters(
  a: number,
  b: number,
  c: number,
  d: number,
): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((c - a) * rad) / 2) ** 2 +
    Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h))));
}
export function relocateNearby(
  places: NearbyPlace[],
  latitude: number,
  longitude: number,
): NearbyPlace[] {
  return places
    .map((p) => ({
      ...p,
      distanceMeters: distanceMeters(
        latitude,
        longitude,
        p.latitude,
        p.longitude,
      ),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
export function createCustomPlace(
  latitude: number,
  longitude: number,
  originLat: number,
  originLng: number,
): NearbyPlace {
  return {
    placeId: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    name: "",
    type: "custom_nearby",
    latitude,
    longitude,
    distanceMeters: distanceMeters(originLat, originLng, latitude, longitude),
  };
}
export type NearbyMapProps = {
  latitude: number;
  longitude: number;
  places: NearbyPlace[];
  selectedIds: string[];
  activeId?: string | null;
  customMode?: boolean;
  apiKey?: string;
  readOnly?: boolean;
  onPlacePress?: (place: NearbyPlace) => void;
  onMapPress?: (latitude: number, longitude: number) => void;
};
