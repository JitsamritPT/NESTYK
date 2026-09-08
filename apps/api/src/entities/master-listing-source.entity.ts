import { Entity, Column } from 'typeorm';
import { SerialEntity } from './base.entity';

@Entity({ name: 'master_listing_sources' })
export class MasterListingSourceEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
