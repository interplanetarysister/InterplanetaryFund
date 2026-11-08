const CONNECTION_ROUTES = new Set([
  "workspace",
  "methods",
  "grant-help",
  "requests",
  "change-selected",
]);

/**
 * Keep connection workspace data bound to the account that initiated the
 * request. Supabase sessions can change while a fetch is in flight (for
 * example, on a shared device); never return the previous account's payload
 * after that happens.
 */
export async function requestConnectionApi({
  client,
  fetcher = fetch,
  path,
  body,
  ownerId = null,
}) {
  if (
    !client?.auth?.getSession ||
    typeof fetcher !== "function" ||
    !CONNECTION_ROUTES.has(path) ||
    (body != null && (typeof body !== "object" || Array.isArray(body)))
  ) {
    throw new Error("This connection action is unavailable.");
  }

  const before = await client.auth.getSession();
  const session = before?.data?.session;
  if (
    before?.error ||
    !session?.access_token ||
    typeof session.user?.id !== "string" ||
    !session.user.id
  ) {
    throw new Error("Please sign in again.");
  }
  if (ownerId && ownerId !== session.user.id) {
    throw new Error("Your account changed. Reload before continuing.");
  }

  const hasBody = body !== undefined && body !== null;
  const response = await fetcher("/api/agents/connections/" + path, {
    method: hasBody ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + session.access_token,
      ...(hasBody ? { "content-type": "application/json" } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => ({
    error: "Connection assistance is temporarily unavailable.",
  }));

  // Check again before exposing either successful or error response data.
  const after = await client.auth.getSession();
  if (
    after?.error ||
    after?.data?.session?.user?.id !== session.user.id
  ) {
    throw new Error("Your account changed. Reload before continuing.");
  }

  if (!response.ok) {
    throw Object.assign(
      Error(result.error || "This connection action is unavailable."),
      { status: response.status },
    );
  }
  return { result, ownerId: session.user.id };
}
