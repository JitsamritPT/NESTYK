import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MasterRoleName } from '../../entities/master-role.entity';
import { AuthRequestUser } from '../decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<MasterRoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthRequestUser }>();
    const user = request.user;
    if (!user?.id) {
      throw new UnauthorizedException('Call POST /auth/sync first');
    }

    const ok = required.some((role) => user.roleNames?.includes(role));
    if (!ok) {
      throw new ForbiddenException(`Required role: ${required.join(' | ')}`);
    }
    return true;
  }
}
