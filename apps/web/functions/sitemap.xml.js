// Cloudflare Pages Function: refresh the public sitemap from RLS-filtered
// published content on every request, with a short edge cache lifetime.
// Only the canonical production Supabase project and publishable key are used.
const ORIGIN = "https://interplanetaryfund.com";
const PROJECT = "https://ssibsfmtodgximseeqsv.supabase.co";
const STATIC_PATHS = [
  "/", "/discover", "/globe", "/about", "/our-story", "/help", "/contact", "/templates",
  "/blogs", "/news", "/terms", "/privacy", "/events", "/download",
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const xmlEscape = (v) => String(v).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[c]));
const entry = (path) => "  <url><loc>" + xmlEscape(ORIGIN + path) + "</loc></url>";
const xml = (paths) => '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [...paths].map(entry).join("\n") + '\n</urlset>\n';

async function fetchPublished(env, resource, filter, orderColumn, pathPrefix) {
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const endpoint = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!key || endpoint !== PROJECT) throw Error("Public data connection unavailable");
  const paths = [];
  const PAGE = 1000;
  // Supabase public REST reads remain constrained by RLS and explicit publication flags.
  for (let offset = 0; offset < 100000; offset += PAGE) {
    const url = new URL(PROJECT + "/rest/v1/" + resource);
    url.searchParams.set("select", "id");
    for (const [key, value] of Object.entries(filter)) url.searchParams.set(key, value);
    url.searchParams.set("order", orderColumn + ".asc");
    url.searchParams.set("limit", String(PAGE));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, {
      headers: { apikey: key, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Error("Public content query failed");
    const rows = await response.json();
    if (!Array.isArray(rows)) throw Error("Invalid public content response");
    for (const row of rows) {
      const id = String(row?.id || "");
      if (UUID.test(id)) paths.push(pathPrefix + id);
    }
    if (rows.length < PAGE) return paths;
  }
  throw Error("Sitemap exceeded page limit");
}

export async function onRequestGet({ env }) {
  const paths = new Set(STATIC_PATHS);
  try {
    const [campaigns, publications] = await Promise.all([
      fetchPublished(env, "ifund_campaigns", { status: "eq.active" }, "id", "/campaign/"),
      fetchPublished(env, "ifund_official_publications",
        { status: "eq.published", final_approved: "eq.true" }, "id", "/publications/"),
    ]);
    for (const path of [...campaigns, ...publications]) paths.add(path);
  } catch (error) {
    // Never silently present an incomplete dynamic sitemap as up to date.
    return new Response("Public sitemap temporarily unavailable", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(xml(paths), {
    status: 200, headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
