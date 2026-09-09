import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

/** Load monorepo root `.env.api` (backend only). */
function loadApiEnv() {
  const candidates = [
    resolve(__dirname, '../../../.env.api'), // from apps/api/dist
    resolve(__dirname, '../../.env.api'), // from apps/api/src
    resolve(process.cwd(), '../../.env.api'),
    resolve(process.cwd(), '.env.api'),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    loadEnv({ path });
    return;
  }

  console.warn('[api] No root .env.api found — using process.env only');
}

loadApiEnv();

async function bootstrap() {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('./app.module');

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`NESTYK Backend API is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
