const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require("reflect-metadata");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
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
const {
  financialTotals,
  bahtText,
  validateFinancialDocument,
} = require("../src/agent/contracts/financial-document.ts");
const {
  createFinancialPdf,
} = require("../src/agent/contracts/financial-pdf.ts");
const {
  AgentContractsService,
} = require("../src/agent/contracts/agent-contracts.service.ts");
const sample = {
  documentNo: "REC-RS202600002",
  issueDate: "2026-09-16",
  dueDate: "2026-09-20",
  reference: "RS202600002",
  customerName: "สมชาย ใจดี",
  customerAddress:
    "123 ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพมหานคร 10110",
  customerTaxId: "",
  customerPhone: "0812345678",
  customerEmail: "customer@example.com",
  issuerName: "บริษัท ตัวอย่าง จำกัด",
  issuerAddress: "456 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310",
  issuerTaxId: "0123456789012",
  issuerPhone: "029876543",
  issuerEmail: "issuer@example.com",
  items: [
    {
      description: "เงินจอง Wind Sukhumvit 23 ห้อง 1201",
      quantity: 1,
      unitPrice: 20000,
    },
  ],
  vatRate: 0,
  discount: 0,
  paymentMethod: "transfer",
  paymentDetails: "ธนาคารตัวอย่าง เลขอ้างอิง TEST-001",
  receiverName: "สมหญิง ใจดี",
  notes: "ตัวอย่างสำหรับตรวจรูปแบบ PDF เท่านั้น",
};
test("financial inputs reject invalid dates, amounts, missing fields and invalid methods", () => {
  assert.deepEqual(validateFinancialDocument(sample, "receipt"), sample);
  for (const patch of [
    { issueDate: "2026-02-30" },
    { customerAddress: "" },
    { issuerName: "" },
    { discount: 20001 },
    { vatRate: 99 },
    { paymentMethod: "" },
    { items: [] },
    { items: [{ description: "x", quantity: -1, unitPrice: 1 }] },
    { customerTaxId: "123" },
    { discount: 0.001 },
  ]) {
    assert.throws(() =>
      validateFinancialDocument({ ...sample, ...patch }, "receipt"),
    );
  }
  assert.throws(() =>
    validateFinancialDocument({ ...sample, dueDate: "2026-09-01" }, "invoice"),
  );
});
test("totals use cents, discount before VAT, and Thai amount words", () => {
  assert.deepEqual(financialTotals({ ...sample, discount: 100, vatRate: 7 }), {
    subtotal: 20000,
    discount: 100,
    vat: 1393,
    total: 21293,
  });
  assert.equal(
    financialTotals({ ...sample, items: [{ quantity: 3, unitPrice: 0.1 }] })
      .total,
    0.3,
  );
  assert.equal(bahtText(20000), "สองหมื่นบาทถ้วน");
  assert.equal(bahtText(21.25), "ยี่สิบเอ็ดบาทยี่สิบห้าสตางค์");
});
test("receipt and invoice PDFs render Thai with five rows and retain a valid PDF", async () => {
  for (const kind of ["receipt", "invoice"]) {
    const input = {
      ...sample,
      documentNo: `${kind === "invoice" ? "INV" : "REC"}-RS202600002`,
      items: Array.from({ length: 5 }, (_, i) => ({
        description: `รายการ ${i + 1} เงินจองห้องพักและค่าใช้จ่ายตามข้อตกลงสำหรับทดสอบ`,
        quantity: 1,
        unitPrice: 4000,
      })),
      vatRate: 7,
      discount: 100,
    };
    const bytes = await createFinancialPdf(kind, input);
    assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    if (process.env.PDF_QA_DIR) {
      fs.mkdirSync(process.env.PDF_QA_DIR, { recursive: true });
      fs.writeFileSync(`${process.env.PDF_QA_DIR}/${kind}.pdf`, bytes);
    }
  }
});
function serviceFixture({ denied = false, failUpdate = false } = {}) {
  const row = {
    id: 11,
    created_by_user_id: 7,
    contract_no: "RS202600002",
    agreement_type: { form_kind: "reservation" },
    status: "draft",
    tenant: { name: "Tenant", phone: "0812345678", email: "t@example.com" },
    party_snapshot: { ownerName: "Owner", ownerPhone: "029999999" },
    reservation_fee: "20000",
    data: { untouched: true },
    rent_room: { property: { name: "Property" } },
  };
  const qb = {};
  for (const key of ["leftJoinAndSelect", "where", "andWhere"])
    qb[key] = () => qb;
  qb.getOne = async () => (denied ? null : row);
  let uploads = 0,
    removed = 0;
  const repo = {
    createQueryBuilder: () => qb,
    findOne: async () => row,
    update: async (_, patch) => {
      if (failUpdate) throw new Error("DB failure");
      Object.assign(row, patch);
    },
  };
  const db = {
    getRepository: () => repo,
    transaction: async (fn) => fn({ getRepository: () => repo }),
  };
  const storage = {
    upload: async () => {
      uploads++;
      return { path: "7/11/receipt/test.pdf" };
    },
    remove: async () => {
      removed++;
    },
  };
  const service = new AgentContractsService(db, storage);
  service.view = async () => row;
  return { service, row, counts: () => ({ uploads, removed }) };
}
test("defaults prefill known values; receipt reuses invoice; generation preserves other contract data", async () => {
  const { service, row } = serviceFixture();
  const defaults = await service.financialDocumentDefaults(7, 11, "invoice");
  assert.equal(defaults.customerName, "Tenant");
  assert.equal(defaults.customerPhone, "0812345678");
  assert.equal(defaults.items[0].unitPrice, 20000);
  await assert.rejects(
    () => service.financialDocumentDefaults(7, 11, "receipt"),
    /ใบแจ้งหนี้/,
  );
  await service.generateFinancialDocument(7, 11, "invoice", {
    ...sample,
    documentNo: "INV-test",
    paymentMethod: "",
    receiverName: "",
  });
  assert.equal(row.data.untouched, true);
  assert.equal(row.data.financialDocuments.invoice.documentNo, "INV-test");
  row.invoice_url = "7/11/invoice/test.pdf";
  const receipt = await service.financialDocumentDefaults(7, 11, "receipt");
  assert.equal(receipt.reference, "INV-test");
  assert.equal(receipt.customerAddress, sample.customerAddress);
  assert.equal(receipt.paymentMethod, "");
  await service.generateFinancialDocument(7, 11, "receipt", {
    documentNo: "REC-test",
    issueDate: "2026-09-16",
    paymentMethod: "transfer",
    paymentDetails: "bank",
    receiverName: "Receiver",
    notes: "",
    customerName: "HACKED",
    items: [{ description: "hack", quantity: 1, unitPrice: 1 }],
    discount: 0,
    vatRate: 0,
  });
  assert.equal(row.data.financialDocuments.receipt.customerName, sample.customerName);
  assert.equal(row.data.financialDocuments.receipt.items[0].unitPrice, 20000);
  assert.equal(row.data.financialDocuments.receipt.reference, "INV-test");
  row.receipt_url = "7/11/receipt/old.pdf";
  await service.generateFinancialDocument(7, 11, "invoice", {
    ...sample,
    documentNo: "INV-new",
    paymentMethod: "",
    receiverName: "",
  });
  assert.equal(row.receipt_url, null);
  assert.equal(row.data.financialDocuments.receipt, undefined);
});
test("inaccessible contract uploads nothing and failed persistence cleans uploaded PDF", async () => {
  const denied = serviceFixture({ denied: true });
  await assert.rejects(() =>
    denied.service.generateFinancialDocument(8, 11, "invoice", {
      ...sample,
      paymentMethod: "",
      receiverName: "",
    }),
  );
  assert.equal(denied.counts().uploads, 0);
  const failed = serviceFixture({ failUpdate: true });
  await assert.rejects(
    () =>
      failed.service.generateFinancialDocument(7, 11, "invoice", {
        ...sample,
        paymentMethod: "",
        receiverName: "",
      }),
    /DB failure/,
  );
  assert.deepEqual(failed.counts(), { uploads: 1, removed: 1 });
});
test("finalized reservation letter rejects financial create/edit", async () => {
  const { service, row, counts } = serviceFixture();
  row.document_url =
    "7/11/generated/reservation_letter/mock-v2/reservation.pdf";
  row.owner_signed_at = new Date();
  row.tenant_signed_at = new Date();
  row.agent_signed_at = new Date();
  row.owner_signature_url = "7/11/signatures/o.png";
  row.tenant_signature_url = "7/11/signatures/t.png";
  row.agent_signature_url = "7/11/signatures/a.png";
  await assert.rejects(
    () =>
      service.generateFinancialDocument(7, 11, "invoice", {
        ...sample,
        paymentMethod: "",
        receiverName: "",
      }),
    /สร้างเอกสารหนังสือจองแล้ว/,
  );
  assert.equal(counts().uploads, 0);
});
