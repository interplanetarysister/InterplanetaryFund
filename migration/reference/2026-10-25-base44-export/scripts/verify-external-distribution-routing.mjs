import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validExternalFundraiserUrl, resolveDonationDestination } from '../base44/shared/distributionDestination.js';
import { ALL_PLATFORMS } from '../src/components/connections/platformCatalog.js';

const campaignId = 'campaign-one';
const approved = { id: 'external-one', platform: 'gofundme', kind: 'crowdfunding',
  created_by_id: 'owner-one', campaign_id: campaignId, status: 'connected',
  verification_status: 'verified', external_url: 'https://www.gofundme.com/f/example-campaign' };
const sr = { entities: { PlatformConnection: { get: async id => id === approved.id ? approved : null } } };

assert.equal(validExternalFundraiserUrl('gofundme', approved.external_url), approved.external_url);
assert.equal(validExternalFundraiserUrl('gofundme', 'https://gofundme.com.evil.test/f/fake'), null);
assert.equal(validExternalFundraiserUrl('gofundme', 'https://www.kickstarter.com/projects/example'), null);
assert.equal(validExternalFundraiserUrl('gofundme', 'http://gofundme.com/f/insecure'), null);
assert.equal(validExternalFundraiserUrl('gofundme', 'https://gofundme.com/'), null);
assert.equal(validExternalFundraiserUrl('custom', 'https://127.0.0.1/f/unsafe'), null);
assert.equal(validExternalFundraiserUrl('custom', 'https://localhost/f/unsafe'), null);
assert.equal(validExternalFundraiserUrl('justgiving', 'https://www.justgiving.com/fundraising/fundname'), 'https://www.justgiving.com/fundraising/fundname');

const local = await resolveDonationDestination(sr, 'owner-one', campaignId, '');
assert.equal(local.kind, 'ifund');
assert.match(local.url, /interplanetaryfund.com/);
const external = await resolveDonationDestination(sr, 'owner-one', campaignId, approved.id);
assert.equal(external.kind, 'external');
assert.equal(external.url, approved.external_url);
assert.equal(external.platform, 'gofundme');
await assert.rejects(() => resolveDonationDestination(sr, 'owner-two', campaignId, approved.id));
await assert.rejects(() => resolveDonationDestination(sr, 'owner-one', 'campaign-two', approved.id));
await assert.rejects(() => resolveDonationDestination(sr, 'owner-one', campaignId, 'unknown-id'));
approved.verification_status = 'unverified';
await assert.rejects(() => resolveDonationDestination(sr, 'owner-one', campaignId, approved.id));

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const connectionSchema = JSON.parse(read('base44/entities/PlatformConnection.jsonc'));
const schemaPlatforms = new Set(connectionSchema.properties.platform.enum);
const catalogPlatformsMissingFromSchema = ALL_PLATFORMS
  .map(({ id }) => id)
  .filter(id => !schemaPlatforms.has(id));
assert.deepEqual(catalogPlatformsMissingFromSchema, [],
  `Connection catalog platform ids missing from PlatformConnection schema: ${catalogPlatformsMissingFromSchema.join(', ')}`);
const generator = read('base44/functions/generateDistributionContent/entry.ts');
const writer = read('base44/functions/createDistributedPost/entry.ts');
const ui = read('src/components/distribution/DistributionPanel.jsx');
const manual = read('base44/functions/publishLinkedCampaignToConnection/entry.ts');
const capabilities = read('base44/shared/providerCapabilities.ts');
assert.match(generator, /donation_destination_connection_id/);
assert.match(generator, /resolveDonationDestination/);
assert.match(writer, /resolveDonationDestination/);
assert.match(ui, /Where should supporters donate/);
assert.match(ui, /donation_destination_connection_id/);
assert.match(manual, /manual_setup_required: true/);
assert.match(manual, /external_campaign_created: false/);
assert.match(capabilities, /campaign_create_verified = false/);
assert.match(read('base44/functions/updateCampaignSettings/entry.ts'), /distribution_donation_connection_id/);
assert.match(read('base44/functions/runSocialAutopilot/entry.ts'), /resolveDonationDestination/);
assert.match(read('base44/shared/crossPost.ts'), /resolveDonationDestination/);
assert.match(read('src/components/connections/platformCatalog.js'), /justgiving/);
assert.match(read('base44/shared/connectionVerification.ts'), /justgiving/);
console.log('External distribution link security, ownership, and publish-capability contracts: PASS');
