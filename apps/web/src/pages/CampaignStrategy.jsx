import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { listOwnerCampaigns } from "@/api/ownerCampaigns";
import { reviewCampaignPublication } from "@/lib/prepublicationReview.mjs";
import { reviewCampaignWideEditorial } from "@/lib/campaignEditorialImprovements.mjs";
import CampaignBudgetPlanner from "@/components/agents/CampaignBudgetPlanner";

const fieldId = finding => finding.field === "title" || finding.id === "title_repetition" ? "campaign-title"
  : finding.field === "summary" || finding.id === "summary_repeated" ? "campaign-summary"
  : finding.id === "budget_clarity" ? "campaign-goal" : "campaign-story";

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
    const client=authClient();
    Promise.all([
      client.rpc("ifund_owner_campaign_strategy_readiness"),
      listOwnerCampaigns(client),
    ]).then(([{data,error},campaigns]) => {
      if (!active) return;
      if (error || !Array.isArray(data) || !Array.isArray(campaigns))
        throw new Error("Your private campaign readiness could not be verified.");
      const owned=new Map(campaigns.map(c=>[c.id,c]));
      const items=data.map(item=>{
        const campaign=owned.get(item.campaign_id);
        return {...item, editorial:campaign ? reviewCampaignPublication(campaign) : null,
          campaignWide:campaign ? reviewCampaignWideEditorial(campaign) : []};
      });
      setState({ status:"ready", items, error:"" });
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
    <CampaignBudgetPlanner />
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
            <p className="mt-1 text-sm font-semibold">
              Full-length story: {item.editorial ? item.editorial.storyCharacters.toLocaleString()+" / 3,500 characters" : "Unavailable"}
            </p>
            {item.editorial && item.editorial.remainingCharacters>0 &&
              <p className="mt-1 text-sm text-amber-700">Add {item.editorial.remainingCharacters.toLocaleString()} characters before publishing.</p>}
          </div>
          <ul className="space-y-3">{CHECKS.map(([key, label, help]) =>
            <li key={key} className="text-sm">
              <span className="font-medium">{item[key] === true ? "Present: " : "Review: "}{label}</span>
              <p className="text-muted-foreground">{item[key] === true ? "Double-check accuracy before publishing." : help}</p>
            </li>
          )}</ul>
          <p className="text-xs text-muted-foreground">Cover check verifies only that a reference exists, not that its image URL loads or that you have image rights.</p>
          {item.editorial && [...item.editorial.findings, ...item.campaignWide.filter(f=>!item.editorial.findings.some(g=>g.id===f.id))].length>0 && <section className="space-y-3 rounded-xl border border-border p-3" aria-label="Contextual campaign writing guidance">
            <h3 className="font-semibold">POLARIS · Writing improvements</h3>
            <p className="text-xs text-muted-foreground">These recommendations come from this campaign's saved text. They never fabricate supporting facts or rewrite your story without approval.</p>
            <ul className="space-y-3">{[...item.editorial.findings, ...item.campaignWide.filter(f=>!item.editorial.findings.some(g=>g.id===f.id))].slice(0,6).map(finding=><li key={finding.id} className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="font-semibold">{finding.title}</p>
              <p className="mt-1 text-muted-foreground">{finding.advice}</p>
              <Link className="mt-2 inline-flex min-h-11 items-center underline" to={"/campaigns/"+encodeURIComponent(item.campaign_id)+"/edit#"+fieldId(finding)}>
                Open the relevant campaign field
              </Link>
            </li>)}</ul>
          </section>}
          <Link to={"/campaigns/" + encodeURIComponent(item.campaign_id) + "/edit#campaign-story"}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold">
            Edit campaign
          </Link>
        </article>
      })}</div>)}
  </main>;
}
