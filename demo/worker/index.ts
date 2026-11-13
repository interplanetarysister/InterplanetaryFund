import type { Campaign, DemoEnv, Order, ProviderOrder, User } from "./types.ts";
import {
  body,
  database,
  demand,
  Fault,
  hash,
  json,
  limit,
  now,
  passwordHash,
  equalHash,
  randomToken,
  requireAdmin,
  requireUser,
  sameOrigin,
  session,
  sessionCookie,
  uuid,
  providerId,
  type DB,
} from "./core.ts";
import { approvalUrl, paypal, paypalCardClientToken, reconcile, verifyWebhook } from "./paypal.ts";
import { generate } from "./ai.ts";
import { googlePayPage, googlePayScript } from "./googlepay-ui.js";
import { judgeGuideHtml, judgeGuideCss, judgeGuideScript } from "./judge-embedded-guide.js";
import {
  campaignInput,
  publicCampaignFields,
  validateMediaAndAI,
  withTotals,
} from "./campaigns.ts";

export async function handle(
  request: Request,
  env: DemoEnv,
): Promise<Response> {
  const u = new URL(request.url),
    path = u.pathname;
  if (request.method === "GET" && (path === "/google-pay" || path === "/google-pay.js")) {
    if (u.origin !== env.DEMO_ORIGIN) return new Response("Invalid sandbox origin", {status:403});
    const isScript = path.endsWith(".js");
    return new Response(isScript ? googlePayScript : googlePayPage, {
      headers: { "content-type": isScript ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8",
        "cache-control": "no-store", "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'self'; script-src 'self' https://*.paypal.com https://*.paypalobjects.com https://pay.google.com https://*.google.com; connect-src 'self' https://*.paypal.com https://*.paypalobjects.com https://pay.google.com https://*.google.com; img-src 'self' data: https://*.paypal.com https://*.paypalobjects.com https://pay.google.com; style-src 'self' 'unsafe-inline' https://*.paypal.com; frame-src 'self' https://*.paypal.com https://pay.google.com https://*.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
      }
    });
  }
  // The walkthrough is an entirely separate, read-only interface surrounding
  // the unchanged sandbox React app. Instructions occupy space outside the iframe,
  // so no step card can obscure or intercept highlighted demo controls.
  if (request.method === "GET" && path.startsWith("/api/judge-guide")) {
    const type = path === "/api/judge-guide" ? "text/html; charset=utf-8"
      : path === "/api/judge-guide.js" ? "text/javascript; charset=utf-8"
      : path === "/api/judge-guide.css" ? "text/css; charset=utf-8" : null;
    if (type) {
      const text = path.endsWith(".js") ? judgeGuideScript
        : path.endsWith(".css") ? judgeGuideCss
        : judgeGuideHtml.replace("</body>", '<p><a href="/google-pay">Try Google Pay (sandbox-only test checkout)</a></p></body>');
      const headers: Record<string,string> = {
        "content-type": type, "cache-control": "no-store",
        "x-content-type-options": "nosniff", "referrer-policy": "same-origin",
        "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
      };
      return new Response(text, { status:200, headers });
    }
  }
  if (!path.startsWith("/api/")) {
    const res = env.ASSETS
      ? await env.ASSETS.fetch(request)
      : new Response("Build the frontend first", { status: 503 });
    const headers = new Headers(res.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "same-origin");
    headers.set(
      "content-security-policy",
      "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://*.paypal.com https://*.paypalobjects.com; connect-src 'self' https://*.paypal.com https://*.paypalobjects.com; img-src 'self' data: blob: https://*.paypal.com https://*.paypalobjects.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.paypal.com https://*.paypalobjects.com; font-src 'self' https://fonts.gstatic.com https://*.paypalobjects.com; frame-src 'self' https://*.paypal.com https://*.paypalobjects.com; object-src 'none'; base-uri 'self'; form-action 'self' https://*.paypal.com; frame-ancestors 'self'",
    );
    if (!path.startsWith("/embed/"))
      headers.set("x-frame-options", "SAMEORIGIN");
    else
      headers.set(
        "content-security-policy",
        headers
          .get("content-security-policy")!
          .replace("frame-ancestors 'self'", "frame-ancestors *"),
      );
    return new Response(res.body, { status: res.status, headers });
  }
  try {
    if (path === "/api/status" && request.method === "GET")
      return json({
        mode: "sandbox",
        configured: !!(
          env.SUPABASE_URL &&
          (env.SUPABASE_SECRET_KEY || env.DB_SIGNER)
        ),
        payments_configured:
          env.DEMO_ENABLED === "true" &&
          !!env.PAYPAL_CLIENT_ID &&
          !!env.PAYPAL_CLIENT_SECRET &&
          !!env.PAYPAL_WEBHOOK_ID,
        ai_configured: env.AI_ENABLED === "true" && !!env.AI,
        media_configured: !!env.MEDIA,
        release_sha: env.RELEASE_SHA || "NOT_DEPLOYED",
        withdrawals_enabled: false,
        subscriptions_enabled: false,
        provider_acceptance: "PROVIDER_CAPTURE_AND_SIGNATURE_VERIFIED__FULL_BUYER_REPLAY_PENDING",
      });
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
      path !== "/api/paypal/webhook"
    )
      sameOrigin(request, env);
    // A mismatched deployment cannot accidentally operate against a configured demo database.
    demand(u.origin === env.DEMO_ORIGIN, "Demo origin is not configured", 503);
    const db = database(env);
    if (path === "/api/paypal/webhook" && request.method === "POST")
      return await webhook(request, env, db);
    const user = await session(request, db);
    if (path === "/api/google-pay/config" && request.method === "GET") {
      requireUser(user);
      demand(env.DEMO_ENABLED === "true", "Sandbox payments are disabled", 503);
      const clientId = typeof env.PAYPAL_CLIENT_ID === "string"
        ? env.PAYPAL_CLIENT_ID : await env.PAYPAL_CLIENT_ID?.get();
      demand(clientId, "Sandbox Google Pay merchant is not configured", 503);
      return json({environment:"sandbox",client_id:clientId},200,{"cache-control":"no-store"});
    }
    if (path === "/api/session" && request.method === "GET")
      return json({ user });
    if (
      (path === "/api/auth/register" && request.method === "POST") ||
      (path === "/api/auth/login" && request.method === "POST")
    ) {
      const input = await body(request);
      demand(
        typeof input.handle === "string" &&
          /^[a-z0-9_]{3,30}$/.test(input.handle),
        "Use a fictional handle: 3–30 lowercase letters, digits or underscores",
      );
      demand(
        typeof input.password === "string" &&
          input.password.length >= 12 &&
          input.password.length <= 128,
        "Use a separate demo password of 12–128 characters",
      );
      const ip = await hash(request.headers.get("cf-connecting-ip") || "local");
      await limit(db, "auth-ip:" + ip, 15, 900);
      await limit(db, "auth-handle:" + input.handle, 10, 900);
      let found: User & { password_hash: string; salt: string };
      if (path.endsWith("register")) {
        const salt = randomToken();
        const rows = await db.insert<
          User & { password_hash: string; salt: string }
        >("users", {
          handle: input.handle,
          salt,
          password_hash: await passwordHash(input.password, salt),
        });
        found = rows[0];
      } else {
        const rows = await db.rows<
          User & { password_hash: string; salt: string }
        >("users", "?handle=eq." + input.handle + "&limit=1");
        const candidate = await passwordHash(
          input.password,
          rows[0]?.salt || "00000000000000000000000000000000",
        );
        demand(
          rows[0] && equalHash(candidate, rows[0].password_hash),
          "Demo login was not accepted",
          401,
        );
        found = rows[0];
      }
      const token = randomToken();
      await db.insert("sessions", {
        token_hash: await hash(token),
        user_id: found.id,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });
      return json(
        { user: { id: found.id, handle: found.handle, role: found.role } },
        200,
        { "set-cookie": sessionCookie(token, request) },
      );
    }
    if (path === "/api/auth/logout" && request.method === "POST") {
      const token = (request.headers.get("cookie") || "").match(
        /(?:^|;\s*)ifund_demo_session=([a-f0-9]{64})/,
      )?.[1];
      if (token)
        await db.remove("sessions", "?token_hash=eq." + (await hash(token)));
      return json({ ok: true }, 200, {
        "set-cookie": sessionCookie("", request, 0),
      });
    }
    if (path === "/api/ai/generate" && request.method === "POST")
      return json(await generate(request, env, db, requireUser(user)));
    if (path === "/api/campaigns" && request.method === "GET") {
      const mine = u.searchParams.get("mine") === "1";
      if (mine) requireUser(user);
      const campaigns = await db.rows<Campaign>(
        "campaigns",
        "?select=" +
          publicCampaignFields +
          (mine ? "&owner_id=eq." + user!.id : "&status=eq.published") +
          "&order=created_at.desc&limit=200",
      );
      return json({ campaigns: await withTotals(db, campaigns) });
    }
    const focusMatch = path.match(/^\/api\/campaigns\/([0-9a-f-]{36})\/focus$/);
    if (focusMatch && request.method === "GET") {
      const found = await db.rows<{ id: string }>(
        "campaigns",
        "?select=id&id=eq." + focusMatch[1] + "&status=eq.published&fictional=eq.true&limit=1",
      );
      demand(found.length > 0, "Fictional campaign not found", 404);
      const focus = await db.rpc("campaign_focus", { p_campaign: focusMatch[1] });
      return json({ focus });
    }
    const campaignMatch = path.match(/^\/api\/campaigns\/([0-9a-f-]{36})$/);
    if (campaignMatch && request.method === "GET") {
      const rows = await db.rows<Campaign>(
        "campaigns",
        "?select=" + publicCampaignFields + "&id=eq." + campaignMatch[1],
      );
      demand(
        rows[0] &&
          (rows[0].status === "published" ||
            rows[0].owner_id === user?.id ||
            user?.role === "admin"),
        "Campaign not found",
        404,
      );
      return json({ campaign: (await withTotals(db, rows))[0] });
    }
    if (
      (path === "/api/campaigns" && request.method === "POST") ||
      (campaignMatch && request.method === "PATCH")
    ) {
      const actor = requireUser(user),
        raw = await body(request);
      await limit(db, "campaign-write:" + actor.id, 30, 3600);
      const input = campaignInput(raw);
      await validateMediaAndAI(db, actor, input);
      if (campaignMatch) {
        demand(Number.isSafeInteger(raw.version), "Campaign version required");
        const rows = await db.update<Campaign>(
          "campaigns",
          `?id=eq.${campaignMatch[1]}&owner_id=eq.${actor.id}&version=eq.${raw.version}`,
          { ...input, version: Number(raw.version) + 1, updated_at: now() },
        );
        demand(
          rows[0],
          "Campaign changed or is owned by another demo account",
          409,
        );
        return json({ campaign: rows[0] });
      }
      const rows = await db.insert<Campaign>("campaigns", {
        ...input,
        owner_id: actor.id,
      });
      return json({ campaign: rows[0] }, 201);
    }
    const profile = path.match(/^\/api\/organizers\/([0-9a-f-]{36})$/);
    if (profile && request.method === "GET") {
      const campaigns = await db.rows<Campaign>(
        "campaigns",
        `?select=${publicCampaignFields}&owner_id=eq.${profile[1]}&status=eq.published&limit=100`,
      );
      demand(campaigns.length, "No public demo organizer found", 404);
      return json({ campaigns: await withTotals(db, campaigns) });
    }
    if (path === "/api/media" && request.method === "POST")
      return await upload(request, env, db, requireUser(user));
    const media = path.match(/^\/api\/media\/([0-9a-f-]{36})$/);
    if (media && request.method === "GET") {
      demand(env.MEDIA, "Demo media storage is unavailable", 503);
      const rows = await db.rows<{
        object_key: string;
        content_type: string;
        owner_id: string;
      }>("media", "?id=eq." + media[1]);
      demand(rows[0], "Image not found", 404);
      if (rows[0].owner_id !== user?.id) {
        const campaigns = await db.rows<{ id: string }>(
          "campaigns",
          `?select=id&status=eq.published&image_path=eq.${encodeURIComponent("/api/media/" + media[1])}&limit=1`,
        );
        demand(campaigns.length, "Image not found", 404);
      }
      const object = await env.MEDIA.get(rows[0].object_key);
      demand(object, "Image not found", 404);
      return new Response(object.body, {
        headers: {
          "content-type": rows[0].content_type,
          "cache-control": "private, max-age=60",
          "x-content-type-options": "nosniff",
        },
      });
    }
    if (path === "/api/paypal/browser-token" && request.method === "GET") {
      const actor = requireUser(user);
      await limit(db, "card-token:" + actor.id, 15, 3600);
      const clientToken = await paypalCardClientToken(env);
      return json({ clientToken }, 200, { "cache-control": "no-store" });
    }
    if (path === "/api/paypal/status" && request.method === "GET") {
      const actor = requireUser(user);
      await limit(db, "provider-status:" + actor.id, 5, 300);
      const api = await paypal(env);
      demand(env.PAYPAL_WEBHOOK_ID, "Webhook binding missing", 503);
      const wh = await api<{
        id: string;
        url: string;
        event_types: { name: string }[];
      }>("GET", "/v1/notifications/webhooks/" + env.PAYPAL_WEBHOOK_ID);
      return json({
        oauth_verified: true,
        webhook_registered:
          wh.id === env.PAYPAL_WEBHOOK_ID &&
          wh.url === env.DEMO_ORIGIN + "/api/paypal/webhook" &&
          wh.event_types.some(
            (e) => e.name === "PAYMENT.CAPTURE.COMPLETED" || e.name === "*",
          ),
        mode: "sandbox",
      });
    }
    if (path === "/api/paypal/orders" && request.method === "POST")
      return await createOrder(request, env, db, requireUser(user));
    const orderMatch = path.match(
      /^\/api\/paypal\/orders\/([0-9a-f-]{36})\/(capture|reconcile|cancel)$/,
    );
    if (orderMatch && request.method === "POST") {
      const actor = requireUser(user),
        rows = await db.rows<Order>(
          "orders",
          "?id=eq." + orderMatch[1] + "&user_id=eq." + actor.id,
        );
      demand(rows[0], "Demo order not found", 404);
      await limit(db, "capture:" + actor.id, 30, 600);
      const record = rows[0];
      if (orderMatch[2] === "cancel") {
        // Cancellation is a UI state only; it must never erase a provider-backed capture.
        await db.update(
          "orders",
          "?id=eq." +
            record.id +
            "&status=in.(creating,created)&paypal_capture_id=is.null",
          { status: "cancelled", updated_at: now() },
        );
        return json({
          status: "cancelled",
          message: "Checkout cancelled. No successful payment is inferred.",
        });
      }
      try {
        return json(
          await reconcile(env, db, record, orderMatch[2] === "capture"),
        );
      } catch (e) {
        await db.update(
          "orders",
          "?id=eq." + record.id + "&paypal_capture_id=is.null",
          {
            reconciliation: "retry_required",
            failure_code: e instanceof Fault ? e.code : "PROVIDER_ERROR",
            updated_at: now(),
          },
        );
        throw e;
      }
    }
    if (path === "/api/finance" && request.method === "GET")
      return await finance(u, db, requireUser(user));
    const receipt = path.match(/^\/api\/receipts\/([0-9a-f-]{36})$/);
    if (receipt && request.method === "GET") {
      const actor = requireUser(user),
        receipts = await db.rows<{
          id: string;
          capture_id: string;
          issued_at: string;
          disclosure: string;
        }>("receipts", "?id=eq." + receipt[1]);
      demand(receipts[0], "Receipt not found", 404);
      const orders = await db.rows<Order>(
        "orders",
        "?paypal_capture_id=eq." + encodeURIComponent(receipts[0].capture_id),
      );
      const order = orders[0];
      demand(order, "Receipt not found", 404);
      const campaigns = order.campaign_id
        ? await db.rows<Campaign>("campaigns", "?id=eq." + order.campaign_id)
        : [];
      demand(
        order.user_id === actor.id ||
          actor.role === "admin" ||
          campaigns[0]?.owner_id === actor.id,
        "Receipt not found",
        404,
      );
      return json({
        receipt: {
          ...receipts[0],
          ...order,
          title:
            campaigns[0]?.title || "Support Interplanetary Fund — Sandbox Demo",
        },
      });
    }
    if (path === "/api/admin/tracker" && request.method === "GET") {
      requireAdmin(user);
      return json({
        gates: await db.rows("tracker", "?order=gate"),
        ai_runs: await db.rows(
          "ai_runs",
          "?select=id,kind,model,status,outcome,started_at,completed_at&order=started_at.desc&limit=50",
        ),
        events: await db.rows("events", "?order=verified_at.desc&limit=50"),
        release_sha: env.RELEASE_SHA || "NOT_DEPLOYED",
      });
    }
    if (path === "/api/admin/tracker" && request.method === "PATCH") {
      const actor = requireAdmin(user),
        input = await body(request);
      demand(
        typeof input.gate === "string" &&
          /^[a-z_]{3,40}$/.test(input.gate) &&
          ["PASS", "FAIL", "BLOCKED", "NOT VERIFIED"].includes(
            String(input.status),
          ),
        "Invalid gate",
      );
      demand(
        typeof input.result === "string" &&
          input.result.length >= 10 &&
          input.result.length <= 2000,
        "Describe the actual test outcome",
      );
      let url: URL | null = null;
      if (input.evidence_url) {
        try {
          url = new URL(String(input.evidence_url));
        } catch {
          throw new Fault("Evidence must be an HTTPS URL");
        }
        demand(
          url.protocol === "https:" && !url.username && !url.password,
          "Evidence must be a public-safe HTTPS URL",
        );
      }
      demand(input.status !== "PASS" || url, "PASS requires an evidence link");
      demand(Number.isInteger(input.version), "Version required");
      const rows = await db.update(
        "tracker",
        `?gate=eq.${input.gate}&version=eq.${input.version}`,
        {
          status: input.status,
          result: input.result,
          evidence_url: url?.href || null,
          commit_sha: env.RELEASE_SHA || null,
          updated_by: actor.id,
          updated_at: now(),
          version: Number(input.version) + 1,
        },
      );
      demand(rows.length, "Tracker changed; reload", 409);
      return json({ gates: rows });
    }
    if (path === "/api/admin/reconcile" && request.method === "POST") {
      requireAdmin(user);
      return json(await sweep(env, db));
    }
    if (path === "/api/admin/paypal/replay" && request.method === "POST") {
      const actor = requireAdmin(user),
        input = await body(request);
      demand(
        providerId(input.event_id),
        "A verified demo event ID is required",
      );
      await limit(db, "webhook-replay:" + actor.id, 5, 300);
      const events = await db.rows<{ order_id: string | null }>(
        "events",
        "?event_id=eq." + input.event_id,
      );
      demand(
        events[0]?.order_id,
        "Only associated, previously verified demo events can be replayed",
        404,
      );
      demand(env.PAYPAL_WEBHOOK_ID, "Demo webhook binding required", 503);
      const api = await paypal(env);
      await api(
        "POST",
        "/v1/notifications/webhooks-events/" + input.event_id + "/resend",
        { webhook_ids: [env.PAYPAL_WEBHOOK_ID] },
      );
      return json({
        accepted: true,
        mode: "sandbox",
        event_id: input.event_id,
        note: "Provider redelivery requested. Verify delivery_count and unchanged financial record counts separately.",
      });
    }
    if (path === "/api/admin/setup/paypal" && request.method === "POST") {
      requireAdmin(user);
      demand(env.SETUP_ENABLED === "true", "Setup is disabled", 404);
      const input = await body(request),
        api = await paypal(env);
      const existing = await api<{
        webhooks: {
          id: string;
          url: string;
          event_types: { name: string }[];
        }[];
      }>("GET", "/v1/notifications/webhooks");
      if (input.action === "inspect")
        return json({
          webhooks: existing.webhooks.map((w) => ({
            id: w.id,
            url: w.url,
            event_types: w.event_types,
          })),
        });
      demand(input.action === "register", "Invalid setup action");
      const endpoint = env.DEMO_ORIGIN + "/api/paypal/webhook";
      const found = existing.webhooks.find((w) => w.url === endpoint);
      if (found) return json({ id: found.id, url: found.url, reused: true });
      const created = await api<{ id: string; url: string }>(
        "POST",
        "/v1/notifications/webhooks",
        {
          url: endpoint,
          event_types: [
            { name: "PAYMENT.CAPTURE.COMPLETED" },
            { name: "PAYMENT.CAPTURE.PENDING" },
            { name: "PAYMENT.CAPTURE.DENIED" },
          ],
        },
      );
      return json({ id: created.id, url: created.url, reused: false });
    }
    throw new Fault("Demo route not found", 404);
  } catch (e) {
    const fault =
      e instanceof Fault
        ? e
        : new Fault(
            "Service unavailable. No successful operation has been inferred.",
            503,
            "UNAVAILABLE",
          );
    return json({ error: fault.message, code: fault.code }, fault.status);
  }
}

async function createOrder(request: Request, env: DemoEnv, db: DB, user: User) {
  const input = await body(request);
  const method = input.checkout_method === undefined ? "paypal" : input.checkout_method;
  demand(typeof method === "string" && ["paypal", "card", "googlepay"].includes(method), "Invalid sandbox checkout method");
  demand(uuid(input.key), "A checkout idempotency key is required");
  demand(
    input.purpose === "campaign" || input.purpose === "platform_support",
    "Choose a payment purpose",
  );
  demand(
    Number.isSafeInteger(input.amount_cents) &&
      Number(input.amount_cents) >= 100 &&
      Number(input.amount_cents) <= 10000,
    "Choose a sandbox amount between $1 and $100",
  );
  demand(
    input.purpose === "campaign"
      ? uuid(input.campaign_id)
      : input.campaign_id === null,
    "Invalid campaign attribution",
  );
  await limit(db, "order:" + user.id, 20, 3600);
  if (input.campaign_id) {
    const campaigns = await db.rows<Campaign>(
      "campaigns",
      "?id=eq." + input.campaign_id + "&status=eq.published",
    );
    demand(
      campaigns[0]?.fictional,
      "Published fictional demo campaign required",
      409,
    );
  }
  const query = `?user_id=eq.${user.id}&create_key=eq.${input.key}`;
  let records = await db.rows<Order>("orders", query);
  if (!records[0]) {
    try {
      records = await db.insert<Order>("orders", {
        user_id: user.id,
        create_key: input.key,
        purpose: input.purpose,
        campaign_id: input.campaign_id,
        checkout_method: method,
        amount_cents: input.amount_cents,
      });
    } catch (e) {
      if (!(e instanceof Fault) || e.status !== 409) throw e;
      records = await db.rows<Order>("orders", query);
    }
  }
  const record = records[0];
  demand(record, "Unable to persist checkout intent", 503);
  demand(
    record.purpose === input.purpose &&
      record.campaign_id === input.campaign_id &&
      record.amount_cents === input.amount_cents &&
      (record.checkout_method || "paypal") === method,
    "This checkout key is bound to another amount or purpose",
    409,
  );
  // An existing card intent never creates a second PayPal order on retry.
  if (record.paypal_order_id)
    return json({
      id: record.id,
      paypal_order_id: record.paypal_order_id,
      approval_url: record.approval_url,
      status: record.status,
      checkout_method: method,
    });
  const api = await paypal(env);
  demand(env.PAYPAL_WEBHOOK_ID, "Sandbox webhook is not configured", 503);
  const wh = await api<{
    id: string;
    url: string;
    event_types: { name: string }[];
  }>("GET", "/v1/notifications/webhooks/" + env.PAYPAL_WEBHOOK_ID);
  demand(
    wh.id === env.PAYPAL_WEBHOOK_ID &&
      wh.url === env.DEMO_ORIGIN + "/api/paypal/webhook" &&
      wh.event_types.some((e) =>
        ["*", "PAYMENT.CAPTURE.COMPLETED"].includes(e.name),
      ),
    "Sandbox webhook registration does not match this independent demo",
    503,
  );
  const remote = await api<ProviderOrder>(
    "POST",
    "/v2/checkout/orders",
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: "ifund-demo:" + record.id,
          description: "IFund fictional sandbox " + record.purpose,
          ...(env.PAYPAL_MERCHANT_ID
            ? { payee: { merchant_id: env.PAYPAL_MERCHANT_ID } }
            : {}),
          amount: {
            currency_code: "USD",
            value: (record.amount_cents / 100).toFixed(2),
          },
        },
      ],
      ...(method === "paypal"
        ? {
            payment_source: {
              paypal: {
                experience_context: {
                  brand_name: "Interplanetary Fund Sandbox",
                  user_action: "PAY_NOW",
                  return_url:
                    env.DEMO_ORIGIN + "/checkout?id=" + record.id + "&paypal=approved",
                  cancel_url:
                    env.DEMO_ORIGIN + "/checkout?id=" + record.id + "&paypal=cancelled",
                },
              },
            },
          }
        : {}),
    },
    "ifund-demo-create-" + record.id,
  );
  demand(
    providerId(remote.id) &&
      ["CREATED", "PAYER_ACTION_REQUIRED", "APPROVED"].includes(
        remote.status || "",
      ),
    "PayPal order creation not confirmed",
    502,
  );
  const url = method === "paypal" ? approvalUrl(remote) : null;
  const detailed = await api<ProviderOrder>(
    "GET",
    "/v2/checkout/orders/" + remote.id,
  );
  const merchant = detailed.purchase_units?.[0]?.payee?.merchant_id;
  demand(providerId(merchant), "Provider merchant identity missing", 502);
  if (env.PAYPAL_MERCHANT_ID)
    demand(
      merchant === env.PAYPAL_MERCHANT_ID,
      "Sandbox merchant mismatch",
      409,
    );
  const saved = await db.update<Order>(
    "orders",
    "?id=eq." + record.id + "&paypal_order_id=is.null",
    {
      paypal_order_id: remote.id,
      merchant_id: merchant,
      status: "created",
      approval_url: url,
      updated_at: now(),
    },
  );
  if (!saved.length) {
    const current = await db.rows<Order>("orders", "?id=eq." + record.id);
    demand(
      current[0]?.paypal_order_id === remote.id,
      "Order persistence conflict",
      409,
    );
  }
  return json(
    {
      id: record.id,
      paypal_order_id: remote.id,
      approval_url: url,
      checkout_method: method,
      status: "created",
    },
    201,
  );
}

async function webhook(request: Request, env: DemoEnv, db: DB) {
  const event = await body(request, 65536);
  await verifyWebhook(env, request, event);
  demand(
    providerId(event.id) && typeof event.event_type === "string",
    "Invalid webhook event",
  );
  const digest = await hash(JSON.stringify(event)),
    seen = await db.rows<{ payload_hash: string }>(
      "events",
      "?event_id=eq." + event.id,
    );
  if (seen[0]) {
    demand(seen[0].payload_hash === digest, "Webhook ID payload conflict", 409);
    const deliveries = await db.rpc<number>("event_replay", {
      p_event: event.id,
      p_hash: digest,
    });
    return json({ ok: true, duplicate: true, verified_deliveries: deliveries });
  }
  const resource = event.resource as
    | {
        id?: string;
        supplementary_data?: { related_ids?: { order_id?: string } };
      }
    | undefined;
  const providerOrder = resource?.supplementary_data?.related_ids?.order_id;
  let order: Order | undefined;
  if (
    event.event_type === "PAYMENT.CAPTURE.COMPLETED" ||
    event.event_type === "PAYMENT.CAPTURE.PENDING"
  ) {
    demand(providerId(providerOrder), "Webhook order association missing");
    const records = await db.rows<Order>(
      "orders",
      "?paypal_order_id=eq." + providerOrder,
    );
    order = records[0];
    if (order) {
      demand(providerId(resource?.id), "Webhook capture ID missing");
      await reconcile(env, db, order, false, resource.id);
    }
  }
  try {
    await db.insert("events", {
      event_id: event.id,
      event_type: event.event_type,
      payload_hash: digest,
      order_id: order?.id || null,
    });
  } catch (e) {
    if (!(e instanceof Fault) || e.status !== 409) throw e;
    const current = await db.rows<{ payload_hash: string }>(
      "events",
      "?event_id=eq." + event.id,
    );
    demand(current[0]?.payload_hash === digest, "Webhook conflict", 409);
  }
  return json({ ok: true, associated: !!order });
}

async function finance(url: URL, db: DB, user: User) {
  const view = url.searchParams.get("view") || "donor";
  demand(
    ["donor", "organizer", "admin"].includes(view),
    "Unknown financial view",
  );
  if (view === "admin") requireAdmin(user);
  return json(await db.rpc("finance", { p_user: user.id, p_view: view }));
}

async function upload(request: Request, env: DemoEnv, db: DB, user: User) {
  demand(env.MEDIA, "Demo image storage is unavailable", 503);
  await limit(db, "upload:" + user.id, 12, 3600);
  const type = request.headers.get("content-type");
  demand(
    type && ["image/jpeg", "image/png", "image/webp"].includes(type),
    "Upload a JPEG, PNG or WebP image",
    415,
  );
  const reader = request.body?.getReader();
  demand(reader, "Image required");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      demand(
        length <= 2 * 1024 * 1024,
        "Images must be smaller than 2 MB",
        413,
      );
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
  const valid =
    type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216
      : type === "image/png"
        ? bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
        : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
          new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  demand(valid, "Image signature does not match content type");
  const id = crypto.randomUUID(),
    key = "ifund-demo/" + user.id + "/" + id;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type } });
  await db.insert("media", {
    id,
    owner_id: user.id,
    object_key: key,
    content_type: type,
  });
  return json({ image_path: "/api/media/" + id }, 201);
}
export async function sweep(env: DemoEnv, db = database(env)) {
  const records = await db.rows<Order>(
    "orders",
    "?paypal_order_id=not.is.null&status=in.(created,pending,cancelled)&order=updated_at.asc&limit=10",
  );
  let verified = 0,
    unresolved = 0;
  for (const record of records) {
    try {
      const r = await reconcile(env, db, record, false);
      if (r.status === "captured") verified++;
      else unresolved++;
    } catch {
      unresolved++;
    }
  }
  return { checked: records.length, verified, unresolved };
}
export default {
  fetch: handle,
  async scheduled(_event: unknown, env: DemoEnv) {
    if (env.DEMO_ENABLED === "true") await sweep(env);
  },
};
