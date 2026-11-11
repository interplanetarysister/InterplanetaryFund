// Dedicated authenticated transport to demo-only tables. Never exposes a service key.
// The verification key is public. The private signing key exists only in the demo Worker.
const PUBLIC_JWK = {
  key_ops: ["verify"],
  ext: true,
  kty: "EC",
  x: "mCbyadb_k8eJV6YT7nMvFWp7He98zS_38j-qRadvX5Y",
  y: "RJmnHLA1_Tnngkt3BM2AWo1eK21IqidH1783Kquqpu4",
  crv: "P-256",
};
const tables = [
  "users",
  "sessions",
  "campaigns",
  "orders",
  "captures",
  "ledger",
  "receipts",
  "events",
  "ai_runs",
  "media",
  "tracker",
  "rate_limits",
].map((t) => "ifund_demo_" + t);
const functions = ["finalize", "rate", "finance", "totals", "event_replay"].map(
  (t) => "rpc/ifund_demo_" + t,
);
export async function dataGateway(
  request: Request,
  config: { url: string; key: string },
  verificationKey: JsonWebKey = PUBLIC_JWK,
): Promise<Response> {
  const reply = (data: unknown, status: number) =>
    Response.json(data, { status, headers: { "cache-control": "no-store" } });
  if (
    request.method !== "POST" ||
    request.headers.get("content-type") !== "application/json"
  )
    return reply({ error: "Authenticated transport required" }, 403);
  const time = request.headers.get("x-demo-time") || "",
    sig = request.headers.get("x-demo-signature") || "";
  if (
    !/^\d{10}$/.test(time) ||
    Math.abs(Date.now() / 1000 - Number(time)) > 60 ||
    !/^[a-zA-Z0-9_-]{86}$/.test(sig)
  )
    return reply({ error: "Invalid transport authentication" }, 403);
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "Missing body" }, 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 40000) return reply({ error: "Body too large" }, 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  try {
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      signature = Uint8Array.from(
        atob(sig.replace(/-/g, "+").replace(/_/g, "/") + "=="),
        (c) => c.charCodeAt(0),
      );
    const key = await crypto.subtle.importKey(
      "jwk",
      verificationKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        signature,
        new TextEncoder().encode(time + "\n" + raw),
      ))
    )
      return reply({ error: "Invalid transport signature" }, 403);
    const input = JSON.parse(raw) as {
      resource: string;
      method: string;
      query: string;
      payload?: unknown;
    };
    if (!tables.includes(input.resource) && !functions.includes(input.resource))
      return reply({ error: "Demo table boundary violation" }, 403);
    if (
      !["GET", "POST", "PATCH", "DELETE"].includes(input.method) ||
      typeof input.query !== "string" ||
      input.query.length > 4000 ||
      (input.query &&
        (!input.query.startsWith("?") || input.query.includes("#")))
    )
      return reply({ error: "Invalid transport operation" }, 400);
    if (
      functions.includes(input.resource) &&
      (input.method !== "POST" || input.query)
    )
      return reply({ error: "Invalid RPC operation" }, 400);
    const response = await fetch(
      config.url + "/rest/v1/" + input.resource + input.query,
      {
        method: input.method,
        headers: {
          apikey: config.key,
          authorization: "Bearer " + config.key,
          "content-type": "application/json",
          prefer: "return=representation",
        },
        ...(input.payload === undefined
          ? {}
          : { body: JSON.stringify(input.payload) }),
        signal: AbortSignal.timeout(12000),
      },
    );
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return reply({ error: "Demo transport unavailable" }, 503);
  }
}
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
if (typeof Deno !== "undefined")
  Deno.serve((request) =>
    dataGateway(request, {
      url: Deno.env.get("SUPABASE_URL")!,
      key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    }),
  );
