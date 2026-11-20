import test from "node:test";
import assert from "node:assert/strict";
import {SCOUT_PUBLIC_FEEDS,scoutSafeLink,scoutParsePublicRss,scoutFilterLeads} from "../src/lib/scoutFeeds.mjs";
import {onRequest} from "../functions/api/public/scout-feed.js";
const source=SCOUT_PUBLIC_FEEDS[0];
const xml=`<?xml version="1.0"?><rss version="2.0"><channel>
 <item><title><![CDATA[Community &amp; education support]]></title>
 <link>https://www.grants.gov/search-results-detail/123</link>
 <description><![CDATA[Check eligibility with the agency.]]></description>
 <pubDate>Fri, 20 Nov 2026 00:00:00 GMT</pubDate></item>
 <item><title>Untrusted redirect</title><link>https://attacker.com/offer</link><description>Do not show</description></item>
 </channel></rss>`;
test("SCOUT only accepts official HTTPS links and labels leads as unverified",()=>{
 const rows=scoutParsePublicRss(xml,source,{now:Date.parse("2026-11-21")});
 assert.equal(rows.length,1);
 assert.equal(rows[0].title,"Community & education support");
 assert.equal(rows[0].status,"unreviewed_official_feed");
 assert.equal(rows[0].reward_verified,false);
 assert.equal(rows[0].eligibility_verified,false);
 assert.equal(rows[0].provider_partnership_verified,false);
 assert.equal(scoutSafeLink("https://grants.gov/foo",source.domain),true);
 assert.equal(scoutSafeLink("https://grants.gov.evil.com",source.domain),false);
 assert.equal(scoutSafeLink("http://grants.gov",source.domain),false);
 assert.equal(scoutFilterLeads(rows,"education").length,1);
 assert.equal(scoutFilterLeads(rows,"housing").length,0);
});
test("SCOUT endpoint rejects mutation and search abuse",async()=>{
 const r=await onRequest({request:new Request("https://ifund.test/api/public/scout-feed",{method:"POST"})});
 assert.equal(r.status,405);
 const bad=await onRequest({request:new Request("https://ifund.test/api/public/scout-feed?q="+encodeURIComponent("x".repeat(101)))});
 assert.equal(bad.status,400);
});
test("SCOUT endpoint reports source provenance and no member earning authority",async()=>{
 const response=await onRequest({request:new Request("https://ifund.test/api/public/scout-feed?q=education"),fetch:async url=>
   new Response(url.includes("grants.gov")?xml:"<rss version='2.0'></rss>",{status:200,headers:{"content-type":"application/rss+xml"}})});
 assert.equal(response.status,200);const data=await response.json();
 assert.equal(data.leads.length,1);
 assert.equal(data.earning_opportunities_verified,false);
 assert.equal(data.individual_eligibility_verified,false);
 assert.equal(data.partner_affiliation,false);
 assert.equal(data.external_actions_performed,false);
});
test("SCOUT aborts oversized or unreachable feeds without fabricating results",async()=>{
 const response=await onRequest({request:new Request("https://ifund.test/api/public/scout-feed"),fetch:async()=>
   new Response("failure",{status:502})});
 assert.equal(response.status,503);
 const data=await response.json();assert.deepEqual(data.leads,[]);
});
