import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const notifications = read('src/pages/Notifications.jsx');
const discover = read('src/pages/Discover.jsx');
const app = read('src/App.jsx');

assert.match(app, /path="\/notifications" element=\{<Notifications \/>\}/);
assert.match(notifications, /Notification\.filter\(\{ user_id: me\.id \}/);
assert.match(notifications, /requestGeneration = useRef/);
assert.match(notifications, /mountedRef = useRef/);
assert.match(notifications, /Malformed notification response/);
assert.match(notifications, /role="alert"/);
assert.match(notifications, /Loading notifications/);
assert.match(discover, /const \[compareIds, setCompareIds\]/);
assert.match(discover, /current\.length < 3/);
assert.match(discover, /aria-label="Campaign comparison"/);
assert.match(discover, /overflow-x-auto/);
assert.match(discover, /Comparison is informational/);

console.log('notifications and campaign comparison contract: PASS');
