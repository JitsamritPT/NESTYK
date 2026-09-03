import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { UserRole } from '@nestyk/types';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { ListingImageEntity } from './listing-image.entity';

@Entity({ schema: 'NESTYK_PROPTECH', name: 'listings' })
export class ListingEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  project_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  room_type: string; // เช่น '1 Bedroom', 'Studio', '2 Bedrooms'

  @Column({ type: 'varchar', length: 50, nullable: true })
  floor: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  size_sqm: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monthly_rent: number;

  @Column({ type: 'varchar', length: 20, default: 'owner' })
  actor_role: UserRole; // 'owner' | 'agent'

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
  commission_rate: number; // เช่น 3.00% สำหรับ Agent Co-Broke

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'draft' | 'active' | 'rented' | 'inactive';

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by_user_id' })
  created_by: UserEntity;

  @OneToMany(() => ListingImageEntity, (img) => img.listing)
  images: ListingImageEntity[];
}
