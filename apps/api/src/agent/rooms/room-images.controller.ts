import { Controller, Get, Param, Res } from '@nestjs/common';
import { RoomPhotoStorageService } from './room-photo-storage.service';

// Room images are served by unguessable URLs, like public object-storage URLs.
// Do not use this endpoint for identity, bank or ownership documents.
@Controller('room-images')
export class RoomImagesController {
  constructor(private readonly photos: RoomPhotoStorageService) {}

  @Get(':agentId/:name')
  async get(@Param('agentId') agentId: string, @Param('name') name: string,
    @Res() response: { setHeader(name: string, value: string): void; sendFile(path: string, options: { dotfiles: 'allow' }): void }) {
    const path = await this.photos.path(agentId, name);
    response.setHeader('Content-Type', 'image/jpeg');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'public, max-age=86400');
    // The validated storage path lives under .data; Express otherwise returns 404 for dot-directories.
    response.sendFile(path, { dotfiles: 'allow' });
  }
}
