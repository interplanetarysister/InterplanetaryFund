// Independent equivalent of the original source authReturnTo contract.
// Browser-origin-independent so the same checks can be tested under Node.
const BASE = "https://interplanetaryfund.com";
const DEFAULT_LANDING = "/mine";
const BLOCKED_DESTINATIONS = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);
const UNTRUSTED_BOOTSTRAP_KEYS = [
  "access_token", "refresh_token", "clear_access_token",
  "app_id", "app_base_url", "functions_version", "from_url",
];

export function safeReturnTo(value) {
  if (typeof value !== "string" || !value || value.length > 2048 || !value.startsWith("/") ||
      value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return DEFAULT_LANDING;
  try {
    const parsed = new URL(value, BASE);
    if (parsed.origin !== BASE) return DEFAULT_LANDING;
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (!decodedPath.startsWith("/") || decodedPath.startsWith("//") || decodedPath.includes("\\")) return DEFAULT_LANDING;
    if (BLOCKED_DESTINATIONS.has(parsed.pathname.replace(/\/$/, "") || "/")) return DEFAULT_LANDING;
    for (const key of UNTRUSTED_BOOTSTRAP_KEYS) parsed.searchParams.delete(key);
    const result = parsed.pathname + parsed.search + parsed.hash;
    return result.startsWith("/") && !result.startsWith("//") ? result : DEFAULT_LANDING;
  } catch {
    return DEFAULT_LANDING;
  }
}

export function loginPathFor(location) {
  const requested = String(location?.pathname || "/") + String(location?.search || "") + String(location?.hash || "");
  return "/login?returnTo=" + encodeURIComponent(safeReturnTo(requested));
}
