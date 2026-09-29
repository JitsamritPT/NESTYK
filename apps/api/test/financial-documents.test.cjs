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
function seedContractInvoice(row) {
  row.invoice_url = "7/11/invoice/test.pdf";
  row.data = {
    ...row.data,
    financialDocuments: {
      invoice: {
        ...sample,
        documentNo: "INV-test",
        paymentMethod: "",
        receiverName: "",
      },
    },
  };
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
  await assert.rejects(
    () =>
      service.generateFinancialDocument(7, 11, "invoice", {
        ...sample,
        documentNo: "INV-test",
        paymentMethod: "",
        receiverName: "",
      }),
    /หนังสือจอง/,
  );
  assert.equal(row.data.untouched, true);
  assert.equal(row.data.financialDocuments, undefined);
  seedContractInvoice(row);
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
  assert.equal(row.data.untouched, true);
  assert.equal(row.invoice_url, "7/11/invoice/test.pdf");
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
  seedContractInvoice(failed.row);
  await assert.rejects(
    () =>
      failed.service.generateFinancialDocument(7, 11, "receipt", {
        documentNo: "REC-test",
        issueDate: "2026-09-16",
        paymentMethod: "transfer",
        paymentDetails: "bank",
        receiverName: "Receiver",
        notes: "",
      }),
    /DB failure/,
  );
  assert.deepEqual(failed.counts(), { uploads: 1, removed: 1 });
});
test("finalized reservation letter rejects financial create/edit", async () => {
  const { service, row, counts } = serviceFixture();
  row.document_url =
    "7/11/generated/reservation_letter/letter-v1/reservation.pdf";
  row.owner_signed_at = new Date();
  row.tenant_signed_at = new Date();
  row.agent_signed_at = new Date();
  row.owner_signature_url = "7/11/signatures/o.png";
  row.tenant_signature_url = "7/11/signatures/t.png";
  row.agent_signature_url = "7/11/signatures/a.png";
  seedContractInvoice(row);
  await assert.rejects(
    () =>
      service.generateFinancialDocument(7, 11, "receipt", {
        documentNo: "REC-test",
        issueDate: "2026-09-16",
        paymentMethod: "transfer",
        paymentDetails: "bank",
        receiverName: "Receiver",
        notes: "",
      }),
    /สร้างเอกสารหนังสือจองแล้ว/,
  );
  assert.equal(counts().uploads, 0);
});
test("standalone invoice number is generated and ignores the submitted number", async () => {
  let saved = null;
  const repo = {
    find: async () => (saved ? [saved] : []),
    create: (row) => row,
    save: async (row) => {
      saved = { ...row, id: 4, issue_date: row.issue_date };
      return saved;
    },
  };
  const db = {
    getRepository: () => repo,
    transaction: async (fn) =>
      fn({
        getRepository: () => repo,
        query: async (sql) =>
          String(sql).includes("document_no") && saved
            ? [{ document_no: saved.document_no }]
            : [],
      }),
  };
  const documents = {
    uploadStandaloneInvoice: async () => ({ path: "7/invoices/a.pdf" }),
    signPaths: async (paths) => new Map(paths.filter(Boolean).map((path) => [path, `https://files/${path}`])),
    remove: async () => {},
  };
  const service = new AgentContractsService(db, documents);
  const created = await service.createStandaloneInvoice(7, {
    ...sample,
    documentNo: "INV-FREE",
    paymentMethod: "",
    receiverName: "",
  });
  assert.match(created.documentNo, /^INV\d{4}\d{5}$/);
  assert.notEqual(created.documentNo, "INV-FREE");
  assert.equal(created.customerName, sample.customerName);
  assert.equal(saved.data.issuerName, "NESTYK");
  assert.equal(saved.data.issuerAddress, "Bangkok");
  assert.equal(created.total, 20000);
  assert.equal(created.invoiceUrl, "https://files/7/invoices/a.pdf");
  assert.equal(saved.document_no, created.documentNo);
  const again = await service.createStandaloneInvoice(7, {
    ...sample,
    documentNo: "HACKED",
    paymentMethod: "",
    receiverName: "",
  });
  assert.notEqual(again.documentNo, created.documentNo);
  assert.match(again.documentNo, /^INV\d{4}\d{5}$/);
});
test("receipt follows the chosen invoice and keeps its number when replaced", async () => {
  const invoiceData = {
    ...sample,
    documentNo: "INV202600001",
    paymentMethod: "",
    receiverName: "",
  };
  const invoices = new Map([
    [
      3,
      {
        id: 3,
        created_by_user_id: 7,
        document_no: "INV202600001",
        issue_date: "2026-09-16",
        customer_name: sample.customerName,
        data: invoiceData,
        pdf_path: "7/invoices/a.pdf",
        receipt_document_no: null,
        receipt_issue_date: null,
        receipt_data: null,
        receipt_pdf_path: null,
      },
    ],
    [
      8,
      {
        id: 8,
        created_by_user_id: 7,
        document_no: "INV202600002",
        issue_date: "2026-09-16",
        customer_name: sample.customerName,
        data: { ...invoiceData, documentNo: "INV202600002" },
        pdf_path: "7/invoices/b.pdf",
        receipt_document_no: null,
        receipt_issue_date: null,
        receipt_data: null,
        receipt_pdf_path: null,
      },
    ],
  ]);
  const repo = {
    findOne: async ({ where }) => {
      const row = invoices.get(where.id);
      if (!row || row.created_by_user_id !== where.created_by_user_id) return null;
      return row;
    },
    save: async (row) => {
      invoices.set(row.id, row);
      return row;
    },
  };
  const db = {
    getRepository: () => repo,
    transaction: async (fn) =>
      fn({
        getRepository: () => repo,
        query: async (sql) => {
          if (!String(sql).includes("receipt_document_no")) return [];
          const latest = [...invoices.values()]
            .map((row) => row.receipt_document_no)
            .filter(Boolean)
            .sort()
            .at(-1);
          return latest ? [{ receipt_document_no: latest }] : [];
        },
      }),
  };
  let uploads = 0;
  const documents = {
    uploadStandaloneReceipt: async () => ({ path: `7/receipts/${++uploads}.pdf` }),
    uploadPaymentSlip: async () => ({ path: `7/payment-slips/${++uploads}.jpg` }),
    signPaths: async (paths) =>
      new Map(paths.filter(Boolean).map((path) => [path, `https://files/${path}`])),
    remove: async () => {},
  };
  const service = new AgentContractsService(db, documents);
  const created = await service.createReceiptForInvoice(7, 3, {
    documentNo: "HACKED",
    issueDate: "2026-09-20",
    paymentMethod: "cash",
    paymentDetails: "",
    receiverName: "ผู้รับเงิน",
    notes: "",
    customerName: "คนอื่น",
    items: [{ description: "hack", quantity: 1, unitPrice: 1 }],
    discount: 0,
    vatRate: 0,
  });
  assert.match(created.receiptDocumentNo, /^REC\d{4}\d{5}$/);
  assert.notEqual(created.receiptDocumentNo, "HACKED");
  assert.equal(created.documentNo, "INV202600001");
  assert.equal(created.customerName, sample.customerName);
  assert.equal(created.total, 20000);
  assert.match(created.receiptUrl, /^https:\/\/files\/7\/receipts\//);
  const replaced = await service.createReceiptForInvoice(7, 3, {
    issueDate: "2026-09-21",
    paymentMethod: "transfer",
    paymentDetails: "bank",
    receiverName: "ผู้รับเงิน",
    notes: "",
  });
  assert.equal(replaced.receiptDocumentNo, created.receiptDocumentNo);
  const other = await service.createReceiptForInvoice(7, 8, {
    issueDate: "2026-09-22",
    paymentMethod: "cash",
    receiverName: "ผู้รับเงิน",
    notes: "",
  });
  assert.notEqual(other.receiptDocumentNo, created.receiptDocumentNo);
  assert.equal(other.documentNo, "INV202600002");
  await assert.rejects(
    () =>
      service.createReceiptForInvoice(7, 3, {
        issueDate: "2026-09-23",
        paymentMethod: "",
        receiverName: "ผู้รับเงิน",
        notes: "",
      }),
    /สลิป/,
  );
  const slipped = await service.createReceiptForInvoice(
    7,
    3,
    {
      issueDate: "2026-09-23",
      paymentMethod: "",
      receiverName: "ผู้รับเงิน",
      notes: "",
    },
    { buffer: Buffer.from([0xff, 0xd8, 0xff]), size: 3 },
  );
  assert.equal(slipped.receiptDocumentNo, created.receiptDocumentNo);
  assert.match(slipped.paymentSlipUrl, /payment-slips/);
  assert.equal(invoices.get(3).receipt_data.paymentMethod, "");
  await assert.rejects(
    () =>
      service.createReceiptForInvoice(7, 99, {
        issueDate: "2026-09-22",
        paymentMethod: "cash",
        receiverName: "ผู้รับเงิน",
        notes: "",
      }),
    /ไม่พบใบแจ้งหนี้/,
  );
});
test("invoice payer name is the opened tenant", async () => {
  let saved = null;
  const repo = {
    create: (row) => row,
    save: async (row) => {
      saved = { ...row, id: 4, issue_date: row.issue_date };
      return saved;
    },
  };
  const db = {
    transaction: async (fn) =>
      fn({
        getRepository: () => repo,
        findOne: async (_entity, options) => {
          const where = options?.where ?? {};
          return where.id === 9 && where.created_by_user_id === 7
            ? {
                id: 9,
                name: "Jomnakub",
                created_by_user_id: 7,
                lead: {
                  rent_room: {
                    property: {
                      address: "12 Sukhumvit",
                      subdistrict: "-",
                      district: "",
                      province: "Bangkok",
                      postal_code: "10110",
                    },
                  },
                },
              }
            : null;
        },
        query: async () => [],
      }),
  };
  const documents = {
    uploadStandaloneInvoice: async () => ({ path: "7/invoices/payer.pdf" }),
    signPaths: async (paths) =>
      new Map(paths.filter(Boolean).map((path) => [path, `https://files/${path}`])),
    remove: async () => {},
  };
  const service = new AgentContractsService(db, documents);
  const created = await service.createStandaloneInvoice(7, {
    ...sample,
    documentNo: "INV-FREE",
    customerName: "คนอื่น",
    tenantId: 9,
    paymentMethod: "",
    receiverName: "",
  });
  assert.equal(created.customerName, "Jomnakub");
  assert.equal(created.tenantId, 9);
  assert.equal(saved.tenant_id, 9);
  assert.equal(saved.data.customerName, "Jomnakub");
  assert.equal(saved.data.customerAddress, "12 Sukhumvit, Bangkok, 10110");
  assert.equal(saved.data.issuerName, "NESTYK");
  assert.equal(saved.data.issuerAddress, "Bangkok");
  await assert.rejects(
    () =>
      service.createStandaloneInvoice(7, {
        ...sample,
        tenantId: 99,
        paymentMethod: "",
        receiverName: "",
      }),
    /ไม่พบผู้เช่า/,
  );
});
