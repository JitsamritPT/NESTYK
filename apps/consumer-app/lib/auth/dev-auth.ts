/**
 * Dev login credentials — used when EXPO_PUBLIC_USE_DEV_AUTH=true
 * and/or Supabase is not configured. Must match docs/new-project/docker/seed-dev-user.sql
 */
export const DEV_AUTH_CONFIG = {
  enabled:
    process.env.EXPO_PUBLIC_USE_DEV_AUTH === 'true' ||
    process.env.EXPO_PUBLIC_APP_ENV === 'development',
  email: process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL ?? 'admin@jitsamrit.com',
  password: process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD ?? 'Jitsamrit2026',
  /** Stable UUID synced into local Postgres `users.supabase_user_id` */
  uuid: process.env.EXPO_PUBLIC_DEV_LOGIN_UUID ?? '00000000-0000-4000-8000-000000000001',
  firstName: process.env.EXPO_PUBLIC_DEV_LOGIN_FIRST_NAME ?? 'Admin',
  lastName: process.env.EXPO_PUBLIC_DEV_LOGIN_LAST_NAME ?? 'Jitsamrit',
} as const;

export function toDevAccessToken(uuid: string, email: string, firstName: string, lastName: string): string {
  return `dev|${uuid}|${email}|${firstName}|${lastName}`;
}
