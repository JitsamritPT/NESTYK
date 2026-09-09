import { Entity, Column } from 'typeorm';
import { SerialEntity } from './base.entity';

@Entity({ name: 'master_layouts' })
export class MasterLayoutEntity extends SerialEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;
}
