export async function onRequest({ request, env }) {
  if (!env.IFUND_COMMUNICATIONS_AGENT)
    return Response.json(
      { error: "Your communications assistant is not available yet." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  return env.IFUND_COMMUNICATIONS_AGENT.fetch(request);
}
