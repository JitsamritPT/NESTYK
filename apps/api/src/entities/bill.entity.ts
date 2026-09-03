import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ContractEntity } from './contract.entity';

@Entity({ schema: 'NESTYK_PROPTECH', name: 'bills' })
export class BillEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  bill_number: string;

  @Column({ type: 'varchar', length: 20 }) // e.g. '2026-09'
  billing_month: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  rent_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  water_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  electricity_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount: number;

  @Column({ type: 'date' })
  due_date: Date;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';

  @Column({ type: 'varchar', length: 500, nullable: true })
  promptpay_qr_url: string;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date;

  @ManyToOne(() => ContractEntity, (contract) => contract.bills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: ContractEntity;
}
