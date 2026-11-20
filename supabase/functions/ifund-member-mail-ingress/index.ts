const PUBLIC_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEULHIdTiu+6Z0jkuABd0Gj483NXCk5EfjdPk9vBKgCmyGzCTpipzOOfqPvCwh4dOYqa/tm+lipTjopYKBZyQEWg==";
const b64 = (v:string) => Uint8Array.from(atob(v), c=>c.charCodeAt(0));
const hex = (v:string) => Uint8Array.from((v.match(/.{2}/g)||[]).map(n=>parseInt(n,16)));
const memberSubdomain = (v:string)=>/^[a-z0-9][a-z0-9._-]{0,62}@mail[.]interplanetaryfund[.]com$/.test(v);
const paidMainDomain = (v:string)=>{
  const match=v.match(/^([a-z][a-z0-9]*(?:[.-][a-z0-9]+)*)@interplanetaryfund[.]com$/);
  return Boolean(match && match[1].length>=3 && match[1].length<=24);
};
const validMail=(v:string)=>memberSubdomain(v)||paidMainDomain(v);
Deno.serve(async (req:Request) => {
  if(req.method!=="POST")return new Response("Method not allowed",{status:405});
  try {
    const stamp=req.headers.get("x-ifund-email-timestamp")||"";
    const sig=req.headers.get("x-ifund-email-signature")||"";
    if(!/^\d{10}$/.test(stamp)||!/^[a-f0-9]{128}$/i.test(sig)||Math.abs(Date.now()-Number(stamp)*1000)>300000)
      return new Response("Unauthorized",{status:401});
    const body=await req.text();
    if(body.length>65536)return new Response("Too large",{status:413});
    const key=await crypto.subtle.importKey("spki",b64(PUBLIC_KEY),{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
    const ok=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,hex(sig),new TextEncoder().encode(stamp+"."+body));
    if(!ok)return new Response("Unauthorized",{status:401});
    const data=JSON.parse(body);
    const to=String(data.to||"").trim().toLowerCase();
    const from=String(data.from||"").slice(0,254);
    const messageId=String(data.message_id||"").slice(0,254);
    const subject=String(data.subject||"").slice(0,240);
    const plain=String(data.text||"").slice(0,12000);
    if(!validMail(to)||!from||!messageId)return new Response("Invalid recipient or message",{status:400});
    const url=Deno.env.get("SUPABASE_URL");
    const token=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!token)return new Response("Receiver unavailable",{status:503});
    // Dedicated server-only RPC verifies paid subscription, $1 Basic add-on,
    // explicit opt-in and provisioned routing for every main-domain mailbox.
    const rpc=memberSubdomain(to)?"ifund_receive_member_email":"ifund_receive_paid_campaign_email";
    const r=await fetch(url+"/rest/v1/rpc/"+rpc,{
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":token,"Authorization":"Bearer "+token},
      body:JSON.stringify({p_to:to,p_from:from,p_subject:subject,p_body:plain,p_message_id:messageId})
    });
    if(!r.ok){return new Response([400,401,403,404].includes(r.status)?"Mailbox not available":"Delivery unavailable",{status:[400,401,403,404].includes(r.status)?404:503});}
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{"content-type":"application/json"}});
  }catch {return new Response("Delivery unavailable",{status:503});}
});
