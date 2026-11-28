import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const makeJson=(origin:string|null)=>(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":origin||"https://interplanetaryfund.com","vary":"origin","access-control-allow-headers":"authorization, content-type, apikey, x-client-info","access-control-allow-methods":"GET, PATCH, OPTIONS"}});
Deno.serve(async (req)=>{
 const origin=req.headers.get("origin");
 const json=makeJson(origin);
 if(origin && !["https://interplanetaryfund.com","https://www.interplanetaryfund.com","https://interplanetaryfund.base44.app","https://interplanetaryfund-migration.pages.dev","https://interplanetary-fund2.interplanetary-fund.workers.dev","http://localhost","capacitor://localhost"].includes(origin)) return new Response(null,{status:403});
 if(req.method==="OPTIONS") return new Response(null,{status:204,headers:{"access-control-allow-origin":origin||"https://interplanetaryfund.com","access-control-allow-headers":"authorization, content-type, apikey, x-client-info","access-control-allow-methods":"GET, PATCH, OPTIONS","vary":"origin"}});
 if(!["GET","PATCH"].includes(req.method)) return json({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")).find((v):v is string=>typeof v==="string"&&v.startsWith("sb_secret_"));
 if(!url||!service) return json({error:"Unavailable"},503);
 const bearer=req.headers.get("authorization")||"";
 if(!/^Bearer\s+\S+$/i.test(bearer)) return json({error:"Unauthorized"},401);
 const verified=await fetch(url+"/auth/v1/user",{headers:{"apikey":service,"authorization":bearer}});
 if(!verified.ok) return json({error:"Unauthorized"},401);
 const user=await verified.json().catch(()=>null);
 if(!user?.id || typeof user.id!=="string") return json({error:"Unauthorized"},401);
 const checkHeaders={"apikey":service,"authorization":bearer,"content-type":"application/json"};
 for(const rpc of ["ifund_current_account_is_active","ifund_current_user_is_verified_admin"]){
  const result=await fetch(url+"/rest/v1/rpc/"+rpc,{method:"POST",headers:checkHeaders,body:"{}"});
  if(!result.ok)return json({error:"Access verification unavailable"},503);
  if(await result.json()!==true)return json({error:"Forbidden"},403);
 }
 const headers={"apikey":service,...(service.startsWith("eyJ")?{"authorization":"Bearer "+service}:{}),"content-type":"application/json"};
 const allowed=await fetch(url+"/rest/v1/ifund_admin_mail_access?user_id=eq."+encodeURIComponent(user.id)+"&select=user_id&limit=1",{headers});
 if(!allowed.ok) return json({error:"Access check failed"},503);
 const authorized=await allowed.json();
 if(!Array.isArray(authorized)||authorized.length!==1) return json({error:"Forbidden"},403);
 const audit=async(action:string,messageId:string|null)=>{const logged=await fetch(url+"/rest/v1/ifund_admin_mail_audit",{method:"POST",headers,body:JSON.stringify({actor_id:user.id,action,message_id:messageId})});return logged.ok;};
 if(req.method==="GET" && !(await audit("list",null))) return json({error:"Audit unavailable"},503);
 if(req.method==="GET"){
   const params=new URL(req.url).searchParams;
   const unread=params.get("unread")==="true";
   const q=url+"/rest/v1/admin_inbound_email?select=id,recipient_address,sender_address,subject,body_text,received_at,is_read,priority,delivery_status&order=received_at.desc&limit=100"+(unread?"&is_read=eq.false":"");
   const rows=await fetch(q,{headers});
   if(!rows.ok) return json({error:"Inbox unavailable"},503);
   const payload=await rows.json(); return new Response(JSON.stringify({messages:payload}),{status:200,headers:{"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":origin||"https://interplanetaryfund.com","vary":"origin"}});
 }
 let data:unknown;try{data=await req.json();}catch{return json({error:"Bad request"},400);}
 const body=data as {id?:unknown,is_read?:unknown};
 if(typeof body?.id!=="string" || !/^[a-f0-9-]{36}$/i.test(body.id) || typeof body.is_read!=="boolean")return json({error:"Bad request"},400);
 const response=await fetch(url+"/rest/v1/rpc/ifund_admin_mail_set_read_atomic",{method:"POST",headers,body:JSON.stringify({p_actor:user.id,p_message:body.id,p_read:body.is_read})});
 if(!response.ok) return json({error:"Update and audit failed"},503);
 if((await response.json())!==true) return json({error:"Message not found"},404);
 return json({ok:true});
});