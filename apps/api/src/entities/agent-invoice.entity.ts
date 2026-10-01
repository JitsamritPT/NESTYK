import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { SerialTimestampEntity } from "./base.entity";
import { UserEntity } from "./user.entity";
import { TenantEntity } from "./tenant.entity";
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

  @Column({ type: "int", nullable: true })
  tenant_id: number | null;

  @ManyToOne(() => TenantEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "tenant_id" })
  tenant: TenantEntity | null;

  @Column({ type: "varchar", length: 120 })
  customer_name: string;

  @Column({ type: "jsonb" })
  data: FinancialDocumentInput;

  @Column({ type: "text" })
  pdf_path: string;

  @Column({ type: "varchar", length: 40, nullable: true })
  receipt_document_no: string | null;

  @Column({ type: "date", nullable: true })
  receipt_issue_date: string | null;

  @Column({ type: "jsonb", nullable: true })
  receipt_data: FinancialDocumentInput | null;

  @Column({ type: "text", nullable: true })
  receipt_pdf_path: string | null;

  @Column({ type: "text", nullable: true })
  payment_slip_path: string | null;
}
