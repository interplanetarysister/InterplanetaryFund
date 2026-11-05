export async function onRequest({ request, env }) {
  if (!env.IFUND_STRATEGY_AGENT)
    return Response.json(
      { error: "Your strategy assistant is not available yet." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  return env.IFUND_STRATEGY_AGENT.fetch(request);
}
