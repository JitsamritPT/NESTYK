import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '../entities';

const logger = new Logger('DatabaseModule');

function buildTypeOrmOptions() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  const dbSchema = process.env.DB_SCHEMA ?? 'public';
  const isLocalhost =
    databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

  return {
    type: 'postgres' as const,
    url: databaseUrl,
    schema: dbSchema,
    entities: ALL_ENTITIES,
    synchronize: false,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    logging: process.env.NODE_ENV === 'development',
  };
}

const typeOrmRoot = (() => {
  const options = buildTypeOrmOptions();
  if (!options) {
    logger.warn(
      'DATABASE_URL is not provided. Skipping Database Connection for Mock/Skeleton mode.',
    );
    return [];
  }
  return [TypeOrmModule.forRoot(options)];
})();

@Module({
  imports: [...typeOrmRoot, TypeOrmModule.forFeature(ALL_ENTITIES)],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
