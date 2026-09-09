import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from '../auth.service';
import { AuthRequestUser } from '../decorators/current-user.decorator';

export type JwtIdentity = {
  supabaseUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private supabase: SupabaseClient | null = null;

  constructor(private readonly authService: AuthService) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (url && key && !url.includes('your-project-ref')) {
      this.supabase = createClient(url, key);
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthRequestUser;
    }>();

    const header = request.headers.authorization ?? request.headers.Authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const identity = await this.resolveIdentity(token);
    const user = await this.authService.findBySupabaseUserId(identity.supabaseUserId);

    if (!user) {
      // Attach identity for sync endpoint to provision
      (request as { authIdentity?: JwtIdentity }).authIdentity = identity;
      request.user = undefined as unknown as AuthRequestUser;
      return true;
    }

    const withRoles = await this.authService.loadUserWithRoles(user.id);
    request.user = withRoles;
    (request as { authIdentity?: JwtIdentity }).authIdentity = identity;
    return true;
  }

  private async resolveIdentity(token: string): Promise<JwtIdentity> {
    // Local/dev: Bearer dev|<uuid>|<email>
    if (process.env.ALLOW_DEV_AUTH === 'true' && token.startsWith('dev|')) {
      const parts = token.split('|');
      if (parts.length < 3) {
        throw new UnauthorizedException('Invalid dev token format (dev|<uuid>|<email>)');
      }
      const [, supabaseUserId, email, firstName, lastName] = parts;
      return {
        supabaseUserId,
        email,
        firstName: firstName || 'Dev',
        lastName: lastName || 'User',
      };
    }

    if (!this.supabase) {
      throw new UnauthorizedException(
        'Supabase is not configured. Set SUPABASE_URL/ANON_KEY or ALLOW_DEV_AUTH=true',
      );
    }

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const meta = data.user.user_metadata ?? {};
    const fullName = String(meta.full_name ?? meta.name ?? '');
    const [firstName, ...rest] = fullName.split(' ').filter(Boolean);

    return {
      supabaseUserId: data.user.id,
      email: data.user.email ?? `${data.user.id}@users.local`,
      firstName: firstName || 'User',
      lastName: rest.join(' ') || '',
      avatarUrl: (meta.avatar_url as string | undefined) ?? null,
    };
  }
}
