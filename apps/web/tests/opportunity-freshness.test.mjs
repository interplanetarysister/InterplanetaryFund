import test from "node:test";
import assert from "node:assert/strict";
import {currentVerifiedOpportunity,opportunityDeadlineLabel} from "../src/lib/opportunityFreshness.mjs";
const now=Date.parse("2026-11-26T06:00:00Z");
const row=(overrides={})=>({status:"open",source_system:"ifund_external_verified_v1",official_url:"https://example.org/program",verified_at:"2026-11-25T06:00:00Z",...overrides});
const allowed=overrides=>currentVerifiedOpportunity(row(overrides),{now});
test("fresh open sources are potential only and unknown deadlines are labeled",()=>{
 assert.equal(allowed({}),true);
 assert.match(opportunityDeadlineLabel(row()),/Deadline unknown/);
});
test("expired exact deadlines, past dates and invalid date strings are rejected",()=>{
 assert.equal(allowed({deadline_at:"2026-11-26T05:59:59Z"}),false);
 assert.equal(allowed({deadline_at:"2026-11-26T06:00:00Z"}),false);
 assert.equal(allowed({deadline_at:"2026-11-26T06:00:01Z"}),true);
 assert.equal(allowed({deadline_date:"2026-11-25"}),false);
 assert.equal(allowed({deadline_date:"2026-11-26"}),true);
 assert.equal(allowed({deadline_date:"2026-02-30"}),false);
 assert.equal(allowed({deadline_at:"invalid"}),false);
});
test("stale, future, closed, unverified and credential-bearing sources fail closed",()=>{
 for(const patch of [{verified_at:"2026-10-25T00:00:00Z"},{verified_at:"2026-11-27T00:00:00Z"},{verified_at:null},{status:"closed"},{source_system:"legacy"},{official_url:"http://example.org"},{official_url:"https://user:pass@example.org"}])assert.equal(allowed(patch),false);
});
test("program directories use the existing longer freshness window but still reject elapsed deadlines",()=>{
 assert.equal(allowed({status:"program",verified_at:"2026-07-01T00:00:00Z"}),true);
 assert.equal(allowed({status:"program",verified_at:"2026-01-01T00:00:00Z"}),false);
 assert.equal(allowed({status:"program",deadline_date:"2026-11-01"}),false);
});
