import test from "node:test";
import assert from "node:assert/strict";
import {helpTopicForPath,helpPathForLocation,HELP_CATEGORY_NAMES} from "../src/lib/helpCenter.js";

test("relevant context help on finance, plans, campaign, AI and account routes",()=>{
  const entries=[
    ["/plans","Subscriptions"],["/subscriptions","Subscriptions"],
    ["/finances","Money & Withdrawals"],["/withdrawals","Money & Withdrawals"],
    ["/admin/finance","Money & Withdrawals"],["/donors","Donations"],
    ["/create","Campaigns"],["/campaign/abc","Campaigns"],
    ["/campaigns/abc/edit","Campaigns"],["/fundraising-partners","Campaigns"],
    ["/agents","AI Assistance"],["/analytics","AI Assistance"],
    ["/community/abc","Community"],["/news","Community"],
    ["/connections","Connections & Publishing"],["/admin/studio","Connections & Publishing"],
    ["/permissions","Account & Security"],["/register","Account & Security"],
    ["/health-privacy","Legal & Policies"],["/download","Getting Started"]
  ];
  for(const [path,expected] of entries){
    assert.equal(helpTopicForPath(path),expected,path);
    assert.ok(HELP_CATEGORY_NAMES.includes(expected));
    assert.equal(helpPathForLocation(path),"/help?category="+encodeURIComponent(expected));
  }
});

test("unrecognized paths safely fall back to the full help center",()=>{
  assert.equal(helpPathForLocation("/unknown-nested"),"/help");
  assert.equal(helpTopicForPath(""),"");
  assert.equal(helpPathForLocation("/"),"/help");
});
