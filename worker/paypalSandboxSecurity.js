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
  if (type === "PAYMENT.CAPTURE.COMPLETED" || type === "PAYMENT.CAPTURE.REFUNDED") {
    if (!validId(resource?.id) || !validId(orderRecord.paypal_capture_id) && type.endsWith("REFUNDED")) {
      throw new SandboxVerificationError("Capture reference missing");
    }
    // Refund resource ID is the refund ID, not capture ID.
    const captureId = type.endsWith("REFUNDED") ? resource?.links?.find(x => x.rel === "up")?.href?.split("/").pop() : resource.id;
    if (captureId !== orderRecord.paypal_capture_id) throw new SandboxVerificationError("Unassociated capture event");
    if (resource.amount?.currency_code !== "USD" || !/^\\d+\\.\\d{2}$/.test(resource.amount?.value ?? "")) {
      throw new SandboxVerificationError("Invalid webhook amount");
    }
    if (type === "PAYMENT.CAPTURE.COMPLETED" && resource.amount.value !== expectedAmount(orderRecord.gift_cents)) {
      throw new SandboxVerificationError("Webhook capture amount mismatch");
    }
    return { type, eventId: event.id, captureId, status: "verified" };
  }
  throw new SandboxVerificationError("Unsupported webhook event");
}
