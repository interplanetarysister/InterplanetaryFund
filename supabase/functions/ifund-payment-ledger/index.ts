
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
const subscriptionId=/^I-[A-Z0-9]{10,30}$/;
const planId=/^P-[A-Z0-9]{20,32}$/;
const eventId=/^WH-[A-Z0-9-]{8,90}$/;
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
// Donor identities are resolved by Supabase Auth, never from client-provided IDs.
// A missing token represents a guest; an invalid token must not silently become a guest.
async function resolveVerifiedDonor(token) {
  if (token === null || token === undefined) return null;
  if (typeof token !== "string" || token.length < 40 || token.length > 8192 ||
      !/^[A-Za-z0-9._-]+$/.test(token))
    throw Object.assign(new Error("Malformed donor session"), {status:401});
  const response = await fetch(URL_BASE + "/auth/v1/user", {
    headers:{"apikey":key(),"authorization":"Bearer " + token},
    cache:"no-store"
  });
  if (!response.ok)
    throw Object.assign(new Error("Donor session expired or invalid"), {status:401});
  const user=await response.json();
  if (!patternId.test(user.id || "") || user.is_anonymous === true ||
      !user.email_confirmed_at)
    throw Object.assign(new Error("Verified member session required"), {status:401});
  return user.id;
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
      const donorId=await resolveVerifiedDonor(p.donor_access_token);
      const campaign=await findOne("ifund_campaigns?select=id,status&id=eq."+p.campaign_id);
      if(!campaign||campaign.status!=="active") return fail("Campaign is not accepting donations",409);
      let existing=await findOne("ifund_payment_intents?select=*&request_key=eq."+encodeURIComponent(p.request_key));
      if(!existing){
        try{
          const created=await db("ifund_payment_intents","POST",{request_key:p.request_key,campaign_id:p.campaign_id,
             gift_cents:p.gift_cents,optional_support_cents:p.optional_support_cents,total_cents:p.total_cents,
             environment:p.environment,payment_channel:p.payment_channel,currency:"USD",checkout_token_hash:p.checkout_token_hash,donor_id:donorId,status:"creating"});
          existing=created[0];
        }catch(error){
          if(error.status===409) existing=await findOne("ifund_payment_intents?select=*&request_key=eq."+encodeURIComponent(p.request_key));
          else throw error;
        }
      }
      if(!existing|| existing.campaign_id!==p.campaign_id||existing.environment!==p.environment
         ||existing.gift_cents!==p.gift_cents||existing.optional_support_cents!==p.optional_support_cents
         ||existing.total_cents!==p.total_cents||existing.payment_channel!==p.payment_channel
         ||existing.checkout_token_hash!==p.checkout_token_hash || existing.donor_id!==donorId) return fail("Checkout request conflicts with existing intent",409);
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

    if(body.op==="subscription_plan_verified"){
      const p=body.data||{};
      if(!["basic","outreach","professional","enterprise","nonprofit"].includes(p.tier)
        ||!["monthly","annual"].includes(p.interval)||!planId.test(p.paypal_plan_id||"")
        ||typeof p.paypal_product_id!=="string"||p.paypal_product_id.length<6
        ||!Number.isSafeInteger(p.amount_cents)||p.amount_cents<1)
        return fail("Invalid subscription plan verification");
      const row=await findOne("ifund_subscription_plans?select=*&tier=eq."+encodeURIComponent(p.tier)
        +"&interval=eq."+encodeURIComponent(p.interval));
      if(!row||row.amount_cents!==p.amount_cents||row.currency!=="USD")
        return fail("Subscription catalog mismatch",409);
      if(row.paypal_plan_id&&row.paypal_plan_id!==p.paypal_plan_id)
        return fail("Subscription provider plan conflict",409);
      const updated=await db("ifund_subscription_plans?tier=eq."+encodeURIComponent(p.tier)
        +"&interval=eq."+encodeURIComponent(p.interval),"PATCH",{
          paypal_plan_id:p.paypal_plan_id,paypal_product_id:p.paypal_product_id,
          active:true,verified_at:new Date().toISOString(),updated_at:new Date().toISOString()
        });
      return Response.json({ok:true,plan:updated[0]||null});
    }
    if(body.op==="subscription_plans"){
      const rows=await db("ifund_subscription_plans?select=tier,interval,amount_cents,currency,catalog_version,paypal_plan_id,paypal_product_id,active,verified_at&order=tier.asc,interval.asc");
      return Response.json({ok:true,plans:rows});
    }
    if(body.op==="subscription_begin"){
      const p=body.data||{};
      const memberId=await resolveVerifiedDonor(p.member_access_token);
      if(!memberId)return fail("Verified member session required",401);
      if(!["basic","outreach","professional","enterprise","nonprofit"].includes(p.tier)
        ||!["monthly","annual"].includes(p.interval))return fail("Invalid subscription selection");
      const plan=await findOne("ifund_subscription_plans?select=*&tier=eq."+encodeURIComponent(p.tier)
        +"&interval=eq."+encodeURIComponent(p.interval));
      if(!plan||plan.active!==true||!planId.test(plan.paypal_plan_id||""))
        return fail("Subscription plan is not provider verified",409);
      const current=await db("ifund_subscription_intents?select=id,status,paypal_subscription_id&member_id=eq."+memberId
        +"&status=in.(initiated,approval_pending,pending,active,past_due)&order=created_at.desc&limit=1");
      if(current.length)return fail("Manage the existing subscription before starting another",409);
      const custom="IFUND-"+crypto.randomUUID();
      const created=await db("ifund_subscription_intents","POST",{
        member_id:memberId,tier:p.tier,interval:p.interval,amount_cents:plan.amount_cents,currency:"USD",
        paypal_plan_id:plan.paypal_plan_id,custom_id:custom,status:"initiated"
      });
      const row=created[0];
      if(!row)return fail("Subscription intent could not be created",503);
      return Response.json({ok:true,intent_id:row.id,custom_id:custom,plan_id:plan.paypal_plan_id,amount_cents:plan.amount_cents});
    }
    if(body.op==="subscription_bind"){
      const p=body.data||{};
      if(!patternId.test(p.intent_id||"")||!subscriptionId.test(p.paypal_subscription_id||""))
        return fail("Invalid subscription binding");
      const row=await findOne("ifund_subscription_intents?select=*&id=eq."+p.intent_id);
      if(!row||!["initiated","approval_pending"].includes(row.status)
        ||(row.paypal_subscription_id&&row.paypal_subscription_id!==p.paypal_subscription_id))
        return fail("Subscription intent mismatch",409);
      await db("ifund_subscription_intents?id=eq."+p.intent_id,"PATCH",{
        paypal_subscription_id:p.paypal_subscription_id,status:"approval_pending",updated_at:new Date().toISOString()
      });
      return Response.json({ok:true});
    }
    if(body.op==="subscription_get"||body.op==="subscription_lookup"){
      const p=body.data||{};
      if(!subscriptionId.test(p.paypal_subscription_id||""))return fail("Invalid subscription reference");
      const row=await findOne("ifund_subscription_intents?select=*&paypal_subscription_id=eq."+encodeURIComponent(p.paypal_subscription_id));
      if(!row)return fail("Subscription not found",404);
      if(body.op==="subscription_get"){
        const memberId=await resolveVerifiedDonor(p.member_access_token);
        if(!memberId||row.member_id!==memberId)return fail("Subscription is not owned by this member",403);
      }
      return Response.json({ok:true,intent:{
        id:row.id,member_id:row.member_id,tier:row.tier,interval:row.interval,amount_cents:row.amount_cents,
        currency:row.currency,paypal_plan_id:row.paypal_plan_id,custom_id:row.custom_id,
        paypal_subscription_id:row.paypal_subscription_id,status:row.status,last_payment_cents:row.last_payment_cents,
        last_payment_at:row.last_payment_at,next_billing_time:row.next_billing_time,last_reversal_at:row.last_reversal_at,
        created_at:row.created_at
      }});
    }
    if(body.op==="subscription_status"){
      const p=body.data||{};
      const memberId=await resolveVerifiedDonor(p.member_access_token);
      if(!memberId)return fail("Verified member session required",401);
      const rows=await db("ifund_subscription_intents?select=id,tier,interval,amount_cents,currency,paypal_plan_id,paypal_subscription_id,status,last_payment_cents,last_payment_at,next_billing_time,last_reversal_at,created_at,updated_at&member_id=eq."
        +memberId+"&order=created_at.desc&limit=1");
      return Response.json({ok:true,subscription:rows[0]||null});
    }
    if(body.op==="subscription_reversal"){
      const p=body.data||{};
      if(!subscriptionId.test(p.paypal_subscription_id||"")||!eventId.test(p.paypal_event_id||"")
        ||!Number.isSafeInteger(p.amount_cents)||p.amount_cents<1||p.currency!=="USD")
        return fail("Invalid subscription reversal");
      const row=await findOne("ifund_subscription_intents?select=*&paypal_subscription_id=eq."+encodeURIComponent(p.paypal_subscription_id));
      if(!row)return fail("Subscription not found",404);
      const occurred=new Date(p.occurred_at||"");
      if(!Number.isFinite(occurred.getTime()))return fail("Invalid reversal time");
      const operation="paypal:subscription:reversal:"+p.paypal_event_id;
      const existing=await findOne("ifund_subscription_ledger?select=*&operation_key=eq."+encodeURIComponent(operation));
      if(!existing){
        await db("ifund_subscription_ledger","POST",{
          operation_key:operation,intent_id:row.id,member_id:row.member_id,paypal_subscription_id:row.paypal_subscription_id,
          provider_reference:p.provider_reference||p.paypal_event_id,
          entry_type:p.event_type==="PAYMENT.SALE.REFUNDED"?"refund":"reversal",
          amount_cents:-p.amount_cents,currency:"USD",environment:"live",provider_occurred_at:occurred.toISOString()
        });
      }
      await db("ifund_subscription_intents?id=eq."+row.id,"PATCH",{
        status:"past_due",last_reversal_at:occurred.toISOString(),updated_at:new Date().toISOString()
      });
      return Response.json({ok:true});
    }
    if(body.op==="subscription_reconcile"){
      const p=body.data||{};
      if(!subscriptionId.test(p.paypal_subscription_id||"")||!planId.test(p.paypal_plan_id||"")
        ||typeof p.custom_id!=="string"||!["ACTIVE","APPROVAL_PENDING","SUSPENDED","CANCELLED","EXPIRED"].includes(p.provider_status))
        return fail("Invalid subscription provider state");
      const row=await findOne("ifund_subscription_intents?select=*&paypal_subscription_id=eq."+encodeURIComponent(p.paypal_subscription_id));
      if(!row||row.paypal_plan_id!==p.paypal_plan_id||row.custom_id!==p.custom_id)
        return fail("Subscription provider identity mismatch",409);
      const paymentAt=p.last_payment_at?new Date(p.last_payment_at):null;
      const paymentValid=paymentAt&&Number.isFinite(paymentAt.getTime())
        &&Number.isSafeInteger(p.last_payment_cents)&&p.last_payment_cents===row.amount_cents
        &&p.currency==="USD"&&paymentAt.getTime()>=new Date(row.created_at).getTime()
        &&(!row.last_reversal_at||paymentAt.getTime()>new Date(row.last_reversal_at).getTime());
      const failed=Number.isSafeInteger(p.failed_payments_count)?p.failed_payments_count:0;
      let status="pending";
      if(["CANCELLED","EXPIRED"].includes(p.provider_status))status="canceled";
      else if(p.provider_status==="SUSPENDED"||failed>0||(row.last_reversal_at&&!paymentValid))status="past_due";
      else if(p.provider_status==="ACTIVE"&&paymentValid)status="active";
      if(status==="active"){
        const operation="paypal:subscription:payment:"+row.paypal_subscription_id+":"+paymentAt.toISOString();
        const existing=await findOne("ifund_subscription_ledger?select=*&operation_key=eq."+encodeURIComponent(operation));
        if(!existing){
          await db("ifund_subscription_ledger","POST",{
            operation_key:operation,intent_id:row.id,member_id:row.member_id,paypal_subscription_id:row.paypal_subscription_id,
            provider_reference:p.provider_reference||null,entry_type:"payment",amount_cents:row.amount_cents,
            currency:"USD",environment:"live",provider_occurred_at:paymentAt.toISOString()
          });
        }else if(existing.amount_cents!==row.amount_cents||existing.member_id!==row.member_id){
          return fail("Subscription ledger conflict",409);
        }else if(!existing.provider_reference&&p.provider_reference){
          await db("ifund_subscription_ledger?id=eq."+existing.id,"PATCH",{provider_reference:p.provider_reference});
        }
      }
      await db("ifund_subscription_intents?id=eq."+row.id,"PATCH",{
        status,last_payment_cents:paymentValid?p.last_payment_cents:row.last_payment_cents,
        last_payment_at:paymentValid?paymentAt.toISOString():row.last_payment_at,
        next_billing_time:p.next_billing_time||null,updated_at:new Date().toISOString()
      });
      return Response.json({ok:true,status});
    }
    if(body.op==="subscription_event"){
      const p=body.data||{};
      if(!eventId.test(p.paypal_event_id||"")||!subscriptionId.test(p.paypal_subscription_id||"")
        ||typeof p.event_type!=="string"||p.event_type.length<3)return fail("Invalid subscription event");
      const existing=await findOne("ifund_subscription_events?select=*&paypal_event_id=eq."+encodeURIComponent(p.paypal_event_id));
      if(existing){
        if(existing.paypal_subscription_id!==p.paypal_subscription_id||existing.event_type!==p.event_type)
          return fail("Subscription event identity conflict",409);
        return Response.json({ok:true,recorded:true,duplicate:true});
      }
      try{
        await db("ifund_subscription_events","POST",{
          paypal_event_id:p.paypal_event_id,paypal_subscription_id:p.paypal_subscription_id,event_type:p.event_type
        });
      }catch(error){
        if(error.status!==409)throw error;
      }
      return Response.json({ok:true,recorded:true});
    }
    return fail("Unsupported operation",404);
  }catch(err){
    return fail(err.status===401 ? "Your session expired. Sign in again before donating."
      : err.status===409 ? "Payment state conflict. Reconciliation required."
      : "Financial operation unavailable", err.status===401?401:err.status===409?409:503);
  }
});
