import { useRef, useState } from "react";
import CampaignEngagement from "./CampaignEngagement";
import FinanceDashboard from "./FinanceDashboard";
import Atlas from "./Atlas";
import CampaignStrategy from "./CampaignStrategy";

/**
 * Reuses the established owner-scoped finance/engagement RPCs and public
 * opt-in-only Atlas queries. Each view retains its own loading/error states.
 * No sandbox financial records are merged into member dashboards.
 */
// Horizontal tabs support WCAG keyboard navigation without mounting hidden
// finance or Atlas panels (which would trigger unnecessary private reads).
function nextTabIndex(index, key, count) {
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

export default function AnalyticsCenter() {
  const [view, setView] = useState("analysis");
  const tabRefs = useRef([]);
  const tabs = [
    ["analysis", "AI Analysis & refinement"],
    ["engagement", "Supporter engagement"],
    ["finance", "Verified finances"],
    ["atlas", "Campaign atlas"],
  ];
  return <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-7">
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">Campaign command center</h1>
      <p className="text-sm text-muted-foreground">Review and refine campaign quality, supporter engagement, verified finances, and public campaign geography. Writing advice does not guarantee fundraising results.</p>
    </header>
    <div role="tablist" aria-label="Analytics views" aria-orientation="horizontal" className="flex flex-wrap gap-2">
      {tabs.map(([id,label], index) => <button key={id} type="button" role="tab"
        id={"analytics-tab-"+id} aria-selected={view===id}
        aria-controls="analytics-panel"
        tabIndex={view===id ? 0 : -1}
        ref={node => { tabRefs.current[index] = node; }}
        onClick={() => setView(id)}
        onKeyDown={event => {
          const next = nextTabIndex(index, event.key, tabs.length);
          if (next === null) return;
          event.preventDefault();
          setView(tabs[next][0]);
          tabRefs.current[next]?.focus();
        }}
        className={"min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 " + (view===id ? "border-cyan-500 bg-cyan-500/10" : "border-border")}>
        {label}
      </button>)}
    </div>
    <section id="analytics-panel" role="tabpanel" tabIndex={0}
      aria-labelledby={"analytics-tab-"+view}>
      {view==="analysis" ? <CampaignStrategy/> : view==="engagement" ? <CampaignEngagement/> : view==="finance" ? <FinanceDashboard/> : <Atlas/>}
    </section>
  </div>;
}
