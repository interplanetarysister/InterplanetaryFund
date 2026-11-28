import { routeCaptionGeneration } from "../../../../../worker/captionGeneration.js";

const SECURE_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

// Canonical gateway for AI caption wording. Mirrors the images/videos
// gateways: only the two caption routes are forwarded to the Worker
// module; anything else under this prefix is a plain 404.
export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname
    .replace(/^\/api\/ai\/captions\/?/, "")
    .replace(/\/$/, "");
  if (pathname !== "status" && pathname !== "generate")
    return Response.json({ error: "Not found." }, { status: 404, headers: SECURE_HEADERS });
  try {
    const result = await routeCaptionGeneration(context.request, context.env);
    const headers = new Headers(result.headers);
    for (const [name, value] of Object.entries(SECURE_HEADERS)) headers.set(name, value);
    return new Response(result.body, { status: result.status, headers });
  } catch {
    return Response.json(
      { error: "Caption suggestion service is temporarily unavailable." },
      { status: 503, headers: SECURE_HEADERS },
    );
  }
}
