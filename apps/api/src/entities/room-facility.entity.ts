import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SerialEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { MasterFacilitiesGroupEntity } from './master-facilities-group.entity';
import { MasterFacilityEntity } from './master-facility.entity';

@Entity({ name: 'room_facilities' })
export class RoomFacilityEntity extends SerialEntity {
  @Column({ type: 'int' })
  rent_room_id: number;

  @Column({ type: 'int' })
  group_id: number;

  @Column({ type: 'int' })
  f_id: number;

  @ManyToOne(() => RentRoomEntity, (room) => room.facilities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rent_room_id' })
  rent_room: RentRoomEntity;

  @ManyToOne(() => MasterFacilitiesGroupEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'group_id' })
  group: MasterFacilitiesGroupEntity;

  @ManyToOne(() => MasterFacilityEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'f_id' })
  facility: MasterFacilityEntity;
}
