import { Entity, Column } from 'typeorm';
import { SerialEntity } from './base.entity';

@Entity({ name: 'master_room_statuses' })
export class MasterRoomStatusEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 32, unique: true })
  code: string;
}
