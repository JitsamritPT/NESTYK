import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { UserEntity } from "./user.entity";

export type DepositTransferStatus = "pending" | "completed" | "cancelled";

@Entity({ name: "contract_deposit_transfers" })
export class ContractDepositTransferEntity extends SerialTimestampEntity {
  @Column({ type: "int" }) from_contract_id: number;
  @ManyToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "from_contract_id" }) from_contract: LeaseContractEntity;
  @Column({ type: "int" }) to_contract_id: number;
  @ManyToOne(() => LeaseContractEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "to_contract_id" }) to_contract: LeaseContractEntity;
  @Column({ type: "decimal", precision: 12, scale: 2 }) amount: string;
  @Column({ type: "varchar", length: 16, default: "pending" }) status: DepositTransferStatus;
  @Column({ type: "int" }) created_by_user_id: number;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_user_id" }) created_by: UserEntity;
  @Column({ type: "int", nullable: true }) approved_by_user_id: number | null;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "approved_by_user_id" }) approved_by: UserEntity | null;
  @Column({ type: "timestamptz", nullable: true }) approved_at: Date | null;
  @Column({ type: "timestamptz", nullable: true }) transferred_at: Date | null;
}
