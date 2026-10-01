const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(40, 1),
]);
const signaturePng = `data:image/png;base64,${png.toString('base64')}`;

function contract(overrides = {}) {
  return {
    id: 11,
    tenant_id: 2,
    lead_id: 1,
    contract_no: 'LS202600011',
    rent_room: { property: { name: 'Aria' }, listing_title: null, room_id: '1201', owner_id: 9 },
    tenant: { name: 'Sonny', user_id: 8 },
    agreement_type_code: 'lease',
    agreement_type: { name_th: 'สัญญาเช่า', form_kind: 'lease' },
    template: { name: 'Lease', form_kind: 'lease', version: 1 },
    status: 'draft',
    start_date: '2026-10-01',
    end_date: '2027-09-30',
    move_in_date: null,
    monthly_rent: '15000.00',
    deposit: '30000.00',
    reservation_fee: null,
    notes: null,
    data: {},
    party_snapshot: {},
    owner_signed_at: null,
    tenant_signed_at: null,
    agent_signed_at: null,
    owner_signature_url: null,
    tenant_signature_url: null,
    agent_signature_url: null,
    owner_user_id: 9,
    owner_delivered_at: null,
    tenant_delivered_at: null,
    document_url: null,
    invoice_url: null,
    receipt_url: null,
    created_by_user_id: 7,
    agreement_kind: 'new',
    previous_agreement_id: null,
    root_agreement_id: 11,
    template_id: 1,
    ...overrides,
  };
}

function serviceFor(current) {
  const qb = {};
  for (const key of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[key] = () => qb;
  qb.getOne = async () => current;
  qb.getMany = async () => [current];
  const updates = [];
  const documents = {
    uploadSignature: async () => ({ path: '7/11/signatures/sig.png' }),
    remove: async () => undefined,
    signPaths: async (paths) => new Map(paths.filter(Boolean).map((path) => [path, `https://signed.example/${path}`])),
  };
  const db = {
    getRepository: () => ({
      createQueryBuilder: () => qb,
      update: async (where, patch) => {
        updates.push([where, patch]);
        Object.assign(current, patch);
        return { affected: 1 };
      },
    }),
  };
  return { service: new AgentContractsService(db, documents), updates, current };
}

test('deliver sends the contract to the tenant or owner account', async () => {
  const tenant = serviceFor(contract());
  const sent = await tenant.service.deliverToParty(7, 11, { party: 'tenant' });
  assert.equal(sent.party, 'tenant');
  assert.equal(sent.userId, 8);
  assert.ok(tenant.current.tenant_delivered_at instanceof Date);
  assert.equal(tenant.updates.length, 1);

  const owner = serviceFor(contract({ owner_user_id: null }));
  const ownerSent = await owner.service.deliverToParty(7, 11, { party: 'owner' });
  assert.equal(ownerSent.userId, 9);
  assert.equal(owner.current.owner_user_id, 9);
  assert.ok(owner.current.owner_delivered_at instanceof Date);
});

test('deliver rejects a party that has no account and does not write', async () => {
  const missingTenant = serviceFor(contract({ tenant: { name: 'Sonny', user_id: null } }));
  await assert.rejects(
    () => missingTenant.service.deliverToParty(7, 11, { party: 'tenant' }),
    /ผู้เช่ายังไม่มีบัญชีในระบบ/,
  );
  assert.equal(missingTenant.updates.length, 0);

  const missingOwner = serviceFor(contract({ owner_user_id: null, rent_room: { owner_id: null, property: { name: 'Aria' }, room_id: '1' } }));
  await assert.rejects(
    () => missingOwner.service.deliverToParty(7, 11, { party: 'owner' }),
    /ผู้ให้เช่ายังไม่มีบัญชีในระบบ/,
  );
  assert.equal(missingOwner.updates.length, 0);
});

test('the recipient can sign only the delivered party', async () => {
  const f = serviceFor(contract({ tenant_delivered_at: new Date() }));
  const signed = await f.service.signAsParty(8, 11, { party: 'tenant', signaturePng });
  assert.equal(signed.myParties.includes('tenant'), true);
  assert.ok(f.current.tenant_signed_at instanceof Date);
  assert.equal(f.current.tenant_signature_url, '7/11/signatures/sig.png');
  assert.equal(f.current.owner_signed_at, null);

  const stranger = serviceFor(contract({ tenant_delivered_at: new Date() }));
  await assert.rejects(
    () => stranger.service.signAsParty(99, 11, { party: 'tenant', signaturePng }),
    (error) => error.getStatus() === 404,
  );
  assert.equal(stranger.updates.length, 0);
});
