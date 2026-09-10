import { PropertyEntity } from '../../entities/property.entity';
import { canonicalProvince, canonicalArea, leadProvinces } from './lead-locations';
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
  if (body.province != null && (typeof body.province !== 'string' || !canonicalProvince(body.province))) throw new BadRequestException('Invalid province');
  result.province = typeof body.province === 'string' ? canonicalProvince(body.province) : null;
  const locations = body.locations ?? [];
  if (!Array.isArray(locations) || locations.length > 50 || locations.some((v) => typeof v !== 'string' || !v.trim() || v.length > 255)) throw new BadRequestException('Invalid locations');
  result.locations = [...new Set(locations.map(canonicalArea))];
  if ((result.locations as string[]).some((v) => !v || v === '-')) throw new BadRequestException('Invalid locations');
  const textFields = { locationPlaceId: 255, locationName: 500, name: 255, phone: 50, nationality: 120, preferredLocation: 500, moveInPlan: 255, occupation: 255 };
  for (const [key, max] of Object.entries(textFields)) {
    const value = body[key];
    const required = key === 'name' || key === 'phone';
    if (value == null && !required) { result[key] = null; continue; }
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new BadRequestException(`${key} ${required ? 'is required and ' : ''}must be text up to ${max} characters`);
    result[key] = value.trim() || null;
  }
  const pinFields = ['latitude', 'longitude', 'radiusKm'];
  const hasPin = pinFields.some((key) => body[key] != null);
  if ((hasPin || locations.length > 0) && !result.province) throw new BadRequestException('A valid province is required for a location');
  if (hasPin) {
    if (typeof body.latitude !== 'number' || !Number.isFinite(body.latitude) || Math.abs(body.latitude) > 90 ||
        typeof body.longitude !== 'number' || !Number.isFinite(body.longitude) || Math.abs(body.longitude) > 180 ||
        ![1, 3, 5].includes(body.radiusKm as number) || !result.locationName) throw new BadRequestException('A map location requires a name, valid coordinates and a radius of 1, 3 or 5 km');
  } else if (result.locationName || result.locationPlaceId) throw new BadRequestException('Map coordinates are required');
  for (const key of pinFields) result[key] = body[key] ?? null;
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
    if (b.locations?.length && b.latitude == null) {
      const province = (await this.locationCatalog()).find((p) => p.name === b.province);
      if (b.locations.some((area) => !province?.locations.includes(area))) throw new BadRequestException('Location is not available in this province');
    }
    if (b.desiredRoomTypeId != null && !await this.roomTypes.findOne({ where: { id: b.desiredRoomTypeId, is_active: true } })) throw new BadRequestException('Room type is not available');
    if (b.visaTypeId != null && !await this.visaTypes.findOne({ where: { id: b.visaTypeId, is_active: true } })) throw new BadRequestException('Visa type is not available');
    if (b.leaseDurationMonths != null && !await this.contractTypes.findOne({ where: { term_months: b.leaseDurationMonths, is_active: true } })) throw new BadRequestException('Rental duration is not available');
    const row = await this.leads.save(this.leads.create({
      location_place_id: b.locationPlaceId, location_name: b.locationName, latitude: b.latitude, longitude: b.longitude, radius_km: b.radiusKm,
      province: b.province, locations: b.locations,
      name: b.name, phone: b.phone, nationality: b.nationality,
      budget_min: b.budgetMin == null ? null : String(b.budgetMin), budget_max: b.budgetMax == null ? null : String(b.budgetMax),
      preferred_location: b.preferredLocation, move_in_plan: b.moveInPlan, has_pets: b.hasPets,
      occupation: b.occupation, visa_type_id: b.visaTypeId, lease_duration_months: b.leaseDurationMonths,
      uses_car: b.usesCar, occupant_count: b.occupantCount, is_smoker: b.isSmoker,
      desired_room_type_id: b.desiredRoomTypeId, created_by_user_id: agentId,
      rent_room_id: null, status: 'new', other_contacts: [],
    }));
    const saved = await this.leads.findOne({ where: { id: row.id, created_by_user_id: agentId }, relations: { desired_room_type: true, visa_type: true } });
    if (!saved) throw new NotFoundException('Lead not found');
    return toLead(saved);
  }

  async list(agentId: number, query: { q?: string; page?: string; limit?: string; province?: string; locations?: string; includeUnspecified?: string }) {
    if ([query.q, query.province, query.locations, query.page, query.limit, query.includeUnspecified].some((v) => v != null && typeof v !== 'string')) throw new BadRequestException('Invalid query parameters');
    const province = query.province ? canonicalProvince(query.province) : null;
    if (query.province && !province) throw new BadRequestException('Invalid province');
    let locations: string[] = [];
    if (query.locations) {
      try { locations = JSON.parse(query.locations); } catch { throw new BadRequestException('Invalid locations'); }
      if (!Array.isArray(locations) || locations.length > 50 || locations.some((v) => typeof v !== 'string' || !v.trim() || v.length > 255)) throw new BadRequestException('Invalid locations');
      if (locations.length && !province) throw new BadRequestException('Province is required for locations');
    }
    const page = Math.max(1, Math.min(1000000, Math.floor(Number(query.page) || 1)));
    const limit = Math.max(1, Math.min(50, Math.floor(Number(query.limit) || 20)));
    const qb = this.leads.createQueryBuilder('lead').leftJoinAndSelect('lead.desired_room_type', 'roomType')
      .leftJoinAndSelect('lead.visa_type', 'visaType')
      .where('lead.created_by_user_id = :agentId', { agentId });
    if (province) qb.andWhere('lead.province = :province', { province });
    if (locations.length) qb.andWhere(query.includeUnspecified === 'true'
      ? '(lead.locations && CAST(:locations AS text[]) OR (cardinality(lead.locations) = 0 AND lead.latitude IS NULL))'
      : 'lead.locations && CAST(:locations AS text[])', { locations });
    const q = query.q?.trim();
    if (q) qb.andWhere("(lead.name ILIKE :q OR lead.phone ILIKE :q OR lead.preferred_location ILIKE :q OR lead.location_name ILIKE :q OR lead.province ILIKE :q OR array_to_string(lead.locations, ', ') ILIKE :q)", { q: `%${q.replace(/[\\%_]/g, '\\$&')}%` });
    const [rows, total] = await qb.orderBy('lead.created_at', 'DESC').addOrderBy('lead.id', 'DESC').skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items: rows.map(toLead), total, page, limit };
  }

  async view(agentId: number, id: number) {
    const row = await this.leads.findOne({ where: { id, created_by_user_id: agentId }, relations: { desired_room_type: true, visa_type: true } });
    if (!row) throw new NotFoundException('Lead not found');
    if (row.status === 'new') {
      row.status = 'viewed';
      row.viewed_at = new Date();
      await this.leads.save(row);
    }
    return toLead(row);
  }
}
function toLead(row: LeadEntity) {
  return {
    locationPlaceId: row.location_place_id ?? null, locationName: row.location_name ?? null, latitude: row.latitude ?? null, longitude: row.longitude ?? null, radiusKm: row.radius_km ?? null,
    province: row.province ?? null, locations: row.locations ?? [],
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
