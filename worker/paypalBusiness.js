// Independent PayPal Business adapter. Inactive until provider and ledger gates pass.
// No Base44, secret exposure, automatic charges, or payout submission here.
export const IFUND_MERCHANT_EMAIL = 'cuddlemeplatonically@gmail.com';
export const IFUND_ACCOUNT_REF = 'interplanetary_business_paypal';
export const IFUND_BASIC_MONTHLY_PLAN_CANDIDATE = 'P-6YD2273006199630KNLDXBLA';
export const CATALOG_VERSION = '2026-10-v1';
export const IFUND_CATALOG = Object.freeze({
  basic: Object.freeze({ name: 'Basic AI Assistant', monthly: 1200, annual: 11500 }),
  outreach: Object.freeze({ name: 'AI Outreach Agent', monthly: 4900, annual: 47000 }),
  professional: Object.freeze({ name: 'Professional Outreach', monthly: 9900, annual: 95000 }),
  enterprise: Object.freeze({ name: 'Enterprise', monthly: 19900, annual: 191000 }),
  nonprofit: Object.freeze({ name: 'Nonprofit', monthly: 2900, annual: 28000 })
});
export function subscriptionQuote(tier, period) {
  const row = IFUND_CATALOG[tier];
  if (!row || !['monthly','annual'].includes(period)) return null;
  return { tier, period, cents:row[period],currency:'USD',version:CATALOG_VERSION };
}
export function verifySubscriptionPlan(plan, quote) {
  const cycle = plan?.billing_cycles?.find(x=>x.tenure_type==='REGULAR');
  return Boolean(quote && plan?.status==='ACTIVE' &&
    /^PROD-[A-Za-z0-9_-]{5,}$/.test(String(plan.product_id||'')) &&
    cycle?.frequency?.interval_unit === (quote.period === 'annual'?'YEAR':'MONTH') &&
    Number(cycle.frequency.interval_count)===1 &&
    Number(cycle.total_cycles)===0 &&
    cycle.pricing_scheme?.fixed_price?.currency_code==='USD' &&
    Math.round(Number(cycle.pricing_scheme.fixed_price.value)*100)===quote.cents);
}
export function paypalUrl(mode) {
  if (mode==='sandbox') return 'https://api-m.sandbox.paypal.com';
  if (mode==='live') return 'https://api-m.paypal.com';
  throw Error('Choose explicit PayPal mode');
}
export function requireMerchant(env) {
  if (env?.PAYPAL_MERCHANT_EMAIL!==IFUND_MERCHANT_EMAIL ||
      !env?.PAYPAL_CLIENT_ID || !env?.PAYPAL_CLIENT_SECRET ||
      !['sandbox','live'].includes(env.PAYPAL_MODE))
    throw Error('IFund merchant credentials not configured');
}
// REST request helper: merchant email remains an INTENDED target until an
// independently verified PayPal REST account ID is persisted by an operator.
export async function paypalRequest(env,path,options={},fetcher=fetch) {
  requireMerchant(env);
  if (!/^\/v[12]\/[a-z]/.test(path)) throw Error('Unexpected PayPal API path');
  const authorization = await fetcher(paypalUrl(env.PAYPAL_MODE)+'/v1/oauth2/token',{
    method:'POST', headers:{
      Authorization:'Basic '+btoa(env.PAYPAL_CLIENT_ID+':'+env.PAYPAL_CLIENT_SECRET),
      'Content-Type':'application/x-www-form-urlencoded'
    },body:'grant_type=client_credentials'
  });
  if (!authorization.ok) throw Error('PayPal authentication failed');
  const token=(await authorization.json()).access_token;
  if (!token) throw Error('No PayPal access token');
  const headers={ Authorization:'Bearer '+token,Accept:'application/json' };
  if (options.body!==undefined) headers['Content-Type']='application/json';
  if (options.requestId) {
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(options.requestId)) throw Error('Invalid idempotency identifier');
    headers['PayPal-Request-Id']=options.requestId;
  }
  const response=await fetcher(paypalUrl(env.PAYPAL_MODE)+path,{
    method:options.method||'GET',headers,
    ...(options.body===undefined?{}:{body:JSON.stringify(options.body)})
  });
  const data=await response.json().catch(()=>({}));
  if (!response.ok) {const e=Error('PayPal request rejected');e.status=response.status;throw e;}
  return data;
}
export async function checkOwnerBasicPlan(env,fetcher=fetch) {
  const plan=await paypalRequest(env,'/v1/billing/plans/'+IFUND_BASIC_MONTHLY_PLAN_CANDIDATE,{},fetcher);
  if (plan.id!==IFUND_BASIC_MONTHLY_PLAN_CANDIDATE || !verifySubscriptionPlan(plan,subscriptionQuote('basic','monthly')))
    throw Error('Owner basic monthly plan is not verified');
  return {id:plan.id,product_id:plan.product_id,amount_cents:1200,merchant_checked:true};
}
function cents(x,min,max,desc) {
  if(!Number.isSafeInteger(x)||x<min||x>max)throw Error('Invalid '+desc);
  return x;
}
export function giftQuote(giftCents,addSupport,processorRate,processorFixedCents) {
  cents(giftCents,100,100000000,'gift');
  if(typeof addSupport!=='boolean')throw Error('Support choice required');
  if(!Number.isFinite(processorRate)||processorRate<0||processorRate>=0.15)throw Error('Fee needs verification');
  cents(processorFixedCents,0,10000,'fixed fee');
  const supportCents=addSupport?Math.round(giftCents/10):0;
  const allocatedCents=giftCents+supportCents;
  let totalCents=Math.ceil((allocatedCents+processorFixedCents)/(1-processorRate));
  while(totalCents-Math.round(totalCents*processorRate+processorFixedCents)<allocatedCents)totalCents++;
  return {giftCents,supportCents,allocatedCents,totalCents,
    processorEstimateCents:totalCents-allocatedCents,
    withdrawalFeeCents:Math.round(giftCents*0.03),currency:'USD'};
}
export function donationOrder({campaignId,title,intentId,quote}) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignId||''))
    throw Error('Campaign must have persisted UUID');
  if(!/^[A-Za-z0-9_-]{16,100}$/.test(intentId||''))throw Error('Stable intent ID required');
  if(!quote||quote.currency!=='USD'||quote.totalCents!==quote.allocatedCents+quote.processorEstimateCents||
    quote.allocatedCents!==quote.giftCents+quote.supportCents)throw Error('Invalid quote');
  const customId=[campaignId,quote.allocatedCents,quote.processorEstimateCents,quote.supportCents,'paypal','gift_first_v2'].join('|');
  return {intent:'CAPTURE',purchase_units:[{
    amount:{currency_code:'USD',value:(quote.totalCents/100).toFixed(2)},
    payee:{email_address:IFUND_MERCHANT_EMAIL},
    description:('Donation to '+String(title||'')).slice(0,120),
    custom_id:customId
  }]};
}
export function verifyCampaignCapture(order,expectedCustomId,expectedCents,verifiedMerchantId) {
  if(!verifiedMerchantId)throw Error('PayPal merchant ID must be independently verified');
  const unit=order?.purchase_units?.[0], capture=unit?.payments?.captures?.find(x=>x.status==='COMPLETED');
  if(order?.status!=='COMPLETED'||!capture?.id||unit?.payee?.merchant_id!==verifiedMerchantId||
    unit?.custom_id!==expectedCustomId||capture.amount?.currency_code!=='USD'||
    !/^\d+\.\d{2}$/.test(String(capture.amount?.value||''))||
    Math.round(Number(capture.amount.value)*100)!==expectedCents)
    throw Error('Payment cannot be entered into IFund ledger');
  return {order_id:order.id,capture_id:capture.id,gross_cents:expectedCents,currency:'USD'};
}
export function subscriptionOrder(planId,customId) {
  if(!/^P-[A-Z0-9]{20,32}$/.test(planId||'')||!/^IFUND-[A-Za-z0-9_-]{12,80}$/.test(customId||''))
    throw Error('Verified plan and persisted subscription intent required');
  return {plan_id:planId,custom_id:customId,application_context:{
    brand_name:'Interplanetary Fund',user_action:'SUBSCRIBE_NOW',
    return_url:'https://interplanetaryfund.com/subscriptions?paypal_checkout=return',
    cancel_url:'https://interplanetaryfund.com/subscriptions?paypal_checkout=cancel'
  }};
}
export function withdrawalMath(giftCents) {
  cents(giftCents,0,100000000,'withdrawal');
  const feeCents=Math.round(giftCents*0.03);
  return {giftCents,feeCents,netCents:giftCents-feeCents};
}
export function reservedPayout({email,reservationId,giftCents,payoutsApproved}) {
  if(payoutsApproved!==true)throw Error('Payouts provider approval is unverified');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||'')||
    !/^[A-Za-z0-9_-]{16,75}$/.test(reservationId||''))throw Error('Verified reservation and recipient required');
  const x=withdrawalMath(giftCents);
  if(x.netCents<100)throw Error('Payout too small');
  return {
    payload: {
      sender_batch_header:{sender_batch_id:'IFUND_W_'+reservationId,email_subject:'Interplanetary Fund payout'},
      items:[{recipient_type:'EMAIL',receiver:email,amount:{currency:'USD',value:(x.netCents/100).toFixed(2)},
        sender_item_id:'IFUND_I_'+reservationId}]
    },
    platform_fee_cents:x.feeCents
  };
}

// Auctions are a separate transaction class with a 10% hosting/withdrawal
// charge. Do NOT also take the normal campaign-donation 3% fee.
export function auctionPayoutMath(saleProceedsCents) {
  cents(saleProceedsCents,0,100000000,'auction proceeds');
  const hostingFeeCents=Math.round(saleProceedsCents*0.10);
  return {saleProceedsCents,hostingFeeCents,
    netCents:saleProceedsCents-hostingFeeCents,currency:'USD'};
}
