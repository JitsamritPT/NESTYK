import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { UserEntity } from "./user.entity";
import type { FinancialDocumentInput } from "@nestyk/types";

@Entity({ name: "agent_invoices" })
export class AgentInvoiceEntity extends SerialTimestampEntity {
  @Column({ type: "int" })
  created_by_user_id: number;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "created_by_user_id" })
  created_by: UserEntity;

  @Column({ type: "varchar", length: 40 })
  document_no: string;

  @Column({ type: "date" })
  issue_date: string;

  @Column({ type: "varchar", length: 120 })
  customer_name: string;

  @Column({ type: "jsonb" })
  data: FinancialDocumentInput;

  @Column({ type: "text" })
  pdf_path: string;
}
