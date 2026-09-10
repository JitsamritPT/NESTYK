import AsyncStorage from '@react-native-async-storage/async-storage';

export type AuthMode = 'supabase' | 'dev';

export type StoredAuthSession = {
  mode: AuthMode;
  accessToken: string;
  email: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  roles: string[];
};

const SESSION_KEY = 'nestyk.auth.session.v1';

export async function loadAuthSession(): Promise<StoredAuthSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (parsed?.accessToken && parsed?.email && parsed?.userId) return parsed;
  } catch {
    // ignore
  }
  return null;
}

export async function saveAuthSession(session: StoredAuthSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export function initialsFromName(firstName: string, lastName: string, email: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  if (a || b) return `${a}${b}`.toUpperCase() || email.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase() || 'U';
}

export function displayNameFrom(firstName: string, lastName: string, email: string): string {
  const full = [firstName, lastName].filter(Boolean).join(' ').trim();
  return full || email.split('@')[0] || 'User';
}
