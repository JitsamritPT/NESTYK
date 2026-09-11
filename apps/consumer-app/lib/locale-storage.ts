import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupportedLocale, type SupportedLocale } from '@nestyk/i18n';

const PREFERRED_LOCALE_KEY = '@nestyk/preferred_locale';

/** Returns a previously chosen app language, or null if never saved. */
export async function loadPreferredLocale(): Promise<SupportedLocale | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFERRED_LOCALE_KEY);
    return isSupportedLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Persist the user's language choice for the next launch. */
export async function savePreferredLocale(locale: SupportedLocale): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFERRED_LOCALE_KEY, locale);
  } catch {
    // Non-fatal — UI locale still updates in memory.
  }
}
