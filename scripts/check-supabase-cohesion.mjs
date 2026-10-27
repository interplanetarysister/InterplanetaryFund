// Fail closed on cross-project Supabase configuration before a Pages release.
// This checks public project refs only; it never reads or prints API keys.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const TARGET_PROJECT_REF = "ssibsfmtodgximseeqsv";
const FIELD_TYPES = Object.freeze({
  VITE_SUPABASE_URL: "url",
  SUPABASE_URL: "url",
  SUPABASE_JWKS_URL: "jwks",
  IFUND_SUPABASE_URL: "url",
  IFUND_SUPABASE_PROJECT_REF: "ref",
});

function projectRef(value, type) {
  if (type === "ref") return /^[a-z0-9]{20}$/.test(value) ? value : null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
    if (!match) return null;
    if (type === "jwks" && url.pathname !== "/auth/v1/.well-known/jwks.json") return null;
    if (type === "url" && url.pathname !== "/") return null;
    return match[1];
  } catch {
    return null;
  }
}

export function verifySupabaseCohesion(env, { requireFrontend = true } = {}) {
  const checked = [];
  const errors = [];
  if (requireFrontend && !env.VITE_SUPABASE_URL)
    errors.push("VITE_SUPABASE_URL is missing.");
  for (const [name, type] of Object.entries(FIELD_TYPES)) {
    const value = env[name];
    if (value === undefined || value === null || value === "") continue;
    const ref = projectRef(String(value), type);
    checked.push(name);
    if (!ref) errors.push(name + " has an invalid Supabase project endpoint.");
    else if (ref !== TARGET_PROJECT_REF)
      errors.push(name + " uses " + ref + " instead of the canonical target " + TARGET_PROJECT_REF + ".");
  }
  return { ok: errors.length === 0, errors, checked };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const auto = process.argv.includes("--auto");
  // Local dev/test builds do not need production credentials.
  // Cloudflare Pages build always receives CF_PAGES=1.
  if (auto && !["1", "true"].includes(String(process.env.CF_PAGES || "").toLowerCase())) {
    console.log("Supabase cohesion: local build; Cloudflare deployment checks deferred.");
  } else {
    const result = verifySupabaseCohesion(process.env);
    if (!result.ok) {
      console.error("Supabase cohesion failed:");
      for (const error of result.errors) console.error("- " + error);
      process.exitCode = 1;
    } else {
      console.log("Supabase cohesion OK: " + result.checked.join(", "));
    }
  }
}
