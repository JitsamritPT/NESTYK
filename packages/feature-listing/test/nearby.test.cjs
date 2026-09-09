const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { createCustomPlace, relocateNearby, isCustomPlace, nearbyCategory } = require('../src/nearby.ts');
test('custom pins keep their coordinates and IDs when the property moves, and recalculate distance', () => {
  const place = createCustomPlace(13.75, 100.5, 13.75, 100.5);
  assert.equal(place.distanceMeters, 0);
  assert.equal(isCustomPlace(place), true);
  const moved = relocateNearby([place], 13.751, 100.5)[0];
  assert.equal(moved.placeId, place.placeId);
  assert.equal(moved.latitude, 13.75);
  assert.equal(moved.distanceMeters, 111);
  assert.equal(nearbyCategory('train_station'), 'transit');
  assert.equal(nearbyCategory('custom_nearby'), 'other');
});
