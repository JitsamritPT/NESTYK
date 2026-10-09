import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { ContractDepositSettlementEntity } from "./contract-deposit-settlement.entity";

export type DepositDeductionType = "rent" | "utilities" | "damage" | "other";

@Entity({ name: "deposit_deduction_items" })
export class DepositDeductionItemEntity extends SerialTimestampEntity {
  @Column({ type: "int" }) settlement_id: number;
  @ManyToOne(() => ContractDepositSettlementEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "settlement_id" }) settlement: ContractDepositSettlementEntity;
  @Column({ type: "varchar", length: 32 }) deduction_type: DepositDeductionType;
  @Column({ type: "text" }) description: string;
  @Column({ type: "decimal", precision: 12, scale: 2 }) amount: string;
  @Column({ type: "text" }) evidence_reference: string;
}
