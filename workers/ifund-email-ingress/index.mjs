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
 const key=await crypto.subtle.importKey("pkcs8",Uint8Array.from(atob(env.IFUND_EMAIL_SIGNING_PRIVATE_KEY),c=>c.charCodeAt(0)),{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
 const signature=hex(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,bytes.encode(stamp+"."+body)));
 const response=await fetcher(url.toString(),{method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),headers:{"content-type":"application/json","x-ifund-email-timestamp":stamp,"x-ifund-email-signature":signature},body});
 if(!response.ok)throw Error("Receiver rejected delivery");
}
export async function receiveEmail(message,env,{fetcher=fetch,parse=raw=>PostalMime.parse(raw,{maxNestingDepth:32,maxHeadersSize:128*1024})}={}){
 const to=String(message.to||"").trim().toLowerCase(),kind=mailboxKind(to);
 if(kind==="unknown"){message.setReject("Unknown mailbox");return;}
 let raw,payload;
 try{
  if(Number(message.rawSize)>25*1024*1024)throw Error("Message too large");
  raw=await readBounded(message.raw,25*1024*1024);
  const digest=hex(await crypto.subtle.digest("SHA-256",raw));
  const business=kind==="business";
  // Keep the platform's raw business/verification archive private. Never
  // archive unknown, unpaid or private paid-user messages in the admin archive.
  if(business||kind==="verification"){
   const archiveKey="mail-v2/"+digest+"-"+hex(await crypto.subtle.digest("SHA-256",bytes.encode(to)))+".eml";
   await env.IFUND_MAIL_ARCHIVE.put(archiveKey,raw,{httpMetadata:{contentType:"message/rfc822"},customMetadata:{recipient:to,sender:bounded(message.from,254)}});
  }
  let parsed=null;
  if(raw.byteLength<=2_000_000){try{parsed=await parse(raw)}catch{ /* official mail is still archived */ }}
  if(!parsed&&!business)throw Error("Mailbox delivery unavailable");
  payload={message_id:bounded(message.headers?.get("message-id")||digest,254),from:bounded(message.from,254),to,subject:bounded(parsed?.subject||message.headers?.get("subject")||"(Archived email)",240),text:bounded(parsed?.text??"The original email was archived by iFund. Its body could not be displayed.",11500)};
  if(!payload.from||!payload.message_id)throw Error("Missing envelope metadata");
  const endpoint=business?env.IFUND_ADMIN_EMAIL_RECEIVER_URL:kind==="verification"?env.IFUND_EMAIL_RECEIVER_URL:env.IFUND_MEMBER_EMAIL_RECEIVER_URL;
  if(business&&endpoint!==ORIGIN+"/functions/v1/ifund-admin-mail-ingest")throw Error("Admin receiver mismatch");
  if((kind==="paid"||kind==="member")&&endpoint!==ORIGIN+"/functions/v1/ifund-member-mail-ingress")throw Error("Member receiver mismatch");
  await deliver(env,endpoint,payload,fetcher);
 }catch{message.setReject("Mailbox delivery unavailable");return;}
 // Business backup is independent of the committed platform inbox receipt.
 // Cloudflare may reject forwarding for authentication or destination reasons;
 // do not discard a successfully received business message in that case.
 if(kind==="business"){
  try{await message.forward(to==="user@interplanetaryfund.com"?"interplanetarysister@gmail.com":"cuddlemeplatonically@gmail.com");}
  catch{console.error("Business backup forwarding failed after inbox delivery");}
 }
}
export default {email:receiveEmail};
