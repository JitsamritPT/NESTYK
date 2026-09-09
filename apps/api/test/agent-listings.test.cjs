const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
};
const { AgentListingsService } = require('../src/agent/listings/agent-listings.service.ts');
const { AgentListingsController } = require('../src/agent/listings/agent-listings.controller.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const room = {
  id: 22, created_by_user_id: 7, is_scout_room: true, listing_title: 'Test room',
  visibility: 'private', prices: [{ contractTypeCode: 'monthly_12', price: 999 }],
  price_rows: [
    { contract_type_id: 1, price: '15000.00', contract_type: { code: 'monthly_12', term_months: 12 } },
    { contract_type_id: 2, price: '18000.00', contract_type: { code: 'monthly_6', term_months: 6 } },
  ],
  medias: [{ id: 1, media_url: 'first.jpg', media_type: 'image', is_cover: false, sort_order: 0 },
    { id: 2, media_url: 'cover.jpg', media_type: 'image', is_cover: true, sort_order: 1 }],
  room_contacts: [
    { is_primary: true, contact: { id: 3, created_by_user_id: 7, name: 'Own contact', phone: '123' } },
    { is_primary: false, contact: { id: 4, created_by_user_id: 8, name: 'Other agent secret', phone: '456' } },
  ],
  layout_values: [{ layout: { code: 'bedroom' }, value: '1' }],
  facilities: [], custom_facilities: [],
  owner_identity_number: 'must-not-leak', documents: [{ id: 1, kind: 'ownership', media_url: 'https://example.com/ownership.pdf', sort_order: 0 }],
};

test('detail endpoint scopes access, returns all prices and cover first, excludes sensitive fields', async (t) => {
  process.env.ALLOW_DEV_AUTH = 'true';
  const service = new AgentListingsService({ findOne: async ({ where }) =>
    where.id === 22 && where.created_by_user_id === 7 && where.is_scout_room ? room : null });
  class TestModule {}
  Module({ controllers: [AgentListingsController], providers: [
    { provide: AgentListingsService, useValue: service },
    { provide: AuthService, useValue: {
      findBySupabaseUserId: async (id) => ({ id: Number(id) }),
      loadUserWithRoles: async (id) => ({ id, roleNames: ['agent'] }),
    } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  t.after(() => app.close());
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const get = (id, agent = 7) => fetch(`${base}/api/v1/agent/listings/${id}`, { headers: { Authorization: `Bearer dev|${agent}|test@example.invalid` } });
  assert.equal((await fetch(`${base}/api/v1/agent/listings/22`)).status, 401);
  assert.equal((await get('abc')).status, 400);
  assert.equal((await get(22, 8)).status, 404);
  assert.equal((await get(99)).status, 404);
  const response = await get(22);
  assert.equal(response.status, 200);
  const detail = await response.json();
  assert.deepEqual(detail.prices.map((p) => p.price), [18000, 15000]);
  assert.equal(detail.medias[0].mediaUrl, 'cover.jpg');
  assert.equal(detail.contacts.length, 1);
  assert.equal(detail.layout[0].value, '1');
  assert.deepEqual(detail.documents, [{ kind: 'ownership', mediaUrl: 'https://example.com/ownership.pdf', sortOrder: 0 }]);
  assert.deepEqual(detail.facilityItems, []);
  assert.deepEqual(detail.customFacilities, []);
  assert.equal(detail.owner_identity_number, undefined);
});

test('list paginates distinct room IDs and uses all normalized prices', async () => {
  const calls = [];
  const qb = {};
  for (const name of ['leftJoin','where','andWhere','select','distinct','orderBy','offset','limit']) qb[name] = (...args) => { calls.push([name, ...args]); return qb; };
  qb.clone = () => qb;
  qb.getCount = async () => 41;
  qb.getRawMany = async () => [{ id: 22 }];
  const service = new AgentListingsService({ createQueryBuilder: () => qb, find: async ({ where }) => {
    assert.equal(where.created_by_user_id, 7); return [room];
  } });
  const result = await service.listMine(7, { page: 2, limit: 20, q: 'test', visibility: 'private' });
  assert.equal(result.total, 41);
  assert.equal(result.items[0].prices.length, 2);
  assert.equal(result.items[0].coverMediaUrl, 'cover.jpg');
  assert.ok(calls.some(([name, value]) => name === 'distinct' && value === true));
  assert.ok(calls.some(([name, value]) => name === 'offset' && value === 20));
  assert.ok(calls.some(([name, sql, params]) => name === 'andWhere' && params?.q === '%test%'));
});
