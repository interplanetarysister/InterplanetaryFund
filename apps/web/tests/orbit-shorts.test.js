import test from "node:test";
import assert from "node:assert/strict";
import { collectShorts, moveShortIndex, loadPublicVideoPosts, loadShortsFeed, createShortsFeedController } from "../src/lib/shortsFeed.js";
const UUID = "11111111-1111-4111-8111-111111111111";
const clip = "https://youtu.be/dQw4w9WgXcQ";
const campaign = {id:UUID,status:"active",title:"Public campaign",summary:"A public summary",story:clip};
const post = {id:"post-"+UUID,body:"Public clip "+clip};
const deferred = () => { let resolve,reject;const promise = new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject}; };

test("Shorts uses active canonical campaign IDs and moderated public RPC IDs only", () => {
  const items=collectShorts([campaign,{...campaign,status:"draft"},{...campaign,id:"legacy-id"},{...campaign,preview_only:true}],[post,{...post,id:UUID},{...post,id:"archive-private",visibility:"private"}]);
  assert.equal(items.length,2);
  assert.equal(items[0].href,"/campaign/"+UUID);
  assert.equal(items[1].href,"/social/post/post-"+UUID);
  assert.deepEqual(Object.keys(items[0]).sort(),["description","href","id","kind","title","video"]);
});
test("collection deduplicates stable item IDs and uses public archive media safely", () => {
  const items=collectShorts([campaign,campaign],[post,post,{id:"archive-public-1",body:"An old public clip",media_url:"https://vimeo.com/123456789"}]);
  assert.equal(items.length,3);
  assert.equal(items[2].video.type,"vimeo");
  assert.equal(items[2].href,"/social/post/archive-public-1");
  assert.throws(()=>collectShorts(null,[]),/Unexpected/);
});
test("financial data and unapproved file URLs cannot manufacture a public clip", () => {
  assert.equal(collectShorts([{...campaign,story:"",cover_image_url:"https://private.example/clip.mp4",raised_amount:1000}],[]).length,0);
  assert.equal(collectShorts([],[{...post,body:"No clip",media_url:"https://example.test/video.mp4"}]).length,0);
});
test("navigation stops at both ends, including an empty feed", () => {
  assert.equal(moveShortIndex(0,-1,3),0);assert.equal(moveShortIndex(0,1,3),1);assert.equal(moveShortIndex(2,1,3),2);assert.equal(moveShortIndex(0,1,0),0);
});
test("one unavailable public feed preserves valid clips and reports partial loading", async () => {
  const result=await loadShortsFeed({loadCampaigns:async()=>[campaign],loadPosts:async()=>{throw Error("unavailable");}});
  assert.equal(result.items.length,1);assert.equal(result.partial,true);
  await assert.rejects(loadShortsFeed({loadCampaigns:async()=>null,loadPosts:async()=>{throw Error("private provider response");}}),/Public videos/);
});
test("older reload success cannot replace a newer public feed", async () => {
  const old=deferred(),fresh=deferred(),states=[];let requests=0;
  const controller=createShortsFeedController({load:()=>++requests===1?old.promise:fresh.promise,onChange:state=>states.push(state)});
  const first=controller.reload(),second=controller.reload();
  fresh.resolve({items:[{id:"fresh"}],partial:false});await second;
  old.resolve({items:[{id:"old"}],partial:false});await first;
  assert.deepEqual(states.at(-1).items,[{id:"fresh"}]);controller.dispose();
});
test("stale errors and responses after unmount never publish into the view", async () => {
  const old=deferred(),fresh=deferred(),states=[];let requests=0;
  const controller=createShortsFeedController({load:()=>++requests===1?old.promise:fresh.promise,onChange:state=>states.push(state)});
  const first=controller.reload(),second=controller.reload();
  fresh.resolve({items:[{id:"fresh"}],partial:false});await second;old.reject(Error("old failure"));await first;
  assert.equal(states.at(-1).phase,"ready");
  controller.dispose();const count=states.length;await controller.reload();assert.equal(states.length,count);
  const pending=deferred(),after=[];const disposed=createShortsFeedController({load:()=>pending.promise,onChange:state=>after.push(state)});
  const run=disposed.reload();disposed.dispose();pending.resolve({items:[post],partial:false});await run;assert.equal(after.length,1);
});

test("public clip pagination uses the moderated feed cursor with a bounded read", async () => {
 const calls=[];
 const rows=Array.from({length:110},(_,i)=>({id:"archive-public-"+i,body:clip,posted_at:new Date(Date.UTC(2026,10,16)-i*1000).toISOString()}));
 const posts=await loadPublicVideoPosts({loadPage:async({before}={})=>{calls.push(before);const start=before?rows.findIndex(x=>x.id===before.id)+1:0;return rows.slice(start,start+24);}});
 assert.equal(posts.length,100);assert.equal(calls.length,5);
 assert.deepEqual(calls[1],{id:rows[23].id,posted_at:rows[23].posted_at});
});
test("repeated or malformed public cursors cannot create an unbounded load", async () => {
 const rows=[{...post,posted_at:"2026-11-16T00:00:00Z"}];let calls=0;
 await assert.rejects(loadPublicVideoPosts({pageSize:1,limit:3,loadPage:async()=>{calls++;return rows;}}),/pagination/);
 assert.equal(calls,2);
 await assert.rejects(loadPublicVideoPosts({pageSize:0,loadPage:async()=>[]}),/limit/);
});
test("posts with attached native videos join Shorts as direct clips", async () => {
  const { publicMediaDirectSources } = await import("../src/lib/videoLinks.js");
  const origin = "https://interplanetaryfund.com";
  const attached = { ...post, body: "Launch clip", media_url: "/api/media/public/file/" + UUID + ".mp4" };
  const options = { origin, directSources: publicMediaDirectSources(origin) };
  const items = collectShorts([], [attached], options);
  assert.equal(items.length, 1);
  assert.equal(items[0].video.type, "direct");
  assert.equal(items[0].video.src, origin + "/api/media/public/file/" + UUID + ".mp4");
  assert.equal(items[0].href, "/social/post/post-" + UUID);
  // Without the approved own-origin source the same post is not a clip:
  // attached media never bypasses the direct-source approval rule.
  assert.equal(collectShorts([], [attached]).length, 0);
  assert.equal(collectShorts([], [attached], { origin, directSources: publicMediaDirectSources("https://evil.test") }).length, 0);
  // Attached images are not Shorts.
  const image = { ...attached, media_url: "/api/media/public/file/" + UUID + ".png" };
  assert.equal(collectShorts([], [image], options).length, 0);
});
