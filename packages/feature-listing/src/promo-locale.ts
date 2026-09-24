export type PromoOutputLocale = 'th' | 'en' | 'zh' | 'ja';

const PROMO_LOCALES: PromoOutputLocale[] = ['th', 'en', 'zh', 'ja'];

export function normalizePromoLocale(value: string | undefined | null): PromoOutputLocale {
  const raw = (value || '').trim().toLowerCase();
  if (raw === 'en' || raw === 'zh' || raw === 'ja' || raw === 'th') return raw;
  return 'th';
}

export function isPromoOutputLocale(value: string): value is PromoOutputLocale {
  return (PROMO_LOCALES as string[]).includes(value);
}

/**
 * Light heuristic from listing text fields. Prefer an explicit user choice when available.
 */
export function detectPromoOutputLocale(
  texts: Array<string | undefined | null>,
  fallback: string,
): PromoOutputLocale {
  const sample = texts.filter((t) => typeof t === 'string' && t.trim()).join(' \n ');
  const fb = normalizePromoLocale(fallback);
  if (!sample.trim()) return fb;

  if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(sample)) return 'ja';
  if (/[\u4e00-\u9fff]/.test(sample) && !/[\u3040-\u30ff]/.test(sample)) return 'zh';
  if (/[\u0e00-\u0e7f]/.test(sample)) return 'th';
  if (
    /[A-Za-z]{3,}/.test(sample) &&
    !/[\u0e00-\u0e7f\u3040-\u30ff\u4e00-\u9fff]/.test(sample)
  ) {
    return 'en';
  }
  return fb;
}

export const PROMO_OUTPUT_LOCALE_OPTIONS: PromoOutputLocale[] = [...PROMO_LOCALES];
