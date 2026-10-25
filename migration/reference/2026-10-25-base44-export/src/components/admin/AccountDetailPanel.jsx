import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { platformName, AUTOMATION_MODES } from "@/components/connections/platformCatalog";
import {
  healthStatus, HEALTH_BADGE, completenessPct, completenessLevel,
  daysSinceSync, roleForPlatform, accentForRole, agentForRole, oboGranted, credentialStatus,
} from "@/lib/externalAccounts";
import { ExternalLink, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const POST_STATUS = { published: "Published", approved: "Approved", pending_approval: "Pending", scheduled: "Scheduled", draft: "Draft", failed: "Failed" };
const POST_STATUS_COLOR = {
  published: "bg-emerald-100 text-emerald-700", approved: "bg-blue-100 text-blue-700",
  pending_approval: "bg-amber-100 text-amber-700", scheduled: "bg-violet-100 text-violet-700",
  draft: "bg-stone-100 text-stone-600", failed: "bg-red-100 text-red-700",
};

const Section = ({ title, children }) => (
  <div>
    <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">{title}</h3>
    {children}
  </div>
);

const InfoRow = ({ k, v, cap, bool, danger }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-stone-500">{k}</dt>
    <dd className={`font-medium text-right ${danger ? "text-red-600"
      : bool === true ? "text-emerald-600"
      : bool === false ? "text-stone-400"
      : "text-stone-800"} ${cap ? "capitalize" : ""}`}>{v}</dd>
  </div>
);

export default function AccountDetailPanel({ connection, campaigns, agents, posts, onClose }) {
  const c = connection;
  const open = !!c;
  const hs = c ? healthStatus(c) : null;
  const camp = c ? campaigns[c.campaign_id] : null;
  const r = c ? roleForPlatform(c.platform, c.kind) : null;
  const agent = c ? agentForRole(agents, r) : null;
  const accent = accentForRole(r);
  const mode = c ? AUTOMATION_MODES.find((m) => m.value === c.automation_mode) : null;
  const recent = useMemo(() => c ? (posts || []).filter((p) => p.connection_id === c.id).slice(0, 10) : [], [c, posts]);
  const d = c ? daysSinceSync(c) : null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {c && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display text-xl">{platformName(c.platform)} · {c.display_name || "Unnamed account"}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-10 space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${HEALTH_BADGE[hs].className}`}>{HEALTH_BADGE[hs].label}</span>
                <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-stone-100 text-stone-600 capitalize">{c.kind}</span>
                <span className="text-xs text-stone-500">Profile {completenessPct(c)}% · {completenessLevel(c)}</span>
              </div>

              {c.external_url && (
                <a href={c.external_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full rounded-xl"><ExternalLink className="w-4 h-4 mr-2" />Open external profile</Button>
                </a>
              )}

              <Section title="Responsible agent">
                {agent ? (
                  <div className={`flex items-center gap-2.5 rounded-xl p-3 ${accent.bg}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${accent.dot}`} />
                    <div>
                      <p className="font-medium text-stone-900">{agent.name}</p>
                      <p className="text-xs text-stone-500 capitalize">{agent.role}{agent.trust_score ? ` · trust ${agent.trust_score}` : ""}</p>
                    </div>
                  </div>
                ) : <p className="text-sm text-stone-400">No agent assigned.</p>}
              </Section>

              <Section title="Associated campaign">
                {camp ? <Link to={`/campaign/${camp.id}`} className="text-primary hover:underline text-sm">{camp.title}</Link> : <p className="text-sm text-stone-400">Not linked to a campaign.</p>}
              </Section>

              <Section title="Account info">
                <dl className="text-sm space-y-1.5">
                  <InfoRow k="Platform" v={platformName(c.platform)} />
                  <InfoRow k="Display name" v={c.display_name || "—"} />
                  <InfoRow k="Kind" v={c.kind} cap />
                  <InfoRow k="Automation" v={mode?.label || c.automation_mode || "—"} />
                  <InfoRow k="OBO permission" v={oboGranted(c) ? "Granted" : "Not granted"} bool={oboGranted(c)} />
                  <InfoRow k="Credential status" v={credentialStatus(c)} />
                  {c.kind === "crowdfunding" && <InfoRow k="Raised on platform" v={`${c.external_currency || "UNSPECIFIED"} ${(c.external_total || 0).toLocaleString()} · ${c.external_donor_count || 0} donors`} />}
                </dl>
              </Section>

              <Section title="Connection health">
                <dl className="text-sm space-y-1.5">
                  <InfoRow k="Status" v={c.status} cap />
                  <InfoRow k="Last synced" v={c.last_synced ? `${formatDistanceToNow(new Date(c.last_synced), { addSuffix: true })} (${d}d)` : "never"} />
                  <InfoRow k="Last error" v={c.last_error || "None"} danger={!!c.last_error} />
                </dl>
                <p className="text-xs text-stone-500 mt-3">
                  Provider state changes only after a provider-backed webhook, API operation, or synchronization workflow succeeds.
                </p>
              </Section>

              {hs === "requires_action" && (
                <Section title="Required admin action">
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <p className="font-medium mb-1 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />Action needed</p>
                    <p>{c.last_error || (c.status === "disconnected" ? "This account is disconnected and needs to be reconnected." : "Resolve the connection error to restore sync.")}</p>
                  </div>
                </Section>
              )}

              <Section title="Recent posts (last 10)">
                <div className="space-y-2">
                  {recent.map((p) => (
                    <div key={p.id} className="rounded-xl border border-stone-200 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${POST_STATUS_COLOR[p.status] || "bg-stone-100 text-stone-600"}`}>{POST_STATUS[p.status] || p.status}</span>
                        <span className="text-xs text-stone-400">{p.published_at ? new Date(p.published_at).toLocaleDateString() : "—"}</span>
                      </div>
                      <p className="text-sm text-stone-700 line-clamp-2">{p.content}</p>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-xs text-stone-400 truncate">{p.campaign_title || campaigns[p.campaign_id]?.title || "—"}</span>
                        {p.external_post_url && (
                          <a href={p.external_post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0">
                            <ExternalLink className="w-3 h-3" />Open
                          </a>
                        )}
                      </div>
                      {p.error && <p className="text-xs text-red-500 mt-1">{p.error}</p>}
                    </div>
                  ))}
                  {!recent.length && <p className="text-sm text-stone-400">No posts for this account yet.</p>}
                </div>
              </Section>

              {(c.history?.length || 0) > 0 && (
                <Section title="Sync history">
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {c.history.slice().reverse().slice(0, 10).map((h, i) => (
                      <li key={i} className="text-xs text-stone-500">
                        <span className="font-medium text-stone-700 capitalize">{h.event}</span> — {h.detail} · {h.at ? formatDistanceToNow(new Date(h.at), { addSuffix: true }) : ""}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}