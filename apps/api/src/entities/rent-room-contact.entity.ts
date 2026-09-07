import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SerialCreatedEntity } from './base.entity';
import { RentRoomEntity } from './rent-room.entity';
import { ContactEntity } from './contact.entity';

@Entity({ name: 'rent_room_contacts' })
export class RentRoomContactEntity extends SerialCreatedEntity {
  @Column({ type: 'int' })
  rent_room_id: number;

  @Column({ type: 'int' })
  contact_id: number;

  @Column({ type: 'boolean', default: true })
  is_primary: boolean;

  @Column({ type: 'varchar', length: 64, default: 'contact' })
  role_code: string;

  @ManyToOne(() => RentRoomEntity, (room) => room.room_contacts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rent_room_id' })
  rent_room: RentRoomEntity;

  @ManyToOne(() => ContactEntity, (contact) => contact.room_links, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'contact_id' })
  contact: ContactEntity;
}
