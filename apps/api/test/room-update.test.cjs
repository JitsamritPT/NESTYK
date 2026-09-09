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
        case 'MasterFacilityEntity': return options.where.code === 'air_conditioner' ? { id: 11, group_id: 2 } : null;
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

test('editing replaces optional details, facilities and documents, including explicit removal', async () => {
  const { service, saved, removed } = setup();
  await service.createScoutRoom({ id: 7 }, { ...body, listingDescription: 'Bright corner room', availableFromDate: '2028-02-29', nearbyOther: 'BTS 500 m', customFacilities: ['Desk'], facilities: [], documents: [{ kind: 'ownership', mediaUrl: 'https://example.com/ownership.pdf' }] }, 'http://localhost:4000', 9);
  const room = saved.find((row) => row.constructor.name === 'RentRoomEntity');
  assert.equal(room.listing_description, 'Bright corner room');
  assert.equal(room.available_from_date, '2028-02-29');
  assert.equal(room.nearby_other, 'BTS 500 m');
  assert.deepEqual(room.custom_facilities, ['Desk']);
  assert.ok(removed.some(([entity]) => entity === 'RoomFacilityEntity'));
  assert.ok(removed.some(([entity]) => entity === 'RentRoomDocumentEntity'));
  assert.equal(saved.find((row) => row.constructor.name === 'RentRoomDocumentEntity').kind, 'ownership');
  const empty = setup();
  await empty.service.createScoutRoom({ id: 7 }, { ...body, listingDescription: '', nearbyOther: '', customFacilities: [], facilities: [], documents: [] }, 'http://localhost:4000', 9);
  const cleared = empty.saved.find((row) => row.constructor.name === 'RentRoomEntity');
  assert.equal(cleared.listing_description, ''); assert.equal(cleared.nearby_other, '');
  assert.deepEqual(cleared.custom_facilities, []);
  assert.ok(empty.removed.some(([entity]) => entity === 'RentRoomDocumentEntity'));
});

test('omitting optional collections preserves the existing collections', async () => {
  const { service, saved, removed } = setup();
  await service.createScoutRoom({ id: 7 }, body, 'http://localhost:4000', 9);
  assert.ok(!removed.some(([entity]) => ['RoomFacilityEntity', 'RentRoomDocumentEntity'].includes(entity)));
  assert.deepEqual(saved.find((row) => row.constructor.name === 'RentRoomEntity').custom_facilities, ['Keep']);
});

for (const invalid of [
  { availableFromDate: '2026-02-29' }, { availableFromDate: '2026-13-01' },
  { availableFromDate: '2026-09-09T00:00:00Z' }, { listingDescription: 'x'.repeat(10001) },
  { nearbyOther: 'x'.repeat(501) }, { customFacilities: [null] }, { facilities: [null] },
  { documents: [{ kind: 'other', mediaUrl: 'javascript:alert(1)' }] },
  { documents: [{ kind: 'invalid', mediaUrl: 'https://example.com/doc' }] },
  { facilities: [{ code: 'ac', groupCode: 'room' }, { code: 'ac', groupCode: 'room' }] },
]) test(`invalid additional details rejected before writing: ${Object.keys(invalid)[0]} ${JSON.stringify(invalid).slice(0, 70)}`, async () => {
  const { service, saved } = setup();
  await assert.rejects(service.createScoutRoom({ id: 7 }, { ...body, ...invalid }, 'http://localhost:4000', 9), (error) => error.status === 400);
  assert.equal(saved.length, 0);
});

test('existing rooms can replace catalog facilities and unknown codes are rejected', async () => {
  const { service, saved } = setup();
  await service.createScoutRoom({ id: 7 }, { ...body, facilities: [{ code: 'air_conditioner', groupCode: 'room' }] }, 'http://localhost:4000', 9);
  const facility = saved.find((row) => row.constructor.name === 'RoomFacilityEntity');
  assert.equal(facility.f_id, 11); assert.equal(facility.rent_room_id, 9);
  await assert.rejects(setup().service.createScoutRoom({ id: 7 }, { ...body, facilities: [{ code: 'unknown', groupCode: 'room' }] }, 'http://localhost:4000', 9), (error) => error.status === 400);
});

test('nearby pins round-trip with server-calculated distance and explicit clearing', async () => {
  const context = setup();
  await context.service.createScoutRoom({ id: 7 }, { ...body, latitude: 13.75, longitude: 100.5, nearbyPlaces: [{ placeId: 'custom-1', name: ' Market ', type: 'custom_nearby', latitude: 13.751, longitude: 100.5, distanceMeters: 99999 }] }, 'http://localhost:4000', 9);
  const saved = context.saved.find((row) => row.constructor.name === 'RentRoomEntity');
  assert.equal(saved.nearby_places[0].name, 'Market');
  assert.equal(saved.nearby_places[0].distanceMeters, 111);
  const cleared = setup();
  await cleared.service.createScoutRoom({ id: 7 }, { ...body, nearbyPlaces: [] }, 'http://localhost:4000', 9);
  assert.deepEqual(cleared.saved.find((row) => row.constructor.name === 'RentRoomEntity').nearby_places, []);
});

for (const medias of [[], undefined]) test(`private room can be created without photos (${medias ? 'empty' : 'omitted'})`, async () => {
  const { service, saved, checkedPhotos } = setup();
  await service.createScoutRoom({ id: 7 }, { ...body, propertyId: 5, medias }, 'http://localhost:4000');
  assert.ok(saved.some((row) => row.constructor.name === 'RentRoomEntity'));
  assert.equal(saved.filter((row) => row.constructor.name === 'RoomMediaEntity').length, 0);
  assert.equal(checkedPhotos.length, 0);
});
test('private room without photos can be edited later', async () => {
  const { service, saved } = setup();
  await service.createScoutRoom({ id: 7 }, { ...body, medias: [], listingDescription: 'Added later' }, 'http://localhost:4000', 9);
  assert.equal(saved.find((row) => row.constructor.name === 'RentRoomEntity').listing_description, 'Added later');
});
test('published room still requires at least five photos', async () => {
  const { service, saved } = setup();
  await assert.rejects(service.createScoutRoom({ id: 7 }, { ...body, visibility: 'published', medias: [] }, 'http://localhost:4000'), /at least 5/);
  assert.equal(saved.length, 0);
});
