import { createClient } from "@supabase/supabase-js";
import { isCanonicalSupabaseUrl } from "../lib/canonicalSupabaseUrl.mjs";

let client;
export function authClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY;
  try {
    if (typeof key !== "string" || !key.trim() || !isCanonicalSupabaseUrl(url)) throw Error();
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
