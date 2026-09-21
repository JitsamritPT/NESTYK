import { financialKind, validateFinancialDocument, buildReceiptFromInvoice } from "./financial-document";
import { createFinancialPdf } from "./financial-pdf";
import type { FinancialDocumentInput } from "@nestyk/types";
import {
  AgreementAttachmentsService,
  reservationLetterFinalized,
} from "./agreement-attachments.service";
import { PropertyEntity } from "../../entities/property.entity";
import { AgreementTemplateEntity } from "../../entities/agreement-template.entity";
import { PropertyOwnerEntity } from "../../entities/property-owner.entity";
import { UserEntity } from "../../entities/user.entity";
import { validateAgreementData } from "./agreement-data";
import { MasterAgreementTypeEntity } from "../../entities/master-agreement-type.entity";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { DataSource, EntityManager, IsNull } from "typeorm";
import {
  MOCK_RESERVATION_VERSION,
  createReservationMock,
  stampReservationSignatures,
} from "./reservation-pdf";
import {
  BROKER_APPOINTMENT_VERSION,
  createBrokerAppointmentPdf,
  stampBrokerAppointmentSignatures,
} from "./broker-appointment-pdf";
import {
  LEASE_AGREEMENT_VERSION,
  createLeaseAgreementPdf,
  stampLeaseAgreementSignatures,
} from "./lease-agreement-pdf";
import {
  validateBrokerAppointment,
  brokerAppointmentSnapshot,
  pickBrokerRentFromRoom,
} from "./broker-appointment";
import {
  validateLeaseAgreement,
  leaseAgreementSnapshot,
  emptyLeaseAgreement,
  pickLeaseRentFromRoom,
} from "./lease-agreement";
import { validateReservationLetter, emptyReservationLetter } from "./reservation-letter";
import type {
  AgentContract,
  AgentContractDocumentKind,
  AgentContractSignParty,
  BrokerAppointmentInput,
  CreateAgentContract,
  LeaseAgreementInput,
  ReservationLetterInput,
} from "@nestyk/types";
import { AgreementSignInviteEntity } from "../../entities/agreement-sign-invite.entity";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { LeadEntity } from "../../entities/lead.entity";
import { TenantEntity } from "../../entities/tenant.entity";
import { RentRoomEntity } from "../../entities/rent-room.entity";
import { RoomTenancyEntity } from "../../entities/room-tenancy.entity";
import {
  CONTRACT_DOCUMENT_KINDS,
  ContractDocumentStorageService,
} from "./contract-document-storage.service";

const SIGN_INVITE_TTL_MS = 15 * 60 * 1000;
const SHAREABLE_SIGN_PARTIES = ["owner", "tenant"] as const;

const DOCUMENT_COLUMNS: Record<
  AgentContractDocumentKind,
  "document_url" | "invoice_url" | "receipt_url"
> = {
  reservation_letter: "document_url",
  lease_agreement: "document_url",
  broker_appointment: "document_url",
  invoice: "invoice_url",
  receipt: "receipt_url",
};
export const CONTRACT_SIGN_PARTIES = [
  "owner",
  "tenant",
  "agent",
] as const satisfies readonly AgentContractSignParty[];
const SIGN_COLUMNS: Record<
  AgentContractSignParty,
  {
    at: "owner_signed_at" | "tenant_signed_at" | "agent_signed_at";
    url: "owner_signature_url" | "tenant_signature_url" | "agent_signature_url";
  }
> = {
  owner: { at: "owner_signed_at", url: "owner_signature_url" },
  tenant: { at: "tenant_signed_at", url: "tenant_signature_url" },
  agent: { at: "agent_signed_at", url: "agent_signature_url" },
};
const CLOSED_STATUSES = [
  "cancelled",
  "expired",
  "terminated",
  "active",
  "awaiting_payment",
  "awaiting_payment_verification",
] as const;
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const CONTRACT_NO_PATTERN = /^(RS|LS|BA)(\d{4})(\d{5})$/;

export function contractNoPrefix(
  formKind: "reservation" | "lease" | "broker_appointment",
) {
  if (formKind === "reservation") return "RS";
  if (formKind === "broker_appointment") return "BA";
  return "LS";
}

export function contractYear(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
    }).format(date),
  );
}

export function formatContractNo(
  prefix: "RS" | "LS" | "BA",
  year: number,
  seq: number,
) {
  if (!Number.isInteger(seq) || seq < 1 || seq > 99999)
    throw new ConflictException("เลขที่สัญญาเต็มสำหรับปีนี้แล้ว");
  return `${prefix}${year}${String(seq).padStart(5, "0")}`;
}

export function parseContractSeq(contractNo: string | null | undefined) {
  const match = contractNo?.match(CONTRACT_NO_PATTERN);
  return match ? Number(match[3]) : null;
}

export async function nextContractNo(
  manager: EntityManager,
  formKind: "reservation" | "lease" | "broker_appointment",
  at = new Date(),
) {
  const prefix = contractNoPrefix(formKind);
  const year = contractYear(at);
  const lockKey =
    (prefix === "RS" ? 700_000_000 : prefix === "BA" ? 750_000_000 : 800_000_000) +
    year;
  await manager.query("SELECT pg_advisory_xact_lock($1)", [lockKey]);
  const rows = (await manager.query(
    `SELECT contract_no FROM lease_contracts
     WHERE contract_no LIKE $1
     ORDER BY contract_no DESC
     LIMIT 1`,
    [`${prefix}${year}%`],
  )) as Array<{ contract_no: string }>;
  const lastSeq = parseContractSeq(rows[0]?.contract_no) ?? 0;
  return formatContractNo(prefix, year, lastSeq + 1);
}

export function validateSign(input: unknown): {
  parties: AgentContractSignParty[];
  png: Buffer;
} {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลลายเซ็น");
  const b = input as Record<string, unknown>;
  if (!Array.isArray(b.parties) || !b.parties.length)
    throw new BadRequestException("กรุณาเลือกฝ่ายที่ต้องการลงนาม");
  if (
    b.parties.some(
      (party) =>
        !CONTRACT_SIGN_PARTIES.includes(party as AgentContractSignParty),
    )
  )
    throw new BadRequestException("ฝ่ายที่ลงนามไม่ถูกต้อง");
  const parties = [...new Set(b.parties as AgentContractSignParty[])];
  if (typeof b.signaturePng !== "string" || !b.signaturePng.trim())
    throw new BadRequestException("กรุณาวาดลายเซ็นก่อนยืนยัน");
  const raw = b.signaturePng.replace(/^data:image\/png;base64,/i, "");
  let png: Buffer;
  try {
    png = Buffer.from(raw, "base64");
  } catch {
    throw new BadRequestException("ลายเซ็นไม่ถูกต้อง");
  }
  if (
    png.length < 32 ||
    png.length > MAX_SIGNATURE_BYTES ||
    png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  )
    throw new BadRequestException("ลายเซ็นต้องเป็นไฟล์ PNG");
  return { parties, png };
}

export function validateContract(
  input: unknown,
  formKind: "reservation" | "lease" | "broker_appointment" = "lease",
): CreateAgentContract {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลสัญญา");
  const b = input as Record<string, unknown>;
  if (
    !Number.isSafeInteger(b.leadId) ||
    Number(b.leadId) < 1 ||
    Number(b.leadId) > 2147483647
  )
    throw new BadRequestException("กรุณาเลือกผู้เช่า");
  const dateKey =
    formKind === "reservation"
      ? "moveInDate"
      : formKind === "lease"
        ? "endDate"
        : null;
  for (const key of ["startDate", ...(dateKey ? [dateKey] : [])]) {
    const value = b[key];
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number(value.slice(0, 4)) < 1900 ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException("วันที่ต้องเป็น ค.ศ. ในรูปแบบ YYYY-MM-DD");
  }
  if (formKind === "reservation" && String(b.moveInDate) < String(b.startDate))
    throw new BadRequestException("วันที่เข้าอยู่ต้องไม่ก่อนวันที่จอง");
  if (formKind === "lease" && String(b.endDate) <= String(b.startDate))
    throw new BadRequestException("วันสิ้นสุดต้องอยู่หลังวันเริ่มสัญญา");
  if (formKind !== "broker_appointment") {
    for (const key of formKind === "reservation"
      ? ["reservationFee"]
      : ["monthlyRent", "deposit"]) {
      const v = b[key];
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < 0 ||
        (key === "monthlyRent" && v === 0) ||
        v > 9999999999.99 ||
        Math.abs(v * 100 - Math.round(v * 100)) > 0.001
      )
        throw new BadRequestException(
          "จำนวนเงินต้องถูกต้อง ทศนิยมไม่เกิน 2 ตำแหน่ง",
        );
    }
  }
  if (b.notes != null && (typeof b.notes !== "string" || b.notes.length > 5000))
    throw new BadRequestException("หมายเหตุต้องไม่เกิน 5,000 ตัวอักษร");
  return {
    leadId: Number(b.leadId),
    startDate: String(b.startDate),
    ...(formKind === "reservation"
      ? { moveInDate: String(b.moveInDate) }
      : formKind === "lease"
        ? { endDate: String(b.endDate) }
        : {}),
    ...(formKind === "reservation"
      ? { reservationFee: Number(b.reservationFee) }
      : formKind === "lease"
        ? { monthlyRent: Number(b.monthlyRent), deposit: Number(b.deposit) }
        : {}),
    ...(b.agreementTypeCode
      ? { agreementTypeCode: String(b.agreementTypeCode) }
      : {}),
    notes: typeof b.notes === "string" ? b.notes.trim() : undefined,
  };
}

@Injectable()
export class AgentContractsService {
  constructor(
    private readonly db: DataSource,
    private readonly documents?: ContractDocumentStorageService,
    @Optional() private readonly attachments?: AgreementAttachmentsService,
  ) {}
  private query(agentId: number) {
    return this.db
      .getRepository(LeaseContractEntity)
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.rent_room", "room")
      .leftJoinAndSelect("room.property", "property")
      .leftJoinAndSelect("c.agreement_type", "agreementType")
      .leftJoinAndSelect("c.template", "template")
      .leftJoinAndSelect("c.tenant", "tenant")
      .where("c.created_by_user_id = :agentId", { agentId });
  }
  private reservationDocument(c: LeaseContractEntity) {
    if (
      (c.template?.form_kind ?? c.agreement_type?.form_kind) !== "reservation"
    )
      return null;
    const complete = CONTRACT_SIGN_PARTIES.every(
      (party) => c[SIGN_COLUMNS[party].at] && c[SIGN_COLUMNS[party].url],
    );
    const root = `${c.created_by_user_id}/${c.id}/`;
    const versionOk = (kind: "generated" | "mock") =>
      ["letter-v1", "mock-v2"].some(
        (version) =>
          c.document_url?.startsWith(
            `${root}${kind}/reservation_letter/${version}/`,
          ) && c.document_url.endsWith(".pdf"),
      );
    const generated = versionOk("generated");
    const mock = versionOk("mock");
    return {
      status: complete
        ? generated
          ? ("ready" as const)
          : ("ready_to_generate" as const)
        : ("awaiting_signatures" as const),
      path: (generated && complete) || mock ? c.document_url : null,
    };
  }
  private brokerDocument(c: LeaseContractEntity) {
    if (
      (c.template?.form_kind ?? c.agreement_type?.form_kind) !==
      "broker_appointment"
    )
      return null;
    const complete = (["owner", "agent"] as const).every(
      (party) => c[SIGN_COLUMNS[party].at] && c[SIGN_COLUMNS[party].url],
    );
    const root = `${c.created_by_user_id}/${c.id}/`;
    const versionOk = (kind: "generated" | "mock") =>
      c.document_url?.startsWith(
        `${root}${kind}/broker_appointment/${BROKER_APPOINTMENT_VERSION}/`,
      ) && c.document_url.endsWith(".pdf");
    const generated = versionOk("generated");
    const mock = versionOk("mock");
    return {
      status: complete
        ? generated
          ? ("ready" as const)
          : ("ready_to_generate" as const)
        : ("awaiting_signatures" as const),
      path: (generated && complete) || mock ? c.document_url : null,
    };
  }
  private leaseDocument(c: LeaseContractEntity) {
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "lease")
      return null;
    const templateKey = c.template?.document_template_key ?? "";
    if (templateKey && templateKey !== "lease/v1") {
      return {
        status: null,
        path: c.document_url?.endsWith(".pdf") ? c.document_url : null,
      };
    }
    const complete = (["owner", "tenant"] as const).every(
      (party) => c[SIGN_COLUMNS[party].at] && c[SIGN_COLUMNS[party].url],
    );
    const root = `${c.created_by_user_id}/${c.id}/`;
    const versionOk = (kind: "generated" | "mock") =>
      c.document_url?.startsWith(
        `${root}${kind}/lease_agreement/${LEASE_AGREEMENT_VERSION}/`,
      ) && c.document_url.endsWith(".pdf");
    const generated = versionOk("generated");
    const mock = versionOk("mock");
    return {
      status: complete
        ? generated
          ? ("ready" as const)
          : ("ready_to_generate" as const)
        : ("awaiting_signatures" as const),
      path: (generated && complete) || mock ? c.document_url : null,
    };
  }
  /** After a stamped letter exists, the agreement is view-only. */
  private assertDocumentMutable(c: LeaseContractEntity) {
    if (
      this.reservationDocument(c)?.status === "ready" ||
      reservationLetterFinalized(c)
    )
      throw new BadRequestException("สร้างเอกสารหนังสือจองแล้ว แก้ไขไม่ได้");
    if (
      this.brokerDocument(c)?.status === "ready" ||
      !!(
        c.document_url?.includes("/generated/broker_appointment/") &&
        c.document_url.endsWith(".pdf")
      )
    )
      throw new BadRequestException(
        "สร้างเอกสารแต่งตั้งนายหน้าแล้ว แก้ไขไม่ได้",
      );
    if (
      this.leaseDocument(c)?.status === "ready" ||
      !!(
        c.document_url?.includes("/generated/lease_agreement/") &&
        c.document_url.endsWith(".pdf")
      )
    )
      throw new BadRequestException("สร้างเอกสารสัญญาเช่าแล้ว แก้ไขไม่ได้");
  }

  private serialize(
    c: LeaseContractEntity,
    signed = new Map<string, string>(),
  ): AgentContract {
    const url = (path: string | null | undefined) =>
      (path && signed.get(path)) || null;
    return {
      id: c.id,
      tenantId: c.tenant_id,
      leadId: c.lead_id,
      contractNo: c.contract_no || `EC-${c.id}`,
      templateId: c.template_id ?? null,
      templateVersion: c.template?.version ?? null,
      agreementKind: c.agreement_kind ?? "new",
      previousAgreementId: c.previous_agreement_id ?? null,
      rootAgreementId: c.root_agreement_id ?? c.id,
      data: c.data ?? {},
      property:
        (c.party_snapshot?.property as string) ||
        c.rent_room?.property?.name ||
        c.rent_room?.listing_title ||
        "ไม่ระบุโครงการ",
      room: (c.party_snapshot?.room as string) || c.rent_room?.room_id || null,
      tenant:
        (c.party_snapshot?.tenantName as string) ||
        c.tenant?.name ||
        "ไม่ระบุผู้เช่า",
      agreementTypeCode: c.agreement_type_code || "lease",
      agreementTypeName:
        c.template?.name || c.agreement_type?.name_th || "สัญญาเช่า",
      formKind:
        (c.template?.form_kind ?? c.agreement_type?.form_kind) || "lease",
      reservationFee:
        c.reservation_fee == null ? null : Number(c.reservation_fee),
      status: c.status,
      startDate: c.start_date,
      endDate:
        (c.template?.form_kind ?? c.agreement_type?.form_kind) === "reservation"
          ? null
          : c.end_date,
      bookingDate:
        (c.template?.form_kind ?? c.agreement_type?.form_kind) === "reservation"
          ? c.start_date
          : null,
      moveInDate:
        (c.template?.form_kind ?? c.agreement_type?.form_kind) === "reservation"
          ? (c.move_in_date ?? null)
          : null,
      monthlyRent: c.monthly_rent == null ? null : Number(c.monthly_rent),
      deposit: c.deposit == null ? null : Number(c.deposit),
      notes: c.notes,
      ownerSignedAt: c.owner_signed_at?.toISOString() || null,
      tenantSignedAt: c.tenant_signed_at?.toISOString() || null,
      agentSignedAt: c.agent_signed_at?.toISOString() || null,
      ownerSignatureUrl: url(c.owner_signature_url),
      tenantSignatureUrl: url(c.tenant_signature_url),
      agentSignatureUrl: url(c.agent_signature_url),
      reservationLetterUrl: url(this.reservationDocument(c)?.path),
      reservationLetterStatus: this.reservationDocument(c)?.status ?? null,
      brokerAppointmentUrl: url(this.brokerDocument(c)?.path),
      brokerAppointmentStatus: this.brokerDocument(c)?.status ?? null,
      leaseDocumentUrl: url(this.leaseDocument(c)?.path ?? (
        (c.template?.form_kind ?? c.agreement_type?.form_kind) === "lease"
          ? c.document_url
          : null
      )),
      leaseAgreementStatus: this.leaseDocument(c)?.status ?? null,
      invoiceUrl: url(c.invoice_url),
      receiptUrl: url(c.receipt_url),
    };
  }
  private documentPaths(c: LeaseContractEntity) {
    return [
      this.reservationDocument(c)?.path,
      this.brokerDocument(c)?.path,
      this.leaseDocument(c)?.path ??
        ((c.template?.form_kind ?? c.agreement_type?.form_kind) === "lease"
          ? c.document_url
          : null),
      c.invoice_url,
      c.receipt_url,
      c.owner_signature_url,
      c.tenant_signature_url,
      c.agent_signature_url,
    ];
  }
  private async signedFor(rows: LeaseContractEntity[]) {
    if (!this.documents) return new Map<string, string>();
    return this.documents.signPaths(
      rows.flatMap((row) => this.documentPaths(row)),
    );
  }
  async types() {
    const rows = await this.db.getRepository(MasterAgreementTypeEntity).find({
      where: { is_active: true },
      order: { sort_order: "ASC", id: "ASC" },
    });
    return rows.map((row) => ({
      code: row.code,
      nameTh: row.name_th,
      nameEn: row.name_en,
      icon: row.icon,
      formKind: row.form_kind,
    }));
  }
  async templates(code: string) {
    const type = await this.db
      .getRepository(MasterAgreementTypeEntity)
      .findOneBy({ code, is_active: true });
    if (!type) throw new NotFoundException("ไม่พบประเภทสัญญา");
    const rows = await this.db.getRepository(AgreementTemplateEntity).find({
      where: { agreement_type_code: code, is_active: true },
      order: { version: "DESC" },
    });
    return rows.map((t) => ({
      id: t.id,
      agreementTypeCode: t.agreement_type_code,
      version: t.version,
      name: t.name,
      formKind: t.form_kind,
      dataSchema: t.data_schema,
    }));
  }
  async history(agentId: number, id: number) {
    const current = await this.view(agentId, id);
    const rows = await this.query(agentId)
      .andWhere("(c.root_agreement_id = :root OR c.id = :root)", {
        root: current.rootAgreementId,
      })
      .orderBy("c.id", "ASC")
      .getMany();
    return rows.map((c) => this.serialize(c));
  }
  async list(agentId: number) {
    const rows = await this.query(agentId).orderBy("c.id", "DESC").getMany();
    const signed = await this.signedFor(rows);
    return rows.map((c) => this.serialize(c, signed));
  }
  async view(agentId: number, id: number) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    return this.serialize(c, await this.signedFor([c]));
  }
  async reservationPdf(agentId: number, id: number, generate: boolean) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if (
      (c.template?.form_kind ?? c.agreement_type?.form_kind) !== "reservation"
    )
      throw new BadRequestException("รองรับเฉพาะหนังสือจองห้อง");
    if (
      c.template &&
      !["reservation/mock-v2", "reservation/letter-v1"].includes(
        c.template.document_template_key ?? "",
      )
    )
      throw new BadRequestException("แม่แบบนี้ยังไม่รองรับการสร้างเอกสารจอง");
    const state = this.reservationDocument(c)!;
    if (generate && state.status === "awaiting_signatures")
      throw new BadRequestException(
        "กรุณาลงนามให้ครบทั้ง 3 ฝ่ายก่อนสร้างเอกสาร",
      );
    if (!this.documents)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    if (state.status === "ready") return this.view(agentId, id);
    // Always rebuild from the current letter fields so 「ดูหนังสือจอง」
    // shows the filled template, not a stale blank/mock preview.
    const serialized = this.serialize(c);
    const snap = (c.party_snapshot ?? {}) as Record<string, unknown>;
    const existing = (serialized.data?.reservationLetter ??
      null) as Record<string, unknown> | null;
    if (!existing || typeof existing !== "object") {
      serialized.data = {
        ...serialized.data,
        reservationLetter: {
          tenantPhone: String(snap.tenantPhone ?? ""),
          tenantId: String(snap.tenantIdNumber ?? ""),
          tenantNationality: String(snap.tenantNationality ?? ""),
          landlordName: String(snap.ownerName ?? ""),
          landlordPhone: String(snap.ownerPhone ?? ""),
          landlordId: String(snap.ownerIdNumber ?? ""),
          agentName: String(snap.agentName ?? ""),
          agentPhone: String(snap.agentPhone ?? ""),
          address: String(snap.propertyAddress ?? ""),
          payee: String(snap.ownerName ?? ""),
          landlordSignName: String(snap.ownerName ?? ""),
          agentSignName: String(snap.agentName ?? ""),
        },
      };
    }
    const base = await createReservationMock(serialized);
    let pdf = base;
    if (generate) {
      const signatures = await Promise.all(
        CONTRACT_SIGN_PARTIES.map(async (party) => {
          const path = c[SIGN_COLUMNS[party].url]!;
          if (!path.startsWith(`${agentId}/${id}/signatures/`))
            throw new BadRequestException("ไฟล์ลายเซ็นไม่ตรงกับสัญญา");
          return this.documents!.download(path);
        }),
      );
      try {
        pdf = await stampReservationSignatures(base, signatures);
      } catch {
        throw new BadRequestException(
          "ไม่สามารถอ่านภาพลายเซ็นเพื่อสร้าง PDF ได้",
        );
      }
    }
    const stored = await this.documents.uploadReservationPdf(
      agentId,
      id,
      pdf,
      generate,
    );
    try {
      // Compare-and-swap prevents a slow preview from replacing a generated PDF.
      const result = await this.db.getRepository(LeaseContractEntity).update(
        {
          id,
          created_by_user_id: agentId,
          document_url: c.document_url ?? IsNull(),
        },
        {
          document_url: stored.path,
          ...(generate &&
          ["draft", "awaiting_signatures", "awaiting_agent_review"].includes(
            c.status,
          )
            ? { status: "active" as const }
            : {}),
        },
      );
      if (result.affected !== 1)
        throw new ConflictException("เอกสารถูกเปลี่ยนแล้ว กรุณาลองอีกครั้ง");
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    return this.view(agentId, id);
  }

  async brokerAppointmentPdf(agentId: number, id: number, generate: boolean) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if (
      (c.template?.form_kind ?? c.agreement_type?.form_kind) !==
      "broker_appointment"
    )
      throw new BadRequestException("รองรับเฉพาะสัญญาแต่งตั้งนายหน้า");
    if (
      c.template &&
      c.template.document_template_key !== "broker_appointment/v1"
    )
      throw new BadRequestException(
        "แม่แบบนี้ยังไม่รองรับการสร้างเอกสารแต่งตั้งนายหน้า",
      );
    const state = this.brokerDocument(c)!;
    if (generate && state.status === "awaiting_signatures")
      throw new BadRequestException(
        "กรุณาลงนามให้ครบทั้งผู้ให้เช่าและนายหน้าก่อนสร้างเอกสาร",
      );
    if (!this.documents)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    if (state.status === "ready") return this.view(agentId, id);
    const saved = (c.data?.brokerAppointment ?? null) as
      | BrokerAppointmentInput
      | null;
    if (!saved)
      throw new BadRequestException("ไม่พบข้อมูลฟอร์มแต่งตั้งนายหน้า");
    const data: BrokerAppointmentInput = {
      ...saved,
      documentNo: saved.documentNo || c.contract_no || `BA-${c.id}`,
      landlordSignName: saved.landlordName || saved.landlordSignName || "",
      brokerSignName:
        saved.brokerSignName || saved.brokerContact || "",
      landlordSignaturePng: "",
      brokerSignaturePng: "",
    };
    const base = await createBrokerAppointmentPdf(data);
    let pdf = base;
    if (generate) {
      const ownerPath = c.owner_signature_url!;
      const agentPath = c.agent_signature_url!;
      if (
        !ownerPath.startsWith(`${agentId}/${id}/signatures/`) ||
        !agentPath.startsWith(`${agentId}/${id}/signatures/`)
      )
        throw new BadRequestException("ไฟล์ลายเซ็นไม่ตรงกับสัญญา");
      try {
        pdf = await stampBrokerAppointmentSignatures(base, {
          owner: await this.documents.download(ownerPath),
          agent: await this.documents.download(agentPath),
        });
      } catch {
        throw new BadRequestException(
          "ไม่สามารถอ่านภาพลายเซ็นเพื่อสร้าง PDF ได้",
        );
      }
    }
    const stored = await this.documents.uploadBrokerAppointmentPdf(
      agentId,
      id,
      pdf,
      generate,
    );
    try {
      const result = await this.db.getRepository(LeaseContractEntity).update(
        {
          id,
          created_by_user_id: agentId,
          document_url: c.document_url ?? IsNull(),
        },
        {
          document_url: stored.path,
          ...(generate &&
          ["draft", "awaiting_signatures", "awaiting_agent_review"].includes(
            c.status,
          )
            ? { status: "active" as const }
            : {}),
        },
      );
      if (result.affected !== 1)
        throw new ConflictException("เอกสารถูกเปลี่ยนแล้ว กรุณาลองอีกครั้ง");
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    return this.view(agentId, id);
  }

  async leaseAgreementPdf(agentId: number, id: number, generate: boolean) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "lease")
      throw new BadRequestException("รองรับเฉพาะสัญญาเช่า");
    if (c.template && c.template.document_template_key !== "lease/v1")
      throw new BadRequestException(
        "แม่แบบนี้ยังไม่รองรับการสร้างเอกสารสัญญาเช่า",
      );
    const state = this.leaseDocument(c)!;
    if (generate && state.status === "awaiting_signatures")
      throw new BadRequestException(
        "กรุณาลงนามให้ครบทั้งผู้ให้เช่าและผู้เช่าก่อนสร้างเอกสาร",
      );
    if (!this.documents)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    if (state.status === "ready") return this.view(agentId, id);
    const saved = (c.data?.leaseAgreement ?? null) as LeaseAgreementInput | null;
    if (!saved)
      throw new BadRequestException("ไม่พบข้อมูลฟอร์มสัญญาเช่า");
    const data: LeaseAgreementInput = {
      ...saved,
      documentNo: saved.documentNo || c.contract_no || `LS-${c.id}`,
      landlordSignName: saved.landlordName || saved.landlordSignName || "",
      tenantSignName: saved.tenantName || saved.tenantSignName || "",
      witnessSignName: saved.witnessSignName || saved.agentContact || "",
      landlordSignaturePng: "",
      tenantSignaturePng: "",
    };
    const base = await createLeaseAgreementPdf(data);
    let pdf = base;
    if (generate) {
      const ownerPath = c.owner_signature_url!;
      const tenantPath = c.tenant_signature_url!;
      if (
        !ownerPath.startsWith(`${agentId}/${id}/signatures/`) ||
        !tenantPath.startsWith(`${agentId}/${id}/signatures/`)
      )
        throw new BadRequestException("ไฟล์ลายเซ็นไม่ตรงกับสัญญา");
      try {
        pdf = await stampLeaseAgreementSignatures(base, {
          owner: await this.documents.download(ownerPath),
          tenant: await this.documents.download(tenantPath),
        });
      } catch {
        throw new BadRequestException(
          "ไม่สามารถอ่านภาพลายเซ็นเพื่อสร้าง PDF ได้",
        );
      }
    }
    const stored = await this.documents.uploadLeaseAgreementPdf(
      agentId,
      id,
      pdf,
      generate,
    );
    try {
      const result = await this.db.getRepository(LeaseContractEntity).update(
        {
          id,
          created_by_user_id: agentId,
          document_url: c.document_url ?? IsNull(),
        },
        {
          document_url: stored.path,
          ...(generate &&
          ["draft", "awaiting_signatures", "awaiting_agent_review"].includes(
            c.status,
          )
            ? { status: "active" as const }
            : {}),
        },
      );
      if (result.affected !== 1)
        throw new ConflictException("เอกสารถูกเปลี่ยนแล้ว กรุณาลองอีกครั้ง");
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    return this.view(agentId, id);
  }

  async financialDocumentDefaults(agentId: number, id: number, kindInput: string) {
    const kind = financialKind(kindInput);
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if ((c.template?.form_kind ?? c.agreement_type?.form_kind) !== "reservation")
      throw new BadRequestException("สร้างเอกสารได้เฉพาะหนังสือจองห้อง");
    const saved = (c.data?.financialDocuments ?? {}) as Partial<Record<string, FinancialDocumentInput>>;
    if (kind === "invoice" && saved.invoice) return saved.invoice;
    const snapshot = c.party_snapshot ?? {};
    const owner = c.rent_room?.property_owner_id
      ? await this.db.getRepository(PropertyOwnerEntity).findOneBy({ id: c.rent_room.property_owner_id }) : null;
    const ownerUser = c.rent_room?.owner_id
      ? await this.db.getRepository(UserEntity).findOneBy({ id: c.rent_room.owner_id }) : null;
    const v = this.serialize(c);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const base: FinancialDocumentInput = {
      documentNo: `${kind === 'invoice' ? 'INV' : 'REC'}-${v.contractNo}`,
      issueDate: today, dueDate: today, reference: v.contractNo,
      customerName: v.tenant, customerAddress: String(snapshot.tenantAddress ?? ''), customerTaxId: String(snapshot.tenantTaxId ?? ''),
      customerPhone: String(snapshot.tenantPhone ?? c.tenant?.phone ?? ''),
      customerEmail: String(snapshot.tenantEmail ?? c.tenant?.email ?? ''),
      issuerName: String(snapshot.ownerName ?? owner?.name ?? (ownerUser ? `${ownerUser.first_name} ${ownerUser.last_name}`.trim() : '')), issuerAddress: String(snapshot.ownerAddress ?? ''), issuerTaxId: String(snapshot.ownerTaxId ?? ''),
      issuerPhone: String(snapshot.ownerPhone ?? owner?.phone ?? ownerUser?.phone ?? ''), issuerEmail: owner?.email ?? ownerUser?.email ?? '',
      items: [{ description: `เงินจอง ${v.property}${v.room ? ` ห้อง ${v.room}` : ''}`, quantity: 1, unitPrice: v.reservationFee ?? 0 }],
      vatRate: 0, discount: 0, paymentMethod: '', paymentDetails: [c.rent_room?.owner_bank_name, c.rent_room?.owner_bank_account].filter(Boolean).join(' '), receiverName: '', notes: '',
    };
    if (kind === 'receipt') {
      if (!saved.invoice)
        throw new BadRequestException("กรุณาสร้างใบแจ้งหนี้ก่อนสร้างใบเสร็จ");
      const prev = saved.receipt;
      return {
        ...saved.invoice,
        documentNo: prev?.documentNo || base.documentNo,
        issueDate: prev?.issueDate || today,
        reference: saved.invoice.documentNo,
        paymentMethod: prev?.paymentMethod || '',
        paymentDetails: prev?.paymentDetails || '',
        receiverName: prev?.receiverName || '',
        notes: prev?.notes || '',
      };
    }
    return base;
  }

  async generateFinancialDocument(agentId: number, id: number, kindInput: string, input: unknown) {
    const kind = financialKind(kindInput);
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    this.assertDocumentMutable(c);
    const saved = (c.data?.financialDocuments ?? {}) as Partial<Record<string, FinancialDocumentInput>>;
    let data: FinancialDocumentInput;
    if (kind === "receipt") {
      if (!saved.invoice || !c.invoice_url)
        throw new BadRequestException("กรุณาสร้างใบแจ้งหนี้ก่อนสร้างใบเสร็จ");
      const defaults = await this.financialDocumentDefaults(agentId, id, kind);
      const body =
        input && typeof input === "object" && !Array.isArray(input)
          ? (input as Partial<FinancialDocumentInput>)
          : {};
      data = buildReceiptFromInvoice(saved.invoice, body, {
        documentNo: defaults.documentNo,
        issueDate: defaults.issueDate,
      });
    } else {
      data = validateFinancialDocument(input, kind);
    }
    if (!this.documents) throw new ServiceUnavailableException("ยังไม่ได้ตั้งค่าที่เก็บเอกสาร");
    let bytes: Buffer;
    try { bytes = await createFinancialPdf(kind, data); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "สร้าง PDF ไม่สำเร็จ"); }
    const stored = await this.documents.upload(agentId, id, kind, { buffer: bytes, size: bytes.length });
    const previousReceiptPath =
      kind === "invoice" ? c.receipt_url : null;
    try {
      await this.db.transaction(async (manager) => {
        const repo = manager.getRepository(LeaseContractEntity);
        const current = await repo.findOne({ where: { id, created_by_user_id: agentId }, lock: { mode: 'pessimistic_write' } });
        if (!current) throw new NotFoundException("ไม่พบสัญญา");
        if (['cancelled', 'expired', 'terminated'].includes(current.status)) throw new BadRequestException("ไม่สามารถสร้างเอกสารให้สัญญาที่ปิดแล้ว");
        this.assertDocumentMutable(current);
        const existing = current.data ?? {};
        const financialDocuments = {
          ...((existing.financialDocuments as object) ?? {}),
          [kind]: data,
        } as Record<string, FinancialDocumentInput>;
        const documentFileNames = {
          ...((existing.documentFileNames as object) ?? {}),
          [kind]: `${kind}-${data.documentNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
        } as Record<string, string>;
        if (kind === "invoice") {
          delete financialDocuments.receipt;
          delete documentFileNames.receipt;
        }
        await repo.update(
          { id, created_by_user_id: agentId },
          {
            [DOCUMENT_COLUMNS[kind]]: stored.path,
            ...(kind === "invoice" ? { receipt_url: null } : {}),
            data: {
              ...existing,
              financialDocuments,
              documentFileNames,
            },
          },
        );
      });
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    if (previousReceiptPath)
      await this.documents.remove(previousReceiptPath).catch(() => undefined);
    return this.view(agentId, id);
  }

  async uploadDocument(
    agentId: number,
    id: number,
    kind: string,
    file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ) {
    if (!CONTRACT_DOCUMENT_KINDS.some((allowed) => allowed === kind))
      throw new BadRequestException("ชนิดเอกสารไม่ถูกต้อง");
    const documentKind = kind as AgentContractDocumentKind;
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    this.assertDocumentMutable(c);
    const formKind =
      c.template?.form_kind ?? c.agreement_type?.form_kind ?? "lease";
    if (documentKind === "lease_agreement") {
      if (formKind !== "lease")
        throw new BadRequestException("อัปโหลดสัญญาเช่าได้เฉพาะสัญญาเช่า");
    } else if (formKind !== "reservation") {
      throw new BadRequestException("อัปโหลดเอกสารได้เฉพาะหนังสือจองห้อง");
    }
    if (!this.documents)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    const stored = await this.documents.upload(
      agentId,
      c.id,
      documentKind,
      file,
    );
    await this.db
      .getRepository(LeaseContractEntity)
      .update(
        { id: c.id, created_by_user_id: agentId },
        {
          [DOCUMENT_COLUMNS[documentKind]]: stored.path,
          ...(file?.originalname ? {
            data: () => `COALESCE(data, '{}'::jsonb) || jsonb_build_object('documentFileNames', COALESCE(data->'documentFileNames', '{}'::jsonb) || ${"'" + JSON.stringify({ [documentKind]: file.originalname }).replace(/'/g, "''") + "'"}::jsonb)`,
          } : {}),
        },
      );
    return this.view(agentId, c.id);
  }
  async sign(agentId: number, id: number, input: unknown) {
    const { parties, png } = validateSign(input);
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    this.assertDocumentMutable(c);
    if (CLOSED_STATUSES.includes(c.status as (typeof CLOSED_STATUSES)[number]))
      throw new BadRequestException("สัญญานี้ไม่สามารถลงนามได้");
    const formKind =
      c.template?.form_kind ?? c.agreement_type?.form_kind ?? "lease";
    if (formKind === "broker_appointment" && parties.includes("tenant"))
      throw new BadRequestException(
        "สัญญาแต่งตั้งนายหน้าลงนามได้เฉพาะผู้ให้เช่าและนายหน้า",
      );
    if (formKind === "lease" && parties.includes("agent"))
      throw new BadRequestException(
        "สัญญาเช่าลงนามได้เฉพาะผู้ให้เช่าและผู้เช่า",
      );
    if (this.attachments) await this.attachments.assertReady(c);
    const pending = parties.filter((party) => !c[SIGN_COLUMNS[party].at]);
    if (!pending.length) throw new BadRequestException("ฝ่ายที่เลือกลงนามแล้ว");
    if (!this.documents)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    const stored = await this.documents.uploadSignature(agentId, c.id, {
      buffer: png,
      size: png.length,
    });
    const now = new Date();
    const patch: {
      owner_signed_at?: Date;
      tenant_signed_at?: Date;
      agent_signed_at?: Date;
      owner_signature_url?: string;
      tenant_signature_url?: string;
      agent_signature_url?: string;
      status?: LeaseContractEntity["status"];
    } = {};
    for (const party of pending) {
      patch[SIGN_COLUMNS[party].at] = now;
      patch[SIGN_COLUMNS[party].url] = stored.path;
    }
    const ownerAt = patch.owner_signed_at ?? c.owner_signed_at;
    const tenantAt = patch.tenant_signed_at ?? c.tenant_signed_at;
    const agentAt = patch.agent_signed_at ?? c.agent_signed_at;
    if (c.status === "draft" || c.status === "awaiting_signatures") {
      const complete =
        formKind === "broker_appointment"
          ? !!(ownerAt && agentAt)
          : formKind === "lease"
            ? !!(ownerAt && tenantAt)
            : !!(ownerAt && tenantAt && agentAt);
      patch.status = complete ? "awaiting_agent_review" : "awaiting_signatures";
    }
    try {
      await this.db
        .getRepository(LeaseContractEntity)
        .update({ id: c.id, created_by_user_id: agentId }, patch);
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      if ((error as { code?: string }).code === "23514")
        throw new BadRequestException(
          "กรุณาแนบเอกสารที่จำเป็นให้ครบก่อนลงนาม",
        );
      throw error;
    }
    return this.view(agentId, c.id);
  }
  private publicWebBase() {
    return (
      process.env.PUBLIC_WEB_URL ||
      process.env.NEXT_PUBLIC_WEB_URL ||
      process.env.WEB_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");
  }
  private hashInviteToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
  private async loadInvite(token: string) {
    if (!token || token.length < 20 || token.length > 128)
      throw new NotFoundException("ไม่พบลิงก์ลงนาม");
    const invite = await this.db
      .getRepository(AgreementSignInviteEntity)
      .findOne({ where: { token_hash: this.hashInviteToken(token) } });
    if (!invite || invite.revoked_at)
      throw new NotFoundException("ไม่พบลิงก์ลงนาม");
    if (invite.used_at)
      throw new BadRequestException("ลิงก์นี้ใช้ลงนามแล้ว");
    if (invite.expires_at.getTime() < Date.now())
      throw new BadRequestException("ลิงก์ลงนามหมดอายุแล้ว");
    const c = await this.db
      .getRepository(LeaseContractEntity)
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.rent_room", "room")
      .leftJoinAndSelect("room.property", "property")
      .leftJoinAndSelect("c.agreement_type", "agreementType")
      .leftJoinAndSelect("c.template", "template")
      .leftJoinAndSelect("c.tenant", "tenant")
      .where("c.id = :id", { id: invite.agreement_id })
      .getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    return { invite, c };
  }
  async createSignInvite(agentId: number, id: number, input: unknown) {
    const party =
      input &&
      typeof input === "object" &&
      !Array.isArray(input) &&
      typeof (input as { party?: unknown }).party === "string"
        ? (input as { party: string }).party
        : "";
    if (!SHAREABLE_SIGN_PARTIES.includes(party as "owner" | "tenant"))
      throw new BadRequestException("แชร์ลิงก์ได้เฉพาะผู้เช่าหรือผู้ให้เช่า");
    const shareParty = party as "owner" | "tenant";
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    const formKind =
      c.template?.form_kind ?? c.agreement_type?.form_kind ?? "lease";
    if (formKind === "broker_appointment" && shareParty === "tenant")
      throw new BadRequestException(
        "สัญญาแต่งตั้งนายหน้าแชร์ลิงก์ลงนามได้เฉพาะผู้ให้เช่า",
      );
    this.assertDocumentMutable(c);
    if (CLOSED_STATUSES.includes(c.status as (typeof CLOSED_STATUSES)[number]))
      throw new BadRequestException("สัญญานี้ไม่สามารถลงนามได้");
    if (c[SIGN_COLUMNS[shareParty].at])
      throw new BadRequestException("ฝ่ายนี้ลงนามแล้ว");
    if (this.attachments) await this.attachments.assertReady(c);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SIGN_INVITE_TTL_MS);
    await this.db.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(AgreementSignInviteEntity)
        .set({ revoked_at: new Date() })
        .where("agreement_id = :id", { id: c.id })
        .andWhere("party = :party", { party: shareParty })
        .andWhere("used_at IS NULL")
        .andWhere("revoked_at IS NULL")
        .execute();
      await manager.getRepository(AgreementSignInviteEntity).save(
        manager.getRepository(AgreementSignInviteEntity).create({
          agreement_id: c.id,
          party: shareParty,
          token_hash: this.hashInviteToken(token),
          expires_at: expiresAt,
          used_at: null,
          revoked_at: null,
          created_by_user_id: agentId,
        }),
      );
    });
    return {
      party: shareParty,
      url: `${this.publicWebBase()}/sign/${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }
  async publicSignPreview(token: string) {
    const { invite, c } = await this.loadInvite(token);
    const alreadySigned = !!c[SIGN_COLUMNS[invite.party].at];
    return {
      party: invite.party,
      partyLabel: invite.party === "owner" ? "ผู้ให้เช่า" : "ผู้เช่า",
      contractNo: c.contract_no,
      property:
        c.rent_room?.property?.name ||
        c.rent_room?.listing_title ||
        "ไม่ระบุโครงการ",
      room: c.rent_room?.room_id ?? null,
      tenant: c.tenant?.name ?? "",
      agreementTypeName: c.agreement_type?.name_th ?? c.agreement_type_code,
      alreadySigned,
      expiresAt: invite.expires_at.toISOString(),
    };
  }
  async publicSign(token: string, input: unknown) {
    const { invite, c } = await this.loadInvite(token);
    this.assertDocumentMutable(c);
    if (CLOSED_STATUSES.includes(c.status as (typeof CLOSED_STATUSES)[number]))
      throw new BadRequestException("สัญญานี้ไม่สามารถลงนามได้");
    if (c[SIGN_COLUMNS[invite.party].at])
      throw new BadRequestException("ฝ่ายนี้ลงนามแล้ว");
    if (this.attachments) await this.attachments.assertReady(c);
    const { png } = validateSign({
      parties: [invite.party],
      signaturePng:
        input &&
        typeof input === "object" &&
        !Array.isArray(input) &&
        typeof (input as { signaturePng?: unknown }).signaturePng === "string"
          ? (input as { signaturePng: string }).signaturePng
          : "",
    });
    if (!this.documents)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    const stored = await this.documents.uploadSignature(
      c.created_by_user_id,
      c.id,
      { buffer: png, size: png.length },
    );
    const now = new Date();
    const patch: {
      owner_signed_at?: Date;
      tenant_signed_at?: Date;
      owner_signature_url?: string;
      tenant_signature_url?: string;
      status?: LeaseContractEntity["status"];
    } = {
      [SIGN_COLUMNS[invite.party].at]: now,
      [SIGN_COLUMNS[invite.party].url]: stored.path,
    };
    const ownerAt =
      invite.party === "owner" ? now : c.owner_signed_at;
    const tenantAt =
      invite.party === "tenant" ? now : c.tenant_signed_at;
    const agentAt = c.agent_signed_at;
    if (c.status === "draft" || c.status === "awaiting_signatures") {
      const formKind =
        c.template?.form_kind ?? c.agreement_type?.form_kind ?? "lease";
      const complete =
        formKind === "broker_appointment"
          ? !!(ownerAt && agentAt)
          : formKind === "lease"
            ? !!(ownerAt && tenantAt)
            : !!(ownerAt && tenantAt && agentAt);
      patch.status = complete ? "awaiting_agent_review" : "awaiting_signatures";
    }
    try {
      await this.db.transaction(async (manager) => {
        const locked = await manager.findOne(AgreementSignInviteEntity, {
          where: { id: invite.id },
          lock: { mode: "pessimistic_write" },
        });
        if (!locked || locked.revoked_at || locked.used_at)
          throw new ConflictException("ลิงก์นี้ใช้ไม่ได้แล้ว");
        if (locked.expires_at.getTime() < Date.now())
          throw new BadRequestException("ลิงก์ลงนามหมดอายุแล้ว");
        const current = await manager.findOneBy(LeaseContractEntity, {
          id: c.id,
        });
        if (!current) throw new NotFoundException("ไม่พบสัญญา");
        if (current[SIGN_COLUMNS[invite.party].at])
          throw new BadRequestException("ฝ่ายนี้ลงนามแล้ว");
        await manager.update(LeaseContractEntity, { id: c.id }, patch);
        await manager.update(
          AgreementSignInviteEntity,
          { id: invite.id },
          { used_at: now },
        );
      });
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      if ((error as { code?: string }).code === "23514")
        throw new BadRequestException(
          "กรุณาแนบเอกสารที่จำเป็นให้ครบก่อนลงนาม",
        );
      throw error;
    }
    return { ok: true as const, party: invite.party };
  }
  async candidates(agentId: number) {
    const leads = await this.db
      .getRepository(LeadEntity)
      .createQueryBuilder("lead")
      .innerJoinAndSelect("lead.tenant", "tenant")
      .innerJoinAndSelect("lead.rent_room", "room")
      .leftJoinAndSelect("room.property", "property")
      .where("lead.created_by_user_id = :agentId", { agentId })
      .andWhere("lead.status = :status", { status: "booked" })
      .andWhere(
        "tenant.lead_id = lead.id AND tenant.created_by_user_id = :agentId",
        { agentId },
      )
      .andWhere("room.created_by_user_id = :agentId", { agentId })
      .orderBy("lead.id", "DESC")
      .getMany();
    return leads.map((l) => ({
      leadId: l.id,
      tenant: l.tenant!.name,
      property:
        l.rent_room!.property?.name ||
        l.rent_room!.listing_title ||
        "ไม่ระบุโครงการ",
      room: l.rent_room!.room_id,
    }));
  }

  async reservationDefaults(
    agentId: number,
    leadId: number,
  ): Promise<ReservationLetterInput> {
    const lead = await this.db.getRepository(LeadEntity).findOne({
      where: { id: leadId, created_by_user_id: agentId },
      relations: {
        tenant: true,
        rent_room: { property: true },
      },
    });
    if (!lead?.tenant || !lead.rent_room)
      throw new NotFoundException("ไม่พบผู้เช่าสำหรับดึงข้อมูลตั้งต้น");
    const room = lead.rent_room;
    const tenant = lead.tenant;
    const property = room.property;
    const owner = room.property_owner_id
      ? await this.db
          .getRepository(PropertyOwnerEntity)
          .findOneBy({ id: room.property_owner_id, created_by_user_id: agentId })
      : null;
    const ownerUser = room.owner_id
      ? await this.db.getRepository(UserEntity).findOneBy({ id: room.owner_id })
      : null;
    const agent = await this.db.getRepository(UserEntity).findOneBy({
      id: agentId,
    });
    const address = property
      ? [
          property.address,
          property.subdistrict,
          property.district,
          property.province,
          property.postal_code,
        ]
          .filter((part) => part && part !== "-")
          .join(" ")
      : "";
    const landlordName =
      owner?.name ??
      (ownerUser
        ? `${ownerUser.first_name ?? ""} ${ownerUser.last_name ?? ""}`.trim()
        : "");
    const agentName = agent
      ? `${agent.first_name ?? ""} ${agent.last_name ?? ""}`.trim()
      : "";
    const today = new Date().toISOString().slice(0, 10);
    return {
      ...emptyReservationLetter(),
      issueDate: today,
      tenantName: tenant.name ?? "",
      tenantPhone: tenant.phone ?? "",
      tenantId: tenant.identity_number ?? "",
      tenantNationality: tenant.nationality ?? "",
      landlordName,
      landlordPhone: owner?.phone ?? ownerUser?.phone ?? "",
      landlordId: room.owner_identity_number ?? "",
      agentName,
      agentPhone: agent?.phone ?? "",
      project: property?.name || room.listing_title || "",
      address,
      unitNo: room.room_id ?? "",
      advanceMonths:
        room.advance_rent_months != null
          ? String(room.advance_rent_months)
          : "",
      depositMonths:
        room.deposit_months != null ? String(room.deposit_months) : "",
      bankAccount: [room.owner_bank_name, room.owner_bank_account]
        .filter(Boolean)
        .join(" "),
      payee: landlordName,
      tenantSignName: tenant.name ?? "",
      landlordSignName: landlordName,
      agentSignName: agentName,
    };
  }

  async brokerAppointmentDefaults(
    agentId: number,
    leadId: number,
  ): Promise<BrokerAppointmentInput> {
    const base = await this.reservationDefaults(agentId, leadId);
    const lead = await this.db.getRepository(LeadEntity).findOne({
      where: { id: leadId, created_by_user_id: agentId },
      relations: { rent_room: { price_rows: { contract_type: true } } },
    });
    const { monthlyRent, leaseMonths } = pickBrokerRentFromRoom(
      lead?.rent_room,
      lead?.lease_duration_months,
    );
    const propertyLine = [
      base.project,
      base.unitNo ? `ห้อง ${base.unitNo}` : "",
      base.address,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      documentNo: "",
      issueDate: base.issueDate,
      landlordName: base.landlordName,
      landlordNationality: "",
      landlordId: base.landlordId,
      landlordAddress: base.address,
      landlordPhone: base.landlordPhone,
      brokerCompany: "NESTYK",
      brokerContact: base.agentName,
      brokerNationality: "ไทย",
      brokerId: "",
      brokerPhone: base.agentPhone,
      brokerAddress: "",
      propertyLine,
      monthlyRent,
      leaseMonths,
      commissionFee: "",
      commissionMonths: "",
      landlordSignName: base.landlordSignName,
      brokerSignName: base.agentSignName,
      landlordSignaturePng: "",
      brokerSignaturePng: "",
    };
  }

  async leaseDefaults(
    agentId: number,
    leadId: number,
  ): Promise<LeaseAgreementInput> {
    const base = await this.reservationDefaults(agentId, leadId);
    const lead = await this.db.getRepository(LeadEntity).findOne({
      where: { id: leadId, created_by_user_id: agentId },
      relations: {
        tenant: true,
        rent_room: {
          price_rows: { contract_type: true },
          property: { property_type: true },
          room_type: true,
          layout_values: { layout: true },
        },
      },
    });
    const room = lead?.rent_room;
    const tenant = lead?.tenant;
    const property = room?.property;
    const { monthlyRent, termMonths, advanceMonths, depositMonths } =
      pickLeaseRentFromRoom(room, lead?.lease_duration_months);
    const rentNum = Number(String(monthlyRent).replace(/,/g, ""));
    const advanceNum =
      Number.isFinite(rentNum) && advanceMonths
        ? rentNum * Number(advanceMonths)
        : NaN;
    const depositNum =
      Number.isFinite(rentNum) && depositMonths
        ? rentNum * Number(depositMonths)
        : NaN;
    const months = Number(termMonths);
    let termTo = "";
    if (base.issueDate && Number.isFinite(months) && months > 0) {
      const start = new Date(`${base.issueDate}T00:00:00Z`);
      start.setUTCMonth(start.getUTCMonth() + months);
      start.setUTCDate(start.getUTCDate() - 1);
      termTo = start.toISOString().slice(0, 10);
    }
    const floor =
      room?.layout_values?.find((row) => row.layout?.code === "floor")
        ?.value ??
      "";
    const area =
      room?.layout_values?.find((row) => row.layout?.code === "area_sqm")
        ?.value ??
      room?.layout_values?.find((row) => row.layout?.code === "area")?.value ??
      "";
    const agentContact = [base.agentName, base.agentPhone, "NESTYK"]
      .filter(Boolean)
      .join(" · ");
    return {
      ...emptyLeaseAgreement(),
      issueDate: base.issueDate,
      landlordName: base.landlordName,
      landlordId: base.landlordId,
      landlordAddress: base.address,
      landlordPhone: base.landlordPhone,
      tenantName: base.tenantName,
      tenantNationality: base.tenantNationality,
      tenantId: base.tenantId,
      tenantPhone: base.tenantPhone,
      tenantEmail: tenant?.email ?? "",
      propertyType: property?.property_type?.code ?? "",
      project: base.project,
      houseNo: base.unitNo,
      propertyAddress: base.address,
      roomType: room?.room_type?.code ?? "",
      floor,
      area,
      termMonths,
      termFrom: base.issueDate,
      termTo,
      monthlyRent,
      advanceMonths,
      advanceAmount: Number.isFinite(advanceNum) ? String(advanceNum) : "",
      depositMonths,
      depositAmount: Number.isFinite(depositNum) ? String(depositNum) : "",
      bankName: room?.owner_bank_name ?? "",
      accountName: base.landlordName,
      accountNo: room?.owner_bank_account ?? "",
      agentContact,
      landlordSignName: base.landlordName,
      tenantSignName: base.tenantName,
      witnessSignName: base.agentName,
    };
  }

  async create(agentId: number, input: unknown) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new BadRequestException("กรุณาระบุข้อมูลสัญญา");
    const code =
      input && typeof input === "object"
        ? ((input as Record<string, unknown>).agreementTypeCode ?? "lease")
        : "lease";
    if (typeof code !== "string" || !code || code.length > 64)
      throw new BadRequestException("กรุณาเลือกประเภทสัญญา");
    const type = await this.db
      .getRepository(MasterAgreementTypeEntity)
      .findOneBy({ code, is_active: true });
    if (!type || !["lease", "reservation", "broker_appointment"].includes(type.form_kind))
      throw new BadRequestException("ประเภทสัญญานี้ยังไม่เปิดใช้งาน");
    const raw = input as Record<string, unknown>;
    for (const key of ["templateId", "previousAgreementId"]) {
      if (
        raw[key] != null &&
        (!Number.isSafeInteger(raw[key]) ||
          Number(raw[key]) < 1 ||
          Number(raw[key]) > 2147483647)
      )
        throw new BadRequestException("รหัสแม่แบบหรือสัญญาอ้างอิงไม่ถูกต้อง");
    }
    const template = await this.db
      .getRepository(AgreementTemplateEntity)
      .findOne({
        where: {
          agreement_type_code: code,
          is_active: true,
          ...(raw.templateId != null ? { id: Number(raw.templateId) } : {}),
        },
        order: { version: "DESC" },
      });
    if (!template || template.form_kind !== type.form_kind)
      throw new BadRequestException("ไม่พบแม่แบบสัญญาที่เปิดใช้งาน");
    const b = validateContract(input, template.form_kind);
    const rawData =
      raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
        ? { ...(raw.data as Record<string, unknown>) }
        : {};
    let reservationLetter: ReservationLetterInput | undefined;
    let brokerAppointment: BrokerAppointmentInput | undefined;
    let leaseAgreement: LeaseAgreementInput | undefined;
    if (type.form_kind === "reservation" && rawData.reservationLetter != null) {
      reservationLetter = validateReservationLetter(rawData.reservationLetter);
      delete rawData.reservationLetter;
    }
    if (type.form_kind === "broker_appointment" && rawData.brokerAppointment != null) {
      brokerAppointment = validateBrokerAppointment(rawData.brokerAppointment);
      delete rawData.brokerAppointment;
    }
    if (type.form_kind === "lease" && rawData.leaseAgreement != null) {
      leaseAgreement = validateLeaseAgreement(rawData.leaseAgreement);
      delete rawData.leaseAgreement;
    }
    // Prefer lease form dates/money when the overlay payload is present.
    let contractInput = b;
    if (leaseAgreement) {
      const rent = Number(String(leaseAgreement.monthlyRent).replace(/,/g, ""));
      const deposit = Number(
        String(leaseAgreement.depositAmount).replace(/,/g, ""),
      );
      contractInput = {
        ...b,
        startDate: leaseAgreement.termFrom || b.startDate,
        endDate: leaseAgreement.termTo || b.endDate,
        monthlyRent: Number.isFinite(rent) && rent > 0 ? rent : b.monthlyRent,
        deposit: Number.isFinite(deposit) && deposit >= 0 ? deposit : b.deposit,
      };
    }
    const data = validateAgreementData(
      template.data_schema,
      Object.keys(rawData).length ? rawData : undefined,
      contractInput,
      template.form_kind,
    );
    if (reservationLetter) data.reservationLetter = reservationLetter;
    if (brokerAppointment)
      data.brokerAppointment = brokerAppointmentSnapshot(brokerAppointment);
    if (leaseAgreement)
      data.leaseAgreement = leaseAgreementSnapshot(leaseAgreement);
    const id = await this.db.transaction(async (manager) => {
      const lead = await manager.findOne(LeadEntity, {
        where: { id: b.leadId, created_by_user_id: agentId },
        lock: { mode: "pessimistic_write" },
      });
      if (!lead) throw new NotFoundException("ไม่พบผู้เช่า");
      if (lead.status !== "booked" || !lead.tenant_id || !lead.rent_room_id)
        throw new BadRequestException(
          "ต้องจองห้องและสร้างผู้เช่าจาก Lead ก่อนทำสัญญา",
        );
      const tenant = await manager.findOneBy(TenantEntity, {
        id: lead.tenant_id,
        lead_id: lead.id,
        created_by_user_id: agentId,
      });
      const room = await manager.findOne(RentRoomEntity, {
        where: { id: lead.rent_room_id, created_by_user_id: agentId },
        lock: { mode: "pessimistic_write" },
      });
      if (!tenant || !room)
        throw new NotFoundException("ไม่พบผู้เช่าหรือห้องที่คุณมีสิทธิ์จัดการ");
      let previous: LeaseContractEntity | null = null;
      if (raw.previousAgreementId != null) {
        previous = await manager.findOne(LeaseContractEntity, {
          where: {
            id: Number(raw.previousAgreementId),
            created_by_user_id: agentId,
          },
          lock: { mode: "pessimistic_write" },
        });
        if (!previous)
          throw new NotFoundException("ไม่พบสัญญาที่ต้องการต่ออายุ");
        const previousTemplate = await manager.findOneBy(
          AgreementTemplateEntity,
          { id: previous.template_id },
        );
        if (
          template.form_kind !== "lease" ||
          previousTemplate?.form_kind !== "lease" ||
          !["active", "expired"].includes(previous.status) ||
          previous.tenant_id !== tenant.id ||
          previous.rent_room_id !== room.id ||
          previous.lead_id !== lead.id ||
          !previous.end_date ||
          contractInput.startDate <= previous.end_date
        )
          throw new BadRequestException(
            "ต่ออายุได้เฉพาะสัญญาเช่าที่ใช้งานหรือหมดอายุ ผู้เช่าและห้องเดิม และเริ่มหลังวันสิ้นสุดเดิม",
          );
        const successor = await manager
          .getRepository(LeaseContractEntity)
          .createQueryBuilder("c")
          .where("c.previous_agreement_id = :previousId", {
            previousId: previous.id,
          })
          .andWhere("c.status <> 'cancelled'")
          .getCount();
        if (successor) throw new ConflictException("สัญญานี้มีฉบับต่ออายุแล้ว");
      }
      const overlap = await manager
        .getRepository(LeaseContractEntity)
        .createQueryBuilder("c")
        .leftJoin("c.agreement_type", "agreementType")
        .leftJoin("c.template", "contractTemplate")
        .where("c.rent_room_id = :roomId", { roomId: room.id })
        // Different form kinds may coexist on the same room/date
        // (e.g. reservation + broker appointment + lease the same day).
        .andWhere(
          "COALESCE(contractTemplate.form_kind, agreementType.form_kind) = :formKind",
          { formKind: type.form_kind },
        )
        .andWhere("c.status NOT IN (:...closed)", {
          closed: ["cancelled", "expired", "terminated"],
        })
        .andWhere(
          "(CAST(:end AS date) IS NULL OR (CASE WHEN COALESCE(contractTemplate.form_kind, agreementType.form_kind) = 'reservation' THEN COALESCE(c.move_in_date, c.start_date) ELSE c.start_date END) <= :end) AND (COALESCE(contractTemplate.form_kind, agreementType.form_kind) = 'reservation' OR c.end_date IS NULL OR c.end_date >= :start)",
          {
            start:
              type.form_kind === "reservation"
                ? contractInput.moveInDate
                : contractInput.startDate,
            end:
              type.form_kind === "reservation" ||
              type.form_kind === "broker_appointment"
                ? null
                : contractInput.endDate,
          },
        )
        .getCount();
      if (overlap)
        throw new ConflictException(
          "ห้องนี้มีสัญญาประเภทเดียวกันในช่วงวันที่เลือกแล้ว กรุณาตรวจสอบรายการสัญญา",
        );
      const tenancy = await manager.save(
        RoomTenancyEntity,
        manager.create(RoomTenancyEntity, {
          rent_room_id: room.id,
          tenant_id: tenant.id,
          created_by_user_id: agentId,
          status: "prospect",
        }),
      );
      const owner = room.property_owner_id
        ? await manager.findOneBy(PropertyOwnerEntity, {
            id: room.property_owner_id,
            created_by_user_id: agentId,
          })
        : null;
      const ownerUser = room.owner_id
        ? await manager.findOneBy(UserEntity, { id: room.owner_id })
        : null;
      const property = await manager.findOneBy(PropertyEntity, {
        id: room.properties_id,
      });
      const agent = await manager.findOneBy(UserEntity, { id: agentId });
      const contractNo = await nextContractNo(manager, type.form_kind);
      if (reservationLetter && !reservationLetter.documentNo)
        reservationLetter = { ...reservationLetter, documentNo: contractNo };
      if (reservationLetter) data.reservationLetter = reservationLetter;
      if (brokerAppointment && !brokerAppointment.documentNo)
        brokerAppointment = { ...brokerAppointment, documentNo: contractNo };
      if (brokerAppointment)
        data.brokerAppointment = brokerAppointmentSnapshot(brokerAppointment);
      if (leaseAgreement && !leaseAgreement.documentNo)
        leaseAgreement = { ...leaseAgreement, documentNo: contractNo };
      if (leaseAgreement)
        data.leaseAgreement = leaseAgreementSnapshot(leaseAgreement);
      const letterRent = reservationLetter?.monthlyRent
        ? Number(String(reservationLetter.monthlyRent).replace(/,/g, ""))
        : null;
      const letterDeposit = reservationLetter?.depositAmount
        ? Number(String(reservationLetter.depositAmount).replace(/,/g, ""))
        : null;
      const contract = await manager.save(
        LeaseContractEntity,
        manager.create(LeaseContractEntity, {
          contract_no: contractNo,
          template_id: template.id,
          data,
          party_snapshot: {
            tenantName: tenant.name,
            tenantPhone: tenant.phone,
            tenantEmail: tenant.email,
            tenantIdNumber: tenant.identity_number,
            tenantNationality: tenant.nationality,
            ownerName:
              owner?.name ??
              (ownerUser
                ? `${ownerUser.first_name} ${ownerUser.last_name}`.trim()
                : null),
            ownerPhone: owner?.phone ?? ownerUser?.phone ?? null,
            ownerIdNumber: room.owner_identity_number,
            agentName: agent
              ? `${agent.first_name} ${agent.last_name}`.trim()
              : null,
            agentPhone: agent?.phone ?? null,
            room: room.room_id,
            property: property?.name ?? room.listing_title,
            propertyAddress: property
              ? [
                  property.address,
                  property.subdistrict,
                  property.district,
                  property.province,
                  property.postal_code,
                ]
                  .filter((part) => part && part !== "-")
                  .join(" ")
              : null,
          },
          agreement_kind: previous ? "renewal" : "new",
          previous_agreement_id: previous?.id ?? null,
          root_agreement_id: previous
            ? (previous.root_agreement_id ?? previous.id)
            : null,
          lead_id: lead.id,
          tenant_id: tenant.id,
          rent_room_id: room.id,
          room_tenancy_id: tenancy.id,
          property_owner_id: room.property_owner_id,
          owner_user_id: room.owner_id,
          created_by_user_id: agentId,
          start_date: contractInput.startDate,
          end_date:
            type.form_kind === "reservation" ||
            type.form_kind === "broker_appointment"
              ? null
              : contractInput.endDate,
          move_in_date:
            type.form_kind === "reservation" ? contractInput.moveInDate : null,
          agreement_type_code: type.code,
          reservation_fee:
            contractInput.reservationFee == null
              ? null
              : contractInput.reservationFee.toFixed(2),
          monthly_rent:
            type.form_kind === "reservation"
              ? letterRent != null && Number.isFinite(letterRent)
                ? letterRent.toFixed(2)
                : null
              : contractInput.monthlyRent == null
                ? null
                : contractInput.monthlyRent.toFixed(2),
          deposit:
            type.form_kind === "reservation"
              ? letterDeposit != null && Number.isFinite(letterDeposit)
                ? letterDeposit.toFixed(2)
                : null
              : contractInput.deposit == null
                ? null
                : contractInput.deposit.toFixed(2),
          notes: contractInput.notes || null,
          status: "draft",
        }),
      );
      if (!previous)
        await manager.update(
          LeaseContractEntity,
          { id: contract.id },
          { root_agreement_id: contract.id },
        );
      return contract.id;
    });
    return this.view(agentId, id);
  }
}
