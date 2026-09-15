import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { SerialCreatedEntity } from "./base.entity";
import { LeaseContractEntity } from "./lease-contract.entity";
import { UserEntity } from "./user.entity";

@Entity({ name: "agreement_sign_invites" })
export class AgreementSignInviteEntity extends SerialCreatedEntity {
  @Column({ type: "int" }) agreement_id: number;
  @ManyToOne(() => LeaseContractEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agreement_id" })
  agreement: LeaseContractEntity;

  @Column({ type: "varchar", length: 16 }) party: "owner" | "tenant";

  @Column({ type: "char", length: 64 }) token_hash: string;

  @Column({ type: "timestamptz" }) expires_at: Date;

  @Column({ type: "timestamptz", nullable: true }) used_at: Date | null;

  @Column({ type: "timestamptz", nullable: true }) revoked_at: Date | null;

  @Column({ type: "int" }) created_by_user_id: number;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_user_id" })
  created_by: UserEntity;
}
