const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const filename = path.resolve(__dirname, '../src/components/room-photo-load.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { photoLoadReducer: reduce, initialPhotoLoad: initial } = loaded.exports;

test('first successful load displays without reopening the room', () => {
  assert.deepEqual(reduce(initial, { type: 'loaded', attempt: 0 }), { attempt: 0, status: 'loaded' });
});
test('a transient error or timeout retries once automatically', () => {
  const retrying = reduce(initial, { type: 'failed', attempt: 0 });
  assert.deepEqual(retrying, { attempt: 1, status: 'loading' });
  assert.equal(reduce(retrying, { type: 'loaded', attempt: 1 }).status, 'loaded');
});
test('stale native callbacks cannot break a retry or a displayed image', () => {
  const retrying = reduce(initial, { type: 'failed', attempt: 0 });
  assert.equal(reduce(retrying, { type: 'failed', attempt: 0 }), retrying);
  assert.equal(reduce(retrying, { type: 'loaded', attempt: 0 }), retrying);
  const loaded = reduce(retrying, { type: 'loaded', attempt: 1 });
  assert.equal(reduce(loaded, { type: 'failed', attempt: 1 }), loaded);
});
test('persistent errors stop retrying and allow retry from the same screen', () => {
  const failed = reduce({ attempt: 1, status: 'loading' }, { type: 'failed', attempt: 1 });
  assert.equal(failed.status, 'failed');
  assert.deepEqual(reduce(failed, { type: 'retry' }), { attempt: 2, status: 'loading' });
});
