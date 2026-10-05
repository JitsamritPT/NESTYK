const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const loaded = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'contract-signing.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(loaded, loaded.exports);
const { bookingPaymentBlocksSigning } = loaded.exports;

test('tenant signing stays blocked until payment is confirmed by issuing a receipt', () => {
  const reservation = { formKind: 'reservation', receiptUrl: null };
  assert.equal(bookingPaymentBlocksSigning(reservation, 'tenant'), true);
  assert.equal(bookingPaymentBlocksSigning({ ...reservation, reservationPayment: { status: 'submitted' } }, 'tenant'), true);
  assert.equal(bookingPaymentBlocksSigning({ ...reservation, receiptUrl: 'receipt.pdf' }, 'tenant'), false);
});

test('booking payment gate affects only the reservation tenant', () => {
  for (const party of ['owner', 'agent', undefined]) {
    assert.equal(bookingPaymentBlocksSigning({ formKind: 'reservation', receiptUrl: null }, party), false);
  }
  for (const formKind of ['lease', 'broker_appointment']) {
    assert.equal(bookingPaymentBlocksSigning({ formKind, receiptUrl: null }, 'tenant'), false);
  }
});
