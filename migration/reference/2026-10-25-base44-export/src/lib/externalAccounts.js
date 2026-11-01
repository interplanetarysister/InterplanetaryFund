// Shared logic for the Admin → External Accounts area. All "agent assignment"
// and "profile completeness" values here are *derived* from the fields a
// PlatformConnection actually has — we never invent data the entity doesn't
// store (including the explicit provider-verification flag, but no per-account
// agent link). Derived values are honest proxies, documented inline.

import { IN_APP_AGENTS } from "@/components/ops/inAppAgentRoster";

// Accent color per agent role, used for the agent chip across the admin view.
export const ROLE_ACCENTS = {
  coordinator: { dot: "bg-violet-500", text: "text-violet-600", bg: "bg-violet-50" },
  strategy: { dot: "bg-indigo-500", text: "text-indigo-600", bg: "bg-indigo-50" },
  growth: { dot: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50" },
  communications: { dot: "bg-blue-500", text: "text-blue-600", bg: "bg-blue-50" },
  story: { dot: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-50" },
  finance: { dot: "bg-cyan-500", text: "text-cyan-600", bg: "bg-cyan-50" },
  outreach: { dot: "bg-rose-500", text: "text-rose-600", bg: "bg-rose-50" },
};
export const DEFAULT_ACCENT = { dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50" };
export const accentForRole = (role) => ROLE_ACCENTS[role] || DEFAULT_ACCENT;

// Which agent role owns a platform account. Crowdfunding totals/donations are
// owned by Growth (analyzes connected platforms); social publishing is owned
// by Outreach (autonomous posting agent). This is the documented assignment.
export const roleForPlatform = (_platformId, kind) =>
  kind === "crowdfunding" ? "growth" : "outreach";

// Resolve the live Agent record for a role, falling back to the in-app roster.
export const agentForRole = (agents, role) =>
  agents.find((a) => a.role === role) ||
  IN_APP_AGENTS.find((a) => a.role === role) ||
  null;

// Profile completeness — derived from the fields the connection actually has.
const credentialFilled = (c) => {
  const cr = c.credentials || {};
  const meta = c.credentials_meta || {};
  switch (c.platform) {
    case "kofi": return !!meta.kofi_verification_token_set;
    case "bluesky": return !!cr.bluesky_handle && !!meta.bluesky_app_password_set;
    case "mastodon": return !!cr.mastodon_instance && !!meta.mastodon_access_token_set;
    default: return null; // platform stores no credential — not counted
  }
};

export const completenessPct = (c) => {
  const checks = [{ ok: !!c.display_name }, { ok: !!c.external_url }];
  const cred = credentialFilled(c);
  if (cred !== null) checks.push({ ok: cred });
  const filled = checks.filter((x) => x.ok).length;
  return Math.round((filled / checks.length) * 100);
};

export const completenessLevel = (c) => {
  const p = completenessPct(c);
  if (p >= 100) return "complete";
  if (p >= 50) return "partial";
  return "incomplete";
};

export const STALE_DAYS = 7;
export const daysSinceSync = (c) => {
  if (!c.last_synced) return null;
  return Math.floor((Date.now() - new Date(c.last_synced).getTime()) / 86400000);
};
export const isStale = (c) => {
  const d = daysSinceSync(c);
  return d === null || d >= STALE_DAYS;
};

// Credential status shown to admin never treats stored secrets as proof that
// the provider accepted them.
export const credentialStatus = (c) => {
  const hasCred = credentialFilled(c);
  if (c.verification_status === "verified") return "Provider verified";
  if (hasCred) return "Configured; verification pending";
  if (["kofi", "bluesky", "mastodon"].includes(c.platform)) return "Not configured";
  return c.external_url ? "Profile linked; unverified" : "Not configured";
};

// Aggregate health bucket, in priority order. The stale-marker string written
// by syncConnections is excluded from "requires_action" so stale != error.
export const healthStatus = (c) => {
  if (c.verification_status !== "verified" || c.status === "error" || c.status === "disconnected" ||
      (c.last_error && c.last_error !== "No synchronization in over 7 days")) return "requires_action";
  if (isStale(c)) return "stale";
  if (completenessLevel(c) === "incomplete") return "incomplete";
  return "connected";
};

export const HEALTH_BADGE = {
  connected: { label: "Connected", className: "bg-emerald-100 text-emerald-700" },
  stale: { label: "Stale", className: "bg-amber-100 text-amber-700" },
  requires_action: { label: "Requires Admin Action", className: "bg-red-100 text-red-700" },
  incomplete: { label: "Profile Incomplete", className: "bg-orange-100 text-orange-700" },
};

// OBO (on-behalf-of) publishing permission — derived from automation_mode.
export const oboGranted = (c) => c.automation_mode === "auto" || c.automation_mode === "ask";