import assert from 'node:assert/strict'; import fs from 'node:fs';
const mission=fs.readFileSync('src/components/dashboard/MissionControl.jsx','utf8');
const portability=fs.readFileSync('docs/HOST_PORTABILITY_AND_ADMIN_AGENT_CONTRACT.md','utf8');
assert.match(mission,/syncWixCampaigns/); assert.match(mission,/syncWixContent/); assert.match(mission,/syncWixBusinessData/); assert.match(mission,/syncWixAnalytics/); assert.match(mission,/Sync Wix/);
assert.match(portability,/same authoritative Base44 application\/data plane/i); assert.match(portability,/split-brain/i);
console.log('Wix Mission Control and replaceability contract passed.');