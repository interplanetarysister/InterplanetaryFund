import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCityQuery, verifiedCityLocation } from '../src/lib/cityGeocodeContract.mjs';
import { lookupCampaignCity } from '../src/api/cityGeocode.js';
import { readFileSync } from 'node:fs';

const user = { id: 'owner-A', email_confirmed_at: '2026-11-16', is_anonymous: false };
const result = { lat: 51.5, lng: -0.1, display: 'London', approximate: true,
  provider: 'openstreetmap_nominatim', attribution: '© OpenStreetMap contributors' };
function client() {
  return { auth: { getUser: async () => ({ data: { user }, error: null }),
    getSession: async () => ({ data: { session: { user, access_token: 'test.owner.bearer' } } }) } };
}
test('city parser supports international place names and rejects addresses, URLs and excessive bounds', () => {
  for (const city of ['São Paulo, Brasil', 'Paris, France', "L'Haÿ-les-Roses", '東京']) assert.equal(normalizeCityQuery(city), city);
  for (const city of ['123 Main Street', 'Seattle 98101', '47.6,-122.3', 'https://example.org', 'London\nParis', 'a', 'a'.repeat(81), null])
    assert.throws(() => normalizeCityQuery(city));
  assert.throws(() => verifiedCityLocation({ ...result, lat: 51.5074456 }));
  assert.throws(() => verifiedCityLocation({ ...result, display: '123 Main Street' }));
});
test('browser lookup uses canonical same-origin bearer transport and only returns broad verified facts', async () => {
  const seen = [];
  assert.deepEqual(await lookupCampaignCity(client(), ' London ', { fetcher: async (url, init) => {
    seen.push({ url, init }); return Response.json(result);
  } }), result);
  assert.equal(seen[0].url, '/api/geocode/city');
  assert.equal(seen[0].init.headers.Authorization, 'Bearer test.owner.bearer');
  assert.deepEqual(JSON.parse(seen[0].init.body), { city: 'London' });
});
test('guest and changed-session requests never show location from another account', async () => {
  const guest = client();guest.auth.getUser = async () => ({ data: { user: null } });
  await assert.rejects(lookupCampaignCity(guest, 'London', { fetcher: () => { throw Error('must not fetch'); } }), /Sign in/);
  const c = client();let resolve;
  const pending = lookupCampaignCity(c, 'London', { fetcher: () => new Promise(yes => { resolve = yes; }) });
  await new Promise(yes => setImmediate(yes));
  c.auth.getUser = async () => ({ data: { user: { ...user, id: 'owner-B' } } });
  resolve(Response.json(result));
  await assert.rejects(pending, /account changed/);
});
test('upstream errors and precision failures are safe errors rather than map state or fake success', async () => {
  await assert.rejects(lookupCampaignCity(client(), 'London', { fetcher: async () => Response.json({ error: 'server secret diagnostic' }, { status: 503 }) }), /unavailable/);
  await assert.rejects(lookupCampaignCity(client(), 'London', { fetcher: async () => Response.json({ ...result, lng: -0.1277653 }) }), /could not be verified/);
});
test('city lookup is click-only, keeps explicit opt-in and rejects stale lookup/device callbacks', () => {
  const fields = readFileSync(new URL('../src/components/atlas/CampaignLocationFields.jsx', import.meta.url), 'utf8');
  assert.match(fields, /onClick=\{searchCity\}/);
  assert.match(fields, /if \(!editable\.current \|\| searching\) return/);
  assert.match(fields, /ticket === revision\.current/);
  assert.match(fields, /if \(!mounted\.current \|\| !editable\.current \|\| ticket !== revision\.current\) return/);
  assert.doesNotMatch(fields, /lookupCampaignCity[\s\S]*?change\("map_opt_in", true\)/);
  assert.match(fields, /© OpenStreetMap contributors/);
});
