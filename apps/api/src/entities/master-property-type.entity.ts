import { Entity, Column } from 'typeorm';
import { SerialEntity } from './base.entity';

@Entity({ name: 'master_property_types' })
export class MasterPropertyTypeEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;
}
