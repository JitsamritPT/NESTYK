/** True when layout bedrooms is 0, or room type is studio. */
export function isStudioBedroom(
  raw: string | number | null | undefined,
  roomTypeCode?: string | null,
): boolean {
  if (roomTypeCode === 'studio') return true;
  if (raw == null) return false;
  const text = String(raw).trim();
  if (!text) return false;
  return Number(text) === 0;
}

/** Display label for bedroom count — studio → label, else bare number string. */
export function formatBedroomDisplay(
  raw: string | number | null | undefined,
  studioLabel: string,
  roomTypeCode?: string | null,
): string | null {
  if (isStudioBedroom(raw, roomTypeCode)) return studioLabel;
  if (raw == null) return null;
  const text = String(raw).trim();
  return text || null;
}

/** Detail / prose form: studio | "1 bed" | "N beds". */
export function formatBedroomSpec(
  raw: string | number | null | undefined,
  labels: { studio: string; one: string; many: string },
  roomTypeCode?: string | null,
): string | null {
  if (isStudioBedroom(raw, roomTypeCode)) return labels.studio;
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const count = Number(text);
  if (count === 1) return labels.one.replace('{count}', text);
  return labels.many.replace('{count}', text);
}
