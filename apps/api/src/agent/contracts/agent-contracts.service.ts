import { MasterAgreementTypeEntity } from "../../entities/master-agreement-type.entity";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DataSource, IsNull } from "typeorm";
import {
  MOCK_RESERVATION_VERSION,
  createReservationMock,
  stampReservationSignatures,
} from "./reservation-pdf";
import type {
  AgentContract,
  AgentContractDocumentKind,
  AgentContractSignParty,
  CreateAgentContract,
} from "@nestyk/types";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { LeadEntity } from "../../entities/lead.entity";
import { TenantEntity } from "../../entities/tenant.entity";
import { RentRoomEntity } from "../../entities/rent-room.entity";
import { RoomTenancyEntity } from "../../entities/room-tenancy.entity";
import {
  CONTRACT_DOCUMENT_KINDS,
  ContractDocumentStorageService,
} from "./contract-document-storage.service";

const DOCUMENT_COLUMNS: Record<
  AgentContractDocumentKind,
  "document_url" | "invoice_url" | "receipt_url"
> = {
  reservation_letter: "document_url",
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

export function validateSign(input: unknown): {
  parties: AgentContractSignParty[];
  png: Buffer;
} {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลลายเซ็น");
  const b = input as Record<string, unknown>;
  if (!Array.isArray(b.parties) || !b.parties.length)
    throw new BadRequestException("กรุณาเลือกฝ่ายที่ต้องการเซ็นแทน");
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
  formKind: "reservation" | "lease" = "lease",
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
  for (const key of [
    "startDate",
    formKind === "reservation" ? "moveInDate" : "endDate",
  ]) {
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
  if (b.notes != null && (typeof b.notes !== "string" || b.notes.length > 5000))
    throw new BadRequestException("หมายเหตุต้องไม่เกิน 5,000 ตัวอักษร");
  return {
    leadId: Number(b.leadId),
    startDate: String(b.startDate),
    ...(formKind === "reservation"
      ? { moveInDate: String(b.moveInDate) }
      : { endDate: String(b.endDate) }),
    ...(formKind === "reservation"
      ? { reservationFee: Number(b.reservationFee) }
      : { monthlyRent: Number(b.monthlyRent), deposit: Number(b.deposit) }),
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
  ) {}
  private query(agentId: number) {
    return this.db
      .getRepository(LeaseContractEntity)
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.rent_room", "room")
      .leftJoinAndSelect("room.property", "property")
      .leftJoinAndSelect("c.agreement_type", "agreementType")
      .leftJoinAndSelect("c.tenant", "tenant")
      .where("c.created_by_user_id = :agentId", { agentId });
  }
  private reservationDocument(c: LeaseContractEntity) {
    if (c.agreement_type?.form_kind !== "reservation") return null;
    const complete = CONTRACT_SIGN_PARTIES.every(
      (party) => c[SIGN_COLUMNS[party].at] && c[SIGN_COLUMNS[party].url],
    );
    const root = `${c.created_by_user_id}/${c.id}/`;
    const generated =
      c.document_url?.startsWith(
        `${root}generated/reservation_letter/${MOCK_RESERVATION_VERSION}/`,
      ) && c.document_url.endsWith(".pdf");
    const mock =
      c.document_url?.startsWith(
        `${root}mock/reservation_letter/${MOCK_RESERVATION_VERSION}/`,
      ) && c.document_url.endsWith(".pdf");
    return {
      status: complete
        ? generated
          ? ("ready" as const)
          : ("ready_to_generate" as const)
        : ("awaiting_signatures" as const),
      path: (generated && complete) || mock ? c.document_url : null,
    };
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
      property:
        c.rent_room?.property?.name ||
        c.rent_room?.listing_title ||
        "ไม่ระบุโครงการ",
      room: c.rent_room?.room_id || null,
      tenant: c.tenant?.name || "ไม่ระบุผู้เช่า",
      agreementTypeCode: c.agreement_type_code || "lease",
      agreementTypeName: c.agreement_type?.name_th || "สัญญาเช่า",
      formKind: c.agreement_type?.form_kind || "lease",
      reservationFee:
        c.reservation_fee == null ? null : Number(c.reservation_fee),
      status: c.status,
      startDate: c.start_date,
      endDate:
        c.agreement_type?.form_kind === "reservation" ? null : c.end_date,
      bookingDate:
        c.agreement_type?.form_kind === "reservation" ? c.start_date : null,
      moveInDate:
        c.agreement_type?.form_kind === "reservation"
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
      invoiceUrl: url(c.invoice_url),
      receiptUrl: url(c.receipt_url),
    };
  }
  private documentPaths(c: LeaseContractEntity) {
    return [
      this.reservationDocument(c)?.path,
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
    if (c.agreement_type?.form_kind !== "reservation")
      throw new BadRequestException("รองรับเฉพาะหนังสือจองห้อง");
    const state = this.reservationDocument(c)!;
    if (generate && state.status === "awaiting_signatures")
      throw new BadRequestException(
        "กรุณาลงนามให้ครบทั้ง 3 ฝ่ายก่อนสร้างเอกสาร",
      );
    if (!this.documents)
      throw new ServiceUnavailableException(
        "ยังไม่ได้ตั้งค่าที่เก็บเอกสารสัญญา",
      );
    if (state.status === "ready" || (!generate && state.path))
      return this.view(agentId, id);
    const base = state.path
      ? await this.documents.download(state.path)
      : await createReservationMock(this.serialize(c));
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
        { document_url: stored.path },
      );
      if (result.affected !== 1)
        throw new ConflictException("เอกสารถูกเปลี่ยนแล้ว กรุณาลองอีกครั้ง");
    } catch (error) {
      await this.documents.remove(stored.path).catch(() => undefined);
      throw error;
    }
    return this.view(agentId, id);
  }
  async uploadDocument(
    agentId: number,
    id: number,
    kind: string,
    file: { buffer: Buffer; size: number } | undefined,
  ) {
    if (!CONTRACT_DOCUMENT_KINDS.some((allowed) => allowed === kind))
      throw new BadRequestException("ชนิดเอกสารไม่ถูกต้อง");
    const documentKind = kind as AgentContractDocumentKind;
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if (c.agreement_type?.form_kind !== "reservation")
      throw new BadRequestException("อัปโหลดเอกสารได้เฉพาะหนังสือจองห้อง");
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
        { [DOCUMENT_COLUMNS[documentKind]]: stored.path },
      );
    return this.view(agentId, c.id);
  }
  async sign(agentId: number, id: number, input: unknown) {
    const { parties, png } = validateSign(input);
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    if (CLOSED_STATUSES.includes(c.status as (typeof CLOSED_STATUSES)[number]))
      throw new BadRequestException("สัญญานี้ไม่สามารถลงนามได้");
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
      patch.status =
        ownerAt && tenantAt && agentAt
          ? "awaiting_agent_review"
          : "awaiting_signatures";
    }
    await this.db
      .getRepository(LeaseContractEntity)
      .update({ id: c.id, created_by_user_id: agentId }, patch);
    return this.view(agentId, c.id);
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
  async create(agentId: number, input: unknown) {
    const code =
      input && typeof input === "object"
        ? ((input as Record<string, unknown>).agreementTypeCode ?? "lease")
        : "lease";
    if (typeof code !== "string" || !code || code.length > 64)
      throw new BadRequestException("กรุณาเลือกประเภทสัญญา");
    const type = await this.db
      .getRepository(MasterAgreementTypeEntity)
      .findOneBy({ code, is_active: true });
    if (!type || !["lease", "reservation"].includes(type.form_kind))
      throw new BadRequestException("ประเภทสัญญานี้ยังไม่เปิดใช้งาน");
    const b = validateContract(input, type.form_kind);
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
      const overlap = await manager
        .getRepository(LeaseContractEntity)
        .createQueryBuilder("c")
        .leftJoin("c.agreement_type", "agreementType")
        .where("c.rent_room_id = :roomId", { roomId: room.id })
        // A tenant's own reservation must not block their subsequent lease.
        .andWhere(
          "NOT (agreementType.form_kind = 'reservation' AND c.tenant_id = :tenantId AND :isLease = TRUE)",
          { tenantId: tenant.id, isLease: type.form_kind === "lease" },
        )
        .andWhere("c.status NOT IN (:...closed)", {
          closed: ["cancelled", "expired", "terminated"],
        })
        .andWhere(
          "(CAST(:end AS date) IS NULL OR (CASE WHEN agreementType.form_kind = 'reservation' THEN COALESCE(c.move_in_date, c.start_date) ELSE c.start_date END) <= :end) AND (agreementType.form_kind = 'reservation' OR c.end_date IS NULL OR c.end_date >= :start)",
          {
            start:
              type.form_kind === "reservation" ? b.moveInDate : b.startDate,
            end: type.form_kind === "reservation" ? null : b.endDate,
          },
        )
        .getCount();
      if (overlap)
        throw new ConflictException(
          "ห้องนี้มีสัญญาในช่วงวันที่เลือกแล้ว กรุณาตรวจสอบรายการสัญญา",
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
      const contract = await manager.save(
        LeaseContractEntity,
        manager.create(LeaseContractEntity, {
          lead_id: lead.id,
          tenant_id: tenant.id,
          rent_room_id: room.id,
          room_tenancy_id: tenancy.id,
          property_owner_id: room.property_owner_id,
          owner_user_id: room.owner_id,
          created_by_user_id: agentId,
          start_date: b.startDate,
          end_date: type.form_kind === "reservation" ? null : b.endDate,
          move_in_date: type.form_kind === "reservation" ? b.moveInDate : null,
          agreement_type_code: type.code,
          reservation_fee:
            b.reservationFee == null ? null : b.reservationFee.toFixed(2),
          monthly_rent: b.monthlyRent == null ? null : b.monthlyRent.toFixed(2),
          deposit: b.deposit == null ? null : b.deposit.toFixed(2),
          notes: b.notes || null,
          status: "draft",
        }),
      );
      return contract.id;
    });
    return this.view(agentId, id);
  }
}
