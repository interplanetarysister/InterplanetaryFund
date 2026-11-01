import { createClient } from "@supabase/supabase-js";

const REF = "ssibsfmtodgximseeqsv";
let client;
export function authClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  try {
    if (!key || new URL(url).hostname !== REF + ".supabase.co") throw Error();
  } catch {
    throw new Error("Authentication is not configured for the canonical IFund project.");
  }
  if (!client) client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true,
      // Callback handles tokens and one-time codes once, with explicit errors.
      detectSessionInUrl: false, flowType: "implicit" }
  });
  return client;
}
