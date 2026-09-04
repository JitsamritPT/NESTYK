import { Entity, Column, OneToMany } from 'typeorm';
import { SerialEntity } from './base.entity';
import { UserRoleEntity } from './user-role.entity';

/** DB role codes: guest | owner | tenant | agent | admin */
export type MasterRoleName = 'guest' | 'owner' | 'tenant' | 'agent' | 'admin';

@Entity({ name: 'master_roles' })
export class MasterRoleEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name: MasterRoleName;

  @Column({ type: 'varchar', length: 255, nullable: true })
  details: string | null;

  @OneToMany(() => UserRoleEntity, (ur) => ur.role)
  user_roles: UserRoleEntity[];
}
