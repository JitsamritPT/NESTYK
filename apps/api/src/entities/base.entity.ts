import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/** SERIAL PK — matches docs/new-project schema.sql */
export abstract class SerialEntity {
  @PrimaryGeneratedColumn()
  id: number;
}

export abstract class SerialCreatedEntity extends SerialEntity {
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}

export abstract class SerialTimestampEntity extends SerialEntity {
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
