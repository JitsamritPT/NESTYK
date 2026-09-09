import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RentRoomEntity } from '../../entities/rent-room.entity';

export type ListingsQuery = {
  page?: number;
  limit?: number;
  q?: string;
  visibility?: string;
};

function roomPrices(room: RentRoomEntity) {
  if (room.price_rows?.length) {
    return [...room.price_rows].sort((a, b) => (a.contract_type?.term_months ?? 0) - (b.contract_type?.term_months ?? 0)).map((row) => ({
      contractTypeId: row.contract_type_id,
      contractTypeCode: row.contract_type.code,
      termMonths: row.contract_type.term_months,
      price: Number(row.price),
    }));
  }
  return (room.prices ?? []).filter((row) => typeof row.contractTypeCode === 'string' && Number.isFinite(Number(row.price))).map((row) => ({
    contractTypeId: Number(row.contractTypeId) || undefined,
    contractTypeCode: String(row.contractTypeCode),
    termMonths: Number(String(row.contractTypeCode).replace('monthly_', '')) || null,
    price: Number(row.price),
  }));
}

@Injectable()
export class AgentListingsService {
  constructor(
    @InjectRepository(RentRoomEntity)
    private readonly roomsRepo: Repository<RentRoomEntity>,
  ) {}

  async listMine(agentId: number, query: ListingsQuery) {
    const page = Math.max(1, Math.floor(Number.isFinite(Number(query.page)) ? Number(query.page) || 1 : 1));
    const limit = Math.min(50, Math.max(1, Math.floor(Number.isFinite(Number(query.limit)) ? Number(query.limit) || 20 : 20)));

    const countQb = this.roomsRepo
      .createQueryBuilder('room')
      .leftJoin('room.property', 'property')
      .leftJoin('room.room_contacts', 'roomContact')
      .leftJoin('roomContact.contact', 'contact')
      .where('room.is_scout_room = TRUE')
      .andWhere('room.created_by_user_id = :agentId', { agentId });

    if (query.visibility === 'private' || query.visibility === 'published') {
      countQb.andWhere('room.visibility = :visibility', { visibility: query.visibility });
    }

    const search = query.q?.trim();
    if (search) {
      countQb.andWhere(
        '(property.name ILIKE :q OR room.listing_title ILIKE :q OR contact.name ILIKE :q OR contact.phone ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    const total = await countQb.getCount();

    const idRows = await countQb
      .clone()
      .select('room.id', 'id')
      .distinct(true)
      .orderBy('room.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<{ id: number }>();
    const ids = idRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));

    if (!ids.length) {
      return { items: [], total, page, limit };
    }

    const found = await this.roomsRepo.find({
      where: { id: In(ids), created_by_user_id: agentId, is_scout_room: true },
      relations: {
        price_rows: { contract_type: true },
        property: true,
        property_owner: true,
        listing_source: true,
        room_contacts: { contact: true },
        medias: true,
        room_status: true,
      },
    });
    const byId = new Map(found.map((room) => [room.id, room]));
    const rows = ids.map((id) => byId.get(id)).filter((room): room is RentRoomEntity => !!room);

    return {
      items: rows.map((room) => {
        const medias = [...(room.medias ?? [])].sort((a, b) => a.sort_order - b.sort_order);
        const cover = medias.find((m) => m.is_cover) ?? medias[0];
        const primaryContact =
          (room.room_contacts ?? []).find((link) => link.is_primary)?.contact ??
          room.room_contacts?.[0]?.contact ??
          null;

        return {
          id: room.id,
          listingTitle: room.listing_title,
          visibility: room.visibility,
          isScoutRoom: room.is_scout_room,
          listingSourceCode: room.listing_source?.code ?? null,
          roomStatusCode: room.room_status?.code ?? null,
          property: room.property
            ? {
                id: room.property.id,
                name: room.property.name,
                district: room.property.district,
                province: room.property.province,
              }
            : null,
          contact: primaryContact
            ? {
                id: primaryContact.id,
                name: primaryContact.name,
                phone: primaryContact.phone,
              }
            : null,
          propertyOwner: room.property_owner
            ? {
                id: room.property_owner.id,
                name: room.property_owner.name,
                phone: room.property_owner.phone,
              }
            : null,
          prices: roomPrices(room),
          coverMediaUrl: cover?.media_url ?? null,
        };
      }),
      total,
      page,
      limit,
    };
  }
  async viewMine(agentId: number, id: number) {
    const room = await this.roomsRepo.findOne({
      where: { id, created_by_user_id: agentId, is_scout_room: true },
      relations: {
        property: { property_type: true }, room_type: true, room_status: true,
        listing_source: true, medias: true, price_rows: { contract_type: true },
        room_contacts: { contact: true }, layout_values: { layout: true },
        facilities: { facility: { group: true } }, documents: true,
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    const p = room.property;
    return {
      id: room.id, listingTitle: room.listing_title, description: room.listing_description,
      roomId: room.room_id, visibility: room.visibility,
      roomStatusCode: room.room_status?.code ?? null,
      roomTypeCode: room.room_type?.code ?? null, roomTypeId: room.room_type_id,
      listingSourceCode: room.listing_source?.code ?? null,
      availableFromDate: room.available_from_date,
      property: p ? { id: p.id, propertyTypeId: p.property_type_id, latitude: p.latitude, longitude: p.longitude, name: p.name, address: p.address, subdistrict: p.subdistrict,
        district: p.district, province: p.province, postalCode: p.postal_code,
        propertyTypeCode: p.property_type?.code ?? null } : null,
      latitude: room.latitude ?? p?.latitude ?? null,
      longitude: room.longitude ?? p?.longitude ?? null,
      prices: roomPrices(room), advanceRentMonths: room.advance_rent_months,
      depositMonths: room.deposit_months,
      waterRatePerUnit: room.water_rate_per_unit, electricRatePerUnit: room.electric_rate_per_unit,
      medias: [...(room.medias ?? [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order || a.id - b.id)
        .map((m) => ({ id: m.id, mediaUrl: m.media_url, mediaType: m.media_type, isCover: m.is_cover })),
      layout: (room.layout_values ?? []).map((v) => ({ code: v.layout.code, value: v.value })),
      facilities: [...(room.facilities ?? []).map((f) => f.facility.code), ...(room.custom_facilities ?? [])],
      facilityItems: (room.facilities ?? []).map((f) => ({ code: f.facility.code, groupCode: f.facility.group?.code })),
      customFacilities: room.custom_facilities ?? [],
      nearbyPlaces: room.nearby_places ?? [],
      documents: [...(room.documents ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map((d) => ({ kind: d.kind, mediaUrl: d.media_url, sortOrder: d.sort_order })),
      nearbyOther: room.nearby_other,
      contacts: [...(room.room_contacts ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
        .filter((link) => link.contact?.created_by_user_id === agentId)
        .map((link) => ({ id: link.contact.id, name: link.contact.name, phone: link.contact.phone,
          email: link.contact.email, note: link.contact.note, isPrimary: link.is_primary })),
    };
  }

}
