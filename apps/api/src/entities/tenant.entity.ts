import { Entity, Column, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { SerialTimestampEntity } from './base.entity';
import { LeadEntity } from './lead.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'tenants' })
export class TenantEntity extends SerialTimestampEntity {
  @Column({ type: 'int', unique: true })
  lead_id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'int', nullable: true })
  user_id: number | null;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @OneToOne(() => LeadEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lead_id' })
  lead: LeadEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  created_by: UserEntity;
}
