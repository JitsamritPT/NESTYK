import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { PropertyEntity } from '../../entities/property.entity';
import { PropertyOwnerEntity } from '../../entities/property-owner.entity';
import { MasterRoomStatusEntity } from '../../entities/master-room-status.entity';
import { MasterLayoutEntity } from '../../entities/master-layout.entity';
import { MasterFacilityEntity } from '../../entities/master-facility.entity';
import { MasterFacilitiesGroupEntity } from '../../entities/master-facilities-group.entity';
import { RentRoomEntity } from '../../entities/rent-room.entity';
import { RoomMediaEntity } from '../../entities/room-media.entity';
import { RoomLayoutValueEntity } from '../../entities/room-layout-value.entity';
import { RoomFacilityEntity } from '../../entities/room-facility.entity';
import { RentRoomDocumentEntity } from '../../entities/rent-room-document.entity';
import { CreateRoomBody } from './dto/create-room.dto';

@Injectable()
export class AgentRoomsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(PropertyEntity)
    private readonly propertiesRepo: Repository<PropertyEntity>,
    @InjectRepository(PropertyOwnerEntity)
    private readonly propertyOwnersRepo: Repository<PropertyOwnerEntity>,
    @InjectRepository(MasterFacilityEntity)
    private readonly facilitiesRepo: Repository<MasterFacilityEntity>,
  ) {}

  async listProperties(agentId: number) {
    // Reuse any property previously linked to this agent's scout rooms,
    // plus all properties for greenfield simplicity (wizard picker).
    const used = await this.dataSource.query(
      `
      SELECT DISTINCT p.*
      FROM properties p
      INNER JOIN rent_rooms r ON r.properties_id = p.id
      WHERE r.is_scout_room = TRUE
        AND r.created_by_user_id = $1
      ORDER BY p.name ASC
      `,
      [agentId],
    );
    if (used.length) return used;
    return this.propertiesRepo.find({ order: { name: 'ASC' }, take: 100 });
  }

  async listPropertyOwners(agentId: number) {
    const rows: Array<{
      id: number;
      name: string;
      phone: string;
      email: string | null;
      note: string | null;
      roomCount: number | string;
    }> = await this.dataSource.query(
      `
      SELECT
        po.id,
        po.name,
        po.phone,
        po.email,
        po.note,
        COUNT(r.id)::int AS "roomCount"
      FROM property_owners po
      LEFT JOIN rent_rooms r ON r.property_owner_id = po.id
      WHERE po.created_by_user_id = $1
      GROUP BY po.id
      ORDER BY po.name ASC
      `,
      [agentId],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      note: row.note,
      roomCount: Number(row.roomCount) || 0,
    }));
  }

  async createScoutRoom(agent: AuthRequestUser, body: CreateRoomBody) {
    this.validateCreateBody(body);

    return this.dataSource.transaction(async (manager) => {
      const propertyOwnerId = await this.resolvePropertyOwnerId(manager, agent.id, body);
      const propertyId = await this.resolvePropertyId(manager, body);

      const status = await manager.findOne(MasterRoomStatusEntity, {
        where: { code: 'available' },
      });
      if (!status) {
        throw new BadRequestException('master_room_statuses.available missing — run create-room schema');
      }

      const room = manager.create(RentRoomEntity, {
        room_id: body.roomId ?? null,
        listing_title: body.listingTitle!.trim(),
        listing_description: body.listingDescription ?? null,
        available_from_date: body.availableFromDate ?? new Date().toISOString().slice(0, 10),
        prices: body.prices as unknown as Record<string, unknown>[],
        custom_facilities: body.customFacilities ?? [],
        latitude: body.latitude != null ? String(body.latitude) : null,
        longitude: body.longitude != null ? String(body.longitude) : null,
        nearby_other: body.nearbyOther ?? null,
        nearby_places: body.nearbyPlaces ?? [],
        water_rate_per_unit:
          body.waterRatePerUnit != null && Number(body.waterRatePerUnit) > 0
            ? String(body.waterRatePerUnit)
            : null,
        electric_rate_per_unit:
          body.electricRatePerUnit != null && Number(body.electricRatePerUnit) > 0
            ? String(body.electricRatePerUnit)
            : null,
        is_scout_room: true,
        visibility: body.visibility!,
        created_by_user_id: agent.id,
        property_owner_id: propertyOwnerId,
        owner_id: null,
        properties_id: propertyId,
        room_status_id: status.id,
        view_count: 0,
      });
      const saved = await manager.save(room);

      if (body.layout?.length) {
        const allowedLayout = new Set(['bedroom', 'bathroom', 'room_size', 'floor', 'building']);
        for (const item of body.layout) {
          if (!allowedLayout.has(item.code)) {
            throw new BadRequestException(`Unknown layout code: ${item.code}`);
          }
          let layout = await manager.findOne(MasterLayoutEntity, {
            where: { code: item.code },
          });
          if (!layout) {
            layout = await manager.save(
              manager.create(MasterLayoutEntity, { code: item.code }),
            );
          }
          await manager.save(
            manager.create(RoomLayoutValueEntity, {
              rent_room_id: saved.id,
              layout_id: layout.id,
              value: String(item.value),
            }),
          );
        }
      }

      if (body.facilities?.length) {
        for (const item of body.facilities) {
          let facility = await manager.findOne(MasterFacilityEntity, {
            where: { code: item.code },
            relations: { group: true },
          });
          if (!facility && item.groupCode) {
            const group = await manager.findOne(MasterFacilitiesGroupEntity, {
              where: { code: item.groupCode },
            });
            if (!group) {
              throw new BadRequestException(`Unknown facility group: ${item.groupCode}`);
            }
            facility = await manager.save(
              manager.create(MasterFacilityEntity, {
                group_id: group.id,
                code: item.code,
              }),
            );
          }
          if (!facility) {
            throw new BadRequestException(`Unknown facility code: ${item.code}`);
          }
          await manager.save(
            manager.create(RoomFacilityEntity, {
              rent_room_id: saved.id,
              group_id: facility.group_id,
              f_id: facility.id,
            }),
          );
        }
      }

      let coverSet = false;
      for (let i = 0; i < body.medias!.length; i++) {
        const m = body.medias![i];
        const isCover = Boolean(m.isCover) && !coverSet;
        if (isCover) coverSet = true;
        await manager.save(
          manager.create(RoomMediaEntity, {
            rent_id: saved.id,
            media_url: m.mediaUrl,
            media_type: m.mediaType ?? 'image',
            category: m.category ?? 'room',
            is_cover: isCover,
            sort_order: m.sortOrder ?? i,
          }),
        );
      }
      if (!coverSet) {
        await manager.query(
          `UPDATE room_medias SET is_cover = TRUE WHERE rent_id = $1 AND id = (
             SELECT id FROM room_medias WHERE rent_id = $1 ORDER BY sort_order ASC, id ASC LIMIT 1
           )`,
          [saved.id],
        );
      }

      if (body.documents?.length) {
        for (let i = 0; i < body.documents.length; i++) {
          const d = body.documents[i];
          await manager.save(
            manager.create(RentRoomDocumentEntity, {
              rent_id: saved.id,
              kind: d.kind,
              media_url: d.mediaUrl,
              sort_order: d.sortOrder ?? i,
            }),
          );
        }
      }

      return {
        id: saved.id,
        propertyId,
        propertyOwnerId,
        isScoutRoom: true,
        visibility: saved.visibility,
      };
    });
  }

  private validateCreateBody(body: CreateRoomBody) {
    if (!body.visibility || !['private', 'published'].includes(body.visibility)) {
      throw new BadRequestException('visibility must be private or published');
    }
    if (!body.propertyOwnerId && !body.propertyOwner?.name?.trim()) {
      throw new BadRequestException('propertyOwnerId or propertyOwner{name,phone} required');
    }
    if (!body.propertyOwnerId && !body.propertyOwner?.phone?.trim()) {
      throw new BadRequestException('propertyOwner.phone required');
    }
    if (!body.propertyId && !body.property?.address?.trim()) {
      throw new BadRequestException('propertyId or property{address,district,province} required');
    }
    if (!body.propertyId) {
      if (!body.property?.district?.trim() || !body.property?.province?.trim()) {
        throw new BadRequestException('property.district and property.province required');
      }
    }
    if (!body.listingTitle?.trim()) {
      throw new BadRequestException('listingTitle is required');
    }
    if (!body.prices?.length) {
      throw new BadRequestException('prices must have at least 1 row');
    }
    for (const p of body.prices) {
      if (!p.contractTypeCode || !(p.price > 0)) {
        throw new BadRequestException('each price needs contractTypeCode and price > 0');
      }
    }
    if (body.waterRatePerUnit != null && !(Number(body.waterRatePerUnit) > 0)) {
      throw new BadRequestException('waterRatePerUnit must be > 0 when provided');
    }
    if (body.electricRatePerUnit != null && !(Number(body.electricRatePerUnit) > 0)) {
      throw new BadRequestException('electricRatePerUnit must be > 0 when provided');
    }
    const roomMedias = (body.medias ?? []).filter((m) => (m.category ?? 'room') === 'room');
    if (roomMedias.length < 5) {
      throw new BadRequestException('medias must include at least 5 items with category room');
    }
    for (const m of body.medias ?? []) {
      if (!m.mediaUrl?.trim()) {
        throw new BadRequestException('each media needs mediaUrl');
      }
    }
  }

  private async resolvePropertyOwnerId(
    manager: DataSource['manager'],
    agentId: number,
    body: CreateRoomBody,
  ): Promise<number> {
    if (body.propertyOwnerId) {
      const existing = await manager.findOne(PropertyOwnerEntity, {
        where: { id: body.propertyOwnerId, created_by_user_id: agentId },
      });
      if (!existing) {
        throw new NotFoundException('propertyOwnerId not found for this agent');
      }
      return existing.id;
    }

    const phone = body.propertyOwner!.phone.trim();
    const reused = await manager.findOne(PropertyOwnerEntity, {
      where: { created_by_user_id: agentId, phone },
    });
    if (reused) {
      reused.name = body.propertyOwner!.name.trim();
      reused.email = body.propertyOwner!.email ?? reused.email;
      reused.note = body.propertyOwner!.note ?? reused.note;
      await manager.save(reused);
      return reused.id;
    }

    const created = await manager.save(
      manager.create(PropertyOwnerEntity, {
        name: body.propertyOwner!.name.trim(),
        phone,
        email: body.propertyOwner!.email ?? null,
        note: body.propertyOwner!.note ?? null,
        created_by_user_id: agentId,
      }),
    );
    return created.id;
  }

  private async resolvePropertyId(
    manager: DataSource['manager'],
    body: CreateRoomBody,
  ): Promise<number> {
    if (body.propertyId) {
      const existing = await manager.findOne(PropertyEntity, {
        where: { id: body.propertyId },
      });
      if (!existing) {
        throw new NotFoundException('propertyId not found');
      }
      return existing.id;
    }

    const p = body.property!;
    const created = await manager.save(
      manager.create(PropertyEntity, {
        name: p.name?.trim() || p.address.trim().slice(0, 80),
        category_code: p.categoryCode ?? null,
        address: p.address.trim(),
        subdistrict: p.subdistrict?.trim() || '-',
        district: p.district.trim(),
        province: p.province.trim(),
        postal_code: p.postalCode?.trim() || '-',
        latitude: p.latitude != null ? String(p.latitude) : null,
        longitude: p.longitude != null ? String(p.longitude) : null,
      }),
    );
    return created.id;
  }
}
