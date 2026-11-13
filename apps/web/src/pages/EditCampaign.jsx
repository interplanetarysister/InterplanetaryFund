import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { loadOwnerCampaign, saveOwnerCampaign, setCampaignStatus, isCampaignConflict } from "@/api/ownerCampaigns";
import {
  emptyCampaignForm, validateCampaignForm, publishReadiness,
  campaignStatusLabel, campaignStatusTone, TITLE_MAX, SUMMARY_MAX, STORY_MAX, COVER_URL_MAX,
} from "@/lib/campaignLifecycle";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import PageError from "@/components/PageError";
import PrelaunchNotice from "@/components/prelaunch/PrelaunchNotice";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";
import { Loader2, Save, PlayCircle, PauseCircle } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import WritingDraftReview from "@/components/campaigns/WritingDraftReview";
import PrepublicationGate from "@/components/campaigns/PrepublicationGate";
import CampaignLocationFields from "@/components/atlas/CampaignLocationFields";

const CATEGORY_ORDER = ["medical", "emergency", "education", "community", "animals",
  "business", "creative", "memorial", "disaster_relief", "environment", "other"];

const fieldClass = "mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4";

// Owner campaign editor. Loads exactly one campaign owned by the signed-in
// member, blocks saving until that load succeeds, and confirms every write.
export default function EditCampaign() {
  const donationsEnabled = usePublicCampaignFundraising();
  const { user } = useAuthSession();
  const { id } = useParams();
  const navigate = useNavigate();
  const alive = useRef(true);
  const lock = useRef(false);
  const [form, setForm] = useState(emptyCampaignForm);
  const [status, setStatus] = useState("draft");
  const [phase, setPhase] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading"); setLoadError(""); setError("");
    try {
      const campaign = await loadOwnerCampaign(authClient(), id);
      if (!alive.current) return;
      setForm({
        title: campaign.title || "",
        summary: campaign.summary || "",
        story: campaign.story || "",
        category: campaign.category || "community",
        goal_amount: Number(campaign.goal_amount) > 0 ? String(campaign.goal_amount) : "",
        cover_image_url: campaign.cover_image_url || "",
        map_opt_in: campaign.map_opt_in === true,
        public_location_label: campaign.public_location_label || "",
        map_latitude: campaign.map_latitude === null ? "" : String(campaign.map_latitude),
        map_longitude: campaign.map_longitude === null ? "" : String(campaign.map_longitude),
      });
      setStatus(campaign.status);
      setPhase("ready");
    } catch (cause) {
      if (!alive.current) return;
      setLoadError(cause?.message || "That campaign could not be loaded.");
      setPhase("error");
    }
  }, [id]);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const disabled = busy || handoffBusy || phase !== "ready";
  const readiness = publishReadiness(form);

  async function save(nextStatus) {
    if (lock.current || handoffBusy || phase !== "ready") return;
    const problems = validateCampaignForm(form, { publish: nextStatus === "active" && status !== "active" });
    if (problems.length) { setError(problems[0]); setNotice(""); return; }
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const saved = await saveOwnerCampaign(authClient(), form, { id, status: nextStatus });
      setStatus(saved.status);
      setNotice(nextStatus === "active"
        ? "Your campaign is published and visible on Discover."
        : "Your campaign changes were saved.");
    } catch (cause) {
      setError(cause?.message || "Your campaign changes were not saved.");
      // Another session changed this campaign; reload its stored state rather
      // than leaving a stale form on screen.
      if (isCampaignConflict(cause)) load();
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  async function toggleStatus() {
    if (lock.current || handoffBusy || phase !== "ready") return;
    const next = status === "active" ? "paused" : "active";
    if (next === "active" && !readiness.ready) { setError(readiness.missing[0]); setNotice(""); return; }
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const saved = await setCampaignStatus(authClient(), id, next);
      setStatus(saved.status);
      setNotice(next === "active"
        ? "Your campaign is published and visible on Discover."
        : "Your campaign is paused and hidden from Discover.");
    } catch (cause) {
      setError(cause?.message || "The campaign status change was not saved.");
      if (isCampaignConflict(cause)) load();
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  if (phase === "loading") {
    return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p role="status" className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your campaign…
      </p>
    </main>;
  }

  if (phase === "error") {
    return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageError message={loadError} onRetry={load} />
      <p className="mt-6 text-center text-sm">
        <Link to="/campaigns" className="underline">Back to my campaigns</Link>
      </p>
    </main>;
  }

  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
    <WritingDraftReview onBusyChange={setHandoffBusy} ownerId={user?.id || null} campaignId={id} disabled={disabled} onApply={copy => { setForm(previous => ({ ...previous, ...copy })); setError(""); setNotice(""); }} />
    <header className="space-y-3">
      <Link to="/campaigns" className="text-sm underline">Back to my campaigns</Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold">Edit campaign</h1>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${campaignStatusTone(status)}`}>
          {campaignStatusLabel(status)}
        </span>
      </div>
      <p className="text-muted-foreground">Changes are private until you publish. {donationsEnabled ? "Published, active campaigns can accept verified PayPal donations." : "Live donation checkout is temporarily unavailable."}</p>
    </header>

    {!donationsEnabled && <PrelaunchNotice compact />}

    <form className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8" onSubmit={(event) => { event.preventDefault(); save(status); }}>
      <label className="block font-semibold">Campaign title
        <input required maxLength={TITLE_MAX} value={form.title} disabled={disabled}
          onChange={(e) => change("title", e.target.value)} className={fieldClass} />
      </label>
      <label className="block font-semibold">Short description
        <textarea aria-label="Short description" rows={3} maxLength={SUMMARY_MAX} value={form.summary} disabled={disabled}
          onChange={(e) => change("summary", e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" />
      </label>
      <label className="block font-semibold">Your story
        <textarea aria-label="Your story" rows={8} maxLength={STORY_MAX} value={form.story} disabled={disabled}
          onChange={(e) => change("story", e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" />
      </label>
      <label className="block font-semibold">Category
        <select value={form.category} disabled={disabled}
          onChange={(e) => change("category", e.target.value)} className={fieldClass}>
          {CATEGORY_ORDER.map((value) => <option key={value} value={value}>{categoryLabels[value] || value}</option>)}
        </select>
      </label>
      <label className="block font-semibold">Fundraising goal (USD)
        <input inputMode="decimal" value={form.goal_amount} disabled={disabled}
          onChange={(e) => change("goal_amount", e.target.value)} className={fieldClass} />
      </label>
      <label className="block font-semibold">Cover image URL (optional)
        <input type="url" maxLength={COVER_URL_MAX} value={form.cover_image_url} disabled={disabled}
          onChange={(e) => change("cover_image_url", e.target.value)} className={fieldClass} />
      </label>
      <CampaignLocationFields form={form} change={change} disabled={disabled} />

      <PrepublicationGate form={form} campaignId={id} canSend={status !== "active"} disabled={disabled} onApply={value=>setForm(previous=>({...previous,story:value}))} />
      {!readiness.ready && status === "draft" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Before you can publish</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {readiness.missing.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}

      {error && <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">{notice}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={disabled}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50">
          <Save className="h-4 w-4" aria-hidden="true" /> {busy ? "Saving…" : "Save changes"}
        </button>
        {status !== "active" ? (
          <button type="button" onClick={() => save("active")} disabled={disabled || !readiness.ready}
            title={readiness.ready ? "Publish to Discover" : readiness.missing[0]}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-6 font-semibold disabled:opacity-50">
            <PlayCircle className="h-4 w-4" aria-hidden="true" /> Publish
          </button>
        ) : (
          <>
            <button type="button" onClick={toggleStatus} disabled={disabled}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-6 font-semibold disabled:opacity-50">
              <PauseCircle className="h-4 w-4" aria-hidden="true" /> Pause
            </button>
            <Link to={`/campaign/${id}`} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-6 font-semibold">
              View public page
            </Link>
          </>
        )}
      </div>
    </form>

    <p className="text-sm text-muted-foreground">
      Published campaigns cannot be deleted here. Pause it to hide it from Discover, or <Link to="/help" className="underline">get help</Link>.
    </p>
  </main>;
}
