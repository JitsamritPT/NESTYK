import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { UserEntity } from "./user.entity";

export type DepositSettlementStatus = "draft" | "approved" | "completed";

@Entity({ name: "contract_deposit_settlements" })
export class ContractDepositSettlementEntity extends SerialTimestampEntity {
  @Column({ type: "int", unique: true }) lease_contract_id: number;
  @OneToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "lease_contract_id" }) lease_contract: LeaseContractEntity;

  /** Actual cash received, never copied automatically from the contractual deposit. */
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 }) deposit_received_amount: string;
  @Column({ type: "text", nullable: true }) deposit_received_reference: string | null;
  /** Cash received plus completed incoming transfers, before this settlement's allocation. */
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 }) available_deposit_amount: string;
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 }) deduction_total: string;
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 }) carried_forward_total: string;
  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 }) refund_amount: string;
  @Column({ type: "varchar", length: 16, default: "draft" }) status: DepositSettlementStatus;
  @Column({ type: "text", nullable: true }) decision_note: string | null;
  @Column({ type: "int" }) created_by_user_id: number;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_user_id" }) created_by: UserEntity;
  @Column({ type: "int", nullable: true }) approved_by_user_id: number | null;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "approved_by_user_id" }) approved_by: UserEntity | null;
  @Column({ type: "timestamptz", nullable: true }) approved_at: Date | null;
  @Column({ type: "timestamptz", nullable: true }) refunded_at: Date | null;
  @Column({ type: "text", nullable: true }) refund_reference: string | null;
}
