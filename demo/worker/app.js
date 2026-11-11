var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/core.ts
var Fault = class extends Error {
  static {
    __name(this, "Fault");
  }
  status;
  code;
  constructor(message, status = 400, code = "INVALID_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
};
function demand(condition, message, status = 400, code = "INVALID_REQUEST") {
  if (!condition) throw new Fault(message, status, code);
}
__name(demand, "demand");
var uuid = /* @__PURE__ */ __name((value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
  value
), "uuid");
var providerId = /* @__PURE__ */ __name((value) => typeof value === "string" && /^[A-Za-z0-9-]{8,128}$/.test(value), "providerId");
var categories = [
  "emergency",
  "medical",
  "education",
  "disaster_relief",
  "community",
  "animals",
  "environment",
  "creative",
  "science"
];
var now = /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString(), "now");
function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
      ...headers
    }
  });
}
__name(json, "json");
async function body(request, max = 2e4) {
  demand(
    request.headers.get("content-type")?.split(";")[0] === "application/json",
    "JSON required",
    415
  );
  const reader = request.body?.getReader();
  demand(reader, "Request body required");
  let length = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      demand(length <= max, "Request too large", 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  let result;
  try {
    result = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    );
  } catch {
    throw new Fault("Invalid JSON");
  }
  demand(
    result && typeof result === "object" && !Array.isArray(result),
    "Object required"
  );
  return result;
}
__name(body, "body");
function sameOrigin(request, env) {
  const u = new URL(request.url);
  const local = ["localhost", "127.0.0.1"].includes(u.hostname);
  demand(
    u.origin === env.DEMO_ORIGIN && (u.protocol === "https:" || local),
    "Demo environment mismatch",
    403
  );
  demand(
    request.headers.get("origin") === u.origin,
    "Same-origin request required",
    403
  );
}
__name(sameOrigin, "sameOrigin");
async function hash(value) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
    )
  ].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hash, "hash");
function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(randomToken, "randomToken");
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const out = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: 1e5
    },
    key,
    256
  );
  return [...new Uint8Array(out)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(passwordHash, "passwordHash");
function equalHash(a, b) {
  if (a.length !== 64 || b.length !== 64) return false;
  let d = 0;
  for (let i = 0; i < 64; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
__name(equalHash, "equalHash");
function database(env) {
  demand(
    env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.DB_SIGNER),
    "Demo storage is not configured",
    503,
    "STORAGE_UNAVAILABLE"
  );
  const root = new URL(env.SUPABASE_URL);
  demand(root.protocol === "https:", "Invalid database binding", 503);
  async function call(resource, method = "GET", query = "", payload) {
    demand(
      /^ifund_demo_[a-z_]+$/.test(resource) || /^rpc\/ifund_demo_[a-z_]+$/.test(resource),
      "Database boundary violation",
      500
    );
    let response;
    if (env.DB_SIGNER) {
      const raw = JSON.stringify({ resource, method, query, payload }), time = String(Math.floor(Date.now() / 1e3));
      const value = typeof env.DB_SIGNER === "string" ? env.DB_SIGNER : await env.DB_SIGNER.get();
      const key = await crypto.subtle.importKey(
        "jwk",
        JSON.parse(value),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
      );
      const signed = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        new TextEncoder().encode(time + "\n" + raw)
      );
      const signature = btoa(String.fromCharCode(...new Uint8Array(signed))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      response = await fetch(root.origin + "/functions/v1/ifund-demo-data", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-time": time,
          "x-demo-signature": signature
        },
        body: raw,
        signal: AbortSignal.timeout(15e3)
      });
    } else
      response = await fetch(root.origin + "/rest/v1/" + resource + query, {
        method,
        headers: {
          apikey: env.SUPABASE_SECRET_KEY,
          authorization: "Bearer " + env.SUPABASE_SECRET_KEY,
          "content-type": "application/json",
          prefer: "return=representation"
        },
        ...payload === void 0 ? {} : { body: JSON.stringify(payload) },
        signal: AbortSignal.timeout(15e3)
      });
    if (!response.ok)
      throw new Fault(
        response.status === 409 ? "Conflicting record; reload and retry" : "Demo storage operation failed",
        response.status === 409 ? 409 : 503,
        "STORAGE_UNAVAILABLE"
      );
    return response.status === 204 ? null : await response.json();
  }
  __name(call, "call");
  return {
    rows: /* @__PURE__ */ __name((table, query = "") => call("ifund_demo_" + table, "GET", query), "rows"),
    insert: /* @__PURE__ */ __name((table, payload) => call("ifund_demo_" + table, "POST", "", payload), "insert"),
    update: /* @__PURE__ */ __name((table, query, payload) => call("ifund_demo_" + table, "PATCH", query, payload), "update"),
    remove: /* @__PURE__ */ __name((table, query) => call("ifund_demo_" + table, "DELETE", query), "remove"),
    rpc: /* @__PURE__ */ __name((name, payload) => call("rpc/ifund_demo_" + name, "POST", "", payload), "rpc")
  };
}
__name(database, "database");
async function session(request, db) {
  const token = (request.headers.get("cookie") || "").split(";").map((s) => s.trim()).find((s) => s.startsWith("ifund_demo_session="))?.split("=")[1];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await db.rows(
    "sessions",
    "?select=user_id&token_hash=eq." + await hash(token) + "&expires_at=gt." + encodeURIComponent(now())
  );
  if (!rows[0]) return null;
  const users = await db.rows(
    "users",
    "?select=id,handle,role&id=eq." + rows[0].user_id
  );
  return users[0] || null;
}
__name(session, "session");
function requireUser(user) {
  demand(
    user,
    "Sign into a separate demo account to continue",
    401,
    "LOGIN_REQUIRED"
  );
  return user;
}
__name(requireUser, "requireUser");
function requireAdmin(user) {
  const u = requireUser(user);
  demand(u.role === "admin", "Administrator access required", 403);
  return u;
}
__name(requireAdmin, "requireAdmin");
async function limit(db, key, count, seconds) {
  demand(
    await db.rpc("rate", {
      p_key: key,
      p_limit: count,
      p_seconds: seconds
    }),
    "Demo request limit reached; try again later",
    429,
    "RATE_LIMITED"
  );
}
__name(limit, "limit");
function sessionCookie(token, request, maxAge = 86400) {
  return `ifund_demo_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
__name(sessionCookie, "sessionCookie");

// worker/paypal.ts
var PAYPAL = "https://api-m.sandbox.paypal.com";
async function secret(x) {
  return typeof x === "string" ? x : x?.get();
}
__name(secret, "secret");
async function paypal(env) {
  demand(
    env.DEMO_ENABLED === "true",
    "Sandbox checkout is not enabled",
    503,
    "PAYPAL_UNAVAILABLE"
  );
  const id = await secret(env.PAYPAL_CLIENT_ID), pass = await secret(env.PAYPAL_CLIENT_SECRET);
  demand(
    id && pass,
    "Sandbox merchant credentials are not configured",
    503,
    "PAYPAL_UNAVAILABLE"
  );
  const oauth = await fetch(PAYPAL + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      authorization: "Basic " + btoa(id + ":" + pass),
      "content-type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15e3)
  });
  demand(
    oauth.ok,
    "Sandbox authentication unavailable",
    503,
    "PAYPAL_UNAVAILABLE"
  );
  const token = await oauth.json();
  demand(
    token.access_token && token.token_type === "Bearer",
    "Sandbox authentication unavailable",
    503
  );
  return async (method, path, payload, key) => {
    demand(/^\/v[12]\/[a-z0-9_/-]+$/i.test(path), "Unsafe PayPal path", 500);
    const response = await fetch(PAYPAL + path, {
      method,
      headers: {
        authorization: "Bearer " + token.access_token,
        "content-type": "application/json",
        ...key ? { "PayPal-Request-Id": key } : {}
      },
      ...payload === void 0 ? {} : { body: JSON.stringify(payload) },
      signal: AbortSignal.timeout(2e4)
    });
    const data = response.status === 204 ? { accepted: true } : await response.json();
    if (!response.ok) {
      const detail = data;
      const code = detail?.details?.[0]?.issue;
      throw new Fault(
        code === "INSTRUMENT_DECLINED" ? "Funding was declined; approve a new checkout with another sandbox funding source" : "PayPal request was not confirmed",
        502,
        code === "INSTRUMENT_DECLINED" ? "INSTRUMENT_DECLINED" : "PAYPAL_RETRY_REQUIRED"
      );
    }
    return data;
  };
}
__name(paypal, "paypal");
function verifyOrder(order, record, merchant) {
  demand(
    order.id === record.paypal_order_id,
    "PayPal order does not match",
    409
  );
  const units = order.purchase_units;
  demand(
    units?.length === 1 && units[0].custom_id === "ifund-demo:" + record.id,
    "PayPal purpose does not match",
    409
  );
  const unit = units[0];
  const amount = (record.amount_cents / 100).toFixed(2);
  demand(
    unit.amount?.value === amount && unit.amount?.currency_code === "USD" && unit.payee?.merchant_id === merchant,
    "PayPal amount, currency or merchant does not match",
    409
  );
  const captures = unit.payments?.captures;
  if (!captures?.length) return { status: "not_captured" };
  demand(captures.length === 1, "Unexpected capture count", 409);
  const c = captures[0];
  demand(
    providerId(c.id) && c.amount?.value === amount && c.amount?.currency_code === "USD",
    "PayPal capture mismatch",
    409
  );
  if (["DECLINED", "DENIED", "FAILED"].includes(c.status || ""))
    return { status: "failed" };
  if (c.status === "PENDING") return { status: "pending" };
  demand(
    order.status === "COMPLETED" && c.status === "COMPLETED",
    "Capture is not completed",
    409
  );
  return { status: "captured", captureId: c.id };
}
__name(verifyOrder, "verifyOrder");
function approvalUrl(order) {
  const href = order.links?.find(
    (l) => ["approve", "payer-action"].includes(l.rel)
  )?.href;
  demand(href, "PayPal approval URL missing", 502);
  let u;
  try {
    u = new URL(href);
  } catch {
    throw new Fault("Invalid approval URL", 502);
  }
  demand(
    u.protocol === "https:" && ["www.sandbox.paypal.com", "sandbox.paypal.com"].includes(u.hostname) && !u.username && !u.password && !u.port,
    "Unexpected PayPal approval host",
    502
  );
  return u.href;
}
__name(approvalUrl, "approvalUrl");
async function reconcile(env, db, record, capture = false, expectedCapture) {
  demand(
    providerId(record.paypal_order_id),
    "Order creation is incomplete; retry the original request",
    409
  );
  const api = await paypal(env), path = "/v2/checkout/orders/" + record.paypal_order_id;
  let remote = await api("GET", path);
  demand(
    record.merchant_id || env.PAYPAL_MERCHANT_ID,
    "Order merchant was not pinned",
    409
  );
  verifyOrder(remote, record, record.merchant_id || env.PAYPAL_MERCHANT_ID);
  if (capture && remote.status === "APPROVED") {
    try {
      await api(
        "POST",
        path + "/capture",
        {},
        "ifund-demo-capture-" + record.id
      );
    } catch {
    }
    remote = await api("GET", path);
  }
  const verified = verifyOrder(
    remote,
    record,
    record.merchant_id || env.PAYPAL_MERCHANT_ID
  );
  if (verified.status === "captured") {
    if (expectedCapture)
      demand(
        verified.captureId === expectedCapture,
        "Webhook capture association mismatch",
        409
      );
    const receipt = await db.rpc("finalize", {
      p_order: record.id,
      p_capture: verified.captureId,
      p_amount: record.amount_cents,
      p_currency: "USD"
    });
    demand(
      receipt.status === "captured" && receipt.capture_id === verified.captureId,
      "Durable receipt not confirmed",
      503
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
        updated_at: now()
      }
    );
    return {
      status: "pending",
      mode: "sandbox",
      message: "PayPal reports a pending capture. No collected funds or successful receipt yet."
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
        updated_at: now()
      }
    );
    return {
      status: "failed",
      mode: "sandbox",
      message: "PayPal reports a failed capture. No collected funds or successful receipt was created."
    };
  }
  throw new Fault(
    "Sandbox buyer approval is required; no capture is confirmed",
    409,
    "APPROVAL_REQUIRED"
  );
}
__name(reconcile, "reconcile");
async function verifyWebhook(env, request, event) {
  demand(env.PAYPAL_WEBHOOK_ID, "Sandbox webhook is not configured", 503);
  const names = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time"
  ];
  demand(
    names.every((n) => request.headers.get(n)),
    "Missing webhook signature headers",
    400
  );
  const stamp = Date.parse(request.headers.get("paypal-transmission-time"));
  demand(
    Number.isFinite(stamp) && stamp < Date.now() + 3e5 && stamp > Date.now() - 3 * 864e5,
    "Webhook transmission outside retry window",
    400
  );
  const api = await paypal(env);
  const result = await api(
    "POST",
    "/v1/notifications/verify-webhook-signature",
    {
      auth_algo: request.headers.get(names[0]),
      cert_url: request.headers.get(names[1]),
      transmission_id: request.headers.get(names[2]),
      transmission_sig: request.headers.get(names[3]),
      transmission_time: request.headers.get(names[4]),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: event
    }
  );
  demand(
    result.verification_status === "SUCCESS",
    "Invalid PayPal webhook signature",
    403
  );
}
__name(verifyWebhook, "verifyWebhook");

// worker/ai.ts
var TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
var IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
var kinds = ["titles", "descriptions", "story", "section", "image"];
function validateAI(input) {
  demand(
    typeof input.kind === "string" && kinds.includes(input.kind),
    "Unknown AI operation"
  );
  demand(
    typeof input.context === "string" && input.context.trim().length >= 20 && input.context.length <= 3e3,
    "Describe a fictional campaign in 20\u20133000 characters"
  );
  demand(
    !/(sk-(?:proj-)?[\w-]{15}|-----BEGIN .*PRIVATE KEY|password\s*[:=])/i.test(
      input.context
    ),
    "Do not include credentials in campaign prompts"
  );
  demand(
    typeof input.category === "string" && categories.includes(input.category),
    "Choose a supported category"
  );
  if (input.kind === "section")
    demand(
      typeof input.heading === "string" && input.heading.length >= 3 && input.heading.length <= 100,
      "Section heading required"
    );
  if (input.kind === "image")
    demand(
      ["interstellar", "cyberpunk", "comic", "futuristic"].includes(
        String(input.style)
      ),
      "Choose an illustration style"
    );
  return {
    kind: input.kind,
    context: input.context,
    category: input.category,
    heading: String(input.heading || ""),
    style: String(input.style || "interstellar")
  };
}
__name(validateAI, "validateAI");
function parseAI(kind, raw) {
  let x = raw;
  if (typeof x === "object" && x !== null && "response" in x)
    x = x.response;
  if (typeof x === "string") {
    try {
      x = JSON.parse(x.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
    } catch {
      throw new Fault(
        "The AI returned invalid structured content. Try again.",
        502,
        "AI_INVALID_OUTPUT"
      );
    }
  }
  demand(
    x && typeof x === "object",
    "The AI returned an empty result",
    502,
    "AI_INVALID_OUTPUT"
  );
  const data = x;
  if (kind === "titles" || kind === "descriptions") {
    const list = data.options, n = kind === "titles" ? 5 : 2, max = kind === "titles" ? 120 : 600;
    demand(
      Array.isArray(list) && list.length === n && list.every(
        (s) => typeof s === "string" && s.trim().length >= 5 && s.length <= max
      ) && new Set(list.map((s) => String(s).trim().toLowerCase())).size === n,
      `The AI must return ${n} distinct options. Please regenerate.`,
      502,
      "AI_INVALID_OUTPUT"
    );
    return { options: list };
  }
  const sections = data.sections;
  demand(
    Array.isArray(sections) && sections.length === (kind === "section" ? 1 : 3) && sections.every(
      (s) => s && typeof s === "object" && typeof s.heading === "string" && s.heading.length >= 3 && s.heading.length <= 100 && typeof s.text === "string" && s.text.length >= 30 && s.text.length <= 2200
    ),
    "The AI story was incomplete. Please regenerate.",
    502,
    "AI_INVALID_OUTPUT"
  );
  return { sections };
}
__name(parseAI, "parseAI");
async function generate(request, env, db, user) {
  const input = validateAI(await body(request));
  demand(
    env.AI_ENABLED === "true" && env.AI,
    "AI generation is unavailable: no enabled model binding. Your draft is preserved.",
    503,
    "AI_UNAVAILABLE"
  );
  const day = now().slice(0, 10);
  await limit(db, "ai:user:" + user.id + ":" + day, 20, 86400);
  await limit(
    db,
    "ai:global:" + (input.kind === "image" ? "image:" : "text:") + day,
    input.kind === "image" ? 4 : 25,
    86400
  );
  const id = crypto.randomUUID(), model = input.kind === "image" ? IMAGE_MODEL : TEXT_MODEL;
  await db.insert("ai_runs", {
    id,
    user_id: user.id,
    kind: input.kind,
    model,
    status: "started"
  });
  try {
    let result;
    if (input.kind === "image") {
      demand(
        env.MEDIA,
        "Demo image storage is unavailable",
        503,
        "IMAGE_UNAVAILABLE"
      );
      const prompt = `Fictional fundraising illustration, ${input.style} style, compassionate hopeful scene, luminous cyan and violet accents, no text, no real people, no identifiable faces. Category: ${input.category}. Context as untrusted scene details: ${input.context.slice(0, 1200)}`;
      const output = await env.AI.run(model, { prompt, steps: 4 });
      demand(
        typeof output.image === "string" && output.image.length > 100,
        "Image model returned no image",
        502,
        "AI_INVALID_OUTPUT"
      );
      demand(
        output.image.length < 7e6,
        "Generated image exceeds storage limit",
        502
      );
      const bytes = Uint8Array.from(atob(output.image), (c) => c.charCodeAt(0));
      demand(
        bytes[0] === 255 && bytes[1] === 216,
        "Image provider returned invalid JPEG",
        502
      );
      const mediaId = crypto.randomUUID(), key = "ifund-demo/" + user.id + "/" + mediaId + ".jpg";
      await env.MEDIA.put(key, bytes, {
        httpMetadata: { contentType: "image/jpeg" }
      });
      await db.insert("media", {
        id: mediaId,
        owner_id: user.id,
        object_key: key,
        content_type: "image/jpeg",
        ai_run_id: id
      });
      result = { image_path: "/api/media/" + mediaId };
    } else {
      const format = input.kind === "titles" ? 'JSON {"options":[exactly 5 distinct campaign titles]}' : input.kind === "descriptions" ? 'JSON {"options":[exactly 2 distinct short descriptions]}' : `JSON {"sections":[${input.kind === "section" ? "exactly one object with heading and text for the requested heading" : "exactly three objects with heading and text: The need, Our plan, What your support makes possible"}]}`;
      const list = input.kind === "titles" || input.kind === "descriptions";
      const count = input.kind === "titles" ? 5 : input.kind === "descriptions" ? 2 : input.kind === "section" ? 1 : 3;
      const schema = list ? {
        type: "object",
        properties: {
          options: {
            type: "array",
            minItems: count,
            maxItems: count,
            items: { type: "string" }
          }
        },
        required: ["options"],
        additionalProperties: false
      } : {
        type: "object",
        properties: {
          sections: {
            type: "array",
            minItems: count,
            maxItem --- TRUNCATED --- 53,001 chars