import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { ListingEntity } from './listing.entity';
import { BillEntity } from './bill.entity';

@Entity({ schema: 'NESTYK_PROPTECH', name: 'contracts' })
export class ContractEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  contract_number: string;

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date' })
  end_date: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monthly_rent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  security_deposit: number;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status: 'draft' | 'pending_signature' | 'active' | 'terminated' | 'expired';

  @Column({ type: 'varchar', length: 500, nullable: true })
  signed_pdf_url: string; // Supabase Private Signed URL

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant: UserEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'owner_id' })
  owner: UserEntity;

  @ManyToOne(() => ListingEntity)
  @JoinColumn({ name: 'listing_id' })
  listing: ListingEntity;

  @OneToMany(() => BillEntity, (bill) => bill.contract)
  bills: BillEntity[];
}
