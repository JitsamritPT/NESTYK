import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreateLeadInput } from '@nestyk/types';
import { LeadEntity } from '../../entities/lead.entity';
import { MasterRoomTypeEntity } from '../../entities/master-room-type.entity';
import { MasterVisaTypeEntity } from '../../entities/master-visa-type.entity';
import { MasterContractTypeEntity } from '../../entities/master-contract-type.entity';

export function validateLead(input: unknown): CreateLeadInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Lead data is required');
  const body = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const textFields = { name: 255, phone: 50, nationality: 120, preferredLocation: 500, moveInPlan: 255, occupation: 255 };
  for (const [key, max] of Object.entries(textFields)) {
    const value = body[key];
    const required = key === 'name' || key === 'phone';
    if (value == null && !required) { result[key] = null; continue; }
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new BadRequestException(`${key} ${required ? 'is required and ' : ''}must be text up to ${max} characters`);
    result[key] = value.trim() || null;
  }
  for (const key of ['hasPets', 'usesCar', 'isSmoker']) {
    if (body[key] != null && typeof body[key] !== 'boolean') throw new BadRequestException(`${key} must be true, false or null`);
    result[key] = body[key] ?? null;
  }
  for (const key of ['leaseDurationMonths', 'occupantCount', 'desiredRoomTypeId', 'visaTypeId']) {
    const value = body[key];
    const max = key === 'desiredRoomTypeId' || key === 'visaTypeId' ? 2147483647 : 32767;
    if (value != null && (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max)) throw new BadRequestException(`${key} must be a positive whole number`);
    result[key] = value ?? null;
  }
  for (const key of ['budgetMin', 'budgetMax']) {
    const value = body[key];
    if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (key === 'budgetMax' && value === 0) || value > 9999999999.99 || Math.abs(value * 100 - Math.round(value * 100)) > 0.001)) throw new BadRequestException(`${key} must be a valid monthly budget with up to 2 decimal places`);
    result[key] = value ?? null;
  }
  if (result.budgetMin != null && result.budgetMax != null && Number(result.budgetMin) > Number(result.budgetMax)) throw new BadRequestException('Minimum budget must not exceed maximum budget');
  return result as CreateLeadInput;
}

@Injectable()
export class AgentLeadsService {
  constructor(
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(MasterRoomTypeEntity) private readonly roomTypes: Repository<MasterRoomTypeEntity>,
    @InjectRepository(MasterVisaTypeEntity) private readonly visaTypes: Repository<MasterVisaTypeEntity>,
    @InjectRepository(MasterContractTypeEntity) private readonly contractTypes: Repository<MasterContractTypeEntity>,
  ) {}

  async listVisaTypes() {
    const rows = await this.visaTypes.find({ where: { is_active: true }, order: { sort_order: 'ASC', id: 'ASC' } });
    return rows.map((row) => ({ id: row.id, code: row.code }));
  }

  async create(agentId: number, input: unknown) {
    const b = validateLead(input);
    if (b.desiredRoomTypeId != null && !await this.roomTypes.findOne({ where: { id: b.desiredRoomTypeId, is_active: true } })) throw new BadRequestException('Room type is not available');
    if (b.visaTypeId != null && !await this.visaTypes.findOne({ where: { id: b.visaTypeId, is_active: true } })) throw new BadRequestException('Visa type is not available');
    if (b.leaseDurationMonths != null && !await this.contractTypes.findOne({ where: { term_months: b.leaseDurationMonths, is_active: true } })) throw new BadRequestException('Rental duration is not available');
    const row = await this.leads.save(this.leads.create({
      name: b.name, phone: b.phone, nationality: b.nationality,
      budget_min: b.budgetMin == null ? null : String(b.budgetMin), budget_max: b.budgetMax == null ? null : String(b.budgetMax),
      preferred_location: b.preferredLocation, move_in_plan: b.moveInPlan, has_pets: b.hasPets,
      occupation: b.occupation, visa_type_id: b.visaTypeId, lease_duration_months: b.leaseDurationMonths,
      uses_car: b.usesCar, occupant_count: b.occupantCount, is_smoker: b.isSmoker,
      desired_room_type_id: b.desiredRoomTypeId, created_by_user_id: agentId,
      rent_room_id: null, status: 'new', other_contacts: [],
    }));
    return this.view(agentId, row.id);
  }

  async list(agentId: number, query: { q?: string; page?: string; limit?: string }) {
    const page = Math.max(1, Math.min(1000000, Math.floor(Number(query.page) || 1)));
    const limit = Math.max(1, Math.min(50, Math.floor(Number(query.limit) || 20)));
    const qb = this.leads.createQueryBuilder('lead').leftJoinAndSelect('lead.desired_room_type', 'roomType')
      .leftJoinAndSelect('lead.visa_type', 'visaType')
      .where('lead.created_by_user_id = :agentId', { agentId });
    const q = query.q?.trim();
    if (q) qb.andWhere('(lead.name ILIKE :q OR lead.phone ILIKE :q OR lead.preferred_location ILIKE :q)', { q: `%${q.replace(/[\\%_]/g, '\\$&')}%` });
    const [rows, total] = await qb.orderBy('lead.created_at', 'DESC').addOrderBy('lead.id', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items: rows.map(toLead), total, page, limit };
  }

  async view(agentId: number, id: number) {
    const row = await this.leads.findOne({ where: { id, created_by_user_id: agentId }, relations: { desired_room_type: true, visa_type: true } });
    if (!row) throw new NotFoundException('Lead not found');
    return toLead(row);
  }
}
function toLead(row: LeadEntity) {
  return {
    id: row.id, name: row.name, phone: row.phone, nationality: row.nationality,
    budgetMin: row.budget_min == null ? null : Number(row.budget_min), budgetMax: row.budget_max == null ? null : Number(row.budget_max),
    preferredLocation: row.preferred_location, moveInPlan: row.move_in_plan, hasPets: row.has_pets,
    occupation: row.occupation, visaTypeId: row.visa_type_id, visaTypeCode: row.visa_type?.code ?? null,
    leaseDurationMonths: row.lease_duration_months,
    usesCar: row.uses_car, occupantCount: row.occupant_count, isSmoker: row.is_smoker,
    desiredRoomTypeId: row.desired_room_type_id, desiredRoomTypeCode: row.desired_room_type?.code ?? null,
    status: row.status, createdAt: row.created_at,
  };
}
