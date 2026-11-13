import { Link } from "react-router-dom";
import BuilderOperationalReview from "@/components/agents/BuilderOperationalReview";
import WorkflowRegistry from "@/components/agents/WorkflowRegistry";

/**
 * Super-admin read-only operational overview. Never turns an incident
 * dashboard into a deployment console or claims provider health without
 * validated runtime evidence.
 */
export default function OperationsHub({ platform = false }) {
  const areas = [
    { to: "/admin/studio", label: "Website Studio", detail: "Edit and review approved site content" },
    { to: "/admin/social-moderation", label: "Community moderation", detail: "Review reported community content" },
    { to: "/finances#platform-finance", label: "Verified financial reporting", detail: "Provider-confirmed records and authorized reconciliation" },
    { to: "/connections", label: "Member connections", detail: "Review account-scoped provider connections" },
    { to: "/hackathon/tracker", label: "Judge demo tracker", detail: "Separate sandbox evidence and acceptance records" },
  ];
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">{platform ? "Platform operations" : "Operations center"}</h1>
      <p className="text-sm text-muted-foreground">Verified super-administrator workspace. Live deployment, payout, media and provider actions require their own authorized and independently verified workflows; this page is read-only.</p>
    </header>
    <BuilderOperationalReview />
    <WorkflowRegistry />
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-xl font-semibold">Administration workspaces</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {areas.map(item => <Link key={item.to} to={item.to} className="rounded-xl border border-border p-4 hover:border-cyan-500/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
          <span className="block font-semibold">{item.label}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{item.detail}</span>
        </Link>)}
      </div>
    </section>
  </main>;
}
