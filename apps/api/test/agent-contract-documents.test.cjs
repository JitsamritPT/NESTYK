const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { ContractDocumentStorageService } = require('../src/agent/contracts/contract-document-storage.service.ts');
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { AgentContractsController } = require('../src/agent/contracts/agent-contracts.controller.ts');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');

const pdf = Buffer.from('%PDF-1.4\n%eof\n');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function reservationRow(overrides = {}) {
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
    document_url: null,
    invoice_url: null,
    receipt_url: null,
    created_by_user_id: 7,
    ...overrides,
  };
}

function storageDouble() {
  const objects = new Map();
  let bucketExists = false;
  const cloud = {
    upload: async (key, buffer, options) => {
      assert.equal(options.upsert, false);
      objects.set(key, { buffer, contentType: options.contentType });
      return { error: null };
    },
    createSignedUrls: async (paths) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}` })),
      error: null,
    }),
  };
  const storage = new ContractDocumentStorageService();
  storage.storage = () => cloud;
  storage.client = { storage: {
    listBuckets: async () => ({ data: bucketExists ? [{ name: 'contract-documents' }] : [], error: null }),
    createBucket: async (name, options) => {
      assert.equal(name, 'contract-documents');
      assert.equal(options.public, false);
      bucketExists = true;
      return { error: null };
    },
  } };
  return { storage, objects, cloud };
}

test('contract document storage accepts pdf jpeg png and signs private paths', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const { storage, objects } = storageDouble();
  const uploaded = await storage.upload(7, 11, 'reservation_letter', { buffer: pdf, size: pdf.length });
  assert.match(uploaded.path, /^7\/11\/reservation_letter\/.+\.pdf$/);
  assert.equal([...objects.values()][0].contentType, 'application/pdf');
  await storage.upload(7, 11, 'invoice', { buffer: jpeg, size: jpeg.length });
  await storage.upload(7, 11, 'receipt', { buffer: png, size: png.length });
  const signed = await storage.signPaths([uploaded.path, null]);
  assert.equal(signed.get(uploaded.path), `https://signed.example/${uploaded.path}`);
  await assert.rejects(() => storage.upload(7, 11, 'invoice', { buffer: Buffer.from('hello'), size: 5 }), error => error.getStatus() === 400);
  await assert.rejects(() => storage.upload(7, 11, 'invoice', undefined), error => error.getStatus() === 400);
});

test('uploadDocument is limited to reservation contracts and persists the storage path', async () => {
  const { storage } = storageDouble();
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const row = reservationRow();
  const qb = {};
  for (const key of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[key] = () => qb;
  qb.getOne = async () => row;
  const updates = [];
  const db = {
    getRepository: (entity) => {
      assert.equal(entity, LeaseContractEntity);
      return {
        createQueryBuilder: () => qb,
        update: async (where, patch) => {
          updates.push([where, patch]);
          Object.assign(row, patch);
        },
      };
    },
  };
  const service = new AgentContractsService(db, storage);
  await assert.rejects(() => service.uploadDocument(7, 11, 'unknown', { buffer: pdf, size: pdf.length }), error => error.getStatus() === 400);
  const lease = reservationRow({ agreement_type: { name_th: 'สัญญาเช่า', form_kind: 'lease' } });
  qb.getOne = async () => lease;
  await assert.rejects(() => service.uploadDocument(7, 11, 'invoice', { buffer: pdf, size: pdf.length }), error => error.getStatus() === 400 && /หนังสือจองห้อง/.test(error.message));
  qb.getOne = async () => row;
  const result = await service.uploadDocument(7, 11, 'reservation_letter', { buffer: pdf, size: pdf.length });
  assert.equal(updates[0][0].id, 11);
  assert.match(updates[0][1].document_url, /^7\/11\/reservation_letter\//);
  assert.match(result.reservationLetterUrl, /^https:\/\/signed\.example\/7\/11\/reservation_letter\//);
  assert.equal(result.invoiceUrl, null);
});

test('HTTP document upload requires an agent and forwards the file', async (t) => {
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
      uploadDocument: async (agentId, id, kind, file) => {
        received.push({ agentId, id, kind, size: file?.buffer?.length });
        return { id, reservationLetterUrl: 'https://signed.example/doc.pdf' };
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
  const base = await app.getUrl();
  const path = `${base}/agent/contracts/11/documents/reservation_letter`;
  const upload = (auth) => {
    const body = new FormData();
    body.append('file', new Blob([pdf], { type: 'application/pdf' }), 'booking.pdf');
    return fetch(path, { method: 'POST', body, headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
  };
  assert.equal((await upload()).status, 401);
  assert.equal((await upload('dev|8|test@example.invalid')).status, 403);
  const ok = await upload('dev|7|test@example.invalid');
  assert.equal(ok.status, 200);
  assert.equal(received[0].agentId, 7);
  assert.equal(received[0].id, 11);
  assert.equal(received[0].kind, 'reservation_letter');
  assert.equal(received[0].size, pdf.length);
});
