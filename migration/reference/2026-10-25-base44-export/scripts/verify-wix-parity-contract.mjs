import assert from "node:assert/strict"; import fs from "node:fs";
const connections=fs.readFileSync("src/pages/Connections.jsx","utf8");
const mission=fs.readFileSync("src/components/dashboard/MissionControl.jsx","utf8");
const css=fs.readFileSync("src/index.css","utf8");
for (const name of ["syncWixCampaigns","syncWixContent","syncWixBusinessData","syncWixAnalytics"]) { assert.match(connections,new RegExp(name)); assert.match(mission,new RegExp(name)); }
assert.match(connections,/flex flex-wrap items-center/);
assert.match(connections,/Sync Wix/);
assert.match(css,/touch-action:\s*pan-y/i);
console.log("Wix shared web/mobile parity contract passed.");