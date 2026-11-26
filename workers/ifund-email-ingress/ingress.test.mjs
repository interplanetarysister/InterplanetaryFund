import test from "node:test";
import assert from "node:assert/strict";
import {mailboxKind,receiveEmail,retryBusinessMail} from "./index.mjs";
const ORIGIN="https://ssibsfmtodgximseeqsv.supabase.co";
const now=Date.now(),textEncoder=new TextEncoder();
async function setup(){
 const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const privateKey=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey("pkcs8",pair.privateKey))));
 const records=new Map(),calls=[],forwarded=[],rejected=[];
 const bucket={
  async put(key,value,opts={}){const bytes=typeof value==="string"?textEncoder.encode(value):new Uint8Array(value);records.set(key,{bytes,meta:opts.customMetadata||{},uploaded:new Date(now-3600000)});},
  async get(key){const v=records.get(key);if(!v)return null;return {key,size:v.bytes.length,body:new Response(v.bytes).body,customMetadata:v.meta,json:async()=>JSON.parse(new TextDecoder().decode(v.bytes))};},
  async list({prefix}){return {objects:[...records].filter(([key])=>key.startsWith(prefix)).map(([key,r])=>({key,uploaded:r.uploaded,customMetadata:r.meta})),truncated:false};}
 };
 const env={IFUND_MAIL_ARCHIVE:bucket,IFUND_EMAIL_SIGNING_PRIVATE_KEY:privateKey,IFUND_ADMIN_EMAIL_RECEIVER_URL:ORIGIN+"/functions/v1/ifund-admin-mail-ingest",IFUND_MEMBER_EMAIL_RECEIVER_URL:ORIGIN+"/functions/v1/ifund-member-mail-ingress",IFUND_EMAIL_RECEIVER_URL:ORIGIN+"/functions/v1/verification"};
 const message=to=>{const raw="From: diagnostic@example.test\r\nTo: "+to+"\r\nSubject: Synthetic mail\r\nMessage-ID: <synthetic@example.test>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSynthetic body.";return {to,from:"diagnostic@example.test",rawSize:raw.length,raw:new Response(raw).body,headers:new Headers({"message-id":"<synthetic@example.test>","subject":"Synthetic mail"}),forward:async address=>forwarded.push(address),setReject:message=>rejected.push(message)};};
 const fetcher=(status=200)=>async(url,init)=>{
  const data=JSON.parse(init.body),h=init.headers;
  const signature=Uint8Array.from(h["x-ifund-email-signature"].match(/../g),s=>parseInt(s,16));
  assert.ok(await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},pair.publicKey,signature,textEncoder.encode(h["x-ifund-email-timestamp"]+"."+init.body)));
  assert.equal(data.subject,"Synthetic mail");assert.ok(data.text.includes("Synthetic body."));
  calls.push({url,data});return {ok:status===200,status};
 };
 return {env,records,calls,forwarded,rejected,message,fetcher};
}
test("reserved business, member, verification and unknown classifications remain separate",()=>{
 for(const [a,k] of [["support@interplanetaryfund.com","business"],["developer@interplanetaryfund.com","business"],["partner-2@interplanetaryfund.com","business"],["a.b@interplanetaryfund.com","paid"],["a..b@interplanetaryfund.com","unknown"],["verify-0123456789abcdef0123456789abcdef@interplanetaryfund.com","verification"],["member@mail.interplanetaryfund.com","member"]])assert.equal(mailboxKind(a),k);
});
test("signed business intake and backup are independent; a completed delivery is never replayed",async()=>{
 const t=await setup();await receiveEmail(t.message("support@interplanetaryfund.com"),t.env,{fetcher:t.fetcher()});
 assert.equal(t.calls.length,1);assert.ok(t.calls[0].url.endsWith("admin-mail-ingest"));assert.equal(t.forwarded.length,1);assert.equal(t.rejected.length,0);
 const r=await retryBusinessMail(t.env,{fetcher:t.fetcher(),now:now+3600000});assert.equal(r.attempted,0);
});
test("failed signed admin persistence is recoverable from verified archive without forwarding twice",async()=>{
 const t=await setup();await receiveEmail(t.message("support@interplanetaryfund.com"),t.env,{fetcher:t.fetcher(503)});
 assert.equal(t.rejected.length,0);assert.equal(t.forwarded.length,1);
 const r=await retryBusinessMail(t.env,{fetcher:t.fetcher(),now:now+3600000});
 assert.equal(r.attempted,1);assert.equal(r.recovered,1);assert.equal(t.calls.length,2);assert.equal(t.calls[0].data.message_id,t.calls[1].data.message_id);assert.equal(t.forwarded.length,1);
});
test("unpaid member rejection does not write a business archive or forward to admin",async()=>{
 const t=await setup();await receiveEmail(t.message("a.b@interplanetaryfund.com"),t.env,{fetcher:t.fetcher(404)});
 assert.equal(t.records.size,0);assert.equal(t.forwarded.length,0);assert.equal(t.rejected.length,1);assert.ok(t.calls[0].url.endsWith("member-mail-ingress"));
});
test("archive storage failure rejects the message rather than claiming durable delivery",async()=>{
 const t=await setup();t.env.IFUND_MAIL_ARCHIVE.put=async()=>{throw Error("archive unavailable")};await receiveEmail(t.message("support@interplanetaryfund.com"),t.env,{fetcher:t.fetcher()});assert.equal(t.rejected.length,1);assert.equal(t.calls.length,0);
});
