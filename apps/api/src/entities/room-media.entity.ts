import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SerialCreatedEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';

@Entity({ name: 'room_medias' })
export class RoomMediaEntity extends SerialCreatedEntity {
  @Column({ type: 'int' })
  rent_id: number;

  @Column({ type: 'varchar', length: 500 })
  media_url: string;

  @Column({ type: 'varchar', length: 16, default: 'image' })
  media_type: 'image' | 'video';

  @Column({ type: 'varchar', length: 32, default: 'room' })
  category: 'room' | 'common' | 'floorplan';

  @Column({ type: 'boolean', default: false })
  is_cover: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @ManyToOne(() => RentRoomEntity, (room) => room.medias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rent_id' })
  rent_room: RentRoomEntity;
}
