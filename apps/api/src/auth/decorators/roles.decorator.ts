import { SetMetadata } from '@nestjs/common';
import { MasterRoleName } from '../../entities/master-role.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: MasterRoleName[]) => SetMetadata(ROLES_KEY, roles);
