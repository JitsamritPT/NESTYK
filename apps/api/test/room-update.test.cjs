const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentRoomsService } = require('../src/agent/rooms/agent-rooms.service.ts');
const body = {
  visibility: 'private', contactId: 3, listingTitle: 'Updated title', roomTypeId: 1, listingSourceCode: 'owner',
  property: { name: 'Same property', propertyTypeId: 1, address: 'A', district: 'D', province: 'P' },
  prices: [{ contractTypeId: 1, price: 18000 }], layout: [{ code: 'bedroom', value: '1' }, { code: 'bathroom', value: '1' }],
  medias: Array.from({ length: 5 }, (_, i) => ({ mediaUrl: `https://legacy.example/${i}.jpg`, category: 'room', isCover: i === 1 })),
};
function setup(found = true) {
  const saved = [], removed = [], checkedPhotos = [];
  const manager = {
    findOne: async (entity, options) => {
      switch (entity.name) {
        case 'RentRoomEntity':
          assert.deepEqual(options.where, { id: 9, created_by_user_id: 7, is_scout_room: true });
          assert.equal(options.lock.mode, 'pessimistic_write');
          return found ? { id: 9, properties_id: 5, room_status_id: 2, view_count: 42, listing_description: 'Keep description', available_from_date: '2026-12-01', custom_facilities: ['Keep'], nearby_other: 'Keep nearby', nearby_places: [] } : null;
        case 'ContactEntity': return { id: 3 };
        case 'PropertyEntity': return { id: 5, name: 'Same property', property_type_id: 1, address: 'A', district: 'D', province: 'P', subdistrict: '-', postal_code: '-', latitude: null, longitude: null };
        case 'MasterRoomTypeEntity': return { id: 1 };
        case 'MasterListingSourceEntity': return { id: 1, code: 'owner' };
        case 'MasterRoomStatusEntity': return { id: 1 };
        case 'MasterLayoutEntity': return { id: options.where.code === 'bedroom' ? 1 : 2 };
        case 'RentRoomContactEntity': return { id: 6 };
        default: throw new Error(entity.name);
      }
    },
    find: async (entity) => entity.name === 'RoomMediaEntity' ? body.medias.map((m) => ({ media_url: m.mediaUrl })) : [{ id: 1, code: 'monthly_12' }],
    create: (entity, data) => Object.assign(new entity(), data),
    save: async (row) => { saved.push(row); return row; },
    delete: async (entity, where) => { removed.push([entity.name, where]); },
    update: async () => {},
  };
  const service = new AgentRoomsService({ validateRoomPhotos: async (_, medias) => checkedPhotos.push(...medias) }, { transaction: async (fn) => fn(manager) });
  return { service, saved, removed, checkedPhotos };
}
test('editing saves the same room and preserves status, stats, description and unchanged property', async () => {
  const { service, saved, removed, checkedPhotos } = setup();
  const response = await service.createScoutRoom({ id: 7 }, body, 'http://localhost:4000', 9);
  assert.equal(response.id, 9);
  assert.equal(response.propertyId, 5);
  const room = saved.find((row) => row.constructor.name === 'RentRoomEntity');
  assert.equal(room.room_status_id, 2); assert.equal(room.view_count, 42);
  assert.equal(room.listing_description, 'Keep description'); assert.equal(room.available_from_date, '2026-12-01');
  assert.equal(room.listing_title, 'Updated title'); assert.equal(room.prices[0].price, 18000);
  assert.equal(saved.filter((row) => row.constructor.name === 'RoomMediaEntity').length, 5);
  assert.equal(saved.filter((row) => row.constructor.name === 'RoomMediaEntity' && row.is_cover).length, 1);
  assert.equal(saved.filter((row) => row.constructor.name === 'PropertyEntity').length, 0);
  assert.equal(checkedPhotos.length, 0); // Existing URLs may be retained; new URLs still go through ownership validation.
  assert.ok(removed.every(([, where]) => Object.values(where)[0] === 9));
});
test('editing a missing/foreign room never writes', async () => {
  const { service, saved } = setup(false);
  await assert.rejects(service.createScoutRoom({ id: 7 }, body, 'http://localhost:4000', 9), (error) => error.status === 404);
  assert.equal(saved.length, 0);
});
