// PayPal webhook handling for IFund platform-support payments.
// Replaces the Base44 receipt-scan path for the hosted platform-support link.
// Pure helpers are exported for tests; network calls take an injectable fetch.

export const PLATFORM_SUPPORT_EVENTS = new Set([
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.PENDING",
  "PAYMENT.CAPTURE.DENIED",
  "PAYMENT.CAPTURE.REVERSED",
  "PAYMENT.CAPTURE.REFUNDED",
]);

export function paypalApiBase(mode) {
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function toAmount(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function captureIdFromRefund(resource) {
  const up = (resource.links || []).find((l) => l && l.rel === "up");
  if (!up || !up.href) return null;
  return String(up.href).split("/").filter(Boolean).pop() || null;
}

// Decide whether a verified PayPal event is a platform-support payment.
// Campaign checkout orders carry a pipe-delimited custom_id
// (campaign|gift|fee|contribution|channel|version) and are ignored here;
// subscription billing arrives as PAYMENT.SALE.* and is ignored too.
export function classifyPayPalEvent(event) {
  if (!event || typeof event !== "object") return { kind: "invalid", reason: "not_an_object" };
  const type = String(event.event_type || "");
  if (!PLATFORM_SUPPORT_EVENTS.has(type)) return { kind: "ignored", reason: "unsupported_event_type" };
  const r = event.resource || {};
  if (String(r.custom_id || "").includes("|")) return { kind: "ignored", reason: "campaign_checkout_order" };
  const isRefund = type === "PAYMENT.CAPTURE.REFUNDED";
  const captureId = isRefund ? captureIdFromRefund(r) : r.id;
  if (!event.id) return { kind: "invalid", reason: "missing_event_id" };
  if (!captureId) return { kind: "invalid", reason: "missing_capture_id" };
  const amount = r.amount || {};
  const breakdown = r.seller_receivable_breakdown || {};
  return {
    kind: "platform_support",
    record: {
      event_id: String(event.id),
      event_type: type,
      paypal_capture_id: String(captureId),
      paypal_order_id: r.supplementary_data?.related_ids?.order_id || null,
      status: type.split(".").pop(),
      currency: amount.currency_code || null,
      gross_amount: isRefund ? null : toAmount(amount.value),
      paypal_fee: isRefund ? null : toAmount(breakdown.paypal_fee?.value),
      net_amount: isRefund ? null : toAmount(breakdown.net_amount?.value),
      refund_id: isRefund ? String(r.id || "") || null : null,
      refunded_amount: isRefund ? toAmount(amount.value) : null,
      provider_created_at: r.create_time || null,
    },
  };
}

export function missingPayPalWebhookConfig(env) {
  return [
    "PAYPAL_MODE",
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_WEBHOOK_ID",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((k) => !env || !env[k]);
}

async function getAccessToken(env, fetchImpl) {
  const res = await fetchImpl(`${paypalApiBase(env.PAYPAL_MODE)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed with status ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

// Ask PayPal to verify the transmission signature against our webhook ID.
export async function verifyPayPalWebhook(headers, event, env, fetchImpl = fetch) {
  const get = (n) => headers.get(n);
  const fields = {
    auth_algo: get("paypal-auth-algo"),
    cert_url: get("paypal-cert-url"),
    transmission_id: get("paypal-transmission-id"),
    transmission_sig: get("paypal-transmission-sig"),
    transmission_time: get("paypal-transmission-time"),
  };
  if (Object.values(fields).some((v) => !v)) return false;
  const token = await getAccessToken(env, fetchImpl);
  const res = await fetchImpl(
    `${paypalApiBase(env.PAYPAL_MODE)}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, webhook_id: env.PAYPAL_WEBHOOK_ID, webhook_event: event }),
    },
  );
  if (!res.ok) return false;
  const data = await res.json();
  return data.verification_status === "SUCCESS";
}

// Service-role write through a SECURITY DEFINER RPC that is executable only by
// service_role. Idempotent on PayPal event ID.
export async function recordPlatformSupportPayment(record, rawEvent, env, fetchImpl = fetch) {
  const res = await fetchImpl(
    `${env.SUPABASE_URL}/rest/v1/rpc/ifund_record_platform_support_payment`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p: record, raw: rawEvent }),
    },
  );
  if (!res.ok) throw new Error(`Supabase record failed with status ${res.status}`);
  return res.json();
}

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function handlePayPalWebhook(request, env, fetchImpl = fetch) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const missing = missingPayPalWebhookConfig(env);
  // 503 makes PayPal retry later instead of dropping the event.
  if (missing.length) return json({ error: "PayPal webhook is not configured" }, 503);
  let event;
  try {
    event = JSON.parse(await request.text());
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  let verified = false;
  try {
    verified = await verifyPayPalWebhook(request.headers, event, env, fetchImpl);
  } catch {
    return json({ error: "Verification unavailable" }, 503);
  }
  if (!verified) return json({ error: "Signature verification failed" }, 400);
  const result = classifyPayPalEvent(event);
  if (result.kind !== "platform_support") return json({ ok: true, ignored: result.reason });
  try {
    const outcome = await recordPlatformSupportPayment(result.record, event, env, fetchImpl);
    return json({ ok: true, outcome });
  } catch {
    return json({ error: "Record failed" }, 500);
  }
}
