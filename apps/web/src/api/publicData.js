// Public, read-only data layer for the standalone Interplanetary Fund site.
// Replaces the Base44 SDK for the public pages. Uses only the Supabase
// publishable/anon key; every call goes through SECURITY DEFINER RPCs that
// expose published campaign fields only.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client = null;
export function isPublicDataConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
function supabase() {
  if (!isPublicDataConfigured()) {
    throw new Error("Public data is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

const PAGE_SIZE = 50;
const numOrNull = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

// Shape a preview/detail row into the fields the original Base44 cards and
// pages read. Funding totals are null when the source does not provide them;
// the UI hides or labels them instead of showing zeros.
export function mapCampaign(row = {}) {
  return {
    id: String(row.source_id ?? row.id ?? ""),
    source_id: row.source_id ?? row.id ?? null,
    title: row.title || "Untitled campaign",
    summary: row.summary || "",
    story: row.story || "",
    category: row.category || "other",
    cover_image_url: row.cover_image_url || "",
    cover_image_is_ai: row.cover_image_is_ai === true,
    location: row.location || "",
    status: row.status || "active",
    preview_only: row.preview_only !== false,
    raised_amount: numOrNull(row.raised_amount),
    goal_amount: numOrNull(row.goal_amount),
    donor_count: numOrNull(row.donor_count),
    end_date: row.end_date || null,
  };
}

// Active campaign list via ifund_migration_active_campaign_preview, paged by
// keyset (p_after_source_id) until `limit` rows are collected.
export async function listActiveCampaigns({ limit = 100 } = {}) {
  const out = [];
  let after = null;
  while (out.length < limit) {
    const pageLimit = Math.min(PAGE_SIZE, limit - out.length);
    const { data, error } = await supabase().rpc("ifund_migration_active_campaign_preview", {
      p_after_source_id: after,
      p_limit: pageLimit,
    });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    out.push(...rows.map(mapCampaign));
    if (rows.length < pageLimit) break;
    const last = rows[rows.length - 1]?.source_id;
    if (last === undefined || last === null || last === after) break;
    after = last;
  }
  return out;
}

// Campaign detail: try the dedicated public detail RPC (pending migration
// supabase/migrations/pending/public_campaign_detail_001.sql). If it is not
// deployed yet or errors, fall back to the list preview data.
export async function getCampaignDetail(sourceId) {
  if (!sourceId) return null;
  try {
    const { data, error } = await supabase().rpc("ifund_public_campaign_detail", { p_source_id: String(sourceId) });
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) return mapCampaign(row);
    }
  } catch {
    // Fall through to the preview list.
  }
  const all = await listActiveCampaigns({ limit: 500 });
  return all.find((c) => c.id === String(sourceId)) || null;
}

export async function listRelatedCampaigns(category, excludeId, max = 3) {
  const all = await listActiveCampaigns({ limit: 100 });
  return all.filter((c) => c.category === category && c.id !== String(excludeId)).slice(0, max);
}
