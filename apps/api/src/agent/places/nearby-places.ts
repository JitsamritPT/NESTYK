import { BadRequestException } from "@nestjs/common";
import type { NearbyPlace } from "@nestyk/types";

export const NEARBY_TYPES = [
  { type: "subway_station", radius: 1000, limit: 5 },
  { type: "train_station", radius: 1000, limit: 5 },
  { type: "university", radius: 2500, limit: 5 },
  { type: "hospital", radius: 2500, limit: 5 },
  { type: "shopping_mall", radius: 3000, limit: 5 },
  { type: "park", radius: 2000, limit: 3 },
] as const;

export function validCoordinates(
  latitude: unknown,
  longitude: unknown,
): boolean {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180
  );
}

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

export function validateNearbyPlaces(
  input: unknown,
): asserts input is NearbyPlace[] {
  if (!Array.isArray(input) || input.length > 29)
    throw new BadRequestException(
      "At most 24 Google places and 5 custom pins allowed",
    );
  let custom = 0;
  const seen = new Set<string>();
  for (const p of input) {
    if (
      !p ||
      typeof p !== "object" ||
      typeof p.placeId !== "string" ||
      !p.placeId.trim() ||
      p.placeId.length > 300 ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 200 ||
      typeof p.type !== "string" ||
      !p.type.trim() ||
      p.type.length > 64 ||
      !validCoordinates(p.latitude, p.longitude) ||
      typeof p.distanceMeters !== "number" ||
      !Number.isFinite(p.distanceMeters) ||
      p.distanceMeters < 0 ||
      (p.vicinity !== undefined &&
        (typeof p.vicinity !== "string" || p.vicinity.length > 500)) ||
      seen.has(p.placeId)
    ) {
      throw new BadRequestException("Invalid nearby place");
    }
    seen.add(p.placeId);
    if (p.type === "custom_nearby" || p.placeId.startsWith("custom-")) custom++;
  }
  if (custom > 5 || input.length - custom > 24)
    throw new BadRequestException(
      "At most 24 Google places and 5 custom pins allowed",
    );
}
