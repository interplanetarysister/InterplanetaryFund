import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const fn = read('base44/functions/getOwnerDonorDirectory/entry.ts');
const page = read('src/pages/Donors.jsx');
const app = read('src/App.jsx');
const layout = read('src/components/Layout.jsx');

assert.match(fn, /Campaign\.filter\(\{ created_by_id: user\.id \}/);
assert.match(fn, /payment_verified !== true/);
assert.match(fn, /giftOf\(donation\)/);
assert.match(fn, /donor_ref/);
assert.match(fn, /contactable: false/);
assert.doesNotMatch(fn, /email:/);
assert.doesNotMatch(fn, /donor_user_id:\s*donorUserId/);
assert.match(page, /getOwnerDonorDirectory/);
assert.match(page, /Anonymous gifts stay anonymous/);
assert.match(page, /Pending or unverified payment reports are not included/);
assert.match(app, /path="\/donors" element=\{<Donors \/>\}/);
assert.match(layout, /to: "\/donors", label: "Supporters"/);

console.log('owner supporter directory privacy contract: PASS');
