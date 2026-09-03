import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ListingEntity } from './listing.entity';

@Entity({ schema: 'NESTYK_PROPTECH', name: 'listing_images' })
export class ListingImageEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 500 })
  image_url: string; // Supabase Storage Public CDN URL

  @Column({ type: 'int', default: 0 })
  display_order: number;

  @Column({ type: 'boolean', default: false })
  is_cover: boolean;

  @ManyToOne(() => ListingEntity, (listing) => listing.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing: ListingEntity;
}
