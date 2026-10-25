import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
// Publishable key only; server-only secrets must never be available to the browser.
export const db = configured
  ? createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Browser OAuth uses authorization code + PKCE, not a client secret.
        flowType: "pkce",
      },
    })
  : null;
