import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { UserRole } from '@nestyk/types';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

@Entity({ schema: 'NESTYK_PROPTECH', name: 'user_roles' })
export class UserRoleEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 30 })
  role: UserRole; // 'guest' | 'tenant' | 'owner' | 'agent' | 'admin' | 'assistant'

  @ManyToOne(() => UserEntity, (user) => user.roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
