// Public, read-only IFund campaign queries against the ONE independent
// Supabase project. RLS exposes only active rows to anonymous visitors.
// No Base44 SDK, legacy preview RPC or fallback cross-project connection.
import { createClient } from "@supabase/supabase-js";

const PROJECT_REF = "ssibsfmtodgximseeqsv";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const PUBLIC_COLUMNS = "id,title,summary,story,category,goal_amount,cover_image_url,status,created_at";

let client = null;
export function isPublicDataConfigured() {
  try {
    return Boolean(SUPABASE_ANON_KEY) &&
      new URL(SUPABASE_URL).hostname === PROJECT_REF + ".supabase.co";
  } catch {
    return false;
  }
}
function supabase() {
  if (!isPublicDataConfigured()) {
    throw new Error("Set the publishable Supabase key and canonical IFund project URL.");
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

const numOrNull = (value) =>
  value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
    ? null : Number(value);

// Funding/donor totals must never be estimated from goals or preview records.
// This selects only real, RLS-visible active campaigns.
export function mapCampaign(row = {}) {
  return {
    id: String(row.id ?? ""),
    source_id: row.id ?? null,
    title: row.title || "Untitled campaign",
    summary: row.summary || "",
    story: row.story || "",
    category: row.category || "other",
    cover_image_url: row.cover_image_url || "",
    cover_image_is_ai: false,
    location: "",
    status: row.status || "active",
    preview_only: false,
    raised_amount: null,
    goal_amount: numOrNull(row.goal_amount),
    donor_count: null,
    funding_totals_verified: false,
    end_date: null,
  };
}

export async function listActiveCampaigns({ limit = 100 } = {}) {
  const max = Math.min(500, Math.max(1, Number(limit) || 100));
  const { data, error } = await supabase()
    .from("ifund_campaigns")
    .select(PUBLIC_COLUMNS)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(max);
  if (error) throw error;
  return (data || []).map(mapCampaign);
}

export async function getCampaignDetail(id) {
  // Public canonical IDs are UUIDs; do not query private/legacy IDs.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""))) return null;
  const { data, error } = await supabase()
    .from("ifund_campaigns")
    .select(PUBLIC_COLUMNS)
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data ? mapCampaign(data) : null;
}

export async function listRelatedCampaigns(category, excludeId, max = 3) {
  const all = await listActiveCampaigns({ limit: 100 });
  return all.filter((campaign) =>
    campaign.category === category && campaign.id !== String(excludeId)
  ).slice(0, max);
}
