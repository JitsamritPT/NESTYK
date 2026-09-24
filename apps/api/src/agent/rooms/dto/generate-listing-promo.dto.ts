export type GenerateListingPromoLocale = 'th' | 'en' | 'zh' | 'ja';

export type GenerateListingPromoBody = {
  /** @deprecated Prefer outputLocale — kept for older clients (app UI locale). */
  locale?: GenerateListingPromoLocale | string;
  /** Language for listingTitle / listingDescription (may differ from app UI locale). */
  outputLocale?: GenerateListingPromoLocale | string;
  listing: Record<string, unknown>;
};

export type GenerateListingPromoResult = {
  listingTitle: string;
  listingDescription: string;
};
