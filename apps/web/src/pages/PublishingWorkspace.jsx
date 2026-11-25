import { lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";

const CommunicationsWorkspace = lazy(() => import("./CommunicationsWorkspace"));
const CreatorMediaTools = lazy(() => import("../components/communications/CreatorMediaTools"));
const AudienceReviewBench = lazy(() => import("../components/communications/AudienceReviewBench"));

const TABS = [
  { id: "messages", label: "Messages" },
  { id: "media", label: "Media" },
  { id: "audience", label: "Audience & testing" },
  { id: "review", label: "Review & approvals" },
];

/**
 * One creator workspace, not another publishing engine. Each tool mounts only
 * when selected; owner checks, consent, drafts and provider quotas stay in
 * their existing components. A tab is never permission to publish.
 */
export default function PublishingWorkspace() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") || "messages";
  const active = TABS.some(tab => tab.id === requested) ? requested : "messages";
  const select = id => {
    const next = new URLSearchParams(params);
    if (id === "messages") next.delete("tab");
    else next.set("tab", id);
    setParams(next);
  };
  return <div className="mx-auto max-w-6xl space-y-5 px-4 py-7 sm:px-7">
    <header className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500">Campaign Growth Studio</p>
      <h1 className="text-3xl font-bold">Create, improve, review</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Keep campaign messages, artwork, audience evidence and approvals together.
        Nothing is published or sent without the existing verified permissions and review steps.
      </p>
      <Link className="text-sm underline" to="/connections">Manage connected accounts and publishing permissions</Link>
    </header>
    <nav aria-label="Growth Studio sections" className="flex gap-2 overflow-x-auto pb-2">
      {TABS.map(tab => <button key={tab.id} type="button"
        aria-current={active === tab.id ? "page" : undefined}
        onClick={() => select(tab.id)}
        className={"ifund-interactive min-h-11 shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 " +
          (active === tab.id ? "border-cyan-500 bg-cyan-500/10" : "border-border")}>
        {tab.label}
      </button>)}
    </nav>
    <Suspense fallback={<p role="status">Loading your workspace…</p>}>
      {(active === "messages" || active === "review")
        ? <CommunicationsWorkspace embedded focusReview={active === "review"} />
        : active === "media"
          ? <CreatorMediaTools />
          : <AudienceReviewBench />}
    </Suspense>
  </div>;
}
