import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { UserEntity } from "./user.entity";
import { TenantEntity } from "./tenant.entity";
import type { CommissionConfirmationInput } from "@nestyk/types";

@Entity({ name: "agent_commission_confirmations" })
export class AgentCommissionConfirmationEntity extends SerialTimestampEntity {
  @Column({ type: "int" })
  created_by_user_id: number;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "created_by_user_id" })
  created_by: UserEntity;

  @Column({ type: "varchar", length: 40 })
  document_no: string;

  @Column({ type: "date" })
  issue_date: string;

  @Column({ type: "int", nullable: true })
  tenant_id: number | null;

  @ManyToOne(() => TenantEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "tenant_id" })
  tenant: TenantEntity | null;

  @Column({ type: "varchar", length: 80 })
  landlord_name: string;

  @Column({ type: "jsonb" })
  data: CommissionConfirmationInput;

  @Column({ type: "text" })
  pdf_path: string;
}
