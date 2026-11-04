// Same-origin Pages service binding: no browser key or token is put into URLs.
export async function onRequest({ request, env }) {
  if (!env.IFUND_STORY_AGENT)
    return Response.json(
      { error: "Your writing assistant is not available yet." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  return env.IFUND_STORY_AGENT.fetch(request);
}
