// Same-origin Pages entrypoint for the canonical video-generation Worker
// handler (Cloudflare Workers AI provider, allowance-gated, jobs stored in
// the member's private media library). A missing AI binding, R2 media
// binding, jobs table or the IFUND_VIDEO_AI_ENABLED flag fails closed with
// HTTP 503 — the handler reports itself not configured rather than faking
// a generation. No provider credentials live here; the Workers AI binding
// is the only provider credential surface.
import { routeVideoGeneration } from "../../../../../../worker/videoGeneration.js";

const SECURE_HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

export async function onRequest({ request, env }) {
  const pathname = new URL(request.url).pathname;
  if (pathname !== "/api/ai/videos/status" &&
      pathname !== "/api/ai/videos/generate" &&
      !/^\/api\/ai\/videos\/jobs\/[0-9a-f-]{36}(\/advance)?$/i.test(pathname))
    return Response.json({ error: "Not found." }, { status: 404, headers: SECURE_HEADERS });

  try {
    const result = await routeVideoGeneration(request, env);
    const headers = new Headers(result.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");
    return new Response(result.body, { status: result.status, headers });
  } catch {
    return Response.json({ error: "Video generation service is temporarily unavailable." },
      { status: 503, headers: SECURE_HEADERS });
  }
}
