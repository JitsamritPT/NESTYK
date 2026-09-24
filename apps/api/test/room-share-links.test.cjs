const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText,
    filename,
  );

const { createHash } = require('node:crypto');
const { RoomShareLinksService } = require('../src/agent/listings/room-share-links.service.ts');
const { RoomShareLinkEntity } = require('../src/entities/room-share-link.entity.ts');
const { RentRoomEntity } = require('../src/entities/rent-room.entity.ts');
const { RentRoomContactEntity } = require('../src/entities/rent-room-contact.entity.ts');
const {
  hashShareLinkToken,
  isShareLinkExpired,
  shareLinkExpiresAt,
} = require('../src/common/share-link-token.ts');

function roomFixture(overrides = {}) {
  return {
    id: 42,
    created_by_user_id: 7,
    is_scout_room: true,
    listing_title: 'INTERNAL-ONLY',
    promo_title: 'Wind Sukhumvit 23',
    listing_description: 'Nice room',
    room_id: '1804',
    visibility: 'private',
    available_from_date: '2026-10-01',
    advance_rent_months: 1,
    deposit_months: 2,
    latitude: '13.7',
    longitude: '100.5',
    custom_facilities: [],
    nearby_places: [{ placeId: 'p1', name: 'BTS', type: 'subway_station', distanceMeters: 200 }],
    nearby_other: null,
    property: {
      id: 1,
      name: 'Wind',
      address: 'secret-addr',
      subdistrict: 'x',
      district: 'Watthana',
      province: 'Bangkok',
      postal_code: '10110',
      latitude: '13.7',
      longitude: '100.5',
      property_type: { code: 'condo' },
    },
    room_type: { code: 'one_bedroom' },
    room_status: { code: 'available' },
    medias: [
      { id: 1, media_url: 'https://cdn.example/a.jpg', media_type: 'image', is_cover: true, sort_order: 0 },
    ],
    price_rows: [
      { contract_type_id: 1, price: '16000', contract_type: { code: '12m', term_months: 12 } },
    ],
    layout_values: [{ layout: { code: 'bedroom' }, value: '1' }],
    facilities: [{ facility: { code: 'air_conditioning', group: { code: 'appliances' } } }],
    room_contacts: [
      {
        contact_id: 9,
        is_primary: true,
        contact: {
          id: 9,
          name: 'Agent A',
          phone: '081',
          email: null,
          line_id: null,
          facebook: null,
          note: 'SECRET NOTE',
          created_by_user_id: 7,
        },
      },
    ],
    ...overrides,
  };
}

test('share-link-token helpers match sign-invite pattern', () => {
  const expires = shareLinkExpiresAt(7 * 24 * 60 * 60 * 1000, new Date('2026-09-23T00:00:00Z'));
  assert.equal(expires.toISOString(), '2026-09-30T00:00:00.000Z');
  assert.equal(isShareLinkExpired(new Date('2020-01-01T00:00:00Z')), true);
  assert.equal(isShareLinkExpired(new Date('2099-01-01T00:00:00Z')), false);
  assert.equal(hashShareLinkToken('abc').length, 64);
});

test('create returns url once; publicResolve strips internal fields', async () => {
  process.env.PUBLIC_WEB_URL = 'https://web.example';
  const room = roomFixture();
  const links = [];
  const service = new RoomShareLinksService(
    {
      create: (row) => row,
      save: async (row) => {
        const saved = { id: links.length + 1, created_at: new Date(), ...row };
        links.push(saved);
        return saved;
      },
      find: async () => links,
      findOne: async ({ where }) => {
        if (where.token_hash) return links.find((l) => l.token_hash === where.token_hash) || null;
        if (where.id) return links.find((l) => l.id === where.id) || null;
        return null;
      },
    },
    {
      findOne: async ({ where }) => {
        if (where.id === room.id && where.created_by_user_id === 7) return room;
        if (where.id === room.id && where.is_scout_room) return room;
        return null;
      },
    },
    {
      createQueryBuilder: () => {
        const qb = {
          innerJoinAndSelect: () => qb,
          where: () => qb,
          andWhere: () => qb,
          orderBy: () => qb,
          addOrderBy: () => qb,
          getOne: async () => room.room_contacts[0],
        };
        return qb;
      },
    },
  );

  const created = await service.create(7, 42, {
    expiresInDays: 7,
    shareSections: {
      photos: true,
      price: true,
      facilities: true,
      location: false,
      contact: true,
    },
    contactId: 9,
  });
  assert.match(created.url, /^https:\/\/web\.example\/s\/[A-Za-z0-9_-]+$/);
  assert.equal(created.status, 'active');
  const token = created.url.split('/s/')[1];

  const pub = await service.publicResolve(token);
  assert.equal(pub.listingTitle, null);
  assert.equal(pub.roomId, null);
  assert.equal(pub.listingSourceCode, null);
  assert.deepEqual(pub.documents, []);
  assert.equal(pub.contacts[0]?.note, undefined);
  assert.equal(pub.latitude, null);
  assert.equal(pub.longitude, null);
  assert.equal(pub.nearbyPlaces.length, 0);
  assert.equal(pub.medias.length, 1);
  assert.equal(pub.prices[0].price, 16000);

  const listed = await service.list(7, 42);
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].url, undefined);
  assert.ok(!('token' in listed.items[0]));
});

test('expired and revoked links are rejected', async () => {
  const room = roomFixture();
  const token = 'a'.repeat(32);
  const links = [
    {
      id: 1,
      rent_room_id: 42,
      created_by_user_id: 7,
      token_hash: hashShareLinkToken(token),
      expires_at: new Date('2020-01-01T00:00:00Z'),
      revoked_at: null,
      share_sections: {
        photos: true,
        price: true,
        facilities: true,
        location: true,
        contact: true,
      },
      contact_id: 9,
      created_at: new Date(),
    },
  ];
  const service = new RoomShareLinksService(
    {
      findOne: async ({ where }) => links.find((l) => l.token_hash === where.token_hash) || null,
      save: async (row) => row,
    },
    { findOne: async () => room },
    { createQueryBuilder: () => ({ getOne: async () => null }) },
  );
  await assert.rejects(() => service.publicResolve(token), /expired/i);

  links[0].expires_at = new Date('2099-01-01T00:00:00Z');
  links[0].revoked_at = new Date();
  await assert.rejects(() => service.publicResolve(token), /disabled/i);
});
