import { handlePayPalWebhook } from "./paypalWebhook.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health")
      return Response.json(
        { status: "ok", service: "ifund-migration-api", production: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (url.pathname === "/api/paypal/webhook")
      return handlePayPalWebhook(request, env);
    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
