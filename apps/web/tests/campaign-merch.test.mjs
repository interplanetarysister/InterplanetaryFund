import test from "node:test";
import assert from "node:assert/strict";
import {
  MERCH_DESIGN_OPTIONS, MERCH_AGENT_RESPONSIBILITIES, publicBeneficiaryLabel,
  validateMerchDesignRequest, calculateVerifiedMerchSplit, describeMerchArtwork,
} from "../src/lib/campaignMerch.mjs";

test("three unique campaign design choices with explicit beneficiary labels", () => {
  assert.equal(MERCH_DESIGN_OPTIONS.length, 3);
  assert.equal(new Set(MERCH_DESIGN_OPTIONS.map(x => x.id)).size, 3);
  assert.ok(MERCH_DESIGN_OPTIONS.every(x => x.description.includes("beneficiary")));
  assert.match(MERCH_AGENT_RESPONSIBILITIES.link, /Printful/);
});
test("beneficiary name is normalized and never accepted without permission", () => {
  assert.equal(publicBeneficiaryLabel("  Alice  <Owner>  "), "Alice Owner");
  assert.equal(publicBeneficiaryLabel(""), "");
  const input = {beneficiaryName:"Alex", designId:"orbit-portrait"};
  assert.equal(validateMerchDesignRequest(input).ok, false);
  assert.equal(validateMerchDesignRequest({...input,namePublicationApproved:true}).ok, false);
  assert.equal(validateMerchDesignRequest({...input,namePublicationApproved:true,artworkRightsConfirmed:true}).ok, true);
  assert.equal(validateMerchDesignRequest({...input,designId:"unapproved",namePublicationApproved:true,artworkRightsConfirmed:true}).ok, false);
});
test("no profit is booked until provider settlement, fulfillment and refund window close", () => {
  const order = {saleSubtotalCents:3000,productionCents:1400,sellerPaidShippingCents:400,paymentProcessingCents:100};
  for (const settlement of [{},{providerSettled:true},{providerSettled:true,orderFulfilled:true}]) {
    const result=calculateVerifiedMerchSplit({...order,...settlement});
    assert.equal(result.eligible,false);
    assert.equal(result.campaignCents,0);
    assert.equal(result.platformCents,0);
  }
  const clear=calculateVerifiedMerchSplit({...order,providerSettled:true,orderFulfilled:true,refundWindowClosed:true});
  assert.deepEqual({campaign:clear.campaignCents,platform:clear.platformCents,profit:clear.netProfitCents},
    {campaign:550,platform:550,profit:1100});
  const disputed=calculateVerifiedMerchSplit({...order,providerSettled:true,orderFulfilled:true,refundWindowClosed:true,hasOpenDispute:true});
  assert.equal(disputed.eligible,false);
});
test("rounding favors the campaign, and negative net profit is never distributed", () => {
  const cleared={providerSettled:true,orderFulfilled:true,refundWindowClosed:true};
  const oneCent=calculateVerifiedMerchSplit({...cleared,saleSubtotalCents:101,productionCents:100});
  assert.equal(oneCent.campaignCents,1);
  assert.equal(oneCent.platformCents,0);
  const loss=calculateVerifiedMerchSplit({...cleared,saleSubtotalCents:100,productionCents:250});
  assert.equal(loss.netProfitCents,0);
  assert.equal(loss.platformCents,0);
  assert.throws(()=>calculateVerifiedMerchSplit({...cleared,saleSubtotalCents:-1}),RangeError);
  assert.throws(()=>calculateVerifiedMerchSplit({...cleared,saleSubtotalCents:10.5}),RangeError);
});
test("art prompts keep user supplied details and request approval", () => {
  const brief=describeMerchArtwork({campaignTitle:"A safe home",campaignSummary:"Home repairs after a storm",beneficiaryName:"Sam",designId:"horizon-story"});
  assert.match(brief,/Sam/);
  assert.match(brief,/Home repairs after a storm/);
  assert.match(brief,/never create an order/i);
  assert.throws(()=>describeMerchArtwork({beneficiaryName:"Sam",designId:"unknown"}),RangeError);
});
