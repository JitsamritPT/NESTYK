export type UserRole = 'guest' | 'tenant' | 'owner' | 'agent' | 'admin';

export interface UserProfile {
  id: string;
  supabaseUserId: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  roles: UserRole[];
  activeRole: UserRole;
  createdAt: string;
  updatedAt: string;
}
