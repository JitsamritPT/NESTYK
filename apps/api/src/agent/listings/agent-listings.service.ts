import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RentRoomEntity } from '../../entities/rent-room.entity';

export type ListingsQuery = {
  page?: number;
  limit?: number;
  q?: string;
  visibility?: string;
};

function firstPrice(prices: unknown): { contractTypeCode: string; price: number } | null {
  if (!Array.isArray(prices) || !prices[0] || typeof prices[0] !== 'object') {
    return null;
  }
  const row = prices[0] as { contractTypeCode?: string; price?: unknown };
  const price = Number(row.price);
  if (!row.contractTypeCode || !Number.isFinite(price)) return null;
  return { contractTypeCode: row.contractTypeCode, price };
}

@Injectable()
export class AgentListingsService {
  constructor(
    @InjectRepository(RentRoomEntity)
    private readonly roomsRepo: Repository<RentRoomEntity>,
  ) {}

  async listMine(agentId: number, query: ListingsQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

    const countQb = this.roomsRepo
      .createQueryBuilder('room')
      .leftJoin('room.property', 'property')
      .leftJoin('room.property_owner', 'propertyOwner')
      .where('room.is_scout_room = TRUE')
      .andWhere('room.created_by_user_id = :agentId', { agentId });

    if (query.visibility === 'private' || query.visibility === 'published') {
      countQb.andWhere('room.visibility = :visibility', { visibility: query.visibility });
    }

    const search = query.q?.trim();
    if (search) {
      countQb.andWhere(
        '(property.name ILIKE :q OR room.listing_title ILIKE :q OR propertyOwner.name ILIKE :q OR propertyOwner.phone ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    const total = await countQb.getCount();

    const idRows = await countQb
      .clone()
      .select('room.id', 'id')
      .orderBy('room.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<{ id: number }>();
    const ids = idRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));

    if (!ids.length) {
      return { items: [], total, page, limit };
    }

    const found = await this.roomsRepo.find({
      where: { id: In(ids) },
      relations: {
        property: true,
        property_owner: true,
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
        const priceRow = firstPrice(room.prices);
        return {
          id: room.id,
          listingTitle: room.listing_title,
          visibility: room.visibility,
          isScoutRoom: room.is_scout_room,
          roomStatusCode: room.room_status?.code ?? null,
          property: room.property
            ? {
                id: room.property.id,
                name: room.property.name,
                district: room.property.district,
                province: room.property.province,
              }
            : null,
          propertyOwner: room.property_owner
            ? {
                id: room.property_owner.id,
                name: room.property_owner.name,
                phone: room.property_owner.phone,
              }
            : null,
          prices: priceRow ? [priceRow] : [],
          coverMediaUrl: cover?.media_url ?? null,
        };
      }),
      total,
      page,
      limit,
    };
  }
}
