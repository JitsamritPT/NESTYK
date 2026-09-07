import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { SerialCreatedEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { RentRoomContactEntity } from './rent-room-contact.entity';

@Entity({ name: 'contacts' })
export class ContactEntity extends SerialCreatedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'int' })
  created_by_user_id: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_user_id' })
  created_by: UserEntity;

  @OneToMany(() => RentRoomContactEntity, (link) => link.contact)
  room_links: RentRoomContactEntity[];
}
