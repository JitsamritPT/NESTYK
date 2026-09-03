import { SupportedLocale } from './types';

const SUPPORTED_LOCALES: SupportedLocale[] = ['th', 'en', 'zh', 'ja'];

export function resolveSupportedLocale(
  languageTag?: string | null,
  fallback: SupportedLocale = 'en',
): SupportedLocale {
  if (!languageTag) return fallback;

  const base = languageTag.toLowerCase().split('-')[0];
  if (SUPPORTED_LOCALES.includes(base as SupportedLocale)) {
    return base as SupportedLocale;
  }

  return fallback;
}
