const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
require('reflect-metadata');
// Load the actual Nest classes, including decorator metadata, without a build artifact.
require.extensions['.ts'] = (module, filename) => {
  const source = require('node:fs').readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
  }, fileName: filename }).outputText, filename);
};
const sharp = require('sharp');
const { RoomPhotoStorageService, MAX_ROOM_PHOTO_BYTES } = require('../src/agent/rooms/room-photo-storage.service.ts');
const { RoomImagesController } = require('../src/agent/rooms/room-images.controller.ts');
const { AgentRoomsController } = require('../src/agent/rooms/agent-rooms.controller.ts');
const { AgentRoomsService } = require('../src/agent/rooms/agent-rooms.service.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');

test('real multipart room photo upload, retrieval and ownership validation', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nestyk-photo-test-'));
  process.env.ROOM_PHOTO_DIR = path.join(directory, '.data', 'room-photos');
  process.env.ALLOW_DEV_AUTH = 'true';
  delete process.env.PUBLIC_API_URL;
  const storage = new RoomPhotoStorageService();
  class TestModule {}
  Module({ controllers: [AgentRoomsController, RoomImagesController], providers: [
    { provide: RoomPhotoStorageService, useValue: storage },
    { provide: AgentRoomsService, useValue: {} },
    { provide: AuthService, useValue: {
      findBySupabaseUserId: async () => ({ id: 7 }),
      loadUserWithRoles: async () => ({ id: 7, roleNames: ['agent'] }),
    } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  t.after(async () => { await app.close(); await fs.rm(directory, { recursive: true, force: true }); });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const upload = async (buffer, auth = true) => {
    const body = new FormData();
    body.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'untrusted.jpg');
    return fetch(`${base}/api/v1/agent/rooms/media/upload`, { method: 'POST', body,
      headers: auth ? { Authorization: 'Bearer dev|photo-test|test@example.invalid' } : {} });
  };
  const original = await sharp({ create: { width: 3000, height: 100, channels: 3, background: 'red' } }).png().toBuffer();
  assert.equal((await upload(original, false)).status, 401);
  assert.equal((await upload(Buffer.from('<script>not an image</script>'))).status, 400);
  assert.equal((await upload(Buffer.alloc(MAX_ROOM_PHOTO_BYTES + 1))).status, 413);
  const response = await upload(original);
  assert.equal(response.status, 200);
  const { mediaUrl } = await response.json();
  const imageResponse = await fetch(mediaUrl);
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get('content-type'), 'image/jpeg');
  const metadata = await sharp(Buffer.from(await imageResponse.arrayBuffer())).metadata();
  assert.equal(metadata.width, 2400);
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.exif, undefined);
  await storage.validateRoomPhotos(7, [{ mediaUrl }], base);
  await assert.rejects(storage.validateRoomPhotos(8, [{ mediaUrl }], base));
  await assert.rejects(storage.validateRoomPhotos(7, [{ mediaUrl }, { mediaUrl }], base));
  await assert.rejects(storage.validateRoomPhotos(7, [{ mediaUrl: mediaUrl.replace(base, 'https://evil.invalid') }], base));
  await assert.rejects(storage.validateRoomPhotos(7, [{ mediaUrl: `${base}/api/v1/room-images/7/00000000-0000-4000-8000-000000000000.jpg` }], base));
  await assert.rejects(storage.path('7', '../secret'));
  // Files survive service recreation (not held in process memory).
  await new RoomPhotoStorageService().validateRoomPhotos(7, [{ mediaUrl }], base);
});
