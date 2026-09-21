const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { validateNearbyPlaces, distanceMeters, validCoordinates, NEARBY_TYPES, formatTransitPlaceName, mergeNearbyPlaces, isMinorTransitPlace } = require('../src/agent/places/nearby-places.ts');
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

test('nearby search uses Legacy Nearby Search per type, filters parks/noise and computes distances', async (t) => {
  const original = global.fetch;
  const key = process.env.GOOGLE_MAPS_API_KEY;
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  t.after(() => {
    global.fetch = original;
    if (key === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = key;
  });

  const requests = [];
  global.fetch = async (url) => {
    const href = String(url);
    requests.push(href);
    assert.match(href, /maps\.googleapis\.com\/maps\/api\/place\/nearbysearch\/json/);
    const type = new URL(href).searchParams.get('type');
    return {
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            place_id: 'shared',
            name: 'BTS Shared',
            vicinity: 'สุขุมวิท',
            user_ratings_total: 130,
            geometry: { location: { lat: 13.75, lng: 100.5 } },
          },
          {
            place_id: type,
            name: type === 'park' ? 'Tiny park' : 'Place',
            vicinity: 'Somewhere',
            user_ratings_total: type === 'park' ? 0 : 200,
            geometry: { location: { lat: 13.751, lng: 100.5 } },
          },
          {
            place_id: 'minor',
            name: 'ป้ายรถเมล์สุขุมวิท 21',
            vicinity: 'ซอย',
            geometry: { location: { lat: 13.7505, lng: 100.5 } },
          },
          {
            place_id: 'outside',
            name: 'Too far away',
            user_ratings_total: 130,
            geometry: { location: { lat: 15, lng: 100.5 } },
          },
          {
            place_id: 'invalid',
            name: 'No location',
          },
        ],
      }),
    };
  };

  const service = new AgentPlacesService();
  const result = await service.nearby(13.75, 100.5, 'th');
  assert.equal(requests.length, NEARBY_TYPES.length);
  assert.deepEqual(
    requests.map((href) => Number(new URL(href).searchParams.get('radius'))),
    NEARBY_TYPES.map((row) => row.radius),
  );
  assert.equal(result.places.filter((p) => p.placeId === 'shared').length, 1);
  assert.equal(result.places.some((p) => ['outside', 'invalid', 'park', 'minor'].includes(p.placeId)), false);
  assert.ok(result.places.every((p) => p.distanceMeters <= 112));
  assert.equal(result.places[0].distanceMeters, 0);
  assert.equal(result.places.find((p) => p.placeId === 'shared')?.name, 'BTS Shared');
});

test('transit station names normalize BTS/MRT from Google Legacy labels', () => {
  assert.equal(formatTransitPlaceName('BTS อโศก', 'subway_station'), 'BTS อโศก');
  assert.equal(formatTransitPlaceName('สถานี BTS อโศก', 'subway_station'), 'BTS อโศก');
  assert.equal(formatTransitPlaceName('อโศก', 'subway_station', 'MRT Blue Line'), 'MRT อโศก');
  assert.equal(formatTransitPlaceName('บางซื่อ', 'train_station'), 'บางซื่อ');
  assert.equal(formatTransitPlaceName('CentralWorld', 'shopping_mall'), 'CentralWorld');
  assert.equal(isMinorTransitPlace('ป้ายรถเมล์สุขุมวิท 21'), true);
  assert.equal(isMinorTransitPlace('BTS อโศก'), false);
});

test('mergeNearbyPlaces reserves transit slots before filling other categories', () => {
  const places = [
    ...Array.from({ length: 12 }, (_, i) => ({
      placeId: `mall-${i}`,
      name: `Mall ${i}`,
      type: 'shopping_mall',
      latitude: 13.75,
      longitude: 100.5,
      distanceMeters: i + 1,
    })),
    ...Array.from({ length: 6 }, (_, i) => ({
      placeId: `bts-${i}`,
      name: `Station ${i}`,
      type: 'subway_station',
      latitude: 13.75,
      longitude: 100.5,
      distanceMeters: 20 + i,
    })),
  ];
  const merged = mergeNearbyPlaces(places);
  assert.equal(merged.filter((p) => p.type === 'subway_station').length, 6);
  assert.equal(merged.length, 18);
});

test('nearby query rejects missing coordinates without a Google request', async () => {
  const service = new AgentPlacesService();
  service.googleLegacyNearby = async () => { throw new Error('Must not call Google'); };
  const controller = new AgentPlacesController(service);
  await assert.rejects(controller.nearby(undefined, '100', 'th'), (error) => error.status === 400);
  await assert.rejects(controller.nearby('', '100', 'th'), (error) => error.status === 400);
});

test('upstream errors propagate instead of appearing as an empty successful search', async (t) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  t.after(() => {
    if (key === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = key;
  });
  const service = new AgentPlacesService();
  service.googleLegacyNearby = async () => { throw new Error('Upstream failed'); };
  await assert.rejects(service.nearby(13.75, 100.5, 'th'), /Upstream failed/);
});

test('reverse map pin preserves chosen coordinates and resolves Thai province',async(t)=>{
 const original=global.fetch; const key=process.env.GOOGLE_MAPS_API_KEY;
 process.env.GOOGLE_MAPS_API_KEY='test';
 t.after(()=>{global.fetch=original;if(key===undefined)delete process.env.GOOGLE_MAPS_API_KEY;else process.env.GOOGLE_MAPS_API_KEY=key;});
 const service=new AgentPlacesService();service.apiKey=()=> 'test';
 global.fetch=async()=>({ok:true,json:async()=>({status:'OK',results:[{place_id:'abc',formatted_address:'วัฒนา กรุงเทพมหานคร',address_components:[{long_name:'ประเทศไทย',short_name:'TH',types:['country']},{long_name:'กรุงเทพมหานคร',short_name:'กรุงเทพมหานคร',types:['administrative_area_level_1']},{long_name:'เขตวัฒนา',short_name:'วัฒนา',types:['sublocality_level_1']}]}]})});
 const result=await service.reverse(13.737,100.56);assert.equal(result.province,'กรุงเทพมหานคร');assert.equal(result.latitude,13.737);assert.equal(result.longitude,100.56);assert.equal(result.district,'วัฒนา');
 await assert.rejects(()=>service.reverse(NaN,100));
 global.fetch=async()=>({ok:true,json:async()=>({status:'REQUEST_DENIED'})});
 await assert.rejects(()=>service.reverse(13,100));
 global.fetch=async()=>({ok:true,json:async()=>({status:'OK',results:[{address_components:[{short_name:'US',types:['country']}]}]})});
 await assert.rejects(()=>service.reverse(13,100));
});
