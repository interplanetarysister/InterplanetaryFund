// PayPal event classification for future unified, provider-verified processing.
// Use only AFTER signature verification. Classification NEVER changes balances.
const CAMPAIGN_CHANNELS = new Set(['paypal','googlepay','applepay']);
const CAPTURE_EVENTS = new Set(['PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.PENDING','PAYMENT.CAPTURE.DENIED','PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED']);
const BILLING_EVENTS = new Set([
  'PAYMENT.SALE.COMPLETED','PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED',
  'BILLING.SUBSCRIPTION.ACTIVATED','BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED','BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED','BILLING.SUBSCRIPTION.UPDATED'
]);
const PAYOUT_EVENTS = new Set(['PAYMENT.PAYOUTSBATCH.SUCCESS','PAYMENT.PAYOUTSBATCH.DENIED',
  'PAYMENT.PAYOUTS-ITEM.SUCCEEDED','PAYMENT.PAYOUTS-ITEM.FAILED',
  'PAYMENT.PAYOUTS-ITEM.RETURNED','PAYMENT.PAYOUTS-ITEM.CANCELED',
  'PAYMENT.PAYOUTS-ITEM.BLOCKED','PAYMENT.PAYOUTS-ITEM.UNCLAIMED']);
export function parseCampaignAllocation(customId) {
  const parts=String(customId||'').split('|');
  if(parts.length!==6||parts[5]!=='gift_first_v2'||!CAMPAIGN_CHANNELS.has(parts[4]))return null;
  if(!/^[A-Za-z0-9_-]{8,100}$/.test(parts[0]))return null;
  const integers=parts.slice(1,4);
  if(!integers.every(s=>/^(0|[1-9]\d*)$/.test(s)))return null;
  const [allocated,processing,support]=integers.map(Number);
  if(![allocated,processing,support].every(Number.isSafeInteger)||
     allocated<=0||processing<0||support<0||support>=allocated)return null;
  return {campaign_id:parts[0],allocated_cents:allocated,processing_cents:processing,
    support_cents:support,gift_cents:allocated-support,channel:parts[4],version:parts[5]};
}
export function classifyPayPalNotification(event) {
  if(!event||typeof event!=='object'||Array.isArray(event)||!event.id)
    return {type:'invalid',reason:'event_missing'};
  const kind=String(event.event_type||''),r=event.resource||{};
  if(CAPTURE_EVENTS.has(kind)) {
    if(kind.endsWith('.REFUNDED')||kind.endsWith('.REVERSED')) {
      // PayPal refund events frequently omit the original purchase custom_id.
      // Only a database lookup and PayPal transaction confirmation can assign
      // a known capture to one payment purpose. No default to platform support.
      return {type:'capture_reconciliation',event_type:kind,refund_or_reversal_id:r.id||null};
    }
    if(r.custom_id==='ifund:platform-support:v1')
      return {type:'platform_support',event_type:kind,capture_id:r.id||null};
    const allocation=parseCampaignAllocation(r.custom_id);
    if(allocation) return {type:'campaign',event_type:kind,capture_id:r.id||null,allocation};
    return {type:'unattributed',reason:'capture_has_no_verified_purpose'};
  }
  if(BILLING_EVENTS.has(kind)) {
    // For PAYMENT.SALE.*, resource.id is the SALE ID, NOT subscription ID.
    // Only PayPal's billing_agreement_id can identify that subscription;
    // billing events instead carry the subscription as resource.id.
    const subscriptionId=kind.startsWith('PAYMENT.SALE.')
      ? (r.billing_agreement_id||null) : (r.id||null);
    return {type:'subscription_reconciliation',event_type:kind,subscription_id:subscriptionId};
  }
  if(PAYOUT_EVENTS.has(kind))return {type:'payout_reconciliation',event_type:kind,
    payout_batch_id:r.payout_batch_id||r.batch_header?.payout_batch_id||null};
  return {type:'ignored',reason:'unsupported_event'};
}
// These allow a dashboard to report what is still missing without leaking
// passwords, credentials, client IDs or sensitive live merchant balances.
export function paypalReadiness(env={}) {
  const merchantOk=env.PAYPAL_MERCHANT_EMAIL==='cuddlemeplatonically@gmail.com';
  const common=merchantOk&&['sandbox','live'].includes(env.PAYPAL_MODE)&&
    Boolean(env.PAYPAL_CLIENT_ID&&env.PAYPAL_CLIENT_SECRET&&env.PAYPAL_WEBHOOK_ID&&
    env.SUPABASE_URL&&(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY));
  const verified=common&&Boolean(env.PAYPAL_VERIFIED_MERCHANT_ID)&&
    env.IFUND_PAYMENT_PARITY_VERIFIED==='enabled'&&env.IFUND_PAYPAL_MERCHANT_VERIFIED==='enabled';
  return {
    mode:env.PAYPAL_MODE==='live'?'live':env.PAYPAL_MODE==='sandbox'?'sandbox':'unconfigured',
    merchant_intended:'cuddlemeplatonically@gmail.com',
    credential_names_present:Boolean(common),
    merchant_provider_verified:Boolean(verified),
    campaigns:Boolean(verified&&env.IFUND_PAYPAL_CAMPAIGNS_ENABLED==='enabled'),
    platform_support:Boolean(verified&&env.IFUND_PAYPAL_SUPPORT_ENABLED==='enabled'),
    subscriptions:Boolean(verified&&env.IFUND_PAYPAL_SUBSCRIPTIONS_ENABLED==='enabled'&&
      env.IFUND_PAYPAL_PLANS_VERIFIED==='enabled'),
    payouts:Boolean(verified&&env.IFUND_PAYPAL_PAYOUTS_ENABLED==='enabled'&&
      env.IFUND_PAYPAL_PAYOUTS_APPROVED==='enabled'&&env.IFUND_PAYPAL_LEDGER_VERIFIED==='enabled')
  };
}
