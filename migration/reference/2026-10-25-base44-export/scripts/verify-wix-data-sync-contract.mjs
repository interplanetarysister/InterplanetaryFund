import assert from 'node:assert/strict';
import fs from 'node:fs';

const content = fs.readFileSync('base44/functions/syncWixContent/entry.ts', 'utf8');
const business = fs.readFileSync('base44/functions/syncWixBusinessData/entry.ts', 'utf8');
const analytics = fs.readFileSync('base44/functions/syncWixAnalytics/entry.ts', 'utf8');
const ledger = fs.readFileSync('base44/entities/ExternalPlatformRecord.jsonc', 'utf8');

assert.match(content, /IFundContent/);
assert.match(content, /SocialPost/);
assert.match(content, /CampaignUpdate/);
assert.match(content, /failed === 0/);
assert.match(content, /status: failed === 0 \? 200 : 502/);

assert.match(business, /contacts\/v4\/contacts/);
assert.match(business, /ecom\/v1\/orders\/search/);
assert.match(business, /record_type: type/);
assert.ok(business.includes('email-marketing/v1/campaigns'));
assert.match(business, /'marketing'/);
assert.match(business, /do not create/i);

assert.match(analytics, /analytics-ng\/v2\/site-analytics\/data/);
assert.match(analytics, /TOTAL_SESSIONS/);
assert.match(analytics, /TOTAL_FORMS_SUBMITTED/);
assert.match(analytics, /searchParams\.set\('dateRange\.startDate'/);
assert.match(analytics, /searchParams\.set\('dateRange\.endDate'/);
assert.match(analytics, /searchParams\.append\('measurementTypes'/);
assert.match(analytics, /method: 'GET'/);
assert.doesNotMatch(analytics, /body: JSON\.stringify/);

assert.match(ledger, /"record_type"/);
assert.match(ledger, /"owner_user_id"/);
console.log('Wix content, contacts, leads, orders, marketing-signal, and analytics sync contracts passed.');
