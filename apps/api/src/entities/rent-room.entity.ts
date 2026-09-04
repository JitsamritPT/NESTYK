import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { SerialTimestampEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { PropertyEntity } from './property.entity';
import { PropertyOwnerEntity } from './property-owner.entity';
import { MasterRoomStatusEntity } from './master-room-status.entity';
import { RoomMediaEntity } from './room-media.entity';
import { RentRoomDocumentEntity } from './rent-room-document.entity';
import { RoomLayoutValueEntity } from './room-layout-value.entity';
import { RoomFacilityEntity } from './room-facility.entity';

export type RentRoomVisibility = 'private' | 'published';

@Entity({ name: 'rent_rooms' })
export class RentRoomEntity extends SerialTimestampEntity {
  @Column({ type: 'varchar', length: 100, nullable: true })
  room_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  listing_title: string | null;

  @Column({ type: 'text', nullable: true })
  listing_description: string | null;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  available_from_date: string;

  @Column({ type: 'jsonb', nullable: true })
  prices: Record<string, unknown>[] | null;

  @Column({ type: 'jsonb', default: [] })
  custom_facilities: string[];

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  nearby_other: string | null;

  @Column({ type: 'jsonb', default: [] })
  nearby_places: unknown[];

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  water_rate_per_unit: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  electric_rate_per_unit: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  owner_identity_number: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  owner_bank_name: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  owner_bank_account: string | null;

  @Column({ type: 'boolean', default: false })
  is_scout_room: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  visibility: RentRoomVisibility | null;

  @Column({ type: 'int', nullable: true })
  created_by_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  property_owner_id: number | null;

  @Column({ type: 'int', nullable: true })
  owner_id: number | null;

  @Column({ type: 'int' })
  properties_id: number;

  @Column({ type: 'int' })
  room_status_id: number;

  @Column({ type: 'int', default: 0 })
  view_count: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_viewed_at: Date | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  created_by: UserEntity | null;

  @ManyToOne(() => PropertyOwnerEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_owner_id' })
  property_owner: PropertyOwnerEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner: UserEntity | null;

  @ManyToOne(() => PropertyEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'properties_id' })
  property: PropertyEntity;

  @ManyToOne(() => MasterRoomStatusEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_status_id' })
  room_status: MasterRoomStatusEntity;

  @OneToMany(() => RoomMediaEntity, (m) => m.rent_room)
  medias: RoomMediaEntity[];

  @OneToMany(() => RentRoomDocumentEntity, (d) => d.rent_room)
  documents: RentRoomDocumentEntity[];

  @OneToMany(() => RoomLayoutValueEntity, (v) => v.rent_room)
  layout_values: RoomLayoutValueEntity[];

  @OneToMany(() => RoomFacilityEntity, (f) => f.rent_room)
  facilities: RoomFacilityEntity[];
}
