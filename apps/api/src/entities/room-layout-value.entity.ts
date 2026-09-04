import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SerialEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { MasterLayoutEntity } from './master-layout.entity';

@Entity({ name: 'room_layout_values' })
export class RoomLayoutValueEntity extends SerialEntity {
  @Column({ type: 'int' })
  rent_room_id: number;

  @Column({ type: 'int' })
  layout_id: number;

  @Column({ type: 'varchar', length: 64 })
  value: string;

  @ManyToOne(() => RentRoomEntity, (room) => room.layout_values, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rent_room_id' })
  rent_room: RentRoomEntity;

  @ManyToOne(() => MasterLayoutEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'layout_id' })
  layout: MasterLayoutEntity;
}
