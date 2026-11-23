// Independent card subscription provider adapter (Stripe Checkout).
// Deliberately separate from PayPal's first-party subscription ledger.
// A missing accepted, atomic entitlement adapter prevents *any* card checkout.
// Do not add card numbers, CVCs, or raw payment methods to IFund endpoints.
const JSON_HEADERS={"content-type":"application/json","cache-control":"no-store"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
const api="https://api.stripe.com/v1";
const allowedHosts=new Set(["interplanetaryfund.com","www.interplanetaryfund.com"]);
const priceId=/^price_[A-Za-z0-9]{8,120}$/;
const accountId=/^acct_[A-Za-z0-9]{8,120}$/;
const envName=new Set(["test","live"]);
const keyMode=(key)=>key.startsWith("sk_test_")?"test":key.startsWith("sk_live_")?"live":"invalid";
const secret=async value=>typeof value==="string"?value:(typeof value?.get==="function"?await value.get():"");
async function stripe(env,path,init={}){
  const key=await secret(env.STRIPE_SECRET_KEY);
  if(keyMode(key)!==env.IFUND_CARD_MODE)throw new Error("stripe_mode_mismatch");
  const response=await fetch(api+path,{
    ...init,headers:{"authorization":"Bearer "+key,...(init.headers||{})}
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error("stripe_provider_unavailable");
  return data;
}
async function providerReadiness(env){
  const configReady=env.IFUND_CARD_SUBSCRIPTIONS_ENABLED==="true"&&
    env.IFUND_CARD_LEDGER_ACCEPTED==="true"&&
    envName.has(env.IFUND_CARD_MODE)&&priceId.test(env.STRIPE_MONTHLY_PRICE_ID||"")&&
    accountId.test(env.STRIPE_ACCOUNT_ID||"")&&
    Boolean(await secret(env.STRIPE_WEBHOOK_SECRET))&&
    keyMode(await secret(env.STRIPE_SECRET_KEY))===env.IFUND_CARD_MODE;
  if(!configReady)return {ready:false,reason:"card_subscription_setup_pending"};
  try{
    const [price,account]=await Promise.all([
      stripe(env,"/prices/"+encodeURIComponent(env.STRIPE_MONTHLY_PRICE_ID)),
      stripe(env,"/account")
    ]);
    const expectedLive=env.IFUND_CARD_MODE==="live";
    const providerReady=price.active===true&&price.livemode===expectedLive&&
      price.unit_amount===499&&price.currency==="usd"&&price.type==="recurring"&&
      price.recurring?.interval==="month"&&price.recurring?.interval_count===1&&
      account.id===env.STRIPE_ACCOUNT_ID&&
      account.charges_enabled===true;
    return {ready:providerReady,reason:providerReady?"verified":"card_provider_verification_pending"};
  }catch(_){return {ready:false,reason:"card_provider_unavailable"}}
}
// Never use a user-controlled return URL, amount, plan price, or member ID.
// Authenticated service-to-service receipt mapping must be accepted before
// implementing start; a Stripe session alone is not a paid entitlement.
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method==="GET"&&url.pathname==="/api/payments/card-subscriptions/readiness"){
      const status=await providerReadiness(env);
      return json({ok:true,provider:"stripe",mode:env.IFUND_CARD_MODE||"unconfigured",
        amount_cents:499,currency:"USD",interval:"monthly",
        provider_verified:status.ready,ready:false,reason:status.ready?"card_atomic_entitlement_adapter_pending":status.reason});
    }
    if(request.method==="POST"&&url.pathname==="/api/payments/card-subscriptions/start"){
      // Neither a checkout approval nor a return URL can grant Premium.
      // Block creation until a durable, verified Stripe invoice ledger and
      // cross-provider account reconciliation are integrated and tested.
      return json({ok:false,error:"card_subscription_atomic_accounting_not_accepted"},503);
    }
    if(request.method==="POST"&&url.pathname==="/api/payments/card-subscriptions/webhook"){
      // Never acknowledge a webhook before signature verification and an
      // idempotent, atomic subscription-ledger write have succeeded.
      return json({ok:false,error:"card_subscription_webhook_not_accepted"},503);
    }
    return json({ok:false,error:"not_found"},404);
  }
};
