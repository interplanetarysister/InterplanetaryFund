import { handlePayPalWebhook } from "./paypalWebhook.js";
import { paypalReadiness } from "./paypalRouting.js";
import { handleUnifiedPayPalWebhook } from "./paypalInbox.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health")
      return Response.json(
        { status: "ok", service: "ifund-migration-api", production: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (url.pathname === "/api/paypal/readiness" && request.method === "GET")
      return Response.json(paypalReadiness(env), {
        headers: { "Cache-Control": "no-store" },
      });
    if (url.pathname === "/api/paypal/unified-webhook")
      return handleUnifiedPayPalWebhook(request, env);
    if (url.pathname === "/api/paypal/webhook") {
      // This staged support handler is NOT the unified campaign or subscription
      // ledger. It must stay disabled until merchant + receipt parity is proven.
      if (!paypalReadiness(env).platform_support)
        return Response.json({ error: "PayPal support reconciliation disabled" }, {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        });
      return handlePayPalWebhook(request, env);
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
