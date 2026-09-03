import { th } from './locales/th';
import { en } from './locales/en';
import { zh } from './locales/zh';
import { ja } from './locales/ja';
import { SupportedLocale, TranslationSchema } from './types';

export const locales: Record<SupportedLocale, TranslationSchema> = {
  th,
  en,
  zh,
  ja,
};

export function getTranslations(locale: SupportedLocale = 'th'): TranslationSchema {
  return locales[locale] || locales.th;
}

export * from './LocaleContext';
export * from './resolveLocale';
export * from './types';
