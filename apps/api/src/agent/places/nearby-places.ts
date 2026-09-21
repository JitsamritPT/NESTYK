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

export const NEARBY_MAX_RESULTS = 24;
/** Keep at least this many transit hits before filling remaining slots. */
export const NEARBY_TRANSIT_RESERVE = 10;

const TRANSIT_TYPES = new Set([
  "subway_station",
  "train_station",
  "transit_station",
  "bus_station",
]);

const MINOR_TRANSIT =
  /ซอย|ป้ายรถ|วิน|สองแถว|รถตู้|bus\s*stop|motorcycle\s*taxi/i;

export function isTransitNearbyType(type: string): boolean {
  return TRANSIT_TYPES.has(type);
}

export function isMinorTransitPlace(
  name: string,
  vicinity?: string,
): boolean {
  return MINOR_TRANSIT.test(`${name} ${vicinity || ""}`);
}

export function detectRailSystem(
  ...texts: Array<string | undefined>
): "BTS" | "MRT" | "ARL" | "SRT" | null {
  const blob = texts.filter(Boolean).join(" ");
  if (!blob) return null;
  if (/\bBTS\b|bangkok mass transit|skytrain|รถไฟฟ้าบีทีเอส|บีทีเอส/i.test(blob)) {
    return "BTS";
  }
  if (/\bMRT\b|metropolitan rapid transit|รถไฟฟ้ามหานคร|เอ็มอาร์ที/i.test(blob)) {
    return "MRT";
  }
  if (/\bARL\b|airport.?rail|แอร์พอร์ต\s*เรล|แอร์พอร์ตลิงก์/i.test(blob)) {
    return "ARL";
  }
  if (/\bSRT\b|state railway|การรถไฟแห่งประเทศไทย|รถไฟไทย/i.test(blob)) {
    return "SRT";
  }
  return null;
}

function stripStationNoise(name: string): string {
  return name
    .replace(/^(BTS|MRT|ARL|SRT)\s+/i, "")
    .replace(/^(สถานี(รถไฟฟ้า)?|Station)\s+/i, "")
    .replace(/\s*(BTS|MRT|ARL|SRT)?\s*(Station|สถานี)?$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Normalize transit labels when BTS/MRT (etc.) is already in the Google name/vicinity.
 * Otherwise keep the Google name as-is (Legacy Nearby often includes the rail brand).
 */
export function formatTransitPlaceName(
  name: string,
  type: string,
  vicinity?: string,
): string {
  const raw = name.trim();
  if (!raw || !isTransitNearbyType(type) || type === "bus_station") return raw;

  const existing = raw.match(/^(BTS|MRT|ARL|SRT)\b/i);
  if (existing) {
    return `${existing[1]!.toUpperCase()} ${stripStationNoise(raw) || raw}`.trim();
  }

  const system = detectRailSystem(raw, vicinity);
  if (!system) return raw;
  const core = stripStationNoise(raw) || raw;
  if (new RegExp(`^${system}\\b`, "i").test(core)) {
    return `${system} ${stripStationNoise(core) || core}`.trim();
  }
  return `${system} ${core}`;
}

export function mergeNearbyPlaces(places: NearbyPlace[]): NearbyPlace[] {
  const seen = new Set<string>();
  const unique = places.filter((p) => {
    if (seen.has(p.placeId)) return false;
    seen.add(p.placeId);
    return true;
  });
  const byDistance = (a: NearbyPlace, b: NearbyPlace) =>
    a.distanceMeters - b.distanceMeters;
  const transit = unique
    .filter((p) => isTransitNearbyType(p.type))
    .sort(byDistance)
    .slice(0, NEARBY_TRANSIT_RESERVE);
  const transitIds = new Set(transit.map((p) => p.placeId));
  const rest = unique
    .filter((p) => !transitIds.has(p.placeId))
    .sort(byDistance);
  const room = Math.max(0, NEARBY_MAX_RESULTS - transit.length);
  return [...transit, ...rest.slice(0, room)].sort(byDistance);
}

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
