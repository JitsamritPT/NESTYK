import { Entity, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user.entity';
import { MasterRoleEntity } from './master-role.entity';

@Entity({ name: 'user_roles' })
export class UserRoleEntity {
  @PrimaryColumn({ type: 'int' })
  user_id: number;

  @PrimaryColumn({ type: 'int' })
  role_id: number;

  @ManyToOne(() => UserEntity, (user) => user.user_roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => MasterRoleEntity, (role) => role.user_roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: MasterRoleEntity;
}
