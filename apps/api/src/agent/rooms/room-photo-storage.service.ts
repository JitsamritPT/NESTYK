import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

export const MAX_ROOM_PHOTO_BYTES = 10 * 1024 * 1024;
const IMAGE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/;

@Injectable()
export class RoomPhotoStorageService {
  private client?: SupabaseClient;
  private readonly bucket = process.env.SUPABASE_BUCKET_PROPERTIES || 'property-images';

  private bucketReady?: Promise<void>;

  private async ensureBucket() {
    this.storage();
    this.bucketReady ??= (async () => {
      const storage = this.client!.storage;
      const { data, error } = await storage.listBuckets();
      if (error) throw new ServiceUnavailableException('Unable to check room photo storage');
      if (data?.some((bucket) => bucket.name === this.bucket)) return;
      const { error: createError } = await storage.createBucket(this.bucket, {
        public: true, fileSizeLimit: MAX_ROOM_PHOTO_BYTES, allowedMimeTypes: ['image/jpeg'],
      });
      if (createError && !createError.message.toLowerCase().includes('already exists')) {
        throw new ServiceUnavailableException('Unable to initialize room photo storage');
      }
    })().catch((error) => {
      this.bucketReady = undefined;
      throw error;
    });
    await this.bucketReady;
  }

  private storage() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new ServiceUnavailableException('Room photo storage is not configured');
    this.client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    return this.client.storage.from(this.bucket);
  }

  async upload(agentId: number, file: { buffer: Buffer; size: number } | undefined, baseUrl: string) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose an image file');
    if (file.buffer.length > MAX_ROOM_PHOTO_BYTES) throw new BadRequestException('Photo must be 10 MB or smaller');
    let image: Buffer;
    try {
      const input = sharp(file.buffer, { limitInputPixels: 40_000_000, failOn: 'warning' });
      const metadata = await input.metadata();
      if (!['jpeg', 'png', 'webp', 'heif', 'avif'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image');
      // Decode and re-encode: reject corrupt/non-image uploads, normalize orientation,
      // remove EXIF (including GPS), and bound the stored image dimensions.
      image = await input.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch {
      throw new BadRequestException('Use a valid JPEG, PNG or WebP image (up to 40 megapixels)');
    }
    await this.ensureBucket();
    const name = `${randomUUID()}.jpg`;
    const storage = this.storage();
    const objectPath = `${agentId}/${name}`;
    const { error } = await storage.upload(objectPath, image, {
      contentType: 'image/jpeg', cacheControl: '31536000', upsert: false,
    });
    if (error) throw new ServiceUnavailableException('Unable to upload room photo; please try again');
    return { mediaUrl: storage.getPublicUrl(objectPath).data.publicUrl };
  }

  async validateRoomPhotos(agentId: number, medias: Array<{ mediaUrl: string; mediaType?: string; category?: string }>, baseUrl: string) {
    const seen = new Set<string>();
    for (const media of medias) {
      let url: URL;
      try { url = new URL(media.mediaUrl); } catch { throw new BadRequestException('Invalid photo URL'); }
      if (!!url.search || !!url.hash || !!url.username || !!url.password || !['http:', 'https:'].includes(url.protocol) || media.mediaType === 'video') {
        throw new BadRequestException('Upload room photos before saving');
      }
      if (seen.has(url.href)) throw new BadRequestException('Room photos must be different files');
      seen.add(url.href);
      const storage = this.storage();
      const prefix = storage.getPublicUrl(`${agentId}/`).data.publicUrl;
      const name = media.mediaUrl.slice(prefix.length);
      if (!media.mediaUrl.startsWith(prefix) || !IMAGE_NAME.test(name)) {
        throw new BadRequestException('Upload room photos before saving');
      }
      const { data, error } = await storage.exists(`${agentId}/${name}`);
      if (error) throw new ServiceUnavailableException('Unable to verify room photo; please try again');
      if (!data) throw new BadRequestException('Uploaded photo no longer exists; upload it again');
    }
  }
}
