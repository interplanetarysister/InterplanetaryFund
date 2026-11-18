import { Link } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useSuperAdminAccess } from "@/hooks/useSuperAdminAccess";
import { Plug, Leaf, ShieldCheck, Wallet, BookOpen, Server, Sparkles, LayoutDashboard, ArrowRight, Handshake } from "lucide-react";

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
  { to: "/admin/managed-fundraisers", title: "Managed fundraisers", detail: "Creator mandates, full-control AI delegation and private review", icon: Handshake },
];
export default function AdminHub() {
  const { user } = useAuthSession();
  const elevated = useSuperAdminAccess(user);
  const showRestricted = elevated === "super-admin";
  const items = showRestricted ? [...common, ...restricted] : common;
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
    </main>
  );
}
