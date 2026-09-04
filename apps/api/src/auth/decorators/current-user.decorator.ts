import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserEntity } from '../../entities/user.entity';

export type AuthRequestUser = UserEntity & {
  roleNames: string[];
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthRequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthRequestUser }>();
    return request.user;
  },
);
