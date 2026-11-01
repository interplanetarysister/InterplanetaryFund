import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/components/campaigns/EditAIInstructionsDialog.jsx", import.meta.url), "utf8");

assert.match(source, /toast\(\{ title: "Couldn't save AI profile", description: "We couldn't save the AI profile\. Please try again\. If the problem continues, contact support\.", variant: "destructive" \}\)/);
assert.match(source, /console\.error\("EditAIInstructionsDialog AI profile save failed:", e\)/);
assert.doesNotMatch(source, /description:\s*e\.message/);
assert.doesNotMatch(source, /description:\s*.*error\.message/);
assert.match(source, /base44\.functions\.invoke\("updateCampaignSettings", \{ campaign_id: campaign\.id, patch: \{ ai_profile: profile \} \}\)/);
assert.doesNotMatch(source, /base44\.entities\.Campaign\.update/);
assert.match(source, /AIInstructionsStep value=\{profile\} onChange=\{setProfile\}/);

console.log("EditAIInstructionsDialog safe-error contract passed");
