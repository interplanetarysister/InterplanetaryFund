import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const social = read('base44/shared/socialPublish.ts');
const publish = read('base44/functions/publishPost/entry.ts');
const broadcast = read('base44/functions/broadcastPosts/entry.ts');
const capabilities = read('base44/shared/providerCapabilities.ts');
const distribution = read('src/components/distribution/DistributionPanel.jsx');
const catalog = read('src/components/connections/platformCatalog.js');

assert.match(social, /connection\?\.platform === 'mastodon'\) return false/);
assert.match(social, /Live Mastodon publishing is unavailable in this runtime/);
assert.doesNotMatch(social, /https:\/\/\$\{host\}\/api\/v1\/statuses/);
assert.doesNotMatch(social, /errBody\.slice/);

for (const source of [publish, broadcast]) {
  assert.match(source, /direct_publish_verified === true/);
  assert.match(source, /test_status === 'passing'/);
  assert.match(source, /implementation_status === 'implemented'/);
}
assert.match(broadcast, /canPublishViaConnector/);
assert.match(broadcast, /getCurrentAppUserConnection\(linkedinConnectorId\)/);
assert.match(broadcast, /ownerOAuth\?\.accessToken/);
assert.match(broadcast, /publishThroughConnection\(connection, text, sr, ownerOAuth\)/);
assert.doesNotMatch(publish, /pubError.*message \?/);
assert.doesNotMatch(publish, /console\.error\('publishPost error:', error\.message\)/);
assert.match(capabilities, /DIRECT_PUBLISH_RUNTIME_PLATFORMS = new Set\(\['bluesky', 'linkedin'\]\)/);
assert.match(capabilities, /merged\.direct_publish_verified = DIRECT_PUBLISH_RUNTIME_PLATFORMS\.has/);
assert.match(distribution, /direct_publish_verified === true/);
assert.match(distribution, /\[\"bluesky\", \"linkedin\"\]\.includes\(c\.platform\)/);
assert.match(distribution, /const approvedReady = \(c, capabilityMap\) => isUsableConnection/);
assert.doesNotMatch(distribution, /approvedReady\(c,aiAuthorized/);
assert.doesNotMatch(distribution, /c\.platform === \"mastodon\" && cr\.mastodon_instance/);
assert.match(catalog, /Direct Mastodon posting stays off until the runtime can verify the instance safely/);

console.log('social publishing truth and transport safety contract: PASS');