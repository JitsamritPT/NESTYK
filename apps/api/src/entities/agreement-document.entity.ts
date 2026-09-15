import { Entity, Column, PrimaryColumn } from "typeorm";
import { SerialEntity, SerialCreatedEntity } from "./base.entity";
@Entity({ name: "master_document_types" })
export class MasterDocumentTypeEntity {
  @PrimaryColumn({ type: "varchar", length: 64 }) code: string;
  @Column({ type: "varchar", length: 255 }) name_th: string;
  @Column({ type: "boolean", default: true }) is_active: boolean;
}
@Entity({ name: "agreement_template_document_requirements" })
export class AgreementDocumentRequirementEntity extends SerialEntity {
  @Column({ type: "int" }) template_id: number;
  @Column({ type: "varchar", length: 64 }) group_key: string;
  @Column({ type: "varchar", length: 255 }) label: string;
  @Column({ type: "varchar", length: 32 }) subject: string;
  @Column({ type: "varchar", length: 64 }) document_type_code: string;
}
@Entity({ name: "agreement_documents" })
export class AgreementDocumentEntity extends SerialCreatedEntity {
  @Column({ type: "timestamptz", nullable: true }) removed_at: Date | null;
  @Column({ type: "int" }) agreement_id: number;
  @Column({ type: "varchar", length: 64 }) document_type_code: string;
  @Column({ type: "varchar", length: 32 }) subject: string;
  @Column({ type: "text" }) file_path: string;
  @Column({ type: "varchar", length: 255 }) file_name: string;
  @Column({ type: "varchar", length: 64 }) mime_type: string;
  @Column({ type: "int" }) byte_size: number;
  @Column({ type: "int" }) uploaded_by_user_id: number;
  @Column({ type: "varchar", length: 16, default: "pending" }) review_status:
    "pending" | "accepted" | "rejected";
  @Column({ type: "int", nullable: true }) reviewed_by_user_id: number | null;
  @Column({ type: "timestamptz", nullable: true }) reviewed_at: Date | null;
  @Column({ type: "varchar", length: 1000, nullable: true }) review_note:
    string | null;
  @Column({ type: "int", nullable: true }) supersedes_document_id:
    number | null;
  @Column({ type: "int", nullable: true }) source_document_id: number | null;
}
