import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root='base44/functions';
const exempt=new Set([
  'deleteAccount', // must resume its own pending-deletion state machine
  'getCampaignDonations', // public read with optional signed-in owner visibility
  'getCommunityFeed', // public read with optional follower personalization
]);
const mutation=/\.create\(|\.update\(|\.delete\(|updateMany\(|deleteMany\(|SendEmail|InvokeLLM|fetch\(/;
const offenders=[];
for (const name of fs.readdirSync(root)) {
  const p=path.join(root,name,'entry.ts');
  if (!fs.existsSync(p)) continue;
  const s=fs.readFileSync(p,'utf8');
  if (!s.includes('auth.me') || !mutation.test(s) || exempt.has(name)) continue;
  if (!s.includes('assertActiveAccount') && !s.includes('assertActiveAccountIfSignedIn')) offenders.push(name);
}
assert.deepEqual(offenders,[],`Authenticated mutation functions missing active-account guard: ${offenders.join(', ')}`);

const deletion=fs.readFileSync(path.join(root,'deleteAccount','entry.ts'),'utf8');
assert.match(deletion,/account_deletion_pending/);
assert.match(deletion,/ensureCanonicalCampaign/);
console.log('active-account mutation boundary contract: PASS');
