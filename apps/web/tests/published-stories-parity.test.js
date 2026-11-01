import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validEditorialRef, limitEditorialResults, verifiedPublishedEntries, verifiedPublications,
} from "../src/lib/editorialContracts.js";
import { extractCampaignIds, splitCampaignContent } from "../src/lib/campaignEmbed.js";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const legacyId = "c73e129607a4d92f52a8d450"; // representative 24-char ID; NOT a real record.

test("original published Stories paths are rendered, not placeholder routes", () => {
  const app=read("src/App.jsx");
  for(const [path,view] of [["/blogs","Blogs"],["/blogs/:id","BlogArticle"],["/publications/:id","PublicationArticle"]]) {
    assert.ok(app.includes('path="'+path+'" element={<'+view+' />}'),path);
  }
  assert.match(read("src/pages/Blogs.jsx"),/IFund Stories & Blogs/);
  assert.match(read("src/pages/BlogArticle.jsx"),/CampaignEmbeddedText/);
  assert.match(read("src/pages/PublicationArticle.jsx"),/finalized PDF/);
});

test("ID validation accepts original text IDs without allowing URLs or SQL control chars",()=>{
  for(const id of [legacyId,"00000000-0000-0000-0000-000000000001","abc_def-123"])assert.equal(validEditorialRef(id),true);
  for(const id of [undefined,null,42,"", "../secrets", "javascript:alert(1)", "https://evil.test","foo%2fbar","a".repeat(129),"\n"])
    assert.equal(validEditorialRef(id),false,String(id));
  assert.equal(limitEditorialResults(-1),1);
  assert.equal(limitEditorialResults(501),100);
  assert.equal(limitEditorialResults("abc"),100);
  assert.equal(limitEditorialResults(2.8),2);
});

test("public rows are limited to published entries with active parent and complete content",()=>{
  const row={id:legacyId,status:"published",title:"Test",body:"Public text",blog:{status:"active"}};
  assert.deepEqual(verifiedPublishedEntries([row,{...row,id:"wrong?bad"},{...row,status:"draft"},{...row,blog:{status:"draft"}}]),[row]);
  assert.throws(()=>verifiedPublishedEntries(null),/Invalid public story response/);
  assert.throws(()=>verifiedPublishedEntries(Array(101).fill(row)),/Invalid public story response/);
  assert.deepEqual(verifiedPublications([{id:legacyId,status:"published",final_approved:true},
    {id:legacyId,status:"published",final_approved:false}]),[{id:legacyId,status:"published",final_approved:true}]);
});

test("public queries follow the verified live Supabase contract, not the obsolete table",()=>{
  const api=read("src/lib/editorial.js");
  assert.match(api,/\.rpc\("ifund_public_blog_entries_read"/);
  assert.match(api,/p_author_ref/);
  assert.match(api,/p_entry_id/);
  assert.match(api,/p_blog_id/);
  assert.match(api,/\.eq\("final_approved", true\)/);
  assert.doesNotMatch(api,/ifund_user_blogs|base44Client|service_role|select\("\*"\)/i);
});

test("embedded original campaign references render as components, never unsanitized iframe HTML",()=>{
  const token="[campaign:12345678]";
  assert.deepEqual(extractCampaignIds("Hi "+token+" "+token),["12345678"]);
  const parts=splitCampaignContent("hello "+token+" end");
  assert.equal(parts[1].type,"campaign");
  assert.equal(parts[1].id,"12345678");
  const embedded=read("src/components/campaigns/CampaignEmbeddedText.jsx");
  assert.match(embedded,/CampaignCard/);
  assert.doesNotMatch(embedded,/dangerouslySetInnerHTML|srcDoc|innerHTML/);
});
