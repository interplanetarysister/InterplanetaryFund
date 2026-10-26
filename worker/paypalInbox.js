// Canonical intake ONLY: no donor, creator or subscription balances are changed.
// A PayPal webhook is authenticated before it is retained in a private DB inbox.
import { verifyPayPalWebhook } from './paypalWebhook.js';
import { classifyPayPalNotification } from './paypalRouting.js';

export function inboxRpcPayload(event, category, mode) {
  if (!event || typeof event !== 'object' || Array.isArray(event)
    || !/^[A-Za-z0-9_-]{4,150}$/.test(String(event.id||'')))
    throw Error('Invalid PayPal event identifier');
  const kind=String(event.event_type||'');
  if(!/^[A-Z][A-Z_.-]{7,119}$/.test(kind))throw Error('Invalid PayPal event type');
  if(!['sandbox','live'].includes(mode))throw Error('PayPal mode required');
  const r=event.resource||{};
  const allowed=new Set(['campaign','platform_support','unattributed',
    'capture_reconciliation','subscription_reconciliation','payout_reconciliation','ignored']);
  if(!allowed.has(category?.type))throw Error('Unsupported PayPal event category');
  return {event_id:event.id,event_type:kind,mode,category:category.type,
    merchant_id:r.payee?.merchant_id||null,
    provider_ref:category.capture_id||category.subscription_id||category.payout_batch_id||r.id||null};
}

export async function storeVerifiedWebhook(event, category, env, fetchImpl=fetch) {
  const key=env?.SUPABASE_SECRET_KEY||env?.SUPABASE_SERVICE_ROLE_KEY;
  if(!key||key.startsWith('sb_publishable_')||!env?.SUPABASE_URL?.startsWith('https://'))
    throw Error('Private Supabase service role is required');
  const headers={apikey:key,'Content-Type':'application/json'};
  if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
  const payload=inboxRpcPayload(event,category,env.PAYPAL_MODE);
  const result=await fetchImpl(env.SUPABASE_URL+'/rest/v1/rpc/ifund_enqueue_verified_paypal_webhook',{
    method:'POST',headers,body:JSON.stringify({p:payload,raw:event})
  });
  if(!result.ok)throw Error('Unable to retain verified event');
  return result.json();
}

const fail=(message,status)=>Response.json({error:message},{
  status,headers:{'Cache-Control':'no-store'}
});
export async function handleUnifiedPayPalWebhook(request,env,fetchImpl=fetch) {
  if(request.method!=='POST')return fail('Method not allowed',405);
  if(env?.IFUND_PAYPAL_INBOX_ENABLED!=='enabled')
    return fail('PayPal intake unavailable',503);
  if(!env.PAYPAL_WEBHOOK_ID||!env.PAYPAL_CLIENT_ID||!env.PAYPAL_CLIENT_SECRET||
     !['sandbox','live'].includes(env.PAYPAL_MODE))
    return fail('PayPal signature verification not configured',503);
  let raw,event;
  try{
    raw=await request.text();
    if(raw.length>1024*1024)return fail('Event exceeds maximum size',413);
    event=JSON.parse(raw);
    if(!event||typeof event!=='object'||Array.isArray(event))return fail('Invalid event',400);
  }catch{return fail('Invalid JSON',400)}
  let verified=false;
  try{verified=await verifyPayPalWebhook(request.headers,raw,env,fetchImpl)}
  catch{return fail('PayPal signature verification unavailable',503)}
  if(!verified)return fail('Signature verification failed',400);
  let category=classifyPayPalNotification(event);
  if(category.type==='invalid')return fail('Invalid signed event',400);
  // For events bearing a recipient PayPal merchant ID, mismatches must not
  // be attributed to this IFund account. They can only be held for review.
  if(event.resource?.payee?.merchant_id && env.PAYPAL_VERIFIED_MERCHANT_ID &&
    event.resource.payee.merchant_id!==env.PAYPAL_VERIFIED_MERCHANT_ID)
    category={type:'unattributed',reason:'mismatched_merchant'};
  try{
    await storeVerifiedWebhook(event,category,env,fetchImpl);
    return Response.json({ok:true,retained:true,reconciled:false},{
      headers:{'Cache-Control':'no-store'}
    });
  }catch{return fail('Secure event retention failed; retry required',503)}
}
