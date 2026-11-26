// Canonical iFund email ingress. Cloudflare supplies the mailbox transport;
// iFund owns the aliases and bills optional subscriber add-ons separately.
import PostalMime from "./postal-mime-bundle.mjs";
const ORIGIN="https://ssibsfmtodgximseeqsv.supabase.co";
const reserved=new Set(["user","admin","administrator","support","security","abuse","billing","payments","paypal","postmaster","webmaster","contact","help","legal","privacy","donations","fund","funds","ifund","interplanetaryfund","team","staff","noreply","no-reply","system","notifications","official","press","info","sales","hello","signup","register","root","accounts","users","judge","judges","demo","demos","campaign","campaigns","donate","donor","donors","fundraising","owner","owners","office","inbox","mailer","email","mail","webhooks","webhook","reports","verification","verify","confirm","billingteam","adminteam","supportteam","customerservice","helpdesk","reply","answers","developer","partner","crowdfund"]);
const reservedPrefix=new RegExp("^(?:admin|support|security|abuse|staff|help|legal|privacy|team|official|payments|paypal|postmaster|webmaster|ifund|interplanetaryfund|user|judge|demo|donor|billing|verification|verify|no-reply|noreply|developer|partner|crowdfund)(?:[.-]|[0-9])");
const bytes=new TextEncoder();
const hex=v=>Array.from(new Uint8Array(v),x=>x.toString(16).padStart(2,"0")).join("");
const bounded=(v,n)=>String(v??"").slice(0,n);
export function mailboxKind(address){
 if(/^verify-[a-f0-9]{32}@interplanetaryfund\.com$/.test(address))return "verification";
 if(/^[a-z0-9][a-z0-9._-]{0,62}@mail\.interplanetaryfund\.com$/.test(address))return "member";
 if(!/^[^\s@<>\u0000-\u001f]{1,64}@interplanetaryfund\.com$/.test(address))return "unknown";
 const local=address.split("@")[0];
 if(reserved.has(local)||reservedPrefix.test(local))return "business";
 if(local.length>=3&&local.length<=24&&/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(local))return "paid";
 return "unknown";
}
async function readBounded(stream,limit){
 const reader=stream.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error("Message too large");chunks.push(value)}}
 catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock()}
 const all=new Uint8Array(size);let i=0;for(const c of chunks){all.set(c,i);i+=c.byteLength}return all;
}
async function deliver(env,endpoint,payload,fetcher){
 const url=new URL(endpoint);
 if(url.origin!==ORIGIN||!url.pathname.startsWith("/functions/v1/")||url.username||url.password||url.search||url.hash)throw Error("Receiver identity mismatch");
 const stamp=String(Math.floor(Date.now()/1000)),body=JSON.stringify(payload);
 let key,signature,response;
 try{
  const configured=String(env.IFUND_EMAIL_SIGNING_PRIVATE_KEY||"").trim();
  if(!configured)throw Error("Missing signing key");
  if(configured.startsWith("{")){
   const jwk=JSON.parse(configured);
   key=await crypto.subtle.importKey("jwk",jwk,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  }else{
   const encoded=configured.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
   key=await crypto.subtle.importKey("pkcs8",Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  }
 }catch{throw Object.assign(Error("Signing key unavailable"),{deliveryStage:"signing_key"});}
 try{signature=hex(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,bytes.encode(stamp+"."+body)));}
 catch{throw Object.assign(Error("Signing unavailable"),{deliveryStage:"signing"});}
 try{response=await fetcher(url.toString(),{method:"POST",redirect:"manual",...(typeof AbortSignal.timeout==="function"?{signal:AbortSignal.timeout(15000)}:{}),headers:{"content-type":"application/json","x-ifund-email-timestamp":stamp,"x-ifund-email-signature":signature},body});}
 catch(cause){
  const message=String(cause?.message||"").toLowerCase();
  const networkReason=/not a function|illegal invocation/.test(message)?"runtime_invocation":/timeout|abort/.test(message)?"timeout":/dns|resolve/.test(message)?"dns":/redirect/.test(message)?"redirect":/network|fetch|connect/.test(message)?"network":"other";
  throw Object.assign(Error("Receiver network unavailable"),{deliveryStage:"receiver_network",networkReason});
 }
 if(!response.ok)throw Object.assign(Error("Receiver rejected delivery"),{receiverStatus:response.status});
}
export async function receiveEmail(message,env,{fetcher=fetch,parse=raw=>PostalMime.parse(raw,{maxNestingDepth:32,maxHeadersSize:128*1024})}={}){
 const to=String(message.to||"").trim().toLowerCase(),kind=mailboxKind(to);
 if(kind==="unknown"){message.setReject("Unknown mailbox");return;}
 let raw,payload,archiveKey,archiveStored=false;let stage="read";
 try{
  if(Number(message.rawSize)>25*1024*1024)throw Error("Message too large");
  raw=await readBounded(message.raw,25*1024*1024);
  const digest=hex(await crypto.subtle.digest("SHA-256",raw));
  const business=kind==="business";
  // Keep the platform's raw business/verification archive private. Never
  // archive unknown, unpaid or private paid-user messages in the admin archive.
  if(business||kind==="verification"){
   archiveKey="mail-v2/"+digest+"-"+hex(await crypto.subtle.digest("SHA-256",bytes.encode(to)))+".eml";
   await env.IFUND_MAIL_ARCHIVE.put(archiveKey,raw,{httpMetadata:{contentType:"message/rfc822"},customMetadata:{recipient:to,sender:bounded(message.from,254),message_id:bounded(message.headers?.get("message-id")||digest,254),subject:bounded(message.headers?.get("subject"),240)}});
   archiveStored=true;
  }
  stage="parse";
  let parsed=null;
  if(raw.byteLength<=2_000_000){try{parsed=await parse(raw)}catch{ /* official mail is still archived */ }}
  if(!parsed&&!business)throw Error("Mailbox delivery unavailable");
  payload={message_id:bounded(message.headers?.get("message-id")||digest,254),from:bounded(message.from,254),to,subject:bounded(parsed?.subject||message.headers?.get("subject")||"(Archived email)",240),text:bounded(parsed?.text??"The original email was archived by iFund. Its body could not be displayed.",11500)};
  if(!payload.from||!payload.message_id)throw Error("Missing envelope metadata");
  const endpoint=business?env.IFUND_ADMIN_EMAIL_RECEIVER_URL:kind==="verification"?env.IFUND_EMAIL_RECEIVER_URL:env.IFUND_MEMBER_EMAIL_RECEIVER_URL;
  if(business&&endpoint!==ORIGIN+"/functions/v1/ifund-admin-mail-ingest")throw Error("Admin receiver mismatch");
  if((kind==="paid"||kind==="member")&&endpoint!==ORIGIN+"/functions/v1/ifund-member-mail-ingress")throw Error("Member receiver mismatch");
  stage="signed_receiver";
  await deliver(env,endpoint,payload,fetcher);
 }catch(error){
  // Do not claim an inbox write when it failed. If the raw official mail
  // is already durably archived, retain it for the bounded recovery job.
  if(kind==="business"&&archiveKey&&archiveStored){
   let forwarded=true;
   try{await message.forward(to==="user@interplanetaryfund.com"?"interplanetarysister@gmail.com":"cuddlemeplatonically@gmail.com");}
   catch{forwarded=false;}
   try{await storeReceipt(env.IFUND_MAIL_ARCHIVE,archiveKey,{state:"failed",stage:error?.deliveryStage||stage,receiver_status:Number.isInteger(error?.receiverStatus)?error.receiverStatus:null,network_reason:error?.networkReason||null,backup_forwarded:forwarded,attempts:0});}catch{/* archived object remains eligible for recovery */}
   return;
  }
  message.setReject("Mailbox delivery unavailable");return;
 }
 // Business backup is independent of the committed platform inbox receipt.
 // Cloudflare may reject forwarding for authentication or destination reasons;
 // do not discard a successfully received business message in that case.
 if(kind==="business"){
  let forwarded=true;
  try{await message.forward(to==="user@interplanetaryfund.com"?"interplanetarysister@gmail.com":"cuddlemeplatonically@gmail.com");}
  catch{forwarded=false;console.error("Business backup forwarding failed after inbox delivery");}
  if(archiveKey){try{await env.IFUND_MAIL_ARCHIVE.put("mail-delivery-receipts/"+archiveKey.slice(8,-4)+".json",JSON.stringify({state:"persisted",backup_forwarded:forwarded,at:new Date().toISOString()}),{httpMetadata:{contentType:"application/json"}});}catch{/* inbox receipt remains authoritative */}}
 }
}

const receiptKey=key=>"mail-delivery-receipts/"+key.slice(8,-4)+".json";
async function storeReceipt(bucket,key,record){
 await bucket.put(receiptKey(key),JSON.stringify({...record,at:new Date().toISOString()}),{httpMetadata:{contentType:"application/json"}});
}
export async function retryBusinessMail(env,{fetcher=fetch,parse=raw=>PostalMime.parse(raw,{maxNestingDepth:32,maxHeadersSize:128*1024}),now=Date.now()}={}){
 const bucket=env.IFUND_MAIL_ARCHIVE;
 if(!bucket)return {attempted:0,recovered:0};
 // Only the new, business-only archive is eligible. Legacy raw mail may
 // include private member messages and must never be replayed to admins.
 const cursorObject=await bucket.get("mail-retry-cursor.json");
 let cursor;try{cursor=cursorObject?(await cursorObject.json()).cursor:undefined;}catch{}
 const page=await bucket.list({prefix:"mail-v2/",limit:40,...(cursor?{cursor}:{}),include:["customMetadata"]});
 let attempted=0,recovered=0,failed=0;
 for(const summary of page.objects||[]){
  if(attempted>=5)break;
  if(!/^mail-v2\/[a-f0-9]{64}-[a-f0-9]{64}\.eml$/.test(summary.key))continue;
  if(summary.uploaded&&now-new Date(summary.uploaded).getTime()<60_000)continue;
  let receipt;try{const r=await bucket.get(receiptKey(summary.key));receipt=r?await r.json():null;}catch{}
  if(receipt?.state==="persisted")continue;
  if(receipt?.at&&now-Date.parse(receipt.at)<Math.min(60*60_000,300_000*Math.pow(2,Math.min(receipt.attempts||0,4))))continue;
  const object=await bucket.get(summary.key);
  if(!object)continue;
  const to=String(object.customMetadata?.recipient||"").trim().toLowerCase();
  if(mailboxKind(to)!=="business")continue;
  const from=bounded(object.customMetadata?.sender,254);
  if(!from||object.size>25*1024*1024)continue;
  attempted++;
  try{
   const raw=await readBounded(object.body,25*1024*1024);
   const digest=hex(await crypto.subtle.digest("SHA-256",raw));
   const recipientDigest=hex(await crypto.subtle.digest("SHA-256",bytes.encode(to)));
   if(summary.key!=="mail-v2/"+digest+"-"+recipientDigest+".eml")throw Error("Archive identity mismatch");
   let parsed=null;if(raw.byteLength<=2_000_000)try{parsed=await parse(raw)}catch{}
   const payload={message_id:bounded(object.customMetadata?.message_id||parsed?.messageId||digest,254),from,to,subject:bounded(parsed?.subject||object.customMetadata?.subject||"(Archived email)",240),text:bounded(parsed?.text??"The original email was archived by iFund. Its body could not be displayed.",11500)};
   // The original envelope Message-ID and parser Message-ID normalize to
   // the same database key; retries never send another backup email.
   const endpoint=env.IFUND_ADMIN_EMAIL_RECEIVER_URL;
   if(endpoint!==ORIGIN+"/functions/v1/ifund-admin-mail-ingest")throw Error("Admin receiver mismatch");
   await deliver(env,endpoint,payload,fetcher);
   await storeReceipt(bucket,summary.key,{state:"persisted",recovered:true,backup_forwarded:receipt?.backup_forwarded??null,attempts:(receipt?.attempts||0)+1});
   recovered++;
  }catch(error){
   await storeReceipt(bucket,summary.key,{state:"failed",stage:error?.deliveryStage||"retry_receiver",receiver_status:Number.isInteger(error?.receiverStatus)?error.receiverStatus:null,network_reason:error?.networkReason||null,attempts:(receipt?.attempts||0)+1});
   failed++;
  }
 }
 // Reset to the start after a full pass. If the per-run work bound was
 // reached, retain the old cursor so skipped items are not forgotten.
 await bucket.put("mail-retry-cursor.json",JSON.stringify({cursor:attempted>=5?cursor??null:page.truncated?page.cursor:null}));
 return {attempted,recovered,failed};
}
export default {
 async email(message,env,ctx){
  await receiveEmail(message,env);
  if(mailboxKind(String(message.to||"").trim().toLowerCase())==="business"){
   ctx.waitUntil(retryBusinessMail(env).catch(()=>console.error("Business mail recovery unavailable")));
  }
 },
 async scheduled(_event,env,ctx){ctx.waitUntil(retryBusinessMail(env));}
};
