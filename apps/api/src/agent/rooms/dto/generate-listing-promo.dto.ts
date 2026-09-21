export type GenerateListingPromoLocale = 'th' | 'en' | 'zh' | 'ja';

export type GenerateListingPromoBody = {
  locale?: GenerateListingPromoLocale | string;
  listing: Record<string, unknown>;
};

export type GenerateListingPromoResult = {
  listingTitle: string;
  listingDescription: string;
};
