import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import type { AgentTenant, CreateAgentTenant } from "@nestyk/types";
import { TenantEntity } from "../../entities/tenant.entity";
import { LeadEntity } from "../../entities/lead.entity";
import { RentRoomEntity } from "../../entities/rent-room.entity";
import { AgentContractsService } from "../contracts/agent-contracts.service";

export function validateTenant(input: unknown): CreateAgentTenant {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลผู้เช่า");
  const b = input as Record<string, unknown>;
  for (const key of ["leadId", "rentRoomId"])
    if (
      !Number.isSafeInteger(b[key]) ||
      Number(b[key]) < 1 ||
      Number(b[key]) > 2147483647
    )
      throw new BadRequestException("กรุณาเลือก Lead และห้องที่เช่า");
  for (const [key, max] of [
    ["name", 255],
    ["phone", 50],
    ["email", 255],
    ["note", 500],
  ] as const) {
    const v = b[key];
    const required = key === "name" || key === "phone";
    if (v == null && !required) continue;
    if (
      typeof v !== "string" ||
      v.trim().length > max ||
      (required && !v.trim())
    )
      throw new BadRequestException(
        "กรุณาระบุชื่อและเบอร์โทรให้ครบ และตรวจสอบความยาวข้อมูล",
      );
  }
  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new BadRequestException("รูปแบบอีเมลไม่ถูกต้อง");
  const phone = String(b.phone).trim();
  if (
    !/^[+\d\s().-]+$/.test(phone) ||
    phone.replace(/\D/g, "").length < 7 ||
    phone.replace(/\D/g, "").length > 15
  )
    throw new BadRequestException("กรุณาระบุเบอร์โทรที่ถูกต้อง");
  return {
    leadId: Number(b.leadId),
    rentRoomId: Number(b.rentRoomId),
    name: String(b.name).trim(),
    phone,
    email,
    note: typeof b.note === "string" ? b.note.trim() : "",
  };
}

@Injectable()
export class AgentTenantsService {
  constructor(
    private readonly db: DataSource,
    private readonly contracts: AgentContractsService,
  ) {}
  private query(agentId: number) {
    return this.db
      .getRepository(TenantEntity)
      .createQueryBuilder("tenant")
      .leftJoinAndSelect("tenant.lead", "lead")
      .leftJoinAndSelect("lead.rent_room", "room")
      .leftJoinAndSelect("room.property", "property")
      .where("tenant.created_by_user_id = :agentId", { agentId });
  }
  private serialize(
    t: TenantEntity,
    contracts: AgentTenant["contracts"],
  ): AgentTenant {
    return {
      id: t.id,
      leadId: t.lead_id,
      name: t.name,
      phone: t.phone,
      email: t.email,
      note: t.note,
      createdAt: t.created_at.toISOString(),
      property:
        t.lead?.rent_room?.property?.name ||
        t.lead?.rent_room?.listing_title ||
        "ยังไม่ระบุห้อง",
      room: t.lead?.rent_room?.room_id || null,
      contracts: contracts.filter((c) => c.tenantId === t.id),
    };
  }
  async list(agentId: number) {
    const [tenants, contracts] = await Promise.all([
      this.query(agentId).orderBy("tenant.id", "DESC").getMany(),
      this.contracts.list(agentId),
    ]);
    return tenants.map((t) => this.serialize(t, contracts));
  }
  async view(agentId: number, id: number) {
    const tenant = await this.query(agentId)
      .andWhere("tenant.id = :id", { id })
      .getOne();
    if (!tenant) throw new NotFoundException("ไม่พบผู้เช่า");
    return this.serialize(tenant, await this.contracts.list(agentId));
  }
  async leadOptions(agentId: number, q = "") {
    const leads = await this.db
      .getRepository(LeadEntity)
      .createQueryBuilder("lead")
      .where("lead.created_by_user_id = :agentId", { agentId })
      .andWhere("lead.tenant_id IS NULL")
      .andWhere("lead.status != :lost", { lost: "lost" })
      .andWhere("(lead.name ILIKE :q OR lead.phone ILIKE :q)", {
        q: `%${String(q).slice(0, 255)}%`,
      })
      .orderBy("lead.id", "DESC")
      .take(30)
      .getMany();
    return leads.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      email: l.email,
    }));
  }
  async roomOptions(agentId: number, q = "") {
    const rooms = await this.db
      .getRepository(RentRoomEntity)
      .createQueryBuilder("room")
      .leftJoinAndSelect("room.property", "property")
      .where("room.created_by_user_id = :agentId", { agentId })
      .andWhere(
        "(property.name ILIKE :q OR room.room_id ILIKE :q OR room.listing_title ILIKE :q)",
        { q: `%${String(q).slice(0, 255)}%` },
      )
      .orderBy("room.id", "DESC")
      .take(30)
      .getMany();
    return rooms.map((r) => ({
      id: r.id,
      property: r.property?.name || r.listing_title || "ไม่ระบุโครงการ",
      room: r.room_id,
    }));
  }
  async create(agentId: number, input: unknown) {
    const b = validateTenant(input);
    const id = await this.db.transaction(async (manager) => {
      const lead = await manager.findOne(LeadEntity, {
        where: { id: b.leadId, created_by_user_id: agentId },
        lock: { mode: "pessimistic_write" },
      });
      if (!lead) throw new NotFoundException("ไม่พบ Lead ที่คุณมีสิทธิ์จัดการ");
      if (
        lead.tenant_id ||
        (await manager.findOneBy(TenantEntity, { lead_id: lead.id }))
      )
        throw new ConflictException("Lead นี้ถูกสร้างเป็นผู้เช่าแล้ว");
      if (lead.status === "lost")
        throw new ConflictException(
          "Lead ที่ปิดเป็นไม่สำเร็จยังไม่สามารถสร้างผู้เช่าได้",
        );
      const room = await manager.findOneBy(RentRoomEntity, {
        id: b.rentRoomId,
        created_by_user_id: agentId,
      });
      if (!room) throw new NotFoundException("ไม่พบห้องที่คุณมีสิทธิ์จัดการ");
      const tenant = await manager.save(
        TenantEntity,
        manager.create(TenantEntity, {
          lead_id: lead.id,
          created_by_user_id: agentId,
          name: b.name,
          phone: b.phone,
          email: b.email || null,
          note: b.note || null,
        }),
      );
      lead.tenant_id = tenant.id;
      lead.rent_room_id = room.id;
      lead.status = "booked";
      await manager.save(LeadEntity, lead);
      return tenant.id;
    });
    return this.view(agentId, id);
  }
}
