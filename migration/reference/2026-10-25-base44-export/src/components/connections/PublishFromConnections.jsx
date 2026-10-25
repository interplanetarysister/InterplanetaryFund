import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { isUsableConnection } from "@/lib/connectionHealth";
import { Megaphone, ArrowUpRight } from "lucide-react";

const MAX_CAMPAIGNS = 10;
const MAX_DESTINATIONS = 5;
const MAX_PAIRS = 20;

function newBatchId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return String(Date.now()) + "-" + Math.random().toString(36).slice(2);
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

// The Connections screen provides an owner-only, explicit bulk workflow.
// Unsupported provider capabilities must always become copy-and-post handoffs.
export default function PublishFromConnections() {
  const [campaigns, setCampaigns] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [selectedCampaigns, setSelectedCampaigns] = useState([]);
  const [selectedDestinations, setSelectedDestinations] = useState([]);
  const [rightsApproved, setRightsApproved] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [batchId, setBatchId] = useState(newBatchId);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const owner = await base44.auth.me();
        if (!owner?.id) throw new Error("Sign in to IFund first.");
        const rows = await base44.entities.Campaign.filter({ created_by_id: owner.id }, "-created_date", 30);
        if (active) setCampaigns((rows || []).filter(c => c.created_by_id === owner.id && c.status !== "deleted"));
        try {
          const { data } = await base44.functions.invoke("listConnections", { scope: "mine" });
          if (!Array.isArray(data?.connections)) throw new Error("Connections could not be checked.");
          if (active) setConnections(data.connections.filter(c => c.created_by_id === owner.id && c.kind === "social" && isUsableConnection(c)));
        } catch {
          if (active) setConnectionError("Connected destinations could not be verified. Bulk publishing is disabled until the account check succeeds.");
        }
      } catch {
        if (active) setError(true);
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const eligibleCampaigns = campaigns.filter(c => c.status === "active");
  const selected = eligibleCampaigns.filter(c => selectedCampaigns.includes(c.id));
  const destinations = connections.filter(c => selectedDestinations.includes(c.id));

  const pairs = useMemo(() => selected.flatMap(campaign =>
    destinations.filter(conn => !conn.campaign_id || conn.campaign_id === campaign.id)
      .map(conn => ({ campaign, conn }))
  ), [selected, destinations]);

  const resetApproval = () => {
    setRightsApproved(false);
    setResults([]);
    setBatchId(newBatchId());
  };
  const toggleCampaign = id => {
    if (processing) return;
    setSelectedCampaigns(previous => previous.includes(id) ? previous.filter(value => value !== id)
      : previous.length < MAX_CAMPAIGNS ? [...previous, id] : previous);
    resetApproval();
  };
  const toggleDestination = id => {
    if (processing) return;
    setSelectedDestinations(previous => previous.includes(id) ? previous.filter(value => value !== id)
      : previous.length < MAX_DESTINATIONS ? [...previous, id] : previous);
    resetApproval();
  };

  const bulkPublish = async () => {
    if (processing || !rightsApproved || !pairs.length || pairs.length > MAX_PAIRS ||
      selectedCampaigns.length > MAX_CAMPAIGNS || selectedDestinations.length > MAX_DESTINATIONS || connectionError) return;
    if (!window.confirm(`Publish or prepare ${pairs.length} campaign/destination posts? You will see an individual result for each. No unsupported platform will be marked published.`)) return;
    setProcessing(true);
    setResults([]);
    const completed = [];
    for (const { campaign, conn } of pairs) {
      const name = campaign.title || "Campaign";
      const destination = conn.display_name || conn.platform;
      const campaignUrl = `https://interplanetaryfund.com/campaign/${encodeURIComponent(campaign.id)}`;
      const content = [name, String(campaign.summary || campaign.story || "").replace(/\s+/g, " ").slice(0, 900), campaignUrl]
        .filter(Boolean).join("\n\n");
      try {
        const { data: prepared } = await base44.functions.invoke("createDistributedPost", {
          campaign_id: campaign.id, connection_id: conn.id, content,
          bulk_batch_id: batchId,
        });
        if (prepared?.ok !== true || !prepared.post?.id) throw new Error("The post could not be prepared.");
        // The server resolves the actual donation destination and corrects the
        // fundraising link. Never let manual sharing copy stale client text.
        const preparedCopy = String(prepared.post.content || content);
        // An earlier attempt may already have reached the provider. Reuse
        // the server's batch record, but NEVER replay its external write.
        if (prepared.duplicate === true && prepared.post.status !== "published") {
          completed.push({ id: campaign.id + ":" + conn.id, name, destination,
            status: "Previously prepared; review before retrying", content: preparedCopy,
            url: safeExternalUrl(conn.external_url) });
          setResults([...completed]);
          continue;
        }
        const { data: outcome } = await base44.functions.invoke("publishPost", {
          post_id: prepared.post.id, user_publish_authorized: true,
        });
        let status = "Unconfirmed";
        if (outcome?.manual === false && outcome.post?.status === "published") status = "Published";
        else if (outcome?.manual === true) status = "Manual share required";
        completed.push({ id: campaign.id + ":" + conn.id, name, destination, status, content: preparedCopy, url: safeExternalUrl(conn.external_url) });
      } catch {
        // A timed-out provider request may already have posted. Do not
        // automatically replay it. Keep the same batch ID on later clicks.
        completed.push({ id: campaign.id + ":" + conn.id, name, destination,
          status: "Needs review; no publication confirmed", content, url: safeExternalUrl(conn.external_url) });
      }
      setResults([...completed]);
    }
    setRightsApproved(false);
    setProcessing(false);
  };

  const countPublished = results.filter(result => result.status === "Published").length;
  const countManual = results.filter(result => result.status === "Manual share required").length;

  return (
    <section aria-label="Publish to connected accounts" className="mb-7 min-w-0 rounded-2xl border border-cyan-300/40 bg-slate-950 p-4 sm:p-5 text-cyan-50">
      <h2 className="flex items-center gap-2 font-semibold text-lg"><Megaphone className="w-5 h-5" /> Publish to your accounts</h2>
      <p className="text-sm text-slate-200 mt-1">
        Choose an IFund campaign, prepare its post, and send to verified destinations. Unsupported destinations require copying and posting manually.
      </p>
      {loading && <p className="text-sm text-slate-200 mt-3">Loading your campaigns and accounts…</p>}
      {!loading && error && <p role="alert" className="text-sm text-amber-200 mt-3">Your campaigns could not be loaded. <Link to="/dashboard" className="underline">Open dashboard</Link>.</p>}
      {!loading && !error && !campaigns.length && (
        <Link to="/create" className="inline-flex mt-3 min-h-11 items-center rounded-xl bg-cyan-300 px-4 py-2 text-slate-950 font-semibold">Create a campaign</Link>
      )}
      {!loading && !error && campaigns.length > 0 && (
        <>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {campaigns.map(c => (
              <Link key={c.id} to={`/campaign/${encodeURIComponent(c.id)}#campaign-distribution`}
                className="inline-flex min-w-0 min-h-11 items-center justify-between gap-2 rounded-xl border border-cyan-300/40 bg-slate-900 px-3 py-2 text-cyan-50 hover:border-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-200">
                <span className="truncate">{c.title || "Your campaign"}</span><ArrowUpRight className="w-4 h-4 shrink-0" />
              </Link>
            ))}
          </div>
          <div className="mt-5 border-t border-cyan-300/20 pt-5" aria-label="Bulk campaign social actions">
            <h3 className="text-base font-semibold">Bulk actions</h3>
            <p className="text-sm text-slate-200 mt-1">Select up to {MAX_CAMPAIGNS} active campaigns and {MAX_DESTINATIONS} authorized social accounts, with a limit of {MAX_PAIRS} posts per batch. Only the campaign owner can publish.</p>
            <div className="flex flex-wrap gap-2 my-3">
              <button type="button" disabled={processing} onClick={() => {setSelectedCampaigns(eligibleCampaigns.slice(0, MAX_CAMPAIGNS).map(c => c.id));resetApproval();}}
                className="rounded-lg border border-cyan-300/40 px-3 py-2 text-sm">Select up to {MAX_CAMPAIGNS} campaigns</button>
              <button type="button" disabled={processing} onClick={() => {setSelectedCampaigns([]);setSelectedDestinations([]);resetApproval();}}
                className="rounded-lg border border-cyan-300/40 px-3 py-2 text-sm">Clear</button>
            </div>
            {eligibleCampaigns.length === 0 && <p className="text-sm text-slate-200">Publish an IFund campaign before sharing it.</p>}
            <div className="max-h-52 overflow-y-auto space-y-2" role="group" aria-label="Select campaigns">
              {eligibleCampaigns.map(c => <label key={c.id} className="flex items-center gap-3 min-h-10 text-sm">
                <input type="checkbox" checked={selectedCampaigns.includes(c.id)}
                  disabled={processing || (!selectedCampaigns.includes(c.id) && selectedCampaigns.length >= MAX_CAMPAIGNS)}
                  onChange={() => toggleCampaign(c.id)} className="size-4" />
                <span>{c.title || "Untitled campaign"}</span>
              </label>)}
            </div>
            <h4 className="mt-4 text-sm font-semibold">Connected social accounts</h4>
            {connectionError && <p role="alert" className="text-amber-200 text-sm">{connectionError}</p>}
            {!connectionError && connections.length === 0 && <p className="text-sm text-slate-200 mt-1">No independently verified publishing accounts. <Link to="/connections#social-connections" className="underline">Connect an account</Link> first. Facebook sign-in alone does not grant Page posting.</p>}
            <div role="group" aria-label="Select authorized destinations" className="space-y-2 max-h-52 overflow-y-auto mt-2">
              {connections.map(conn => <label key={conn.id} className="flex items-center gap-3 min-h-10 text-sm">
                <input type="checkbox" checked={selectedDestinations.includes(conn.id)}
                  disabled={processing || (!selectedDestinations.includes(conn.id) && selectedDestinations.length >= MAX_DESTINATIONS)}
                  onChange={() => toggleDestination(conn.id)} className="size-4" />
                <span>{conn.display_name || conn.platform} · {conn.platform}{conn.campaign_id ? " (specific campaign)" : ""}</span>
              </label>)}
            </div>
            <p className="text-sm text-slate-200 mt-3">{selected.length} campaigns × {destinations.length} accounts; {pairs.length} compatible posts in this batch.
              {selected.length && destinations.length && pairs.length < selected.length * destinations.length ? " Campaign-specific account restrictions were applied." : ""}
            </p>
            {pairs.length > MAX_PAIRS && <p role="alert" className="text-amber-200 text-sm">Reduce the selection to {MAX_PAIRS} posts or fewer.</p>}
            <label className="flex items-start gap-3 mt-3 text-sm">
              <input type="checkbox" className="size-4 mt-1" checked={rightsApproved} disabled={processing}
                onChange={e => setRightsApproved(e.target.checked)} />
              <span>I own or have permission to share these campaign details and authorize this one batch of external posts.</span>
            </label>
            <button type="button" onClick={bulkPublish}
              disabled={processing || loading || !!connectionError || !rightsApproved || !pairs.length || pairs.length > MAX_PAIRS}
              className="mt-3 min-h-11 w-full sm:w-auto rounded-xl bg-cyan-300 px-4 py-2 text-slate-950 font-semibold disabled:opacity-50">
              {processing ? "Processing selected posts…" : `Publish or prepare ${pairs.length} selected posts`}
            </button>
            {results.length > 0 && <section className="mt-4" aria-live="polite" aria-label="Bulk publish outcomes">
              <p className="text-sm font-semibold">{countPublished} provider-confirmed published · {countManual} require manual sharing · {results.length - countPublished - countManual} need review or remain unconfirmed</p>
              <ul className="mt-2 space-y-2">
                {results.map(result => <li key={result.id} className="rounded-lg border border-cyan-300/20 bg-slate-900 p-3 text-sm">
                  <strong>{result.name}</strong> → {result.destination}: {result.status}
                  {result.status === "Manual share required" && <>
                    <button type="button" className="ml-2 underline" onClick={() => navigator.clipboard.writeText(result.content)
                      .catch(() => window.prompt("Copy the post text:", result.content))}>Copy text</button>
                    {result.url && <a href={result.url} target="_blank" rel="noopener noreferrer" className="ml-3 underline">Open account</a>}
                  </>}
                </li>)}
              </ul>
            </section>}
          </div>
        </>
      )}
    </section>
  );
}
