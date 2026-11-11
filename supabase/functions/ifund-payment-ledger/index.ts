
const PUBLIC_JWK = {"kty":"EC","crv":"P-256","x":"higwnBNoUX4hoTHyvctc85RbeUH1vuvd0xwikU-4s9M","y":"YMrYjF3lZDSfkTRhTNt7jtgrqTrY1-r3zdBECcAe13w","ext":true,"key_ops":["verify"]};
const URL_BASE = Deno.env.get("SUPABASE_URL") || "";
function key() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try { const v = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default; return typeof v === "string" ? v : (v?.key || v?.secret || ""); }
  catch (_) { return ""; }
}
function fail(message, status=400) { return Response.json({ok:false,error:message},{status}); }
function bytes64(s) { const raw=atob(s.replace(/-/g,"+").replace(/_/g,"/") + "=".repeat((4-s.length%4)%4)); return Uint8Array.from(raw,c=>c.charCodeAt(0)); }
const patternId=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const opts={cache:"no-store"};
async function db(path,method="GET",payload) {
  const k=key();if(!k||!URL_BASE) throw new Error("Database service credentials unavailable");
  const headers={"apikey":k,"content-type":"application/json","prefer":"return=representation"};
  if(k.startsWith("eyJ")) headers["authorization"]="Bearer "+k;
  const res=await fetch(URL_BASE+"/rest/v1/"+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),...opts});
  const text=await res.text();
  let value;try{value=JSON.parse(text)}catch(_){value={error:text.slice(0,200)}}
  if(!res.ok) { const err=new Error("Database operation failed");err.status=res.status;err.code=value?.code;throw err; }
  return value;
}
async function verifiedBody(req) {
  const raw=await req.text();
  if(raw.length>65536) throw new Error("Payload too large");
  const time=req.headers.get("x-ifund-timestamp")||"";
  const signature=req.headers.get("x-ifund-signature")||"";
  const tick=Number(time);
  if(!Number.isInteger(tick)||Math.abs(Math.floor(Date.now()/1000)-tick)>120||!signature) throw new Error("Invalid signature timestamp");
  const publicKey=await crypto.subtle.importKey("jwk",PUBLIC_JWK,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
  const valid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},publicKey,bytes64(signature),new TextEncoder().encode(time+"\n"+raw));
  if(!valid) throw new Error("Invalid service signature");
  return JSON.parse(raw);
}
const findOne=async(path)=>(await db(path))[0]||null;
Deno.serve(async req=>{
  if(req.method!=="POST") return fail("Method not allowed",405);
  let body;try{body=await verifiedBody(req)}catch(_){return fail("Unauthorized payment service request",401)}
  try{
    if(body.op==="begin"){
      const p=body.data||{};
      if(!patternId.test(p.campaign_id||"")||!/^[A-Za-z0-9_-]{16,100}$/.test(p.request_key||"")
        || !["paypal","card","googlepay","applepay","venmo"].includes(p.payment_channel)
        || !["live","sandbox"].includes(p.environment)
        || !Number.isSafeInteger(p.gift_cents)||p.gift_cents<100||p.gift_cents>100000000
        || !Number.isSafeInteger(p.optional_support_cents)||p.optional_support_cents<0
        || p.optional_support_cents>Math.round(p.gift_cents*0.1)
        || !Number.isSafeInteger(p.total_cents)||p.total_cents<p.gift_cents+p.optional_support_cents
        || !/^[0-9a-f]{64}$/.test(p.checkout_token_hash||"")) return fail("Invalid payment quote");
      const campaign=await findOne("ifund_campaigns?select=id,status&id=eq."+p.campaign_id);
      if(!campaign||campaign.status!=="active") return fail("Campaign is not accepting donations",409);
      let existing=await findOne("ifund_payment_intents?select=*&request_key=eq."+encodeURIComponent(p.request_key));
      if(!existing){
        try{
          const created=await db("ifund_payment_intents","POST",{request_key:p.request_key,campaign_id:p.campaign_id,
             gift_cents:p.gift_cents,optional_support_cents:p.optional_support_cents,total_cents:p.total_cents,
             environment:p.environment,payment_channel:p.payment_channel,currency:"USD",checkout_token_hash:p.checkout_token_hash,status:"creating"});
          existing=created[0];
        }catch(error){
          if(error.status===409) existing=await findOne("ifund_payment_intents?select=*&request_key=eq."+encodeURIComponent(p.request_key));
          else throw error;
        }
      }
      if(!existing|| existing.campaign_id!==p.campaign_id||existing.environment!==p.environment
         ||existing.gift_cents!==p.gift_cents||existing.optional_support_cents!==p.optional_support_cents
         ||existing.total_cents!==p.total_cents||existing.payment_channel!==p.payment_channel
         ||existing.checkout_token_hash!==p.checkout_token_hash) return fail("Checkout request conflicts with existing intent",409);
      return Response.json({ok:true,status:existing.status,order_id:existing.paypal_order_id||null});
    }
    if(body.op==="bind"){
      const p=body.data||{};
      if(!/^[A-Za-z0-9_-]{8,100}$/.test(p.paypal_order_id||"")
         ||!/^[A-Za-z0-9_-]{16,100}$/.test(p.request_key||"")) return fail("Invalid order binding");
      const rows=await db("ifund_payment_intents?request_key=eq."+encodeURIComponent(p.request_key));
      if(rows.length!==1||!["creating","created"].includes(rows[0].status)
        ||(rows[0].paypal_order_id&&rows[0].paypal_order_id!==p.paypal_order_id)) return fail("Payment intent mismatch",409);
      await db("ifund_payment_intents?request_key=eq."+encodeURIComponent(p.request_key),"PATCH",
          {paypal_order_id:p.paypal_order_id,status:"created",updated_at:new Date().toISOString()});
      return Response.json({ok:true});
    }
    if(body.op==="get"){
      const p=body.data||{};
      if(!/^[A-Za-z0-9_-]{8,100}$/.test(p.paypal_order_id||"")) return fail("Invalid order reference");
      const row=await findOne("ifund_payment_intents?select=*&paypal_order_id=eq."+encodeURIComponent(p.paypal_order_id));
      if(!row) return fail("Order not found",404);
      return Response.json({ok:true,intent:{campaign_id:row.campaign_id,gift_cents:row.gift_cents,
         optional_support_cents:row.optional_support_cents,total_cents:row.total_cents,environment:row.environment,
         status:row.status,checkout_token_hash:row.checkout_token_hash,payment_channel:row.payment_channel,
         paypal_capture_id:row.paypal_capture_id}});
    }
    if(body.op==="finalize"){
      const p=body.data||{};
      const r=await db("rpc/ifund_finalize_verified_live_paypal_capture","POST",{
         p_order_id:p.paypal_order_id,p_capture_id:p.paypal_capture_id,p_captured_cents:p.captured_cents,
         p_capture_status:p.capture_status,p_currency:p.currency});
      return Response.json({ok:true,donation_id:r});
    }
    if(body.op==="event"){
      const p=body.data||{};
      const validId=v=>typeof v==="string"&&/^[A-Za-z0-9_-]{8,100}$/.test(v);
      if(!validId(p.paypal_event_id)||!validId(p.paypal_order_id)
        ||!validId(p.paypal_capture_id)||p.event_type!=="PAYMENT.CAPTURE.COMPLETED")
        return fail("Invalid signed provider event");
      const donation=await findOne("ifund_donations?select=id,status,paypal_capture_id,paypal_capture_verified_at&paypal_order_id=eq."+encodeURIComponent(p.paypal_order_id));
      if(!donation||donation.status!=="captured"||!donation.paypal_capture_verified_at
        ||donation.paypal_capture_id!==p.paypal_capture_id)
        return fail("Captured donation not verified",409);
      try{
        await db("ifund_payment_events","POST",{
          paypal_event_id:p.paypal_event_id,paypal_order_id:p.paypal_order_id,
          paypal_capture_id:p.paypal_capture_id,event_type:p.event_type,
        });
      }catch(error){if(error.status!==409)throw error;}
      const recorded=await findOne("ifund_payment_events?select=paypal_order_id,paypal_capture_id,event_type&paypal_event_id=eq."+encodeURIComponent(p.paypal_event_id));
      if(!recorded||recorded.paypal_order_id!==p.paypal_order_id
        ||recorded.paypal_capture_id!==p.paypal_capture_id||recorded.event_type!==p.event_type)
        return fail("PayPal event identity conflict",409);
      return Response.json({ok:true,recorded:true});
    }
    if(body.op==="reverse"){
      const p=body.data||{};
      const r=await db("rpc/ifund_reverse_verified_live_paypal_capture","POST",{
        p_capture_id:p.paypal_capture_id,p_paypal_event_id:p.paypal_event_id,p_event_type:p.event_type,p_refunded_cents:p.refunded_cents});
      return Response.json({ok:true,donation_id:r});
    }
    return fail("Unsupported operation",404);
  }catch(err){
    return fail(err.status===409?"Payment state conflict. Reconciliation required.":"Financial operation unavailable",err.status===409?409:503);
  }
});
