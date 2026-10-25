// Run without network/API calls: node scripts/test-campaign-save-publish.mjs
// Tests the actual backend source with mocked SDK, storage and image responses.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

function load(path, mocks = {}, context = {}) {
  let source = readFileSync(path, 'utf8');
  if (path.endsWith('serverImagePolicy.ts')) {
    source = source.replace('async function fetchTrustedMedia(', 'export async function fetchTrustedMedia(');
  }
  const code = transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require(id) {
      if (!(id in mocks)) throw Error('Unexpected dependency: ' + id);
      return mocks[id];
    },
    URL, Response, AbortSignal, TextEncoder, console, fetch: context.fetch || fetch,
  }, { filename: path });
  return module.exports;
}

const appId = '6a67a778342a8fe05ee79cba';
const media = 'https://media.base44.com/files/public/' + appId + '/photo.png';
const proxy = 'https://base44.app/api/apps/' + appId + '/files/mp/public/' + appId + '/photo.png';
const imagePolicy = load('base44/shared/serverImagePolicy.ts', {}, {
  fetch: async (url) => {
    if (url === proxy) return { status: 302, headers: new Headers({ location: media }) };
    if (url === media) return { status: 200, ok: true, headers: new Headers() };
    throw Error('Unexpected image URL: ' + url);
  },
});
assert.equal(imagePolicy.validIfundMediaUrl(proxy), proxy);
assert.equal(imagePolicy.validIfundMediaUrl(media), media);
assert.equal(imagePolicy.validIfundMediaUrl('https://evil.example/' + appId), '');
assert.equal(imagePolicy.validIfundMediaUrl('https://media.base44.com/files/public/other-app/photo.png'), '');
assert.equal(imagePolicy.validIfundMediaUrl('https://base44.app/api/apps/' + appId + '/files/mp/public/other-app/photo.png'), '');
assert.equal((await imagePolicy.fetchTrustedMedia(proxy)).status, 200);

const badPolicy = load('base44/shared/serverImagePolicy.ts', {}, {
  fetch: async () => ({ status: 302, headers: new Headers({ location: 'https://evil.example/hijack.png' }) }),
});
await assert.rejects(() => badPolicy.fetchTrustedMedia(proxy), /outside IFund media/);

let user = { id: 'creator-1', role: 'user' };
const rows = [];
let processed = 0;
const storage = {
  filter: async ({ id }) => rows.filter((r) => r.id === id),
  update: async (id, patch) => Object.assign(rows.find((r) => r.id === id), patch),
  create: async (payload) => {
    const record = { ...payload, id: 'campaign-' + (rows.length + 1) };
    rows.push(record);
    return record;
  },
};
const sdk = { asServiceRole: { entities: { Campaign: storage } } };
const handler = load('base44/functions/saveCampaign/entry.ts', {
  'npm:@base44/sdk@0.8.44': { createClientFromRequest: () => sdk },
  '../../shared/accountGuard.ts': { assertActiveAccount: async () => ({ ok: true, user }) },
  '../../shared/campaignResponse.ts': { campaignForResponse: (campaign) => campaign },
  '../../shared/serverImagePolicy.ts': {
    validIfundMediaUrl: imagePolicy.validIfundMediaUrl,
    enforceImagePolicy: async (_, __, url) => { processed++; return url; },
  },
}).default;

async function save(campaign, campaign_id) {
  const response = await handler({ json: async () => ({ campaign, campaign_id }) });
  return { status: response.status, body: await response.json() };
}

let result = await save({ title: '', goal_amount: 0, status: 'draft', cover_image_url: proxy, draft_step: 0 });
assert.equal(result.status, 200);
assert.equal(result.body.campaign.created_by_id, user.id);
assert.equal(result.body.campaign.status, 'draft');
assert.equal(processed, 0, 'private draft should not require media processing');

result = await save({ title: 'A garden', summary: 'Community garden', goal_amount: 50, status: 'active', cover_image_url: proxy }, 'campaign-1');
assert.equal(result.status, 200);
assert.equal(result.body.campaign.status, 'active');
assert.equal(processed, 1, 'draft-to-public must enforce image processing');

result = await save({ title: 'No photo yet', story: 'We need a garden', goal_amount: 50, status: 'active', cover_image_url: '' });
assert.equal(result.status, 200, 'a campaign can publish with the default cover');
assert.equal(result.body.campaign.created_by_id, user.id);

user = { id: 'another-user', role: 'user' };
result = await save({ title: 'Changed', goal_amount: 1, status: 'draft' }, 'campaign-1');
assert.equal(result.status, 403);
assert.equal(rows[0].title, 'A garden');
user = { id: 'creator-1', role: 'user' };

result = await save({ title: 'Bad photo', goal_amount: 0, status: 'draft', cover_image_url: 'https://evil.example/image.jpg' });
assert.equal(result.status, 422);

console.log('PASS: trusted image redirects, private draft saving, draft publishing, owner checks, default-cover publishing, unsafe URL rejection');
