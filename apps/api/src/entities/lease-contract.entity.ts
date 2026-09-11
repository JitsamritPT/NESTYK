import { MasterAgreementTypeEntity } from './master-agreement-type.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SerialTimestampEntity } from './base.entity';
import { RoomTenancyEntity } from './room-tenancy.entity';
import { RentRoomEntity } from './rent-room.entity';
import { TenantEntity } from './tenant.entity';
import { LeadEntity } from './lead.entity';
import { PropertyOwnerEntity } from './property-owner.entity';
import { UserEntity } from './user.entity';

export type LeaseContractStatus =
  | 'draft'
  | 'awaiting_signatures'
  | 'awaiting_agent_review'
  | 'awaiting_payment'
  | 'awaiting_payment_verification'
  | 'active'
  | 'cancelled'
  | 'expired'
  | 'terminated';

@Entity({ name: 'lease_contracts' })
export class LeaseContractEntity extends SerialTimestampEntity {
  @Column({ type: 'varchar', length: 64, default: 'lease' })
  agreement_type_code: string;

  @ManyToOne(() => MasterAgreementTypeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'agreement_type_code', referencedColumnName: 'code' })
  agreement_type: MasterAgreementTypeEntity;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  reservation_fee: string | null;

  @Column({ type: 'varchar', length: 32, unique: true, nullable: true })
  contract_no: string | null;

  @Column({ type: 'int' })
  room_tenancy_id: number;

  @Column({ type: 'int' })
  rent_room_id: number;

  @Column({ type: 'int' })
  tenant_id: number;

  @Column({ type: 'int' })
  lead_id: number;

  @Column({ type: 'int', nullable: true })
  property_owner_id: number | null;

  @Column({ type: 'int', nullable: true })
  owner_user_id: number | null;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @Column({ type: 'int', nullable: true })
  original_contract_id: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  contract_type_code: string | null;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date', nullable: true })
  end_date: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  monthly_rent: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  deposit: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  advance_rent: string | null;

  @Column({ type: 'varchar', length: 40, default: 'draft' })
  status: LeaseContractStatus;

  @Column({ type: 'text', nullable: true })
  document_url: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  owner_signed_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  tenant_signed_at: Date | null;

  @Column({ type: 'int', nullable: true })
  reviewed_by_user_id: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  payment_submitted_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  terminated_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => RoomTenancyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_tenancy_id' })
  room_tenancy: RoomTenancyEntity;

  @ManyToOne(() => RentRoomEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rent_room_id' })
  rent_room: RentRoomEntity;

  @ManyToOne(() => TenantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @ManyToOne(() => LeadEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lead_id' })
  lead: LeadEntity;

  @ManyToOne(() => PropertyOwnerEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'property_owner_id' })
  property_owner: PropertyOwnerEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_user_id' })
  owner_user: UserEntity | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  created_by: UserEntity;

  @ManyToOne(() => LeaseContractEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'original_contract_id' })
  original_contract: LeaseContractEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_user_id' })
  reviewed_by: UserEntity | null;
}
