// The browser may request/reserve a personal email identity, never activate it.
// The backend derives eligibility from provider-verified recurring entitlements.
const HANDLE=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const IFUND_EMAIL_DOMAIN="interplanetaryfund.com";
export const BASIC_EMAIL_ADDON_MONTHLY_CENTS=100;
export function normalizedEmailHandle(value){
  const handle=String(value||"").trim().toLowerCase();
  if(handle.length<3||handle.length>24||!HANDLE.test(handle))
    throw new Error("Use 3–24 lowercase letters, numbers, dots or hyphens, starting with a letter.");
  return handle;
}
const STATES=new Set(["paid_subscription_required","not_selected","tier_policy_pending",
  "awaiting_verified_addon_payment","awaiting_email_routing_verification","active"]);
export function checkedEmailAddonStatus(raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    !STATES.has(raw.state)||raw.basic_addon_amount_cents!==BASIC_EMAIL_ADDON_MONTHLY_CENTS||
    raw.currency!=="USD"||raw.interval!=="monthly"||
    typeof raw.eligible!=="boolean"||typeof raw.opted_in!=="boolean"||
    typeof raw.active!=="boolean"||typeof raw.billing_verified!=="boolean"||
    raw.can_send_email!==false||typeof raw.can_receive_email!=="boolean")
    throw new Error("Email add-on entitlement could not be verified.");
  if(raw.active && (!raw.eligible||!raw.opted_in||!raw.billing_verified||
    raw.state!=="active"||!raw.can_receive_email))
    throw new Error("Email add-on activation was not verified.");
  if(raw.linked_campaign_id!=null && !UUID.test(raw.linked_campaign_id))
    throw new Error("Email-linked campaign reference is invalid.");
  if(raw.requested_address!==null&&
    (typeof raw.requested_address!=="string"||
      !raw.requested_address.endsWith("@"+IFUND_EMAIL_DOMAIN)))
    throw new Error("Email identity response was not valid.");
  return raw;
}
export async function readEmailAddon(client){
  const {data:user,error:authError}=await client.auth.getUser();
  if(authError||!user?.user?.email_confirmed_at||user.user.is_anonymous===true)
    throw new Error("Sign in with a verified member account.");
  const {data,error}=await client.rpc("ifund_campaign_email_addon_status");
  if(error)throw new Error("Campaign email eligibility could not be verified.");
  return checkedEmailAddonStatus(data);
}
export async function selectEmailAddon(client,{optIn,handle}){
  if(typeof optIn!=="boolean")throw Error("Choose whether to request the email add-on.");
  const normalized=optIn?normalizedEmailHandle(handle):null;
  const {data:user,error:authError}=await client.auth.getUser();
  if(authError||!user?.user?.email_confirmed_at||user.user.is_anonymous===true)
    throw new Error("Sign in with a verified member account.");
  const {data,error}=await client.rpc("ifund_set_campaign_email_option",{
    p_opt_in:optIn,p_handle:normalized
  });
  if(error)throw new Error(error.message||"The email add-on selection was not saved.");
  const selection=checkedEmailAddonStatus(data);
  // Require a fresh server read so a local checkbox cannot masquerade as activation.
  const confirmed=await readEmailAddon(client);
  if(confirmed.opted_in!==optIn||
    optIn&&confirmed.requested_handle!==normalized)
    throw new Error("Your email selection could not be confirmed. Refresh before retrying.");
  if(selection.active!==confirmed.active)
    throw new Error("Your email billing status changed. Refresh before using this address.");
  return confirmed;
}


/** Bind the selected email alias to a campaign owned by the same verified member.
 * Does not activate email or grant campaign management permissions. */
export async function linkCampaignEmail(client,{campaignId=null}){
  if(campaignId!==null && !UUID.test(campaignId))
    throw new Error("Choose a valid campaign from your account.");
  const {data:user,error:authError}=await client.auth.getUser();
  if(authError||!UUID.test(user?.user?.id||"")||
     !user?.user?.email_confirmed_at||user.user.is_anonymous===true)
    throw new Error("Sign in with a verified member account.");
  const previous=await readEmailAddon(client);
  if(!previous.eligible||!previous.opted_in||!previous.requested_address)
    throw new Error("Reserve your paid campaign email option before linking a campaign.");
  const {data,error}=await client.rpc("ifund_set_campaign_email_campaign",{
    p_campaign_id:campaignId
  });
  if(error)throw new Error(error.message||"Campaign email connection could not be saved.");
  if(data!==campaignId)throw new Error("Campaign email connection was not confirmed.");
  const confirmed=await readEmailAddon(client);
  if(confirmed.linked_campaign_id!==campaignId ||
    confirmed.requested_address!==previous.requested_address)
    throw new Error("Your email connection changed unexpectedly. Refresh before continuing.");
  return confirmed;
}


/** Server-authoritative readiness for an actual $1/month recurring PayPal plan.
 * No frontend price or subscription state is trusted to activate checkout. */
export async function readEmailAddonCheckoutReadiness(client){
  const {data:user,error:authError}=await client.auth.getUser();
  if(authError||!UUID.test(user?.user?.id||"")||
      !user.user.email_confirmed_at||user.user.is_anonymous===true)
    throw new Error("Sign in with your verified account to view recurring billing.");
  const {data,error}=await client.rpc("ifund_campaign_email_checkout_readiness");
  if(error||!data||typeof data!=="object"||Array.isArray(data)||
     typeof data.plan_available!=="boolean"||
     typeof data.checkout_ready!=="boolean"||
     typeof data.subscription_eligible!=="boolean"||
     typeof data.opted_in!=="boolean"||
     data.monthly_amount_cents!==100||data.currency!=="USD"||
     data.payment_provider!=="paypal"||
     data.requires_recurring_provider_checkout!==true||
     data.approval_alone_activates!==false||
     (data.checkout_ready&&(!data.plan_available||!data.subscription_eligible||!data.opted_in)))
    throw new Error("The provider-backed email checkout status could not be verified.");
  return data;
}
