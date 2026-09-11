import { MasterAgreementTypeEntity } from "../../entities/master-agreement-type.entity";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import type { AgentContract, CreateAgentContract } from "@nestyk/types";
import { LeaseContractEntity } from "../../entities/lease-contract.entity";
import { LeadEntity } from "../../entities/lead.entity";
import { TenantEntity } from "../../entities/tenant.entity";
import { RentRoomEntity } from "../../entities/rent-room.entity";
import { RoomTenancyEntity } from "../../entities/room-tenancy.entity";

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
  for (const key of ["startDate", "endDate"]) {
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
  if (String(b.endDate) <= String(b.startDate))
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
    endDate: String(b.endDate),
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
  constructor(private readonly db: DataSource) {}
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
  private serialize(c: LeaseContractEntity): AgentContract {
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
      endDate: c.end_date,
      monthlyRent: c.monthly_rent == null ? null : Number(c.monthly_rent),
      deposit: c.deposit == null ? null : Number(c.deposit),
      notes: c.notes,
      ownerSignedAt: c.owner_signed_at?.toISOString() || null,
      tenantSignedAt: c.tenant_signed_at?.toISOString() || null,
    };
  }
  async types() {
    const rows = await this.db
      .getRepository(MasterAgreementTypeEntity)
      .find({
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
    return (await this.query(agentId).orderBy("c.id", "DESC").getMany()).map(
      (c) => this.serialize(c),
    );
  }
  async view(agentId: number, id: number) {
    const c = await this.query(agentId).andWhere("c.id = :id", { id }).getOne();
    if (!c) throw new NotFoundException("ไม่พบสัญญา");
    return this.serialize(c);
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
          "c.start_date <= :end AND (c.end_date IS NULL OR c.end_date >= :start)",
          { start: b.startDate, end: b.endDate },
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
          end_date: b.endDate,
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
