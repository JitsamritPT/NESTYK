const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { validateNearbyPlaces, distanceMeters, validCoordinates, NEARBY_TYPES } = require('../src/agent/places/nearby-places.ts');
const { AgentPlacesService } = require('../src/agent/places/agent-places.service.ts');
const { AgentPlacesController } = require('../src/agent/places/agent-places.controller.ts');
const pin = (id = 'custom-1') => ({ placeId: id, name: 'Market', type: 'custom_nearby', latitude: 13.75, longitude: 100.5, distanceMeters: 100 });

test('nearby coordinates and distances handle equator, antimeridian and invalid values', () => {
  assert.equal(validCoordinates(0, 0), true);
  assert.equal(validCoordinates(91, 0), false);
  assert.equal(validCoordinates(13, Infinity), false);
  assert.equal(distanceMeters(0, 0, 0, 0), 0);
  assert.ok(distanceMeters(0, 179.999, 0, -179.999) < 225);
});

test('nearby payload validates names, coordinates, duplicates and custom / Google limits', () => {
  validateNearbyPlaces([]); validateNearbyPlaces([pin()]);
  const invalid = [null, {}, [pin(), pin()], [{ ...pin(), name: '  ' }], [{ ...pin(), latitude: '13.75' }], [{ ...pin(), longitude: 181 }], [{ ...pin(), distanceMeters: NaN }], Array.from({ length: 6 }, (_, i) => pin(`custom-${i}`)), Array.from({ length: 25 }, (_, i) => ({ ...pin(`google-${i}`), type: 'hospital' }))];
  for (const value of invalid) assert.throws(() => validateNearbyPlaces(value), (error) => error.status === 400);
});

test('nearby search requests each radius, filters low-quality parks, deduplicates and computes distances', async () => {
  const service = new AgentPlacesService();
  const requests = [];
  service.googlePost = async (url, body, mask) => {
    requests.push({ url, body, mask });
    return { places: [
      { id: 'shared', displayName: { text: 'Shared station' }, location: { latitude: 13.75, longitude: 100.5 }, userRatingCount: 130 },
      { id: body.includedTypes[0], displayName: { text: 'Place' }, location: { latitude: 13.751, longitude: 100.5 }, userRatingCount: 0 },
      { id: 'outside', displayName: { text: 'Too far away' }, location: { latitude: 15, longitude: 100.5 }, userRatingCount: 130 },
      { id: 'invalid', displayName: { text: 'No location' } },
    ] };
  };
  const result = await service.nearby(13.75, 100.5, 'th');
  assert.equal(requests.length, 6);
  assert.deepEqual(requests.map((r) => r.body.locationRestriction.circle.radius), NEARBY_TYPES.map((r) => r.radius));
  assert.equal(result.places.filter((p) => p.placeId === 'shared').length, 1);
  assert.equal(result.places.some((p) => ['outside', 'invalid', 'park'].includes(p.placeId)), false);
  assert.ok(result.places.every((p) => p.distanceMeters <= 112));
  assert.equal(result.places[0].distanceMeters, 0);
});

test('nearby query rejects missing coordinates without a Google request', async () => {
  const service = new AgentPlacesService();
  service.googlePost = async () => { throw new Error('Must not call Google'); };
  const controller = new AgentPlacesController(service);
  await assert.rejects(controller.nearby(undefined, '100', 'th'), (error) => error.status === 400);
  await assert.rejects(controller.nearby('', '100', 'th'), (error) => error.status === 400);
});

test('upstream errors propagate instead of appearing as an empty successful search', async () => {
  const service = new AgentPlacesService();
  service.googlePost = async () => { throw new Error('Upstream failed'); };
  await assert.rejects(service.nearby(13.75, 100.5, 'th'), /Upstream failed/);
});
