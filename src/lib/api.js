import { db } from "./supabase.js";

const configuredApiBase = String(import.meta.env?.VITE_API_BASE_URL || "").trim();

export class ApiError extends Error {
  constructor(message, { status = 0, code = "api_error", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function resolveApiUrl(path, baseUrl = configuredApiBase) {
  if (typeof path !== "string" || !path.startsWith("/api/")) {
    throw new TypeError("API paths must be absolute /api/ routes.");
  }
  if (!baseUrl) return path;

  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new TypeError("VITE_API_BASE_URL must be a valid absolute URL.");
  }
  if (!["https:", "http:"].includes(base.protocol) || base.username || base.password) {
    throw new TypeError("API base URL must use HTTP(S) and contain no credentials.");
  }
  if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) {
    throw new TypeError("Non-local API base URLs must use HTTPS.");
  }
  const prefix = base.pathname.replace(/\/+$/, "");
  return new URL(`${prefix}${path}`, base.origin).toString();
}

export function createApiClient({
  baseUrl = configuredApiBase,
  getAccessToken = async () => {
    if (!db) return null;
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    return data.session?.access_token || null;
  },
  fetchImpl = fetch,
} = {}) {
  return Object.freeze({
    async request(path, options = {}) {
      const url = resolveApiUrl(path, baseUrl);
      const token = options.accessToken ?? await getAccessToken();
      const headers = new Headers(options.headers || {});
      headers.set("accept", "application/json");
      if (token) headers.set("authorization", `Bearer ${token}`);

      let body = options.body;
      if (body !== undefined && body !== null && typeof body !== "string" && !(typeof FormData !== "undefined" && body instanceof FormData)) {
        headers.set("content-type", "application/json");
        body = JSON.stringify(body);
      }

      const response = await fetchImpl(url, {
        method: options.method || (body === undefined ? "GET" : "POST"),
        headers,
        ...(body === undefined || body === null ? {} : { body }),
        signal: options.signal,
      });
      const payload = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) {
        throw new ApiError(payload?.error || payload?.message || "The API request failed.", {
          status: response.status,
          code: payload?.code || "api_error",
          details: payload?.details || null,
        });
      }
      return payload;
    },
  });
}

export const api = createApiClient();
