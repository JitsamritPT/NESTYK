const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentContractsService, validateSign } = require('../src/agent/contracts/agent-contracts.service.ts');
const { AgentContractsController } = require('../src/agent/contracts/agent-contracts.controller.ts');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(40, 1),
]);
const signaturePng = `data:image/png;base64,${png.toString('base64')}`;

function row(overrides = {}) {
  return {
    id: 11,
    tenant_id: 2,
    lead_id: 1,
    contract_no: 'EC-11',
    rent_room: { property: { name: 'Aria' }, listing_title: null, room_id: '1201' },
    tenant: { name: 'สมชาย' },
    agreement_type_code: 'reservation',
    agreement_type: { name_th: 'หนังสือจองห้อง', form_kind: 'reservation' },
    reservation_fee: '5000.00',
    status: 'draft',
    start_date: '2026-10-01',
    end_date: '2026-10-15',
    monthly_rent: null,
    deposit: null,
    notes: null,
    owner_signed_at: null,
    tenant_signed_at: null,
    agent_signed_at: null,
    owner_signature_url: null,
    tenant_signature_url: null,
    agent_signature_url: null,
    document_url: null,
    invoice_url: null,
    receipt_url: null,
    created_by_user_id: 7,
    ...overrides,
  };
}

function serviceFor(current) {
  const qb = {};
  for (const key of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[key] = () => qb;
  qb.getOne = async () => current;
  const updates = [];
  const documents = {
    uploadSignature: async () => ({ path: '7/11/signatures/sig.png' }),
    signPaths: async (paths) => new Map(paths.filter(Boolean).map((path) => [path, `https://signed.example/${path}`])),
  };
  const db = {
    getRepository: (entity) => {
      assert.equal(entity, LeaseContractEntity);
      return {
        createQueryBuilder: () => qb,
        update: async (where, patch) => {
          updates.push([where, patch]);
          Object.assign(current, patch);
        },
      };
    },
  };
  return { service: new AgentContractsService(db, documents), updates, current };
}

test('validateSign accepts png data urls and unique parties', () => {
  const result = validateSign({ parties: ['owner', 'owner', 'tenant'], signaturePng });
  assert.deepEqual(result.parties, ['owner', 'tenant']);
  assert.equal(result.png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.throws(() => validateSign({ parties: ['owner'], signaturePng: 'nope' }), error => error.getStatus() === 400);
  assert.throws(() => validateSign({ parties: ['witness'], signaturePng }), error => error.getStatus() === 400);
});

test('proxy sign stamps unsigned parties and moves draft to awaiting signatures', async () => {
  const { service, updates, current } = serviceFor(row());
  const result = await service.sign(7, 11, { parties: ['owner'], signaturePng });
  assert.equal(updates[0][1].status, 'awaiting_signatures');
  assert.ok(updates[0][1].owner_signed_at instanceof Date);
  assert.equal(updates[0][1].owner_signature_url, '7/11/signatures/sig.png');
  assert.equal(result.status, 'awaiting_signatures');
  assert.match(result.ownerSignatureUrl, /signed\.example/);
  current.owner_signed_at = new Date();
  await assert.rejects(() => service.sign(7, 11, { parties: ['owner'], signaturePng }), error => error.getStatus() === 400);
});

test('signing every remaining party moves the contract to agent review', async () => {
  const { service, updates } = serviceFor(row());
  const result = await service.sign(7, 11, { parties: ['owner', 'tenant', 'agent'], signaturePng });
  assert.equal(updates[0][1].status, 'awaiting_agent_review');
  assert.ok(updates[0][1].owner_signed_at && updates[0][1].tenant_signed_at && updates[0][1].agent_signed_at);
  assert.equal(result.status, 'awaiting_agent_review');
});

test('closed contracts cannot be signed', async () => {
  const { service } = serviceFor(row({ status: 'active' }));
  await assert.rejects(() => service.sign(7, 11, { parties: ['agent'], signaturePng }), error => error.getStatus() === 400);
});

test('HTTP sign requires an agent', async (t) => {
  const previous = process.env.ALLOW_DEV_AUTH;
  process.env.ALLOW_DEV_AUTH = 'true';
  t.after(() => { if (previous === undefined) delete process.env.ALLOW_DEV_AUTH; else process.env.ALLOW_DEV_AUTH = previous; });
  const received = [];
  class TestModule {}
  Module({ controllers: [AgentContractsController], providers: [
    { provide: AgentContractsService, useValue: {
      list: async () => [],
      candidates: async () => [],
      create: async () => ({}),
      sign: async (agentId, id, body) => {
        received.push({ agentId, id, body });
        return { id, status: 'awaiting_signatures' };
      },
    } },
    { provide: AuthService, useValue: {
      findBySupabaseUserId: async id => ({ id: Number(id) }),
      loadUserWithRoles: async id => ({ id, roleNames: id === 7 ? ['agent'] : ['tenant'] }),
    } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const path = `${await app.getUrl()}/agent/contracts/11/sign`;
  const post = (auth) => fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify({ parties: ['agent'], signaturePng }),
  });
  assert.equal((await post()).status, 401);
  assert.equal((await post('dev|8|test@example.invalid')).status, 403);
  const ok = await post('dev|7|test@example.invalid');
  assert.equal(ok.status, 200);
  assert.equal(received[0].agentId, 7);
  assert.deepEqual(received[0].body.parties, ['agent']);
});
