export const PRICE_LIMIT = 100000;
export const PRICE_STEP = 1000;
export const PRICE_PRESETS = [
  ['', ''],
  ['', '10000'],
  ['10000', '20000'],
  ['20000', '30000'],
  ['30000', '50000'],
  ['50000', ''],
] as const;

export type PriceRange = { minPrice: string; maxPrice: string };
export type PriceThumb = 'min' | 'max';

export function pricePosition(raw: string, fallback: number) {
  return raw.trim() && Number.isFinite(Number(raw))
    ? Math.max(0, Math.min(PRICE_LIMIT, Number(raw)))
    : fallback;
}

export function movePrice(range: PriceRange, thumb: PriceThumb, value: number): PriceRange {
  const snapped = Math.max(0, Math.min(PRICE_LIMIT, Math.round(value / PRICE_STEP) * PRICE_STEP));
  if (thumb === 'min') {
    return {
      ...range,
      minPrice: String(Math.min(snapped, pricePosition(range.maxPrice, PRICE_LIMIT))),
    };
  }
  if (snapped === PRICE_LIMIT) return { ...range, maxPrice: '' };
  return { ...range, maxPrice: String(Math.max(snapped, Number(range.minPrice) || 0)) };
}

export function validPriceRange(range: PriceRange) {
  return (
    [range.minPrice, range.maxPrice].every(
      (v) => v === '' || (/^\d+(\.\d{1,2})?$/.test(v) && Number.isFinite(Number(v))),
    ) &&
    (!range.minPrice || !range.maxPrice || Number(range.minPrice) <= Number(range.maxPrice))
  );
}

export function matchesPreset(range: PriceRange, min: string, max: string) {
  return (
    validPriceRange(range) &&
    Number(range.minPrice) === Number(min) &&
    (range.maxPrice === '' ? Infinity : Number(range.maxPrice)) ===
      (max === '' ? Infinity : Number(max))
  );
}

/** Digits-only (optional decimals) for storage / API. */
export function parsePriceInput(text: string): string {
  const cleaned = text.replace(/,/g, '').replace(/[^\d.]/g, '').trim();
  if (!cleaned) return '';
  const match = cleaned.match(/^\d+(?:\.\d{0,2})?/);
  return match ? match[0] : '';
}

/** Display with locale grouping; keeps trailing decimal while typing. */
export function formatPriceInput(raw: string, locale: string): string {
  if (!raw) return '';
  if (!/^\d+(\.\d{0,2})?$/.test(raw)) return raw;
  const [intPart, dec] = raw.split('.');
  const grouped = Number(intPart).toLocaleString(locale);
  return dec != null ? `${grouped}.${dec}` : grouped;
}

export function isPriceBeyondScale(range: PriceRange): boolean {
  const over = (raw: string) => raw !== '' && Number.isFinite(Number(raw)) && Number(raw) > PRICE_LIMIT;
  return over(range.minPrice) || over(range.maxPrice);
}

/** Pick closest thumb to a track value (0…PRICE_LIMIT). */
export function nearestPriceThumb(
  range: PriceRange,
  trackValue: number,
): PriceThumb {
  const low = pricePosition(range.minPrice, 0);
  const high = pricePosition(range.maxPrice, PRICE_LIMIT);
  return Math.abs(trackValue - low) <= Math.abs(trackValue - high) ? 'min' : 'max';
}

export function formatPriceSummary(
  range: PriceRange,
  locale: string,
  labels: { unlimited: string; perMonth: string },
): string {
  const min = range.minPrice
    ? formatPriceInput(range.minPrice, locale)
    : '0';
  const max = range.maxPrice
    ? formatPriceInput(range.maxPrice, locale)
    : labels.unlimited;
  return `${min}–${max} ${labels.perMonth}`;
}
