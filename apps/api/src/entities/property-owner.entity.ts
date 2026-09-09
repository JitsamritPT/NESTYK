import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SerialCreatedEntity } from './base.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'property_owners' })
export class PropertyOwnerEntity extends SerialCreatedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @Column({ type: 'int', nullable: true })
  user_id: number | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_user_id' })
  created_by: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity | null;
}
