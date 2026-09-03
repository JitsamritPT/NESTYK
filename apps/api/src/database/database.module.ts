import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_PROPTECH_ENTITIES } from '../entities';

const logger = new Logger('DatabaseModule');

const databaseUrl = process.env.DATABASE_URL;

@Module({
  imports: [
    ...(databaseUrl
      ? [
          TypeOrmModule.forRoot({
            type: 'postgres',
            url: databaseUrl,
            schema: 'NESTYK_PROPTECH',
            entities: ALL_PROPTECH_ENTITIES,
            synchronize: process.env.NODE_ENV !== 'production', // ห้าม sync บน production
            ssl: {
              rejectUnauthorized: false, // สำหรับ Supabase connection
            },
            logging: process.env.NODE_ENV === 'development',
          }),
        ]
      : (() => {
          logger.warn(
            '⚠️  DATABASE_URL is not provided. Skipping Database Connection for Mock/Skeleton mode.',
          );
          return [];
        })()),
    TypeOrmModule.forFeature(ALL_PROPTECH_ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
