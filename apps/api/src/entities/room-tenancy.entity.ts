import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SerialTimestampEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { TenantEntity } from './tenant.entity';
import { UserEntity } from './user.entity';

export type RoomTenancyStatus = 'prospect' | 'active' | 'moved_out';

@Entity({ name: 'room_tenancies' })
export class RoomTenancyEntity extends SerialTimestampEntity {
  @Column({ type: 'int' })
  rent_room_id: number;

  @Column({ type: 'int' })
  tenant_id: number;

  @Column({ type: 'varchar', length: 20, default: 'prospect' })
  status: RoomTenancyStatus;

  @Column({ type: 'date', nullable: true })
  move_in_date: string | null;

  @Column({ type: 'date', nullable: true })
  move_out_date: string | null;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @ManyToOne(() => RentRoomEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rent_room_id' })
  rent_room: RentRoomEntity;

  @ManyToOne(() => TenantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: TenantEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  created_by: UserEntity;
}
