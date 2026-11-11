export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id");
  if (!/^[a-f0-9]{24}$/.test(id || "")) return new Response(null, { status: 404 });
  const image = await env.IFUND_CAMPAIGN_MEDIA?.get(`public-social-archive/${id}`);
  if (!image) return new Response(null, { status: 404 });
  return new Response(image.body, { headers: {
    "content-type": image.httpMetadata.contentType,
    "cache-control": "public, max-age=3600",
    "x-content-type-options": "nosniff",
  } });
}
