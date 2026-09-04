import { Entity, Column, OneToMany } from 'typeorm';
import { SerialCreatedEntity } from './base.entity';
import { UserRoleEntity } from './user-role.entity';

@Entity({ name: 'users' })
export class UserEntity extends SerialCreatedEntity {
  @Column({ type: 'uuid', unique: true, nullable: true })
  supabase_user_id: string | null;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 255, default: 'User' })
  first_name: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  last_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatar_url: string | null;

  @Column({ type: 'boolean', default: false })
  profile_completed: boolean;

  @OneToMany(() => UserRoleEntity, (ur) => ur.user)
  user_roles: UserRoleEntity[];
}
