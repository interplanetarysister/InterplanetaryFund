import { Link, useSearchParams } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useSuperAdminAccess } from "@/hooks/useSuperAdminAccess";
import { Plug, Leaf, ShieldCheck, Wallet, BookOpen, Server, Sparkles, LayoutDashboard, ArrowRight } from "lucide-react";
import OperationsHub from "./OperationsHub";
import AdminConnections from "./AdminConnections";
import AdminSustainability from "./AdminSustainability";
import SocialModeration from "./SocialModeration";
import AdminAudit from "./AdminAudit";
import AdminDeletionQueue from "./AdminDeletionQueue";
import AdminStudio from "./AdminStudio";
import AdminHelpEditor from "./AdminHelpEditor";
import AdminSponsorInquiries from "./AdminSponsorInquiries";

// /admin is a functional navigation hub, not an elevated data endpoint.
// Actual route guards and backend RLS remain authoritative for every tool.
const common = [
  { to: "/admin/integrations", title: "Integrations", detail: "Connection gateway and provider readiness", icon: Plug },
  { to: "/admin/sustainability", title: "Planet Impact", detail: "Environmental and community commitments", icon: Leaf },
  { to: "/admin/social-moderation", title: "Community moderation", detail: "Moderate reported community content", icon: ShieldCheck },
  { to: "/admin/finance", title: "Platform finance", detail: "Review permitted financial operations", icon: Wallet },
];
const restricted = [
  { to: "/ops", title: "Operations", detail: "Platform system and agent oversight", icon: LayoutDashboard },
  { to: "/platform", title: "Platform", detail: "Super-administrator controls", icon: Server },
  { to: "/admin/audit", title: "Audit log", detail: "Review verified platform audit events", icon: ShieldCheck },
  { to: "/admin/deletions", title: "Deletion requests", detail: "Review confirmed account erasure requests and legal retention", icon: ShieldCheck },
  { to: "/admin/studio", title: "Website studio", detail: "Manage authorized site content", icon: Sparkles },
  { to: "/admin/help", title: "Help Center editor", detail: "Manage published help guidance", icon: BookOpen },
];

// Sprint 8 (2026-11-25): Admin Console (40-page list, page 21) — one tabbed
// console for every admin destination. The Overview tab is the existing
// link hub, unchanged; every other tab renders the existing destination
// page as its panel, so no destination is rebuilt and no component moves.
// Each destination was checked for route-context dependencies before
// embedding: none of them reads useParams, useLocation, useNavigate or
// useSearchParams, and none depends on Layout, so they render inside a
// tab panel exactly as they render on their own routes. Their own
// session/RPC checks still run; the tab gate below is UX only, never the
// authority. Tab state lives in the URL (?tab=audit) so tabs are
// deep-linkable. Unknown or missing values fall back to the Overview.
// There is no finance tab: /admin/finance already redirects to
// /finances#platform-finance. There is no planetary-impact tab: that page
// renders AdminSustainability publicly and stays its own destination.
// "moderation" and "social-moderation" are the same single destination
// (/admin/social-moderation -> SocialModeration), so they share one tab.
const ADMIN_CONSOLE_TABS = Object.freeze([
  { id: "overview", label: "Overview", superAdminOnly: false },
  { id: "ops", label: "Operations", superAdminOnly: true },
  { id: "platform", label: "Platform", superAdminOnly: true },
  { id: "integrations", label: "Integrations", superAdminOnly: false },
  { id: "sustainability", label: "Planet Impact", superAdminOnly: false },
  { id: "social-moderation", label: "Community moderation", superAdminOnly: false },
  { id: "audit", label: "Audit log", superAdminOnly: true },
  { id: "deletions", label: "Deletion requests", superAdminOnly: true },
  { id: "studio", label: "Website studio", superAdminOnly: true },
  { id: "help", label: "Help Center editor", superAdminOnly: true },
  { id: "sponsor-inquiries", label: "Sponsor inquiries", superAdminOnly: true },
]);

// Tab state lives in the URL (?tab=audit) so Admin Console tabs are
// deep-linkable. Unknown or missing values fall back to the Overview.
export function tabFromParam(value) {
  const found = ADMIN_CONSOLE_TABS.find((tab) => tab.id === String(value || "").toLowerCase());
  return found ? found.id : "overview";
}

const SUPER_ADMIN_TABS = Object.freeze(
  ADMIN_CONSOLE_TABS.filter((tab) => tab.superAdminOnly).map((tab) => tab.id),
);

// Restricted destinations stay super-admin-only per tab: a non-super-admin
// viewer gets this card instead of the panel — the destination component
// never mounts for them, so it fires no privileged reads.
function AdminSuperAdminRequired() {
  return <section className="space-y-3 rounded-2xl border border-border bg-card p-5" aria-label="Super-administrator access required">
    <h2 className="text-xl font-semibold">Super-administrator access required</h2>
    <p className="text-sm text-muted-foreground">This section is restricted to verified super-administrators. The tool itself was not opened — nothing here was read or changed.</p>
    <Link className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground" to="/admin?tab=overview">Back to the administration overview</Link>
  </section>;
}

export default function AdminHub() {
  const { user } = useAuthSession();
  const elevated = useSuperAdminAccess(user);
  const showRestricted = elevated === "super-admin";
  const items = showRestricted ? [...common, ...restricted] : common;
  const [params, setParams] = useSearchParams();
  const tab = tabFromParam(params.get("tab"));
  const setTab = (next) => setParams({ tab: tabFromParam(next) });

  // Panels that used to sit behind SuperAdminAccess on their own routes
  // keep their route-level gate. While the super-admin check is resolving,
  // show a loading state so the panel does not mount and fire privileged
  // reads as an unverified viewer; other viewers get the unauthorized card
  // instead of the panel.
  function superAdminTabPanel(tabId, panel) {
    if (!SUPER_ADMIN_TABS.includes(tabId)) return panel;
    if (elevated === "loading")
      return <p role="status" className="text-sm text-muted-foreground">Checking additional administrator tools…</p>;
    if (elevated !== "super-admin") return <AdminSuperAdminRequired />;
    return panel;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[.16em] text-emerald-600 dark:text-emerald-300">IFund administration</p>
        <h1 className="text-3xl font-bold tracking-tight">Administrative workspace</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Access your authorized administration tools from one place. Privileged
          actions remain restricted by verified identity and server permissions.
        </p>
      </header>
      <div role="tablist" aria-label="Administration sections" className="flex flex-wrap gap-2">
        {ADMIN_CONSOLE_TABS.map((item) => (
          <button key={item.id} type="button" role="tab" id={`admin-tab-${item.id}`}
            aria-selected={tab === item.id} aria-controls={`admin-panel-${item.id}`}
            className={`ifund-interactive min-h-11 rounded-xl border px-4 py-2 font-semibold ${tab === item.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
            onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div role="tabpanel" id="admin-panel-overview" aria-labelledby="admin-tab-overview" className="space-y-7">
          <section aria-label="Administrative destinations" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ to, title, detail, icon: Icon }) => (
              <Link key={to} to={to}
                className="group flex min-h-36 flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-emerald-500/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500">
                <span className="flex items-center gap-3 font-semibold"><Icon aria-hidden="true" className="h-6 w-6 text-emerald-500" />{title}</span>
                <span className="mt-3 text-sm text-muted-foreground">{detail}</span>
                <span className="mt-3 flex items-center gap-2 text-xs font-semibold text-primary">Open <ArrowRight aria-hidden="true" className="h-4 w-4" /></span>
              </Link>
            ))}
          </section>
          {elevated === "loading" && <p role="status" className="text-sm text-muted-foreground">Checking additional administrator tools…</p>}
          {elevated === "unavailable" && <p role="status" className="text-sm text-muted-foreground">Additional administrator privileges could not be verified. Restricted tools are hidden.</p>}
        </div>
      )}

      {tab === "ops" && (
        <div role="tabpanel" id="admin-panel-ops" aria-labelledby="admin-tab-ops">
          {superAdminTabPanel("ops", <OperationsHub />)}
        </div>
      )}

      {tab === "platform" && (
        <div role="tabpanel" id="admin-panel-platform" aria-labelledby="admin-tab-platform">
          {superAdminTabPanel("platform", <OperationsHub platform />)}
        </div>
      )}

      {tab === "integrations" && (
        <div role="tabpanel" id="admin-panel-integrations" aria-labelledby="admin-tab-integrations">
          <AdminConnections />
        </div>
      )}

      {tab === "sustainability" && (
        <div role="tabpanel" id="admin-panel-sustainability" aria-labelledby="admin-tab-sustainability">
          <AdminSustainability />
        </div>
      )}

      {tab === "social-moderation" && (
        <div role="tabpanel" id="admin-panel-social-moderation" aria-labelledby="admin-tab-social-moderation">
          <SocialModeration />
        </div>
      )}

      {tab === "audit" && (
        <div role="tabpanel" id="admin-panel-audit" aria-labelledby="admin-tab-audit">
          {superAdminTabPanel("audit", <AdminAudit />)}
        </div>
      )}

      {tab === "deletions" && (
        <div role="tabpanel" id="admin-panel-deletions" aria-labelledby="admin-tab-deletions">
          {superAdminTabPanel("deletions", <AdminDeletionQueue />)}
        </div>
      )}

      {tab === "studio" && (
        <div role="tabpanel" id="admin-panel-studio" aria-labelledby="admin-tab-studio">
          {superAdminTabPanel("studio", <AdminStudio />)}
        </div>
      )}

      {tab === "help" && (
        <div role="tabpanel" id="admin-panel-help" aria-labelledby="admin-tab-help">
          {superAdminTabPanel("help", <AdminHelpEditor />)}
        </div>
      )}

      {tab === "sponsor-inquiries" && (
        <div role="tabpanel" id="admin-panel-sponsor-inquiries" aria-labelledby="admin-tab-sponsor-inquiries">
          {superAdminTabPanel("sponsor-inquiries", <AdminSponsorInquiries />)}
        </div>
      )}
    </main>
  );
}
