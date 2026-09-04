import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SerialCreatedEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';

@Entity({ name: 'rent_room_documents' })
export class RentRoomDocumentEntity extends SerialCreatedEntity {
  @Column({ type: 'int' })
  rent_id: number;

  @Column({ type: 'varchar', length: 32 })
  kind: 'id_passport' | 'bookbank' | 'ownership' | 'other';

  @Column({ type: 'varchar', length: 500 })
  media_url: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @ManyToOne(() => RentRoomEntity, (room) => room.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rent_id' })
  rent_room: RentRoomEntity;
}
