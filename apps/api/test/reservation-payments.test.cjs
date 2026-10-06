const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { ContractDocumentStorageService } = require('../src/agent/contracts/contract-document-storage.service.ts');
const { PartyContractsController } = require('../src/agent/contracts/party-contracts.controller.ts');
const { AgreementAttachmentsService } = require('../src/agent/contracts/agreement-attachments.service.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');

function fixture({ patch = {}, failUpdate = false, concurrentPatch, reassignTenant = false } = {}) {
  const invoice = {
    documentNo: 'INV-RS202600011', issueDate: '2026-10-01', dueDate: '2026-10-01', reference: 'RS202600011',
    customerName: 'Tenant', customerFirstName: 'Tenant', customerLastName: '', customerAddress: 'Project', customerTaxId: '', customerPhone: '0811111111', customerEmail: 'tenant@example.com',
    issuerName: 'NESTYK', issuerAddress: 'Bangkok', issuerTaxId: '', issuerPhone: '', issuerEmail: '',
    items: [{ description: 'ค่าจอง Project ห้อง A1', quantity: 1, unitPrice: 5000 }], vatRate: 0, discount: 0, paymentMethod: '', paymentDetails: 'Bank 123', receiverName: '', notes: '',
  };
  const row = {
    id: 11, created_by_user_id: 7, tenant_id: 2, lead_id: 1, contract_no: 'RS202600011', status: 'draft', start_date: '2026-10-01',
    agreement_type_code: 'reservation', template: { form_kind: 'reservation' }, agreement_type: { form_kind: 'reservation' },
    tenant: { id: 2, user_id: 8, name: 'Tenant' }, tenant_delivered_at: new Date(), owner_user_id: 9, owner_delivered_at: new Date(),
    rent_room: { room_id: 'A1', property: { name: 'Project' } }, reservation_fee: '5000',
    invoice_url: '7/11/invoice/a.pdf', receipt_url: null, data: { untouched: true, financialDocuments: { invoice } }, ...patch,
  };
  const uploaded = [], removed = [], updates = [];
  const qb = {};
  for (const key of ['where', 'andWhere', 'leftJoinAndSelect', 'orderBy']) qb[key] = () => qb;
  qb.getOne = async () => structuredClone(row);
  qb.getMany = async () => [row];
  const repo = {
    createQueryBuilder: () => qb,
    findOne: async ({ where, lock }) => {
      assert.equal(where.created_by_user_id, 7);
      assert.equal(lock.mode, 'pessimistic_write');
      if (concurrentPatch) Object.assign(row, concurrentPatch);
      return row;
    },
    update: async (where, update) => {
      if (failUpdate) throw new Error('DB failure');
      updates.push(update); Object.assign(row, update); return { affected: 1 };
    },
  };
  const documents = {
    uploadPaymentSlip: async (agentId, file) => {
      assert.equal(agentId, 7);
      assert.ok(file.buffer.length);
      const path = `7/payment-slips/${uploaded.length}.jpg`;
      uploaded.push(path); return { path };
    },
    upload: async (agentId, id, kind, file) => {
      assert.equal(file.buffer.subarray(0, 4).toString(), '%PDF');
      const path = `7/11/${kind}/${uploaded.length}.pdf`; uploaded.push(path); return { path };
    },
    remove: async path => removed.push(path),
    signPaths: async paths => new Map(paths.filter(Boolean).map(path => [path, `https://signed.example/${path}`])),
  };
  const db = {
    getRepository: () => repo,
    transaction: async fn => fn({ getRepository: () => repo, findOneBy: async (_entity, where) => !reassignTenant && where.id === 2 && where.user_id === 8 ? row.tenant : null }),
  };
  return { service: new AgentContractsService(db, documents), row, uploaded, removed, updates };
}
const file = { buffer: Buffer.from([0xff, 0xd8, 0xff]), size: 3, originalname: 'slip.jpg' };

test('tenant can read only their delivered invoice, receipt and slip, using private signed URLs', async () => {
  const f = fixture({ patch: { receipt_url: '7/11/receipt/a.pdf' } });
  f.row.data.reservationPayment = { slipPath: '7/payment-slips/a.jpg' };
  for (const [kind, path] of [['invoice', f.row.invoice_url], ['receipt', f.row.receipt_url], ['payment-slip', '7/payment-slips/a.jpg']]) {
    assert.equal((await f.service.financialDocumentForParty(8, 11, kind)).url, `https://signed.example/${path}`);
    await assert.rejects(() => f.service.financialDocumentForParty(99, 11, kind), e => e.getStatus() === 404);
  }
  await assert.rejects(() => f.service.financialDocumentForParty(8, 11, 'signatures'), e => e.getStatus() === 404);
  const undelivered = fixture({ patch: { tenant_delivered_at: null } });
  await assert.rejects(() => undelivered.service.financialDocumentForParty(8, 11, 'invoice'), e => e.getStatus() === 404);
});

test('tenant submits and replaces a slip without issuing a receipt or changing signing status', async () => {
  const f = fixture({ patch: { status: 'active', document_url: '7/11/generated/reservation_letter/letter-v1/a.pdf' } });
  const updated = await f.service.uploadReservationPaymentSlip(8, 11, file);
  assert.equal(updated.reservationPayment.status, 'submitted');
  assert.equal(updated.invoiceUrl, 'https://signed.example/7/11/invoice/a.pdf');
  assert.equal(updated.receiptUrl, null);
  assert.equal(updated.reservationPayment.paymentSlipUrl, 'https://signed.example/7/payment-slips/0.jpg');
  assert.deepEqual(updated.myParties, ['tenant']);
  assert.equal(f.row.status, 'active');
  assert.equal(f.row.data.untouched, true);
  assert.equal(f.row.data.reservationPayment.submittedBy, 8);
  assert.ok(f.row.payment_submitted_at instanceof Date);
  await f.service.uploadReservationPaymentSlip(8, 11, file);
  assert.deepEqual(f.removed, ['7/payment-slips/0.jpg']);
  assert.equal(f.row.data.reservationPayment.slipPath, '7/payment-slips/1.jpg');
});

test('strangers, owners, undelivered tenants and closed/non-reservation/receipted records upload nothing', async () => {
  for (const [userId, patch] of [
    [99, {}], [9, {}], [8, { tenant_delivered_at: null }],
    ...['cancelled', 'expired', 'terminated'].map(status => [8, { status }]),
    [8, { template: { form_kind: 'lease' } }], [8, { invoice_url: null }], [8, { receipt_url: 'receipt.pdf' }],
  ]) {
    const f = fixture({ patch });
    await assert.rejects(() => f.service.uploadReservationPaymentSlip(userId, 11, file));
    assert.equal(f.uploaded.length, 0);
    assert.equal(f.updates.length, 0);
  }
});

test('failed or stale uploads remove the new file and retain the original payment', async () => {
  for (const options of [{ failUpdate: true }, { reassignTenant: true }, { concurrentPatch: { invoice_url: 'changed.pdf' } }, { concurrentPatch: { receipt_url: 'receipt.pdf' } }]) {
    const f = fixture(options);
    f.row.data.reservationPayment = { slipPath: '7/payment-slips/original.jpg' };
    await assert.rejects(() => f.service.uploadReservationPaymentSlip(8, 11, file));
    assert.deepEqual(f.removed, f.uploaded);
    assert.equal(f.row.data.reservationPayment.slipPath, '7/payment-slips/original.jpg');
  }
});

test('agent receipt confirms the invoice amount; tenant sees it and cannot replace paid evidence', async () => {
  const f = fixture();
  await f.service.uploadReservationPaymentSlip(8, 11, file);
  const defaults = await f.service.financialDocumentDefaults(7, 11, 'receipt');
  assert.equal(defaults.paymentMethod, 'transfer');
  assert.equal(defaults.reference, 'INV-RS202600011');
  const result = await f.service.generateFinancialDocument(7, 11, 'receipt', {
    ...defaults, documentNo: 'HACKED', customerName: 'Other', items: [{ description: 'hack', quantity: 1, unitPrice: 1 }], receiverName: 'Agent',
  });
  assert.equal(result.reservationPayment.status, 'paid');
  assert.equal(result.reservationPayment.receiptDocumentNo, 'REC-RS202600011');
  assert.equal(f.row.data.financialDocuments.receipt.items[0].unitPrice, 5000);
  assert.equal(f.row.data.financialDocuments.receipt.customerName, 'Tenant');
  assert.equal(f.row.data.financialDocuments.receipt.reference, 'INV-RS202600011');
  const mine = await f.service.listForUser(8);
  assert.equal(mine[0].receiptUrl, result.receiptUrl);
  await assert.rejects(() => f.service.uploadReservationPaymentSlip(8, 11, file), /ออกใบเสร็จแล้ว/);
  const count = f.uploaded.length;
  await f.service.generateFinancialDocument(7, 11, 'receipt', {});
  assert.equal(f.uploaded.length, count);
});

test('invoice and receipt cannot be re-uploaded to bypass booking amounts', async () => {
  const f = fixture();
  for (const kind of ['invoice', 'receipt'])
    await assert.rejects(() => f.service.uploadDocument(7, 11, kind, file), /ต้องสร้างจากใบแจ้งหนี้/);
  assert.equal(f.uploaded.length, 0);
});

test('slip storage rejects unsupported bytes, missing files and oversized uploads', async () => {
  const storage = new ContractDocumentStorageService();
  await assert.rejects(() => storage.uploadPaymentSlip(7, undefined), /สลิป/);
  await assert.rejects(() => storage.uploadPaymentSlip(7, { buffer: Buffer.from('executable'), size: 10 }), /PDF|JPG|PNG/);
  const tooLarge = Buffer.alloc(10 * 1024 * 1024 + 1);
  await assert.rejects(() => storage.uploadPaymentSlip(7, { buffer: tooLarge, size: tooLarge.length }), /10 MB/);
});

test('party payment endpoints enforce authentication, roles and file-only multipart uploads', async t => {
  const previous = process.env.ALLOW_DEV_AUTH;
  process.env.ALLOW_DEV_AUTH = 'true';
  t.after(() => { if (previous == null) delete process.env.ALLOW_DEV_AUTH; else process.env.ALLOW_DEV_AUTH = previous; });
  const calls = [];
  class TestModule {}
  Module({ controllers: [PartyContractsController], providers: [
    { provide: AgentContractsService, useValue: {
      financialDocumentForParty: async (userId, id, kind) => { calls.push(['read', userId, id, kind]); return { url: 'https://files/invoice.pdf' }; },
      uploadReservationPaymentSlip: async (userId, id, file) => { calls.push(['upload', userId, id, file?.originalname]); return { ok: true }; },
    } },
    { provide: AgreementAttachmentsService, useValue: {} },
    { provide: AuthService, useValue: { findBySupabaseUserId: async id => ({ id: Number(id) }), loadUserWithRoles: async id => ({ id, roleNames: id === 8 ? ['tenant'] : ['agent'] }) } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/contracts/mine/11`;
  assert.equal((await fetch(`${base}/financial-documents/invoice`)).status, 401);
  assert.equal((await fetch(`${base}/financial-documents/invoice`, { headers: { Authorization: 'Bearer dev|7|test@example.invalid' } })).status, 403);
  assert.equal((await fetch(`${base}/financial-documents/invoice`, { headers: { Authorization: 'Bearer dev|8|test@example.invalid' } })).status, 200);
  const form = new FormData(); form.append('file', new Blob([file.buffer], { type: 'image/jpeg' }), 'slip.jpg');
  assert.equal((await fetch(`${base}/payment-slip`, { method: 'POST', headers: { Authorization: 'Bearer dev|8|test@example.invalid' }, body: form })).status, 200);
  assert.deepEqual(calls[1], ['upload', 8, 11, 'slip.jpg']);
  const malicious = new FormData(); malicious.append('file', new Blob([file.buffer]), 'slip.jpg'); malicious.append('invoiceId', '999');
  assert.equal((await fetch(`${base}/payment-slip`, { method: 'POST', headers: { Authorization: 'Bearer dev|8|test@example.invalid' }, body: malicious })).status, 400);
  assert.equal(calls.length, 2);
});
