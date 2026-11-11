import { demand, Fault, providerId, now, type DB } from "./core.ts";
import type { DemoEnv, Order, ProviderOrder } from "./types.ts";
import { mayCaptureSandboxCard } from "../src/sandbox-liability.ts";
export const PAYPAL = "https://api-m.sandbox.paypal.com";
async function secret(x: DemoEnv["PAYPAL_CLIENT_ID"]) {
  return typeof x === "string" ? x : x?.get();
}
// Browser-safe token for PayPal-hosted iframe fields. Never a merchant access token.
export async function paypalCardClientToken(env: DemoEnv): Promise<string> {
  demand(env.DEMO_ENABLED === "true", "Sandbox checkout is disabled", 503);
  const id = await secret(env.PAYPAL_CLIENT_ID);
  const pass = await secret(env.PAYPAL_CLIENT_SECRET);
  demand(id && pass, "Sandbox merchant credentials are unavailable", 503);
  const result = await fetch(PAYPAL + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      authorization: "Basic " + btoa(id + ":" + pass),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&response_type=client_token&intent=sdk_init",
    signal: AbortSignal.timeout(15000),
  });
  demand(result.ok, "PayPal browser-safe card token unavailable", 503, "PAYPAL_UNAVAILABLE");
  const data = await result.json() as { access_token?: string };
  demand(typeof data.access_token === "string" && data.access_token.length > 10,
    "PayPal card session unavailable", 503, "PAYPAL_UNAVAILABLE");
  return data.access_token;
}

export async function paypal(env: DemoEnv) {
  demand(
    env.DEMO_ENABLED === "true",
    "Sandbox checkout is not enabled",
    503,
    "PAYPAL_UNAVAILABLE",
  );
  const id = await secret(env.PAYPAL_CLIENT_ID),
    pass = await secret(env.PAYPAL_CLIENT_SECRET);
  demand(
    id && pass,
    "Sandbox merchant credentials are not configured",
    503,
    "PAYPAL_UNAVAILABLE",
  );
  const oauth = await fetch(PAYPAL + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      authorization: "Basic " + btoa(id + ":" + pass),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15000),
  });
  demand(
    oauth.ok,
    "Sandbox authentication unavailable",
    503,
    "PAYPAL_UNAVAILABLE",
  );
  const token = (await oauth.json()) as {
    access_token?: string;
    token_type?: string;
  };
  demand(
    token.access_token && token.token_type === "Bearer",
    "Sandbox authentication unavailable",
    503,
  );
  return async <T>(
    method: string,
    path: string,
    payload?: unknown,
    key?: string,
  ): Promise<T> => {
    demand(
      /^\/v[12]\/[a-z0-9_/-]+(?:\?fields=payment_source)?$/i.test(path),
      "Unsafe PayPal path",
      500,
    );
    const response = await fetch(PAYPAL + path, {
      method,
      headers: {
        authorization: "Bearer " + token.access_token,
        "content-type": "application/json",
        ...(key ? { "PayPal-Request-Id": key } : {}),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(20000),
    });
    const data = (
      response.status === 204 ? { accepted: true } : await response.json()
    ) as T;
    if (!response.ok) {
      const detail = data as { details?: { issue?: string }[] };
      const code = detail?.details?.[0]?.issue;
      throw new Fault(
        code === "INSTRUMENT_DECLINED"
          ? "Funding was declined; approve a new checkout with another sandbox funding source"
          : "PayPal request was not confirmed",
        502,
        code === "INSTRUMENT_DECLINED"
          ? "INSTRUMENT_DECLINED"
          : "PAYPAL_RETRY_REQUIRED",
      );
    }
    return data;
  };
}
export function verifyOrder(
  order: ProviderOrder,
  record: Order,
  merchant: string,
) {
  demand(
    order.id === record.paypal_order_id,
    "PayPal order does not match",
    409,
  );
  const units = order.purchase_units;
  demand(
    units?.length === 1 && units[0].custom_id === "ifund-demo:" + record.id,
    "PayPal purpose does not match",
    409,
  );
  const unit = units[0];
  const amount = (record.amount_cents / 100).toFixed(2);
  demand(
    unit.amount?.value === amount &&
      unit.amount?.currency_code === "USD" &&
      unit.payee?.merchant_id === merchant,
    "PayPal amount, currency or merchant does not match",
    409,
  );
  const captures = unit.payments?.captures;
  if (!captures?.length) return { status: "not_captured" as const };
  demand(captures.length === 1, "Unexpected capture count", 409);
  const c = captures[0];
  demand(
    providerId(c.id) &&
      c.amount?.value === amount &&
      c.amount?.currency_code === "USD",
    "PayPal capture mismatch",
    409,
  );
  if (["DECLINED", "DENIED", "FAILED"].includes(c.status || ""))
    return { status: "failed" as const };
  if (c.status === "PENDING") return { status: "pending" as const };
  demand(
    order.status === "COMPLETED" && c.status === "COMPLETED",
    "Capture is not completed",
    409,
  );
  return { status: "captured" as const, captureId: c.id };
}
export function approvalUrl(order: ProviderOrder) {
  const href = order.links?.find((l) =>
    ["approve", "payer-action"].includes(l.rel),
  )?.href;
  demand(href, "PayPal approval URL missing", 502);
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    throw new Fault("Invalid approval URL", 502);
  }
  demand(
    u.protocol === "https:" &&
      ["www.sandbox.paypal.com", "sandbox.paypal.com"].includes(u.hostname) &&
      !u.username &&
      !u.password &&
      !u.port,
    "Unexpected PayPal approval host",
    502,
  );
  return u.href;
}
export async function reconcile(
  env: DemoEnv,
  db: DB,
  record: Order,
  capture = false,
  expectedCapture?: string,
): Promise<Record<string, unknown>> {
  demand(
    providerId(record.paypal_order_id),
    "Order creation is incomplete; retry the original request",
    409,
  );
  const api = await paypal(env),
    path = "/v2/checkout/orders/" + record.paypal_order_id;
  let remote = await api<ProviderOrder>("GET", path);
  // Check pinned merchant, reference and amount BEFORE any capture attempt.
  demand(
    record.merchant_id || env.PAYPAL_MERCHANT_ID,
    "Order merchant was not pinned",
    409,
  );
  verifyOrder(remote, record, record.merchant_id || env.PAYPAL_MERCHANT_ID!);
  if (capture && remote.status === "APPROVED") {
    if (record.checkout_method === "card") {
      // Only query PayPal for 3DS risk data; never copy raw card data into our DB.
      const authentication = await api<ProviderOrder>("GET", path + "?fields=payment_source");
      const threeDS = authentication.payment_source?.card?.authentication_result;
      demand(
        mayCaptureSandboxCard(
          threeDS?.liability_shift,
          threeDS?.three_d_secure?.enrollment_status,
        ),
        "PayPal 3-D Secure outcome does not permit capture; use another sandbox test card",
        409,
        "3DS_NOT_VERIFIED",
      );
    }
    try {
      await api<ProviderOrder>(
        "POST",
        path + "/capture",
        {},
        "ifund-demo-capture-" + record.id,
      );
    } catch {
      /* Timeout and concurrent requests reconcile through a fresh provider GET. */
    }
    remote = await api<ProviderOrder>("GET", path);
  }
  const verified = verifyOrder(
    remote,
    record,
    record.merchant_id || env.PAYPAL_MERCHANT_ID!,
  );
  if (verified.status === "captured") {
    if (expectedCapture)
      demand(
        verified.captureId === expectedCapture,
        "Webhook capture association mismatch",
        409,
      );
    const receipt = await db.rpc<Record<string, unknown>>("finalize", {
      p_order: record.id,
      p_capture: verified.captureId,
      p_amount: record.amount_cents,
      p_currency: "USD",
    });
    demand(
      receipt.status === "captured" &&
        receipt.capture_id === verified.captureId,
      "Durable receipt not confirmed",
      503,
    );
    return { ...receipt, mode: "sandbox" };
  }
  if (verified.status === "pending") {
    await db.update(
      "orders",
      "?id=eq." + record.id + "&paypal_capture_id=is.null",
      {
        status: "pending",
        reconciliation: "retry_required",
        updated_at: now(),
      },
    );
    return {
      status: "pending",
      mode: "sandbox",
      message:
        "PayPal reports a pending capture. No collected funds or successful receipt yet.",
    };
  }
  if (verified.status === "failed") {
    await db.update(
      "orders",
      "?id=eq." + record.id + "&paypal_capture_id=is.null",
      {
        status: "failed",
        reconciliation: "provider_verified",
        failure_code: "PROVIDER_DECLINED",
        updated_at: now(),
      },
    );
    return {
      status: "failed",
      mode: "sandbox",
      message:
        "PayPal reports a failed capture. No collected funds or successful receipt was created.",
    };
  }
  throw new Fault(
    "Sandbox buyer approval is required; no capture is confirmed",
    409,
    "APPROVAL_REQUIRED",
  );
}
export async function verifyWebhook(
  env: DemoEnv,
  request: Request,
  event: Record<string, unknown>,
) {
  demand(env.PAYPAL_WEBHOOK_ID, "Sandbox webhook is not configured", 503);
  const names = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ];
  demand(
    names.every((n) => request.headers.get(n)),
    "Missing webhook signature headers",
    400,
  );
  const stamp = Date.parse(request.headers.get("paypal-transmission-time")!);
  demand(
    Number.isFinite(stamp) &&
      stamp < Date.now() + 300000 &&
      stamp > Date.now() - 3 * 86400000,
    "Webhook transmission outside retry window",
    400,
  );
  const api = await paypal(env);
  const result = await api<{ verification_status?: string }>(
    "POST",
    "/v1/notifications/verify-webhook-signature",
    {
      auth_algo: request.headers.get(names[0]),
      cert_url: request.headers.get(names[1]),
      transmission_id: request.headers.get(names[2]),
      transmission_sig: request.headers.get(names[3]),
      transmission_time: request.headers.get(names[4]),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    },
  );
  demand(
    result.verification_status === "SUCCESS",
    "Invalid PayPal webhook signature",
    403,
  );
}
