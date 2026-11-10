// Pure, dependency-free validation for the isolated PayPal sandbox gateway.
// Never writes to the real donation ledger or authorizes a withdrawal.
export class SandboxVerificationError extends Error {
  constructor(message) { super(message); this.name = "SandboxVerificationError"; }
}
const required = ["PAYPAL_CLIENT_ID","PAYPAL_CLIENT_SECRET","PAYPAL_WEBHOOK_ID","SUPABASE_URL","SUPABASE_SECRET_KEY"];
const validId = value => typeof value === "string" && /^[A-Za-z0-9-]{8,128}$/.test(value);
const expectedAmount = cents => {
  if (!Number.isSafeInteger(cents) || cents < 100 || cents > 10000) throw new SandboxVerificationError("Invalid sandbox amount");
  return (cents / 100).toFixed(2);
};
export function sandboxConfigured(env) {
  return env?.IFUND_PAYPAL_SANDBOX_ENABLED === "enabled" &&
    required.every(name => typeof env[name] === "string" && env[name].trim().length > 0) &&
    (() => { try { const u = new URL(env.SUPABASE_URL); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; } })();
}
export function confirmCapturedOrder(order, record) {
  if (!validId(record?.paypal_order_id) || order?.id !== record.paypal_order_id || order?.status !== "COMPLETED") {
    throw new SandboxVerificationError("Unconfirmed PayPal order");
  }
  const units = order.purchase_units;
  if (!Array.isArray(units) || units.length !== 1 || units[0]?.custom_id !== record.campaign_id) {
    throw new SandboxVerificationError("Order campaign mismatch");
  }
  const captures = units[0]?.payments?.captures;
  if (!Array.isArray(captures) || captures.length !== 1) {
    throw new SandboxVerificationError("Unexpected capture count");
  }
  const capture = captures[0];
  if (!validId(capture?.id) || capture.status !== "COMPLETED" ||
      capture.amount?.currency_code !== "USD" || capture.amount?.value !== expectedAmount(record.gift_cents) ||
      units[0]?.amount?.currency_code !== "USD" || units[0]?.amount?.value !== expectedAmount(record.gift_cents)) {
    throw new SandboxVerificationError("Capture amount or status mismatch");
  }
  return Object.freeze({ orderId: order.id, captureId: capture.id, amountCents: record.gift_cents });
}
export function confirmedWebhookResource(event, orderRecord) {
  if (!validId(event?.id) || !orderRecord?.paypal_order_id) throw new SandboxVerificationError("Invalid webhook event");
  const type = event.event_type, resource = event.resource;
  // Refunds require a separate provider GET of the refund and original capture.
  // Do not infer financial transitions from webhook links or untrusted payloads.
  if (type !== "PAYMENT.CAPTURE.COMPLETED") throw new SandboxVerificationError("Unsupported webhook event");
  if (!validId(resource?.id) || resource.id !== orderRecord.paypal_capture_id) {
    throw new SandboxVerificationError("Unassociated capture event");
  }
  if (resource.amount?.currency_code !== "USD" || resource.amount?.value !== expectedAmount(orderRecord.gift_cents)) {
    throw new SandboxVerificationError("Webhook capture amount mismatch");
  }
  return { type, eventId: event.id, captureId: resource.id, status: "verified" };
}

const cookieName = orderId => {
  if (!validId(orderId)) throw new SandboxVerificationError("Invalid order ID");
  return "ifund_sandbox_" + orderId;
};
const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
export async function checkoutTokenHash(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new SandboxVerificationError("Invalid checkout token");
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token))));
}
export async function issueCheckoutBinding(orderId) {
  const name=cookieName(orderId);
  const token=toHex(crypto.getRandomValues(new Uint8Array(32)));
  const hash=await checkoutTokenHash(token);
  return {
    checkoutTokenHash:hash,
    setCookie:`${name}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/api/paypal/sandbox; Max-Age=3600`
  };
}
export async function requireCheckoutSession(request, orderRecord) {
  if (request.method !== "POST" || new URL(request.url).protocol !== "https:" ||
      request.headers.get("origin") !== new URL(request.url).origin)
    throw new SandboxVerificationError("Invalid checkout request origin");
  const name=cookieName(orderRecord?.paypal_order_id);
  const token=(request.headers.get("cookie")||"").split(";").map(c=>c.trim())
    .find(c=>c.startsWith(name+"="))?.slice(name.length+1);
  if (!token || !/^[a-f0-9]{64}$/.test(orderRecord?.checkout_token_hash||""))
    throw new SandboxVerificationError("Checkout session missing");
  const presented=await checkoutTokenHash(token);
  const expected=orderRecord.checkout_token_hash;
  let difference=0;
  for(let i=0;i<64;i++) difference |= presented.charCodeAt(i)^expected.charCodeAt(i);
  if(difference!==0) throw new SandboxVerificationError("Checkout session mismatch");
  return true;
}
export function atomicCaptureUpdateFilter(record) {
  if (!validId(record?.paypal_order_id) || !/^[a-f0-9]{64}$/.test(record.checkout_token_hash||""))
    throw new SandboxVerificationError("Unbound capture attempt");
  return "?paypal_order_id=eq."+encodeURIComponent(record.paypal_order_id)+
    "&checkout_token_hash=eq."+record.checkout_token_hash+
    "&status=eq.created&paypal_capture_id=is.null";
}
export function associatedCaptureWebhook(event, orderRecord) {
  if(event?.event_type!=="PAYMENT.CAPTURE.COMPLETED" ||
     event?.resource?.supplementary_data?.related_ids?.order_id!==orderRecord?.paypal_order_id)
    throw new SandboxVerificationError("Webhook order association missing");
  if (event.resource.amount?.currency_code!=="USD" ||
      event.resource.amount?.value!==expectedAmount(orderRecord.gift_cents) ||
      !validId(event.resource.id))
    throw new SandboxVerificationError("Webhook capture mismatch");
  return {orderId:orderRecord.paypal_order_id,captureId:event.resource.id};
}
