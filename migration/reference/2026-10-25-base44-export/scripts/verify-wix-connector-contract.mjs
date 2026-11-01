import assert from 'node:assert/strict';
import fs from 'node:fs';

const shared = fs.readFileSync('base44/functions/getSharedConnectorStatus/entry.ts', 'utf8');
const page = fs.readFileSync('src/pages/Connections.jsx', 'utf8');

assert.match(shared, /getConnection\('wix'\)/);
assert.match(shared, /https:\/\/www\.wixapis\.com\/site-properties\/v4\/properties/);
assert.match(shared, /if \(!res\.ok\)/);
assert.match(shared, /verified: false/);
assert.match(shared, /verified: true/);
assert.match(shared, /connectorCapabilities/);
assert.doesNotMatch(shared, /accessToken\) return \{ connected: true, verified: true/);
assert.match(page, /s\.connected && s\.verified/);
assert.match(page, />Connected</);
assert.match(page, />Needs attention</);

console.log('Wix shared connector contract passed.');
