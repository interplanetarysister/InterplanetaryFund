export async function onRequest({ request, env }) {
  if (!env.IFUND_GROWTH_AGENT)
    return Response.json(
      { error: "Your growth assistant is not available yet." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  return env.IFUND_GROWTH_AGENT.fetch(request);
}
