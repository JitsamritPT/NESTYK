const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText,
    filename,
  );
const {
  validateCommissionConfirmation,
} = require("../src/agent/contracts/commission-confirmation.ts");
const {
  createCommissionConfirmationPdf,
} = require("../src/agent/contracts/commission-confirmation-pdf.ts");

const sample = {
  documentNo: "CCM202600001",
  issueDate: "2026-09-29",
  landlordName: "สมชาย ใจดี",
  landlordNationality: "ไทย",
  landlordId: "1234567890123",
  agentName: "NESTYK",
  agentNationality: "",
  agentId: "",
  propertyType: "คอนโด",
  project: "ชาโตว์ อินทาวน์",
  unitNo: "27",
  propertyAddress: "27 สุขุมวิท 64/1 กรุงเทพมหานคร",
  tenantName: "Jomnakub",
  tenantNationality: "ไทย",
  tenantIdentity: "",
  leasePeriod: "12 เดือน",
  leaseStart: "2026-10-01",
  leaseEnd: "2027-09-30",
  monthlyRent: "20000",
  agreedCommission: "20000",
  bankAccount: "กสิกรไทย 123-4-56789-0",
  landlordSignName: "",
  agentSignName: "",
  landlordSignDate: "",
  agentSignDate: "",
};

test("commission confirmation fills signature defaults and ignores a blank document number check", () => {
  const data = validateCommissionConfirmation(sample);
  assert.equal(data.landlordSignName, "สมชาย ใจดี");
  assert.equal(data.agentSignName, "NESTYK");
  assert.equal(data.landlordSignDate, "2026-09-29");
  assert.equal(data.monthlyRent, "20000");
});

test("commission confirmation rejects a missing landlord and a bad amount", () => {
  assert.throws(
    () => validateCommissionConfirmation({ ...sample, landlordName: "" }),
    /landlordName/,
  );
  assert.throws(
    () => validateCommissionConfirmation({ ...sample, agreedCommission: "0" }),
    /จำนวนเงิน/,
  );
});

test("commission confirmation PDF keeps a single stamped page", async () => {
  const bytes = await createCommissionConfirmationPdf(
    validateCommissionConfirmation(sample),
  );
  assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.ok(bytes.length > 1000);
});
