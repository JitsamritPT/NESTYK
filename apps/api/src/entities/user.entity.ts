import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserRoleEntity } from './user-role.entity';

@Entity({ schema: 'NESTYK_PROPTECH', name: 'users' })
export class UserEntity extends BaseEntity {
  @Column({ type: 'uuid', unique: true, nullable: true })
  supabase_user_id: string; // ผูกกับ auth.users ของ Supabase

  @Column({ type: 'varchar', length: 150 })
  full_name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone_number: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar_url: string;

  @OneToMany(() => UserRoleEntity, (role) => role.user)
  roles: UserRoleEntity[];
}
