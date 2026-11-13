import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { listOwnerCampaigns, setCampaignStatus, deleteDraftCampaign, isCampaignConflict } from "@/api/ownerCampaigns";
import { campaignStatusLabel, campaignStatusTone, publishReadiness } from "@/lib/campaignLifecycle";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import CampaignShareButton from "@/components/campaigns/CampaignShareButton";
import PageError from "@/components/PageError";
import PrelaunchNotice from "@/components/prelaunch/PrelaunchNotice";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";
import { Pencil, PlusCircle, Loader2, Eye, PauseCircle, PlayCircle, Trash2, Compass } from "lucide-react";

const money = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? `$${amount.toLocaleString()}` : "Goal not set";
};

// Owner campaign management. Reads and writes are scoped to the signed-in
// member and enforced by Supabase row level security; publishing makes a
// campaign publicly discoverable but never enables donations.
export default function MyCampaigns() {
  const donationsEnabled = usePublicCampaignFundraising();
  const alive = useRef(true);
  const generation = useRef(0);
  const lock = useRef(false);
  const [rows, setRows] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmingId, setConfirmingId] = useState("");

  const load = useCallback(async () => {
    const request = ++generation.current;
    setPhase("loading"); setError("");
    try {
      const data = await listOwnerCampaigns(authClient());
      if (alive.current && request === generation.current) { setRows(data); setPhase("ready"); }
    } catch (cause) {
      if (alive.current && request === generation.current) {
        setError(cause?.message || "Your campaigns could not be loaded.");
        setPhase("error");
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; generation.current += 1; };
  }, [load]);

  async function changeStatus(campaign, status) {
    if (lock.current) return;
    lock.current = true;
    setBusyId(campaign.id); setError(""); setNotice("");
    try {
      const saved = await setCampaignStatus(authClient(), campaign.id, status);
      setRows((current) => current.map((row) => (row.id === saved.id ? saved : row)));
      setNotice(
        status === "active"
          ? `"${saved.title}" is published and visible on Discover. ${donationsEnabled ? "Supporters may donate through verified PayPal checkout." : "Live donation checkout is temporarily unavailable."}`
          : `"${saved.title}" was paused and is hidden from Discover.`
      );
    } catch (cause) {
      setError(cause?.message || "The campaign status change was not saved.");
      // A lost race means another session already changed this campaign;
      // reload so the list shows the current stored state.
      if (isCampaignConflict(cause)) load();
    } finally {
      lock.current = false; setBusyId("");
    }
  }

  async function remove(campaign) {
    if (lock.current) return;
    lock.current = true;
    setBusyId(campaign.id); setError(""); setNotice("");
    try {
      await deleteDraftCampaign(authClient(), campaign.id);
      setRows((current) => current.filter((row) => row.id !== campaign.id));
      setNotice("Draft deleted.");
    } catch (cause) {
      setError(cause?.message || "The draft could not be deleted.");
      if (isCampaignConflict(cause)) load();
    } finally {
      lock.current = false; setBusyId(""); setConfirmingId("");
    }
  }

  if (phase === "loading") {
    return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your campaigns…
      </p>
    </main>;
  }

  if (phase === "error") {
    return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageError message={error} onRetry={load} />
    </main>;
  }

  const published = rows.filter((row) => row.status === "active").length;

  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">My campaigns</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Save a private draft, publish it to Discover, or pause it at any time. {donationsEnabled ? "Published, active campaigns can receive verified PayPal donations." : "Live donation checkout is temporarily unavailable."}
        </p>
      </div>
      <Link to="/create" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
        <PlusCircle className="h-4 w-4" aria-hidden="true" /> New campaign
      </Link>
    </header>

    {!donationsEnabled && <PrelaunchNotice compact />}

    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total</dt>
        <dd className="mt-1 text-2xl font-semibold">{rows.length}</dd>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Published</dt>
        <dd className="mt-1 text-2xl font-semibold">{published}</dd>
      </div>
      <div className="col-span-2 rounded-2xl border border-border bg-card p-4 sm:col-span-1">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Drafts</dt>
        <dd className="mt-1 text-2xl font-semibold">{rows.length - published}</dd>
      </div>
    </dl>

    {notice && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">{notice}</p>}
    {error && <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-destructive">{error}</p>}

    {rows.length === 0 ? (
      <section className="rounded-2xl border border-border bg-card p-6 text-center">
        <h2 className="text-xl font-semibold">No campaigns yet</h2>
        <p className="mt-2 text-muted-foreground">Start with a draft. You can publish when your story is ready.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link to="/create" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
            <PlusCircle className="h-4 w-4" aria-hidden="true" /> Create a campaign
          </Link>
          <Link to="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-5 font-semibold">
            <Compass className="h-4 w-4" aria-hidden="true" /> Explore campaigns
          </Link>
        </div>
      </section>
    ) : (
      <ul className="space-y-4">
        {rows.map((campaign) => {
          const readiness = publishReadiness(campaign);
          const busy = busyId === campaign.id;
          return <li key={campaign.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${campaignStatusTone(campaign.status)}`}>
                    {campaignStatusLabel(campaign.status)}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {categoryLabels[campaign.category] || "Other"}
                  </span>
                </div>
                <h2 className="mt-2 truncate font-display text-xl text-foreground">{campaign.title || "Untitled campaign"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Goal {money(campaign.goal_amount)} · Raised totals are not shown until independently reconciled
                </p>
                {campaign.status === "draft" && !readiness.ready && (
                  <p className="mt-2 text-sm text-amber-700">
                    Not ready to publish: {readiness.missing[0]}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/campaigns/${campaign.id}/edit`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 font-semibold">
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                </Link>
                {campaign.status === "active" && (
                  <Link to={`/campaign/${campaign.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 font-semibold">
                    <Eye className="h-4 w-4" aria-hidden="true" /> View
                  </Link>
                )}
                {campaign.status === "draft" && (
                  <button type="button" disabled={busy || !readiness.ready}
                    onClick={() => changeStatus(campaign, "active")}
                    title={readiness.ready ? "Publish to Discover" : readiness.missing[0]}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
                    <PlayCircle className="h-4 w-4" aria-hidden="true" /> {busy ? "Publishing…" : "Publish"}
                  </button>
                )}
                {campaign.status === "active" && (
                  <button type="button" disabled={busy} onClick={() => changeStatus(campaign, "paused")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 font-semibold disabled:opacity-50">
                    <PauseCircle className="h-4 w-4" aria-hidden="true" /> {busy ? "Pausing…" : "Pause"}
                  </button>
                )}
                {campaign.status === "paused" && (
                  <button type="button" disabled={busy} onClick={() => changeStatus(campaign, "active")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
                    <PlayCircle className="h-4 w-4" aria-hidden="true" /> {busy ? "Resuming…" : "Resume"}
                  </button>
                )}
                {campaign.status === "draft" && (confirmingId === campaign.id ? (
                  <span className="flex items-center gap-2">
                    <button type="button" disabled={busy} onClick={() => remove(campaign)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-destructive px-4 font-semibold text-destructive-foreground disabled:opacity-50">
                      <Trash2 className="h-4 w-4" aria-hidden="true" /> {busy ? "Deleting…" : "Confirm delete"}
                    </button>
                    <button type="button" onClick={() => setConfirmingId("")}
                      className="min-h-11 rounded-xl border border-border px-4 font-semibold">Cancel</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmingId(campaign.id)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 font-semibold">
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
                  </button>
                ))}
              </div>
            </div>
            {campaign.status === "active" && (
              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <CampaignShareButton campaign={campaign} ownerView />
                  <Link to={`/social?shareCampaign=${encodeURIComponent(campaign.id)}&kind=update`}
                    className="inline-flex min-h-11 items-center rounded-xl border border-primary/40 px-4 font-semibold text-primary">
                    Draft a public campaign update
                  </Link>
                </div>
              </div>
            )}
            {campaign.status !== "draft" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Published campaigns cannot be deleted here; pause it to hide it from Discover.
              </p>
            )}
          </li>;
        })}
      </ul>
    )}
  </main>;
}
