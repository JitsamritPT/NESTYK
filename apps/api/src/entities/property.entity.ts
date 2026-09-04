import { Entity, Column } from 'typeorm';
import { SerialTimestampEntity } from './base.entity';

@Entity({ name: 'properties' })
export class PropertyEntity extends SerialTimestampEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  category_code: string | null;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', length: 255, default: '-' })
  subdistrict: string;

  @Column({ type: 'varchar', length: 255 })
  district: string;

  @Column({ type: 'varchar', length: 255 })
  province: string;

  @Column({ type: 'varchar', length: 10, default: '-' })
  postal_code: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;
}
