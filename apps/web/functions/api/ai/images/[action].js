// Same-origin Pages entrypoint for the canonical, quota-limited image Worker handlers.
// A missing AI binding or unapproved quota migration fails closed with HTTP 503.
// No duplicate token vault, image storage, service-role key or model credentials here.
import { routeImageStudio } from "../../../../../../worker/imageStudio.js";
import { routeImageImprove } from "../../../../../../worker/imageImprove.js";

const SECURE_HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

export async function onRequest({ request, env }) {
  const pathname = new URL(request.url).pathname;
  if (pathname !== "/api/ai/images/generate" && pathname !== "/api/ai/images/improve")
    return Response.json({ error: "Not found." }, { status: 404, headers: SECURE_HEADERS });

  try {
    const result = pathname === "/api/ai/images/generate"
      ? await routeImageStudio(request, env)
      : await routeImageImprove(request, env);
    const headers = new Headers(result.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");
    return new Response(result.body, { status: result.status, headers });
  } catch {
    return Response.json({ error: "Artwork service is temporarily unavailable." },
      { status: 503, headers: SECURE_HEADERS });
  }
}
