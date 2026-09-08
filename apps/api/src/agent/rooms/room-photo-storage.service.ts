import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { access, mkdir, writeFile } from 'fs/promises';
import { resolve, join } from 'path';
import sharp from 'sharp';

export const MAX_ROOM_PHOTO_BYTES = 10 * 1024 * 1024;
const IMAGE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/;

@Injectable()
export class RoomPhotoStorageService {
  // Stable location whether Nest is started from the workspace or apps/api.
  private readonly root = resolve(process.env.ROOM_PHOTO_DIR || join(__dirname, '../../../../../.data/room-photos'));

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
    const name = `${randomUUID()}.jpg`;
    const directory = join(this.root, String(agentId));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, name), image, { flag: 'wx' });
    const base = (process.env.PUBLIC_API_URL || baseUrl).replace(/\/$/, '');
    return { mediaUrl: `${base}/api/v1/room-images/${agentId}/${name}` };
  }

  async path(agentId: string, name: string) {
    if (!/^[1-9]\d*$/.test(agentId) || !IMAGE_NAME.test(name)) throw new NotFoundException();
    const path = join(this.root, agentId, name);
    try { await access(path); } catch { throw new NotFoundException(); }
    return path;
  }

  async validateRoomPhotos(agentId: number, medias: Array<{ mediaUrl: string; mediaType?: string; category?: string }>, baseUrl: string) {
    const expectedOrigin = new URL(process.env.PUBLIC_API_URL || baseUrl).origin;
    const seen = new Set<string>();
    for (const media of medias) {
      let url: URL;
      try { url = new URL(media.mediaUrl); } catch { throw new BadRequestException('Invalid photo URL'); }
      const prefix = `/api/v1/room-images/${agentId}/`;
      if (url.origin !== expectedOrigin || !!url.search || !!url.hash || !!url.username || !!url.password || !['http:', 'https:'].includes(url.protocol) || !url.pathname.startsWith(prefix) || media.mediaType === 'video') {
        throw new BadRequestException('Upload room photos before saving');
      }
      if (seen.has(url.pathname)) throw new BadRequestException('Room photos must be different files');
      seen.add(url.pathname);
      try { await this.path(String(agentId), url.pathname.slice(prefix.length)); }
      catch { throw new BadRequestException('Uploaded photo no longer exists; upload it again'); }
    }
  }
}
