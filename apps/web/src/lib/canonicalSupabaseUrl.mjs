/** Canonical production identity boundary for browser Supabase clients. */
export const CANONICAL_SUPABASE_ORIGIN = "https://ssibsfmtodgximseeqsv.supabase.co";

export function isCanonicalSupabaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.origin === CANONICAL_SUPABASE_ORIGIN &&
      parsed.pathname === "/" && !parsed.search && !parsed.hash &&
      !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
