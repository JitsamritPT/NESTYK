import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ServiceCategory } from '@nestyk/types';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { ListingEntity } from './listing.entity';

@Entity({ schema: 'NESTYK_PROPTECH', name: 'service_tickets' })
export class ServiceTicketEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  ticket_number: string;

  @Column({ type: 'varchar', length: 50 })
  category: ServiceCategory; // 'cleaning' | 'maintenance' | 'inspection' | 'viewing' | 'support'

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_at: Date;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  estimated_cost: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'requested_by_user_id' })
  requested_by: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'assigned_to_user_id' })
  assigned_to: UserEntity; // Assistant หรือ ช่าง/แม่บ้าน ที่ได้รับมอบหมาย

  @ManyToOne(() => ListingEntity, { nullable: true })
  @JoinColumn({ name: 'listing_id' })
  listing: ListingEntity;
}
