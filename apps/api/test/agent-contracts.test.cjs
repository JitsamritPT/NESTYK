const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentContractsService, validateContract } = require('../src/agent/contracts/agent-contracts.service.ts');
const { AgentContractsController } = require('../src/agent/contracts/agent-contracts.controller.ts');
const { LeadEntity } = require('../src/entities/lead.entity.ts');
const { RentRoomEntity } = require('../src/entities/rent-room.entity.ts');
const { RoomTenancyEntity } = require('../src/entities/room-tenancy.entity.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const valid = { leadId: 1, startDate: '2026-10-01', endDate: '2027-09-30', monthlyRent: 15000, deposit: 30000 };

test('validates actual calendar dates, financial precision and required fields', () => {
  assert.deepEqual(validateContract({ ...valid, notes: ' hello ', status: 'active' }), { ...valid, notes: 'hello' });
  for (const patch of [{ leadId: 0 }, { leadId: '1' }, { startDate: '2026-02-30' }, { startDate: '01/10/2026' }, { endDate: '2026-10-01' }, { monthlyRent: 0 }, { monthlyRent: 1.111 }, { deposit: -1 }, { deposit: Infinity }, { notes: 7 }]) assert.throws(() => validateContract({ ...valid, ...patch }));
  assert.equal(validateContract({ ...valid, startDate: '2024-02-29', deposit: 0 }).deposit, 0);
});
function fixture({ status = 'booked', overlap = 0, foreignRoom = false, failSave = false } = {}) {
  const saved = []; const calls = []; let rolledBack = false;
  const qb = {};
  for (const key of ['leftJoin', 'where', 'andWhere']) qb[key] = (...args) => { calls.push([key, ...args]); return qb; };
  qb.getCount = async () => overlap;
  const manager = {
    findOne: async (entity, options) => {
      calls.push(['findOne', entity.name, options]);
      assert.equal(options.where.created_by_user_id, 7);
      assert.equal(options.lock.mode, 'pessimistic_write');
      if (entity === LeadEntity) return { id: 1, status, tenant_id: 2, rent_room_id: 3 };
      if (entity === RentRoomEntity) return foreignRoom ? null : { id: 3, property_owner_id: 4, owner_id: 5 };
    },
    findOneBy: async (_, options) => { assert.deepEqual(options, { id: 2, lead_id: 1, created_by_user_id: 7 }); return { id: 2 }; },
    getRepository: () => ({ createQueryBuilder: () => qb }),
    create: (_, data) => data,
    save: async (entity, data) => { if (failSave && entity !== RoomTenancyEntity) throw Error('database failure'); const row = { id: saved.length + 10, ...data }; saved.push(row); return row; },
  };
  const service = new AgentContractsService({ getRepository: () => ({ findOneBy: async ({code}) => ({ code, form_kind: code === 'reservation' ? 'reservation' : 'lease' }) }), transaction: async fn => { try { return await fn(manager); } catch (e) { saved.length = 0; rolledBack = true; throw e; } } });
  service.view = async (agentId, id) => { assert.equal(agentId, 7); return saved.find(c => c.id === id); };
  return { service, saved, calls, rolledBack: () => rolledBack };
}
test('creates tenancy and draft using server-owned identity and locked room', async () => {
  const f = fixture(); const c = await f.service.create(7, { ...valid, status: 'active', created_by_user_id: 99, tenantId: 99 });
  assert.equal(c.status, 'draft'); assert.equal(c.created_by_user_id, 7); assert.equal(c.tenant_id, 2); assert.equal(c.room_tenancy_id, 10); assert.equal(c.monthly_rent, '15000.00');
  assert.equal(f.saved[0].status, 'prospect');
  assert.ok(f.calls.some(c => c[0] === 'andWhere' && c[1].includes('c.end_date >= :start')));
});
test('rejects unbooked leads, unauthorized rooms and overlapping contracts without writes', async () => {
  for (const options of [{ status: 'viewed' }, { foreignRoom: true }, { overlap: 1 }]) { const f = fixture(options); await assert.rejects(() => f.service.create(7, valid)); assert.equal(f.saved.length, 0); }
});
test('failed contract save rolls back the tenancy transaction', async () => {
  const f = fixture({ failSave: true }); await assert.rejects(() => f.service.create(7, valid), /database failure/); assert.equal(f.saved.length, 0); assert.equal(f.rolledBack(), true);
});
test('list and detail scope records to the current agent and exclude private entity fields', async () => {
  const calls = []; const qb = {};
  for (const key of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[key] = (...args) => { calls.push([key, ...args]); return qb; };
  qb.getMany = async () => [{ id: 1, status: 'draft', rent_room: { property: { name: 'Test' }, owner_identity_number: 'SECRET' }, tenant: { name: 'A', phone: 'PRIVATE' }, monthly_rent: '15000' }];
  qb.getOne = async () => null;
  const service = new AgentContractsService({ getRepository: () => ({ createQueryBuilder: () => qb }) });
  const result = await service.list(7); assert.equal(result[0].monthlyRent, 15000); assert.ok(!JSON.stringify(result).includes('SECRET')); assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  await assert.rejects(() => service.view(9, 1), e => e.getStatus() === 404);
  assert.ok(calls.some(c => c[0] === 'where' && c[2].agentId === 7)); assert.ok(calls.some(c => c[0] === 'where' && c[2].agentId === 9));
});
test('HTTP endpoints require authentication and agent role', async t => {
  const previous = process.env.ALLOW_DEV_AUTH; process.env.ALLOW_DEV_AUTH = 'true';
  t.after(() => { if (previous === undefined) delete process.env.ALLOW_DEV_AUTH; else process.env.ALLOW_DEV_AUTH = previous; });
  class TestModule {}
  Module({ controllers: [AgentContractsController], providers: [
    { provide: AgentContractsService, useValue: { list: async id => [{ agentId: id }], candidates: async () => [], create: async (id, input) => ({ ...validateContract(input), agentId: id }) } },
    { provide: AuthService, useValue: { findBySupabaseUserId: async id => ({ id: Number(id) }), loadUserWithRoles: async id => ({ id, roleNames: id === 7 ? ['agent'] : ['tenant'] }) } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false }); await app.listen(0, '127.0.0.1'); t.after(() => app.close());
  const base = await app.getUrl(); const path = `${base}/agent/contracts`;
  const headers = id => ({ Authorization: `Bearer dev|${id}|test@example.invalid`, 'Content-Type': 'application/json' });
  assert.equal((await fetch(path)).status, 401);
  assert.equal((await fetch(path, { headers: headers(8) })).status, 403);
  assert.deepEqual(await (await fetch(path, { headers: headers(7) })).json(), [{ agentId: 7 }]);
  assert.equal((await fetch(`${path}/candidates`, { headers: headers(7) })).status, 200);
  assert.equal((await fetch(path, { method: 'POST', headers: headers(7), body: '{}' })).status, 400);
  const created = await fetch(path, { method: 'POST', headers: headers(7), body: JSON.stringify(valid) }); assert.equal(created.status, 201); assert.equal((await created.json()).agentId, 7);
});

test('reservation validates booking fee independently from rent and deposit', () => {
  const body = { leadId: 1, agreementTypeCode: 'reservation', startDate: '2026-10-01', endDate: '2026-10-15', reservationFee: 5000 };
  const result = validateContract(body, 'reservation');
  assert.equal(result.reservationFee, 5000); assert.equal(result.monthlyRent, undefined); assert.equal(result.deposit, undefined);
  for (const reservationFee of [undefined, -1, 1.111, Infinity, '5000']) assert.throws(() => validateContract({...body, reservationFee}, 'reservation'));
});
test('reservation drafts persist their master code and booking fee without monthly rent', async () => {
  const f = fixture();
  const c = await f.service.create(7, { leadId: 1, agreementTypeCode: 'reservation', startDate: '2026-10-01', endDate: '2026-10-15', reservationFee: 5000 });
  assert.equal(c.agreement_type_code, 'reservation'); assert.equal(c.reservation_fee, '5000.00'); assert.equal(c.monthly_rent, null); assert.equal(c.deposit, null);
  assert.ok(f.calls.some(call => call[2]?.isLease === false));
});
test('lease creation excludes only the same tenant reservation from overlap checks', async () => {
  const f = fixture(); await f.service.create(7, valid);
  const clause = f.calls.find(call => call[1]?.includes?.('agreementType.form_kind'));
  assert.ok(clause[1].includes('c.tenant_id = :tenantId')); assert.equal(clause[2].isLease, true); assert.equal(clause[2].tenantId, 2);
});
test('inactive or unknown master type is rejected before transaction', async () => {
  const service = new AgentContractsService({ getRepository: () => ({findOneBy: async () => null}), transaction: () => assert.fail('Must not write') });
  await assert.rejects(() => service.create(7, {...valid, agreementTypeCode:'unknown'}), error => error.getStatus() === 400);
});
test('type catalog uses active master rows and preserves display order', async () => {
  const service = new AgentContractsService({getRepository: () => ({find: async options => {
    assert.deepEqual(options.where, {is_active:true}); assert.deepEqual(options.order, {sort_order:'ASC',id:'ASC'});
    return [{code:'reservation',name_th:'สัญญาจองห้อง',name_en:'Reservation',icon:'calendar',form_kind:'reservation'}];
  }})});
  assert.equal((await service.types())[0].nameTh, 'สัญญาจองห้อง');
});
