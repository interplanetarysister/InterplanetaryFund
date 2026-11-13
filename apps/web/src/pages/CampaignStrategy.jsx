import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";

const CHECKS = [
  ["has_clear_title", "A specific, descriptive title", "State who needs help and why"],
  ["has_summary", "An understandable short summary", "Explain the need in at least a few sentences"],
  ["has_story", "A detailed campaign story", "Explain the background and intended impact"],
  ["has_goal", "A fundraising target", "Use a realistic amount supported by your budget"],
  ["has_cover_reference", "A campaign cover reference", "Choose an image you own or can use"],
];
export default function CampaignStrategy() {
  const [state, setState] = useState({ status: "loading", items: [], error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ status: "loading", items: [], error: "" });
    authClient().rpc("ifund_owner_campaign_strategy_readiness")
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !Array.isArray(data)) throw new Error("Your private campaign readiness could not be verified.");
        setState({ status: "ready", items: data, error: "" });
      }).catch(e => { if (active) setState({ status: "error", items: [], error: e.message || "Unavailable" }); });
    return () => { active = false };
  }, [retry]);

  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">Strategy workspace</h1>
      <p className="text-sm text-muted-foreground">
        Free, owner-scoped campaign preparation checks using your existing records.
        No new AI inference, grant submissions or fundraising claims are generated here.
        These checks help you prepare; they do not guarantee publication, donations or campaign success.
      </p>
    </header>
    {state.status === "loading" && <p role="status">Checking your owned campaign drafts…</p>}
    {state.status === "error" && <section role="alert" className="rounded-xl border border-red-500/40 p-5">
      <p>{state.error}</p><button className="mt-3 min-h-11 rounded-lg border px-4" onClick={() => setRetry(n => n + 1)}>Retry</button>
    </section>}
    {state.status === "ready" && (state.items.length === 0
      ? <section className="space-y-3 rounded-xl border border-border p-5">
        <p>You do not have an owned campaign to review yet.</p>
        <Link to="/create" className="inline-flex min-h-11 items-center rounded-lg bg-cyan-600 px-4 font-semibold text-white">Start a campaign</Link>
      </section>
      : <div className="grid gap-4 sm:grid-cols-2">{state.items.map(item => {
        const passed = CHECKS.filter(([key]) => item[key] === true).length;
        return <article key={item.campaign_id} className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">{item.campaign_title || "Untitled campaign"}</h2>
            <p className="mt-1 text-sm text-muted-foreground capitalize">Current status: {item.campaign_status || "unknown"}</p>
            <p className="mt-1 text-sm font-semibold">{passed} of {CHECKS.length} content checks met</p>
          </div>
          <ul className="space-y-3">{CHECKS.map(([key, label, help]) =>
            <li key={key} className="text-sm">
              <span className="font-medium">{item[key] === true ? "Present: " : "Review: "}{label}</span>
              <p className="text-muted-foreground">{item[key] === true ? "Double-check accuracy before publishing." : help}</p>
            </li>
          )}</ul>
          <p className="text-xs text-muted-foreground">Cover check verifies only that a reference exists, not that its image URL loads or that you have image rights.</p>
          <Link to={"/campaigns/" + encodeURIComponent(item.campaign_id) + "/edit"}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold">
            Edit campaign
          </Link>
        </article>
      })}</div>)}
  </main>;
}
