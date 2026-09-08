import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SerialTimestampEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { UserEntity } from './user.entity';
import { MasterRoomTypeEntity } from './master-room-type.entity';
import { MasterVisaTypeEntity } from './master-visa-type.entity';
import { TenantEntity } from './tenant.entity';

export type LeadContactChannel = { channel: string; value: string };

export type LeadStatus = 'new' | 'inprogress' | 'viewed' | 'lost' | 'booked';

@Entity({ name: 'leads' })
export class LeadEntity extends SerialTimestampEntity {
  @Column({ type: 'int', nullable: true })
  rent_room_id: number | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'int', nullable: true })
  desired_room_type_id: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  nationality: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  preferred_location: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  move_in_plan: string | null;

  @Column({ type: 'boolean', nullable: true })
  has_pets: boolean | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  occupation: string | null;

  @Column({ type: 'int', nullable: true })
  visa_type_id: number | null;

  @Column({ type: 'smallint', nullable: true })
  lease_duration_months: number | null;

  @Column({ type: 'boolean', nullable: true })
  uses_car: boolean | null;

  @Column({ type: 'smallint', nullable: true })
  occupant_count: number | null;

  @Column({ type: 'boolean', nullable: true })
  is_smoker: boolean | null;

  /** Monthly rent budget in THB. Decimal values are returned as strings. */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  budget_min: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  budget_max: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  other_contacts: LeadContactChannel[];

  @ManyToOne(() => MasterRoomTypeEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'desired_room_type_id' })
  desired_room_type: MasterRoomTypeEntity | null;

  @ManyToOne(() => MasterVisaTypeEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'visa_type_id' })
  visa_type: MasterVisaTypeEntity | null;

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

  @ManyToOne(() => RentRoomEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rent_room_id' })
  rent_room: RentRoomEntity | null;

  @ManyToOne(() => TenantEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  created_by: UserEntity;
}
