import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');

const membership=read('base44/functions/communityMembership/entry.ts');
const createCommunity=read('base44/functions/createCommunity/entry.ts');
const apply=read('base44/functions/applyInstitutionOpportunity/entry.ts');
const publish=read('base44/functions/publishInstitutionOpportunity/entry.ts');
const support=read('base44/functions/createSupportTicket/entry.ts');
const contact=read('base44/functions/sendPublicContactMessage/entry.ts');
const comms=read('base44/functions/sendCommunication/entry.ts');

assert.match(createCommunity,/isFeatureEnabled\(base44, 'community_creation'\)/);
assert.match(membership,/community\.created_by_id === user\.id/);
assert.match(membership,/owner cannot leave without transferring or closing/i);
assert.doesNotMatch(membership,/user_name: user\.full_name \|\| user\.email/);

assert.match(apply,/String\(opp\.institution_id \|\| ''\) !== String\(institution_id\)/);
assert.match(apply,/campaign\.created_by_id !== user\.id/);
assert.match(apply,/safeNarrative\.length > 10000/);
assert.match(apply,/requestedAmount > 100000000/);
assert.match(publish,/institution\.created_by_id !== user\.id/);
assert.match(publish,/safeTitle\.length > 200/);

assert.match(support,/user_id:user\.id/);
assert.match(contact,/checkRateLimit/);
assert.match(contact,/Please enter a valid name, email, and message/);
assert.match(comms,/payment_verified === true/);
assert.match(comms,/prefs\.email_updates !== false/);
assert.match(comms,/prefs\.in_app_updates !== false/);

console.log('community, institutions, support and communications user-boundary contract: PASS');
