// Signed Cloudflare-only business mailbox intake. No subscription required.
const PUBLIC_KEY="MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEULHIdTiu+6Z0jkuABd0Gj483NXCk5EfjdPk9vBKgCmyGzCTpipzOOfqPvCwh4dOYqa/tm+lipTjopYKBZyQEWg==";
const ORIGIN="https://ssibsfmtodgximseeqsv.supabase.co";
const answer=(data:unknown,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store"}});
const priority=new Set(["admin","contact","support","ifund","campaigns","help","developer","partner","crowdfund"]);
function serviceKey(){
 const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(legacy)return legacy;
 try{const v=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;return typeof v==="string"?v:v?.key||v?.secret||"";}catch{return "";}
}
async function bounded(req:Request,max:number){
 const length=req.headers.get("content-length");
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>max))throw new Error("too_large");
 if(!req.body)throw new Error("invalid_body");
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new Error("too_large");chunks.push(value);}}
 catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 const data=new Uint8Array(size);let i=0;for(const c of chunks){data.set(c,i);i+=c.byteLength;}return new TextDecoder("utf-8",{fatal:true}).decode(data);
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return answer({error:"method_not_allowed"},405);
 const stamp=req.headers.get("x-ifund-email-timestamp")||"",signature=req.headers.get("x-ifund-email-signature")||"";
 if(!/^\d{10}$/.test(stamp)||!/^[a-f0-9]{128}$/i.test(signature)||Math.abs(Date.now()-Number(stamp)*1000)>300000)return answer({error:"unauthorized"},401);
 let body:string;
 try{body=await bounded(req,65536);}catch{return answer({error:"invalid_body"},413);}
 try{
 const key=await crypto.subtle.importKey("spki",Uint8Array.from(atob(PUBLIC_KEY),c=>c.charCodeAt(0)),{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
 const valid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,Uint8Array.from(signature.match(/../g)||[],v=>parseInt(v,16)),new TextEncoder().encode(stamp+"."+body));
 if(!valid)return answer({error:"unauthorized"},401);
 const data=JSON.parse(body),to=String(data.to||"").trim().toLowerCase(),from=String(data.from||"").slice(0,254),id=String(data.message_id||"").slice(0,254).replace(/[<>]/g,"");
 if(!/^[^\s@<>\u0000-\u001f]{1,64}@interplanetaryfund\.com$/.test(to)||!from||!id)return answer({error:"invalid_envelope"},400);
 const token=serviceKey(),url=Deno.env.get("SUPABASE_URL");
 if(!token||url!==ORIGIN)return answer({error:"mailbox_service_unavailable"},503);
 const headers:Record<string,string>={apikey:token,"content-type":"application/json"};
 if(token.startsWith("eyJ"))headers.authorization="Bearer "+token;
 // Database constraint enforces the organization-only recipient registry.
 const payload={recipient_address:to,sender_address:from,message_id:id,subject:String(data.subject||"").slice(0,240),body_text:String(data.text||"").slice(0,12000),priority:priority.has(to.split("@")[0])?"priority":"normal"};
 const response=await fetch(url+"/rest/v1/admin_inbound_email?on_conflict=recipient_address,message_id",{method:"POST",headers:{...headers,prefer:"resolution=ignore-duplicates"},body:JSON.stringify(payload),redirect:"error",signal:AbortSignal.timeout(12000)});
 if(!response.ok){console.error("Business mailbox persistence failed",response.status);return answer({error:"mailbox_persistence_unavailable"},503);}
 return answer({ok:true});
 }catch{console.error("Business mailbox signed intake failed");return answer({error:"mailbox_intake_unavailable"},503);}
});
