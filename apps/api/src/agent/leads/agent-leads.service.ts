import { PropertyEntity } from '../../entities/property.entity';
import { canonicalProvince, canonicalArea, leadProvinces } from './lead-locations';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import type { CreateLeadInput, LeadPin, LeadPinInput, LeadStatus, AgentLeadsSort } from '@nestyk/types';
import { LeadEntity } from '../../entities/lead.entity';
import { LeadLocationEntity } from '../../entities/lead-location.entity';
import { MasterRoomTypeEntity } from '../../entities/master-room-type.entity';
import { MasterVisaTypeEntity } from '../../entities/master-visa-type.entity';
import { MasterContractTypeEntity } from '../../entities/master-contract-type.entity';

const LEAD_MAX_PINS = 3;
const LEAD_RADII_KM = [1, 3, 5];

function validatePins(value: unknown): LeadPin[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > LEAD_MAX_PINS) throw new BadRequestException(`pins must be a list of up to ${LEAD_MAX_PINS} locations`);
  const pins = value.map((raw, index): LeadPin => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Invalid pin');
    const pin = raw as Record<string, unknown>;
    const { latitude, longitude } = pin;
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new BadRequestException('Each pin requires valid coordinates');
    if (typeof pin.name !== 'string' || !pin.name.trim() || pin.name.trim().length > 500) throw new BadRequestException('Each pin requires a name up to 500 characters');
    if (pin.placeId != null && (typeof pin.placeId !== 'string' || pin.placeId.trim().length > 255)) throw new BadRequestException('Invalid pin placeId');
    if (pin.district != null && (typeof pin.district !== 'string' || pin.district.length > 255)) throw new BadRequestException('Invalid pin district');
    const province = typeof pin.province === 'string' ? canonicalProvince(pin.province) : null;
    if (!province) throw new BadRequestException('Each pin must be inside a Thai province');
    const district = typeof pin.district === 'string' ? canonicalArea(pin.district) : '';
    return {
      rank: index + 1,
      placeId: typeof pin.placeId === 'string' && pin.placeId.trim() ? pin.placeId.trim() : null,
      name: pin.name.trim(),
      latitude,
      longitude,
      province,
      district: district && district !== '-' ? district : null,
    };
  });
  const seen = new Set<string>();
  for (const pin of pins) {
    const keys = [`${pin.latitude.toFixed(6)},${pin.longitude.toFixed(6)}`, ...(pin.placeId ? [`place:${pin.placeId}`] : [])];
    if (keys.some((k) => seen.has(k))) throw new BadRequestException('Pins must be different locations');
    keys.forEach((k) => seen.add(k));
  }
  return pins;
}

export function validateLead(input: unknown): CreateLeadInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Lead data is required');
  const body = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const pins = validatePins(body.pins);
  result.pins = pins;
  if (pins.length) {
    if (!LEAD_RADII_KM.includes(body.radiusKm as number)) throw new BadRequestException('Pinned locations require a radius of 1, 3 or 5 km');
    result.radiusKm = body.radiusKm;
    result.province = pins[0].province;
    result.locations = [...new Set(pins.map((p) => p.district).filter((d): d is string => !!d))];
  } else {
    if (body.radiusKm != null && !LEAD_RADII_KM.includes(body.radiusKm as number)) throw new BadRequestException('radiusKm must be 1, 3 or 5');
    result.radiusKm = null;
    if (body.province != null && (typeof body.province !== 'string' || !canonicalProvince(body.province))) throw new BadRequestException('Invalid province');
    result.province = typeof body.province === 'string' ? canonicalProvince(body.province) : null;
    const locations = body.locations ?? [];
    if (!Array.isArray(locations) || locations.length > 50 || locations.some((v) => typeof v !== 'string' || !v.trim() || v.length > 255)) throw new BadRequestException('Invalid locations');
    result.locations = [...new Set(locations.map(canonicalArea))];
    if ((result.locations as string[]).some((v) => !v || v === '-')) throw new BadRequestException('Invalid locations');
    if (locations.length > 0 && !result.province) throw new BadRequestException('A valid province is required for a location');
  }
  const textFields = { name: 255, phone: 50, nationality: 120, preferredLocation: 500, moveInPlan: 255, occupation: 255, notes: 500 };
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

  async locationCatalog(agentId?: number) {
    const rows = await this.leads.manager.getRepository(PropertyEntity).createQueryBuilder('property')
      .select('property.province', 'province').addSelect('property.district', 'district').distinct(true).getRawMany();
    const areas = new Map<string, Set<string>>();
    for (const row of rows) {
      const province = canonicalProvince(row.province || '');
      const area = canonicalArea(row.district || '');
      if (!province || !area || area === '-') continue;
      if (!areas.has(province)) areas.set(province, new Set());
      areas.get(province)!.add(area);
    }
    if (agentId != null) {
      const saved = await this.leads.createQueryBuilder('lead').select('lead.province', 'province').addSelect('lead.locations', 'locations')
        .where('lead.created_by_user_id = :agentId', { agentId }).distinct(true).getRawMany();
      for (const row of saved) {
        if (!row.province) continue;
        if (!areas.has(row.province)) areas.set(row.province, new Set());
        for (const area of row.locations ?? []) areas.get(row.province)!.add(area);
      }
    }
    return leadProvinces.map((p) => ({ ...p, locations: [...(areas.get(p.name) ?? [])].sort((a, b) => a.localeCompare(b, 'th')) }));
  }

  async create(agentId: number, input: unknown) {
    const b = validateLead(input);
    await this.validateReferences(b);
    const id = await this.leads.manager.transaction(async (em) => {
      const repo = em.getRepository(LeadEntity);
      const row = await repo.save(repo.create({
        ...leadColumns(b), created_by_user_id: agentId,
        rent_room_id: null, status: 'new', other_contacts: [],
      }));
      await replacePins(em, row.id, b.pins ?? []);
      return row.id;
    });
    return toLead(await this.requireLead(agentId, id));
  }

  private async validateReferences(b: CreateLeadInput) {
    if (b.locations?.length && !b.pins?.length) {
      const province = (await this.locationCatalog()).find((p) => p.name === b.province);
      if (b.locations.some((area) => !province?.locations.includes(area))) throw new BadRequestException('Location is not available in this province');
    }
    if (b.desiredRoomTypeId != null && !await this.roomTypes.findOne({ where: { id: b.desiredRoomTypeId, is_active: true } })) throw new BadRequestException('Room type is not available');
    if (b.visaTypeId != null && !await this.visaTypes.findOne({ where: { id: b.visaTypeId, is_active: true } })) throw new BadRequestException('Visa type is not available');
    if (b.leaseDurationMonths != null && !await this.contractTypes.findOne({ where: { term_months: b.leaseDurationMonths, is_active: true } })) throw new BadRequestException('Rental duration is not available');
  }

  async update(agentId: number, id: number, input: unknown) {
    const existing = await this.requireLead(agentId, id);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Lead data is required');
    const b = validateLead({ ...toLead(existing), ...input });
    await this.validateReferences(b);
    await this.leads.manager.transaction(async (em) => {
      await em.getRepository(LeadEntity).update({ id, created_by_user_id: agentId }, leadColumns(b));
      await replacePins(em, id, b.pins ?? []);
    });
    return toLead(await this.requireLead(agentId, id));
  }

  async list(agentId: number, query: { q?: string; page?: string; limit?: string; province?: string; locations?: string; includeUnspecified?: string; sort?: string }) {
    if ([query.q, query.province, query.locations, query.page, query.limit, query.includeUnspecified, query.sort].some((v) => v != null && typeof v !== 'string')) throw new BadRequestException('Invalid query parameters');
    const province = query.province ? canonicalProvince(query.province) : null;
    if (query.province && !province) throw new BadRequestException('Invalid province');
    let locations: string[] = [];
    if (query.locations) {
      try { locations = JSON.parse(query.locations); } catch { throw new BadRequestException('Invalid locations'); }
      if (!Array.isArray(locations) || locations.length > 50 || locations.some((v) => typeof v !== 'string' || !v.trim() || v.length > 255)) throw new BadRequestException('Invalid locations');
      if (locations.length && !province) throw new BadRequestException('Province is required for locations');
    }
    const sort = normalizeLeadSort(query.sort);
    const page = Math.max(1, Math.min(1000000, Math.floor(Number(query.page) || 1)));
    const limit = Math.max(1, Math.min(50, Math.floor(Number(query.limit) || 20)));
    const qb = this.leads.createQueryBuilder('lead').leftJoinAndSelect('lead.desired_room_type', 'roomType')
      .leftJoinAndSelect('lead.visa_type', 'visaType')
      .where('lead.created_by_user_id = :agentId', { agentId });
    if (province) qb.andWhere('lead.province = :province', { province });
    if (locations.length) qb.andWhere(query.includeUnspecified === 'true'
      ? '(lead.locations && CAST(:locations AS text[]) OR (cardinality(lead.locations) = 0 AND NOT EXISTS (SELECT 1 FROM lead_locations pin WHERE pin.lead_id = lead.id)))'
      : 'lead.locations && CAST(:locations AS text[])', { locations });
    const q = query.q?.trim();
    if (q) qb.andWhere("(lead.name ILIKE :q OR lead.phone ILIKE :q OR lead.preferred_location ILIKE :q OR lead.province ILIKE :q OR array_to_string(lead.locations, ', ') ILIKE :q OR EXISTS (SELECT 1 FROM lead_locations pin WHERE pin.lead_id = lead.id AND pin.name ILIKE :q))", { q: `%${q.replace(/[\\%_]/g, '\\$&')}%` });
    applyLeadSort(qb, sort);
    const [rows, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    if (rows.length) {
      const pins = await this.leads.manager.getRepository(LeadLocationEntity).find({ where: { lead_id: In(rows.map((r) => r.id)) }, order: { rank: 'ASC' } });
      for (const row of rows) row.pins = pins.filter((p) => p.lead_id === row.id);
    }
    return { items: rows.map(toLead), total, page, limit };
  }

  async view(agentId: number, id: number) {
    return toLead(await this.requireLead(agentId, id));
  }

  async markInProgress(agentId: number, id: number) {
    const row = await this.requireLead(agentId, id);
    if (row.status === 'booked') throw new ConflictException('Booked leads cannot move to in progress');
    if (row.status === 'inprogress') return toLead(row);
    row.status = 'inprogress';
    row.lost_reason = null;
    await this.leads.save(row);
    return toLead(row);
  }

  async markLost(agentId: number, id: number, input: unknown) {
    const row = await this.requireLead(agentId, id);
    if (row.status === 'booked') throw new ConflictException('Booked leads cannot be marked lost');
    const reason = parseLostReason(input);
    row.status = 'lost';
    row.lost_reason = reason;
    await this.leads.save(row);
    return toLead(row);
  }

  private async requireLead(agentId: number, id: number) {
    const row = await this.leads.findOne({ where: { id, created_by_user_id: agentId }, relations: { desired_room_type: true, visa_type: true, pins: true } });
    if (!row) throw new NotFoundException('Lead not found');
    return row;
  }
}

function leadColumns(b: CreateLeadInput) {
  return {
    radius_km: b.radiusKm ?? null, province: b.province ?? null, locations: b.locations ?? [],
    name: b.name, phone: b.phone, nationality: b.nationality ?? null,
    budget_min: b.budgetMin == null ? null : String(b.budgetMin), budget_max: b.budgetMax == null ? null : String(b.budgetMax),
    preferred_location: b.preferredLocation ?? null, move_in_plan: b.moveInPlan ?? null, has_pets: b.hasPets ?? null,
    occupation: b.occupation ?? null, visa_type_id: b.visaTypeId ?? null, lease_duration_months: b.leaseDurationMonths ?? null,
    uses_car: b.usesCar ?? null, occupant_count: b.occupantCount ?? null, is_smoker: b.isSmoker ?? null,
    desired_room_type_id: b.desiredRoomTypeId ?? null, notes: b.notes ?? null,
  };
}

async function replacePins(em: EntityManager, leadId: number, pins: LeadPinInput[]) {
  const repo = em.getRepository(LeadLocationEntity);
  await repo.delete({ lead_id: leadId });
  if (!pins.length) return;
  await repo.insert(pins.map((pin, index) => ({
    lead_id: leadId, rank: index + 1, place_id: pin.placeId ?? null, name: pin.name,
    latitude: pin.latitude, longitude: pin.longitude, province: pin.province, district: pin.district ?? null,
  })));
}

function parseLostReason(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Lost reason is required');
  const value = (input as Record<string, unknown>).lostReason;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 500) {
    throw new BadRequestException('lostReason must be text up to 500 characters');
  }
  return value.trim();
}

const LEAD_SORTS: AgentLeadsSort[] = [
  'created_desc',
  'created_asc',
  'updated_desc',
  'name_asc',
  'budget_asc',
  'budget_desc',
  'status_asc',
  'status_desc',
];

const STATUS_RANK_SQL =
  "CASE lead.status WHEN 'new' THEN 1 WHEN 'inprogress' THEN 2 WHEN 'booked' THEN 3 WHEN 'lost' THEN 4 ELSE 5 END";

const BUDGET_SORT_SQL = 'COALESCE(lead.budget_min, lead.budget_max)';

export function normalizeLeadSort(value?: string): AgentLeadsSort {
  if (value == null || value === '') return 'created_desc';
  if ((LEAD_SORTS as string[]).includes(value)) return value as AgentLeadsSort;
  throw new BadRequestException('Invalid sort');
}

function applyLeadSort(qb: SelectQueryBuilder<LeadEntity>, sort: AgentLeadsSort) {
  if (sort === 'created_asc') {
    qb.orderBy('lead.created_at', 'ASC').addOrderBy('lead.id', 'ASC');
    return;
  }
  if (sort === 'updated_desc') {
    qb.orderBy('lead.updated_at', 'DESC').addOrderBy('lead.id', 'DESC');
    return;
  }
  if (sort === 'name_asc') {
    qb.orderBy('lead.name', 'ASC').addOrderBy('lead.id', 'ASC');
    return;
  }
  if (sort === 'budget_asc' || sort === 'budget_desc') {
    // TypeORM orderBy cannot take raw COALESCE(...) — select an alias first.
    qb.addSelect(BUDGET_SORT_SQL, 'sort_budget');
    qb.orderBy('sort_budget', sort === 'budget_asc' ? 'ASC' : 'DESC', 'NULLS LAST')
      .addOrderBy('lead.id', sort === 'budget_asc' ? 'ASC' : 'DESC');
    return;
  }
  if (sort === 'status_asc' || sort === 'status_desc') {
    // TypeORM orderBy cannot take raw CASE ... — select an alias first.
    qb.addSelect(STATUS_RANK_SQL, 'sort_status_rank');
    qb.orderBy('sort_status_rank', sort === 'status_asc' ? 'ASC' : 'DESC')
      .addOrderBy('lead.created_at', 'DESC')
      .addOrderBy('lead.id', 'DESC');
    return;
  }
  qb.orderBy('lead.created_at', 'DESC').addOrderBy('lead.id', 'DESC');
}

function toLead(row: LeadEntity) {
  const pins: LeadPin[] = [...(row.pins ?? [])].sort((a, b) => a.rank - b.rank).map((pin) => ({
    rank: pin.rank, placeId: pin.place_id ?? null, name: pin.name,
    latitude: Number(pin.latitude), longitude: Number(pin.longitude), province: pin.province, district: pin.district ?? null,
  }));
  return {
    pins, radiusKm: row.radius_km ?? null,
    province: row.province ?? null, locations: row.locations ?? [],
    id: row.id, name: row.name, phone: row.phone, nationality: row.nationality,
    budgetMin: row.budget_min == null ? null : Number(row.budget_min), budgetMax: row.budget_max == null ? null : Number(row.budget_max),
    preferredLocation: row.preferred_location, moveInPlan: row.move_in_plan, hasPets: row.has_pets,
    occupation: row.occupation, visaTypeId: row.visa_type_id, visaTypeCode: row.visa_type?.code ?? null,
    leaseDurationMonths: row.lease_duration_months,
    usesCar: row.uses_car, occupantCount: row.occupant_count, isSmoker: row.is_smoker,
    desiredRoomTypeId: row.desired_room_type_id, desiredRoomTypeCode: row.desired_room_type?.code ?? null,
    notes: row.notes ?? null,
    status: row.status as LeadStatus, lostReason: row.lost_reason ?? null, createdAt: row.created_at,
  };
}
