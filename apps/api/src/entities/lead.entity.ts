import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SerialTimestampEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { UserEntity } from './user.entity';
import { TenantEntity } from './tenant.entity';

export type LeadStatus = 'new' | 'inprogress' | 'viewed' | 'lost' | 'booked';

@Entity({ name: 'leads' })
export class LeadEntity extends SerialTimestampEntity {
  @Column({ type: 'int' })
  rent_room_id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: LeadStatus;

  @Column({ type: 'timestamptz', nullable: true })
  viewed_at: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  lost_reason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', nullable: true })
  tenant_id: number | null;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @ManyToOne(() => RentRoomEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rent_room_id' })
  rent_room: RentRoomEntity;

  @ManyToOne(() => TenantEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  created_by: UserEntity;
}
