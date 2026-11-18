import { authClient } from "./auth.js";

function functionUrl() {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const parsed = new URL(base);
  if (parsed.hostname !== "ssibsfmtodgximseeqsv.supabase.co" || parsed.protocol !== "https:") {
    throw new Error("Managed creator authorization is not configured for IFund.");
  }
  return new URL("/functions/v1/ifund-managed-creator-mandates", parsed.origin).toString();
}

function publishableKey() {
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!key) throw new Error("IFund API access is not configured.");
  return key;
}

async function parseResponse(response) {
  let data;
  try { data = await response.json(); } catch { throw new Error("The authorization service returned an invalid response."); }
  if (!response.ok) throw new Error(data?.error || "The authorization request could not be completed.");
  return data;
}

export async function publicCreatorMandateRequest(action, token, body = {}) {
  if (!token || typeof token !== "string" || token.length > 128) throw new Error("A valid secure authorization link is required.");
  const url = new URL(functionUrl());
  url.searchParams.set("action", action);
  url.searchParams.set("token", token);
  const response = await fetch(url, {
    method: body && Object.keys(body).length ? "POST" : "GET",
    headers: { "content-type": "application/json", apikey: publishableKey() },
    ...(body && Object.keys(body).length ? { body: JSON.stringify({ ...body, token }) } : {}),
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function adminCreatorMandateRequest(action, body = {}) {
  const client = authClient();
  const { data, error } = await client.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (error || !accessToken) throw new Error("Sign in with the assigned IFund super-admin account.");
  const url = new URL(functionUrl());
  url.searchParams.set("action", action);
  const response = await fetch(url, {
    method: ["list","list_external_destinations"].includes(action) ? "GET" : "POST",
    headers: { authorization: `Bearer ${accessToken}`, apikey: publishableKey(), "content-type": "application/json" },
    ...(["list","list_external_destinations"].includes(action) ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const result = await parseResponse(response);
  const { data: current, error: currentError } = await client.auth.getSession();
  if (currentError || current?.session?.user?.id !== data?.session?.user?.id) {
    throw new Error("Your account changed during this request. Sign in again before continuing.");
  }
  return result;
}
