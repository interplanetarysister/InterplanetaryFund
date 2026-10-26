import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const get = read('base44/functions/getConnectedPayoutAccount/entry.ts');
const start = read('base44/functions/startStripeConnectOnboarding/entry.ts');
const manage = read('base44/functions/manageConnectedPayoutAccount/entry.ts');
const prepare = read('base44/functions/prepareCollectAndWithdraw/entry.ts');
const page = read('src/pages/Withdrawals.jsx');

assert.match(get, /provider_available:false/);
assert.match(get, /status:'unavailable'/);
assert.match(get, /record\.status==='disabled'/);
assert.match(get, /provider_available:true/);
assert.doesNotMatch(get, /error\?\.message\|\|error/);

assert.match(start, /record\?\.status==='disabled'/);
assert.match(start, /status:'onboarding'/);
assert.doesNotMatch(start, /error\?\.message\|\|error/);

assert.match(manage, /action!=='disconnect'/);
assert.match(manage, /owner_user_id:user\.id/);
assert.match(manage, /status:'disabled'/);
assert.match(manage, /External provider account deletion was not implied/);

assert.match(prepare, /payoutVerificationFresh/);
assert.match(prepare, /15 \* 60 \* 1000/);
assert.match(page, /provider_available === true && payoutAccount\?\.status === "ready"/);
assert.match(page, /manageConnectedPayoutAccount/);
assert.match(page, /Campaign withdrawals still use the owner's PayPal email/);

console.log('connected settlement account truth contract: PASS');
