import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { isAbsolute, resolve } from 'path';

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
    resolveVertexCredentialsEnv(path);
    return;
  }

  console.warn('[api] No root .env.api found — using process.env only');
}

/** Make service-account JSON path absolute so Google Auth finds it. */
function resolveVertexCredentialsEnv(envFilePath: string) {
  const raw = (
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.VERTEX_CREDENTIALS ||
    ''
  )
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (!raw) return;

  const envDir = resolve(envFilePath, '..');
  const candidates = [
    isAbsolute(raw) ? raw : null,
    resolve(envDir, raw),
    resolve(process.cwd(), raw),
  ].filter((p): p is string => Boolean(p));

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
    return;
  }
}

loadApiEnv();

async function bootstrap() {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('./app.module');
  type NestExpressApplication =
    import('@nestjs/platform-express').NestExpressApplication;

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Signature PNGs arrive as base64 data URLs — default Express 100kb is too small.
  app.useBodyParser('json', { limit: '3mb' });
  app.enableCors();
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`NESTYK Backend API is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
