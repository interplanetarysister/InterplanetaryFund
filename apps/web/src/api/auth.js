import { createClient } from "@supabase/supabase-js";

const CANONICAL_SUPABASE_URL = "https://ssibsfmtodgximseeqsv.supabase.co";
let client;
export function authClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY;
  try {
    const parsed = new URL(url);
    if (!key || parsed.origin !== CANONICAL_SUPABASE_URL || parsed.pathname !== "/" ||
        parsed.search || parsed.hash || parsed.username || parsed.password) throw Error();
  } catch {
    throw new Error(
      "Authentication is not configured for the canonical IFund project.",
    );
  }
  if (!client)
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
  return client;
}
