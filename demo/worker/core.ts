import type { DemoEnv, User } from "./types.ts";
export class Fault extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "INVALID_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function demand(
  condition: unknown,
  message: string,
  status = 400,
  code = "INVALID_REQUEST",
): asserts condition {
  if (!condition) throw new Fault(message, status, code);
}
export const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export const providerId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9-]{8,128}$/.test(value);
export const categories = [
  "emergency",
  "medical",
  "education",
  "disaster_relief",
  "community",
  "animals",
  "environment",
  "creative",
  "science",
];
export const disclosure =
  "DEMO CAMPAIGN — FICTIONAL CONTENT — SANDBOX PAYMENTS ONLY";
export const now = () => new Date().toISOString();
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
      ...headers,
    },
  });
}
export async function body(
  request: Request,
  max = 20000,
): Promise<Record<string, unknown>> {
  demand(
    request.headers.get("content-type")?.split(";")[0] === "application/json",
    "JSON required",
    415,
  );
  const reader = request.body?.getReader();
  demand(reader, "Request body required");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      demand(length <= max, "Request too large", 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  let result: unknown;
  try {
    result = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    throw new Fault("Invalid JSON");
  }
  demand(
    result && typeof result === "object" && !Array.isArray(result),
    "Object required",
  );
  return result as Record<string, unknown>;
}
export function sameOrigin(request: Request, env: DemoEnv) {
  const u = new URL(request.url);
  const local = ["localhost", "127.0.0.1"].includes(u.hostname);
  demand(
    u.origin === env.DEMO_ORIGIN && (u.protocol === "https:" || local),
    "Demo environment mismatch",
    403,
  );
  demand(
    request.headers.get("origin") === u.origin,
    "Same-origin request required",
    403,
  );
}
export async function hash(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const out = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
    },
    key,
    256,
  );
  return [...new Uint8Array(out)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function equalHash(a: string, b: string) {
  if (a.length !== 64 || b.length !== 64) return false;
  let d = 0;
  for (let i = 0; i < 64; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export function database(env: DemoEnv) {
  demand(
    env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.DB_SIGNER),
    "Demo storage is not configured",
    503,
    "STORAGE_UNAVAILABLE",
  );
  const root = new URL(env.SUPABASE_URL);
  demand(root.protocol === "https:", "Invalid database binding", 503);
  async function call<T>(
    resource: string,
    method = "GET",
    query = "",
    payload?: unknown,
  ): Promise<T> {
    demand(
      /^ifund_demo_[a-z_]+$/.test(resource) ||
        /^rpc\/ifund_demo_[a-z_]+$/.test(resource),
      "Database boundary violation",
      500,
    );
    let response: Response;
    if (env.DB_SIGNER) {
      const raw = JSON.stringify({ resource, method, query, payload }),
        time = String(Math.floor(Date.now() / 1000));
      const value =
        typeof env.DB_SIGNER === "string"
          ? env.DB_SIGNER
          : await env.DB_SIGNER.get();
      const key = await crypto.subtle.importKey(
        "jwk",
        JSON.parse(value),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
      );
      const signed = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        new TextEncoder().encode(time + "\n" + raw),
      );
      const signature = btoa(String.fromCharCode(...new Uint8Array(signed)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      response = await fetch(root.origin + "/functions/v1/ifund-demo-data", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-time": time,
          "x-demo-signature": signature,
        },
        body: raw,
        signal: AbortSignal.timeout(15000),
      });
    } else
      response = await fetch(root.origin + "/rest/v1/" + resource + query, {
        method,
        headers: {
          apikey: env.SUPABASE_SECRET_KEY!,
          authorization: "Bearer " + env.SUPABASE_SECRET_KEY,
          "content-type": "application/json",
          prefer: "return=representation",
        },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        signal: AbortSignal.timeout(15000),
      });
    if (!response.ok)
      throw new Fault(
        response.status === 409
          ? "Conflicting record; reload and retry"
          : "Demo storage operation failed",
        response.status === 409 ? 409 : 503,
        "STORAGE_UNAVAILABLE",
      );
    return (response.status === 204 ? null : await response.json()) as T;
  }
  return {
    rows: <T>(table: string, query = "") =>
      call<T[]>("ifund_demo_" + table, "GET", query),
    insert: <T>(table: string, payload: unknown) =>
      call<T[]>("ifund_demo_" + table, "POST", "", payload),
    update: <T>(table: string, query: string, payload: unknown) =>
      call<T[]>("ifund_demo_" + table, "PATCH", query, payload),
    remove: (table: string, query: string) =>
      call<null>("ifund_demo_" + table, "DELETE", query),
    rpc: <T>(name: string, payload: unknown) =>
      call<T>("rpc/ifund_demo_" + name, "POST", "", payload),
  };
}
export type DB = ReturnType<typeof database>;
export async function session(request: Request, db: DB): Promise<User | null> {
  const token = (request.headers.get("cookie") || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("ifund_demo_session="))
    ?.split("=")[1];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await db.rows<{ user_id: string }>(
    "sessions",
    "?select=user_id&token_hash=eq." +
      (await hash(token)) +
      "&expires_at=gt." +
      encodeURIComponent(now()),
  );
  if (!rows[0]) return null;
  const users = await db.rows<User>(
    "users",
    "?select=id,handle,role&id=eq." + rows[0].user_id,
  );
  return users[0] || null;
}
export function requireUser(user: User | null): User {
  demand(
    user,
    "Sign into a separate demo account to continue",
    401,
    "LOGIN_REQUIRED",
  );
  return user;
}
export function requireAdmin(user: User | null): User {
  const u = requireUser(user);
  demand(u.role === "admin", "Administrator access required", 403);
  return u;
}
export async function limit(
  db: DB,
  key: string,
  count: number,
  seconds: number,
) {
  demand(
    await db.rpc<boolean>("rate", {
      p_key: key,
      p_limit: count,
      p_seconds: seconds,
    }),
    "Demo request limit reached; try again later",
    429,
    "RATE_LIMITED",
  );
}
export function sessionCookie(token: string, request: Request, maxAge = 86400) {
  return `ifund_demo_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
