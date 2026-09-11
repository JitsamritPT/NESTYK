import { SupportedLocale } from './types';

const SUPPORTED_LOCALES: SupportedLocale[] = ['th', 'en', 'zh', 'ja'];

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return !!value && SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

export function resolveSupportedLocale(
  languageTag?: string | null,
  fallback: SupportedLocale = 'en',
): SupportedLocale {
  if (!languageTag) return fallback;

  const base = languageTag.toLowerCase().split('-')[0];
  if (isSupportedLocale(base)) {
    return base;
  }

  return fallback;
}
