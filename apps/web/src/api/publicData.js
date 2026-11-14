// Public, read-only IFund campaign queries against the ONE independent
// Supabase project. RLS exposes only active rows to anonymous visitors.
// No Base44 SDK, legacy preview RPC or fallback cross-project connection.
import { createClient } from "@supabase/supabase-js";

const PROJECT_REF = "ssibsfmtodgximseeqsv";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const PUBLIC_COLUMNS = "id,title,summary,story,category,goal_amount,cover_image_url,status,created_at,map_opt_in,public_location_label,map_latitude,map_longitude";

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
    location: row.map_opt_in === true && row.public_location_label ? row.public_location_label : "",
    map_opt_in: row.map_opt_in === true,
    latitude: row.map_opt_in === true && row.map_latitude !== null ? numOrNull(row.map_latitude) : null,
    longitude: row.map_opt_in === true && row.map_longitude !== null ? numOrNull(row.map_longitude) : null,
    status: row.status || "active",
    preview_only: false,
    raised_amount: null,
    goal_amount: numOrNull(row.goal_amount),
    donor_count: null,
    end_date: null,
  };
}

// Only provider-verified captures count. The security-definer RPC enforces
// active campaigns and canonical confirmed gifts, with no sample payments.
async function attachVerifiedFunding(rows) {
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);
  const { data, error } = await supabase().rpc("ifund_public_campaign_funding_totals", { p_campaign_ids: ids });
  if (error || !Array.isArray(data)) throw new Error("Verified campaign funding is unavailable.");
  const totals = new Map();
  for (const entry of data) {
    if (!ids.includes(entry.campaign_id)) throw new Error("Unexpected funding response.");
    const amount = Number(entry.raised_amount);
    const donors = Number(entry.donor_count);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(donors) || donors < 0)
      throw new Error("Invalid verified campaign funding totals.");
    totals.set(entry.campaign_id, { amount, donors });
  }
  return rows.map(row => {
    const progress = totals.get(row.id);
    if (!progress) throw new Error("Verified campaign totals were incomplete.");
    return { ...mapCampaign(row), raised_amount: progress.amount, donor_count: progress.donors };
  });
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
  return attachVerifiedFunding(data || []);
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
  if (!data) return null;
  const funding = await attachVerifiedFunding([data]);
  return funding[0];
}

export async function listRelatedCampaigns(category, excludeId, max = 3) {
  const all = await listActiveCampaigns({ limit: 100 });
  return all.filter((campaign) =>
    campaign.category === category && campaign.id !== String(excludeId)
  ).slice(0, max);
}

// Atlas geography does not depend on financial ledger RPC availability.
// This read includes only active, RLS-visible campaigns and approved broad
// locations; payment statistics are intentionally never requested.
export async function listPublicAtlasCampaigns({ limit = 500 } = {}) {
  const max=Math.min(500,Math.max(1,Number(limit)||500));
  const {data,error}=await supabase()
    .from("ifund_campaigns")
    .select("id,title,summary,category,status,map_opt_in,public_location_label,map_latitude,map_longitude")
    .eq("status","active")
    .order("created_at",{ascending:false})
    .order("id",{ascending:false})
    .limit(max);
  if(error || !Array.isArray(data)) throw new Error("Public Atlas campaigns could not be loaded.");
  return data.map(row=>mapCampaign(row));
}
