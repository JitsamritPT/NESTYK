/** Locale-specific tone + CTA for listing promo (appended to the base system prompt). */

export type ListingPromoLocale = 'th' | 'en' | 'zh' | 'ja';

const CTA_BY_LOCALE: Record<ListingPromoLocale, string> = {
  th: 'นัดดูห้อง',
  en: 'Schedule a viewing',
  zh: '预约看房',
  ja: '内見を予約',
};

const STYLE_BY_LOCALE: Record<ListingPromoLocale, string> = {
  th: `
Tone for Thai (th):
- Warm, persuasive lifestyle PropTech copy that scans well on mobile.
- Invite the reader to imagine daily convenience in the city (e.g. living near transit, easy routines) using ONLY real facts.
- Short paragraphs and clear bullets; professional yet energetic — not slangy or spammy.
`.trim(),
  en: `
Tone for English (en):
- Clear, persuasive lifestyle copy for international renters in Thailand.
- Emphasize convenience, layout, and location with concrete facts only.
- Short scannable lines; professional broker tone — no empty hype.
`.trim(),
  zh: `
Tone for Chinese (zh):
- Concise, practical listing copy focused on location, size, amenities, and price.
- Prefer clear bullets over long lifestyle prose; still inviting but factual.
- Natural Simplified Chinese for rental listings (not machine-translated stiffness).
`.trim(),
  ja: `
Tone for Japanese (ja):
- Polite, precise, well-organized copy (丁寧語). Avoid overly salesy English-style hype.
- Prefer accurate facts: station/nearby distance when present, layout, sunlight/orientation only if in the JSON.
- Structured sections and clean bullets; trustworthy and orderly.
`.trim(),
};

export function listingPromoCtaLabel(locale: ListingPromoLocale): string {
  return CTA_BY_LOCALE[locale];
}

export function listingPromoLocaleStyle(locale: ListingPromoLocale): string {
  const cta = CTA_BY_LOCALE[locale];
  return `
${STYLE_BY_LOCALE[locale]}

CTA (mandatory): End listingDescription by directing the reader to tap/click the in-page button labeled exactly "${cta}" on the current listing page. Do NOT ask them to call, add Line, WhatsApp, email, or inbox the agent. Do not invent a different CTA label.
`.trim();
}
