#!/usr/bin/env node
/**
 * Seed demo room photos into Supabase Storage + room_medias.
 * Fetches real apartment photos from Unsplash (falls back to solid JPEG if offline).
 *
 * Prerequisite:
 *   - nestyk-postgres with agent demo rooms (seed-agent-demo.sh)
 *   - Local or remote Supabase with valid SUPABASE_* in root .env.api
 *   - API deps available (sharp, @supabase/supabase-js, pg) via apps/api
 *
 * Usage (from monorepo root):
 *   ./docs/new-project/docker/seed-agent-photos.sh
 */
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const requireFromApi = createRequire(resolve(ROOT, 'apps/api/package.json'));

const { createClient } = requireFromApi('@supabase/supabase-js');
const sharp = requireFromApi('sharp');
const { Client } = requireFromApi('pg');

function loadEnvApi() {
  const path = resolve(ROOT, '.env.api');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvApi();

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/nestyk_db';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const BUCKET = process.env.SUPABASE_BUCKET_PROPERTIES || 'property-images';
const PHOTOS_PER_ROOM = Number(process.env.DEMO_PHOTOS_PER_ROOM || 5);

/** Unsplash apartment / condo interiors — free for demo seeding */
const DEMO_PHOTO_URLS = [
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=960&h=720&fit=crop&q=80',
  'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=960&h=720&fit=crop&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=960&h=720&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=960&h=720&fit=crop&q=80',
  'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=960&h=720&fit=crop&q=80',
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=960&h=720&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=960&h=720&fit=crop&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=960&h=720&fit=crop&q=80',
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=960&h=720&fit=crop&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=960&h=720&fit=crop&q=80',
];

const FALLBACK_COLORS = [
  { r: 248, g: 182, b: 21 },
  { r: 33, g: 30, b: 30 },
  { r: 37, g: 99, b: 235 },
  { r: 34, g: 197, b: 94 },
  { r: 220, g: 38, b: 38 },
  { r: 100, g: 116, b: 139 },
];

function isPlaceholderSupabase(url, key) {
  return (
    !url ||
    !key ||
    url.includes('your-project-ref') ||
    key.includes('eyJhbGci...') ||
    key.length < 40
  );
}

async function ensureBucket(storage) {
  const { data: buckets, error: listError } = await storage.listBuckets();
  if (listError) throw listError;
  if (buckets?.some((b) => b.name === BUCKET)) return;
  const { error } = await storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg'],
  });
  if (error && !String(error.message || '').toLowerCase().includes('already exists')) {
    throw error;
  }
}

async function makeFallbackJpeg(index) {
  const c = FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  return sharp({
    create: {
      width: 960,
      height: 720,
      channels: 3,
      background: c,
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function fetchPhotoBuffer(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NESTYK-demo-seed/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const raw = Buffer.from(await res.arrayBuffer());
  return sharp(raw).resize(960, 720, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
}

async function makeJpeg(roomIndex, photoIndex) {
  const url = DEMO_PHOTO_URLS[(roomIndex + photoIndex) % DEMO_PHOTO_URLS.length];
  try {
    return await fetchPhotoBuffer(url);
  } catch (err) {
    console.warn(
      `  ⚠ Unsplash fetch failed (${err instanceof Error ? err.message : err}) — solid fallback`,
    );
    return makeFallbackJpeg(photoIndex);
  }
}

async function main() {
  if (isPlaceholderSupabase(SUPABASE_URL, SERVICE_KEY)) {
    console.error(
      'Supabase is not configured (still placeholder).\n' +
        'Run: ./docs/new-project/docker/start-supabase-local.sh\n' +
        'Then put SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY into .env.api',
    );
    process.exit(1);
  }

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  const agentRes = await db.query(
    `SELECT id FROM users WHERE email = 'admin@jitsamrit.com' LIMIT 1`,
  );
  const agentId = agentRes.rows[0]?.id;
  if (!agentId) {
    console.error('Dev user admin@jitsamrit.com not found — run seed-dev-user.sh first');
    process.exit(1);
  }

  const roomsRes = await db.query(
    `SELECT id, room_id FROM rent_rooms
     WHERE created_by_user_id = $1 AND room_id LIKE 'demo-agent-%'
     ORDER BY id ASC`,
    [agentId],
  );
  if (!roomsRes.rows.length) {
    console.error('No demo rooms — run seed-agent-demo.sh first');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storage = supabase.storage;
  await ensureBucket(storage);
  const bucket = storage.from(BUCKET);

  console.log(
    `Seeding ${PHOTOS_PER_ROOM} Unsplash photos × ${roomsRes.rows.length} rooms → ${BUCKET} (agent ${agentId})`,
  );

  let uploaded = 0;
  for (let roomIndex = 0; roomIndex < roomsRes.rows.length; roomIndex++) {
    const room = roomsRes.rows[roomIndex];
    await db.query(`DELETE FROM room_medias WHERE rent_id = $1`, [room.id]);

    for (let i = 0; i < PHOTOS_PER_ROOM; i++) {
      const name = `${randomUUID()}.jpg`;
      const objectPath = `${agentId}/${name}`;
      const body = await makeJpeg(roomIndex, i);
      const { error: upErr } = await bucket.upload(objectPath, body, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = bucket.getPublicUrl(objectPath);
      await db.query(
        `INSERT INTO room_medias (rent_id, media_url, media_type, category, is_cover, sort_order)
         VALUES ($1, $2, 'image', 'room', $3, $4)`,
        [room.id, pub.publicUrl, i === 0, i],
      );
      uploaded += 1;
    }
    console.log(`  ✓ ${room.room_id} (${PHOTOS_PER_ROOM} photos)`);
  }

  await db.end();
  console.log(`Done. Uploaded ${uploaded} demo photos.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
