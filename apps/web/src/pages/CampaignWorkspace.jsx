import AgentAdviceReview from "@/components/agents/AgentAdviceReview";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { loadOwnerCampaign, saveOwnerCampaign, setCampaignStatus, isCampaignConflict } from "@/api/ownerCampaigns";
import { getCampaignDetail } from "@/api/publicData";
import { listMissions, listMissionCampaignLinks, listMissionTasks, setMissionTaskState } from "@/api/missions";
import {
  emptyCampaignForm, validateCampaignForm, publishReadiness,
  campaignStatusLabel, campaignStatusTone, TITLE_MAX, SUMMARY_MAX, STORY_MAX, COVER_URL_MAX,
} from "@/lib/campaignLifecycle";
import { CAMPAIGN_WORKSPACE_TABS, tabForWorkspaceField, tabForValidationProblem } from "@/lib/campaignWorkspaceTabs.mjs";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import PageError from "@/components/PageError";
import PrelaunchNotice from "@/components/prelaunch/PrelaunchNotice";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";
import { Loader2, Save, PlayCircle, PauseCircle, LockKeyhole } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import WritingDraftReview from "@/components/campaigns/WritingDraftReview";
import PrepublicationGate from "@/components/campaigns/PrepublicationGate";
import CampaignReadinessScore from "@/components/campaigns/CampaignReadinessScore";
import CampaignLocationFields from "@/components/atlas/CampaignLocationFields";
import CampaignDocuments from "@/components/campaigns/CampaignDocuments";

const CATEGORY_ORDER = ["medical", "emergency", "education", "community", "animals",
  "business", "creative", "memorial", "disaster_relief", "environment", "other"];

const fieldClass = "mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4";
const money = (value) => "$" + Number(value || 0).toLocaleString();

// Sprint 4 (2026-11-25): unified Campaign Workspace (40-page list, page 19).
// The single-page editor moved here as tab panels — same components, same
// handlers, same save/publish/pause/conflict behavior. The old route
// /campaigns/:id/edit redirects here (see EditCampaign.jsx) so saved links,
// agent handoffs and field deep links keep working: #campaign-title,
// #campaign-summary and #campaign-story open the Story tab, #campaign-goal
// opens Goals, and #campaign-atlas-location opens the Media tab.
// Tabs with no backend are honest: Updates, Finance Tasks and Spending show
// explicit "not yet tracked" states and never invent entries, counts or
// totals. Tasks and Missions read only real linked-mission data, and
// Missions stay visibly separated and labeled PRIVATE — a Mission never
// publishes a fundraiser on its own.
export default function CampaignWorkspace() {
  const donationsEnabled = usePublicCampaignFundraising();
  const { user } = useAuthSession();
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
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
  const [tab, setTab] = useState("story");
  // Lazily loaded real data for tabs with no editor form: verified public
  // donation totals, and tasks/missions linked to this campaign.
  const [financePhase, setFinancePhase] = useState("idle");
  const [financeTotals, setFinanceTotals] = useState(null);
  const [financeError, setFinanceError] = useState("");
  const [linkedPhase, setLinkedPhase] = useState("idle");
  const [linkedMissions, setLinkedMissions] = useState([]);
  const [allMissions, setAllMissions] = useState([]);
  const [linkedError, setLinkedError] = useState("");
  const [taskBusy, setTaskBusy] = useState("");

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

  // Agent advice handoffs land on the Growth tab, where AgentAdviceReview
  // lives. It consumes and clears the ?agentAdvice= parameter itself.
  useEffect(() => {
    if (phase !== "ready") return;
    if (searchParams.get("agentAdvice")) setTab("growth");
  }, [phase, searchParams]);

  // Strategy and review cards deep-link to the exact editor field: switch to
  // the tab containing the target field first, then scroll/focus it.
  useEffect(() => {
    if (phase !== "ready") return;
    const targetId = location.hash.slice(1);
    const targetTab = tabForWorkspaceField(targetId);
    if (!targetTab) return;
    setTab(targetTab);
  }, [phase, location.hash]);

  useEffect(() => {
    if (phase !== "ready") return;
    const targetId = location.hash.slice(1);
    if (!tabForWorkspaceField(targetId)) return;
    const field = document.getElementById(targetId);
    if (!field) return;
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.focus({ preventScroll: true });
  }, [phase, location.hash, tab]);

  // Verified public donation totals, loaded lazily on first Finance Tasks
  // visit. getCampaignDetail returns null while the campaign is unpublished
  // (no public row) — that is shown as "not published yet", never as zero.
  const loadFinanceTotals = useCallback(async () => {
    if (financePhase === "loading" || financePhase === "ready") return;
    setFinancePhase("loading"); setFinanceError("");
    try {
      const detail = await getCampaignDetail(id);
      if (!alive.current) return;
      setFinanceTotals(detail);
      setFinancePhase("ready");
    } catch (cause) {
      if (!alive.current) return;
      setFinanceError(cause?.message || "Verified donation totals are temporarily unavailable.");
      setFinancePhase("error");
    }
  }, [id, financePhase]);

  useEffect(() => {
    if (tab === "finance") loadFinanceTotals();
  }, [tab, loadFinanceTotals]);

  // No API lists Missions by campaign, so discovery scans the owner's
  // Missions (bounded to the first 30) and keeps the ones linked to this
  // campaign. Shared by the Tasks and Missions tabs; loaded lazily once.
  const loadLinkedMissions = useCallback(async () => {
    if (linkedPhase === "loading" || linkedPhase === "ready") return;
    setLinkedPhase("loading"); setLinkedError("");
    try {
      const client = authClient();
      const missions = await listMissions(client, { limit: 30 });
      const links = await Promise.all(missions.map((mission) =>
        listMissionCampaignLinks(client, mission.id).catch(() => [])));
      const linked = missions.filter((mission, index) =>
        links[index].some((link) => link.campaign_id === id));
      const withTasks = await Promise.all(linked.map(async (mission) => ({
        mission,
        tasks: await listMissionTasks(client, mission.id).catch(() => []),
      })));
      if (!alive.current) return;
      setAllMissions(missions);
      setLinkedMissions(withTasks);
      setLinkedPhase("ready");
    } catch (cause) {
      if (!alive.current) return;
      setLinkedError(cause?.message || "Linked Missions could not be loaded.");
      setLinkedPhase("error");
    }
  }, [id, linkedPhase]);

  useEffect(() => {
    if (tab === "tasks" || tab === "missions") loadLinkedMissions();
  }, [tab, loadLinkedMissions]);

  async function toggleLinkedTask(missionId, task) {
    if (taskBusy) return;
    setTaskBusy(task.id); setError("");
    try {
      const updated = await setMissionTaskState(authClient(), missionId, task.id, task.revision, task.state === "done" ? "todo" : "done");
      setLinkedMissions((current) => current.map((entry) => entry.mission.id !== missionId ? entry : {
        ...entry,
        tasks: entry.tasks.map((item) => item.id === task.id ? updated : item),
      }));
      setNotice("Task progress saved.");
    } catch (cause) {
      setError(cause?.message || "Task update failed.");
    } finally {
      setTaskBusy("");
    }
  }

  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const disabled = busy || handoffBusy || phase !== "ready";
  const readiness = publishReadiness(form);

  async function save(nextStatus) {
    if (lock.current || handoffBusy || phase !== "ready") return;
    const problems = validateCampaignForm(form, { publish: nextStatus === "active" && status !== "active" });
    if (problems.length) {
      setError(problems[0]); setNotice("");
      const targetTab = tabForValidationProblem(problems[0]);
      if (targetTab) setTab(targetTab);
      return;
    }
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
    if (next === "active" && !readiness.ready) {
      setError(readiness.missing[0]); setNotice("");
      const targetTab = tabForValidationProblem(readiness.missing[0]);
      if (targetTab) setTab(targetTab);
      return;
    }
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

  const linkedTasks = linkedMissions.flatMap((entry) =>
    entry.tasks.map((task) => ({ mission: entry.mission, task })));

  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
    <header className="space-y-3">
      <Link to="/campaigns" className="text-sm underline">Back to my campaigns</Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-bold">Campaign Workspace</h1>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${campaignStatusTone(status)}`}>
          {campaignStatusLabel(status)}
        </span>
      </div>
      <p className="text-muted-foreground">Changes are private until you publish. {donationsEnabled ? "Published, active campaigns can accept verified PayPal donations." : "Live donation checkout is temporarily unavailable."}</p>
    </header>

    {!donationsEnabled && <PrelaunchNotice compact />}

    <div role="tablist" aria-label="Campaign workspace sections" className="flex gap-2 overflow-x-auto pb-1">
      {CAMPAIGN_WORKSPACE_TABS.map((item) => (
        <button key={item.id} type="button" role="tab" id={`workspace-tab-${item.id}`}
          aria-selected={tab === item.id} aria-controls={`workspace-panel-${item.id}`}
          onClick={() => setTab(item.id)}
          className={`min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${tab === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
          {item.label}
        </button>
      ))}
    </div>

    <form className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8" onSubmit={(event) => { event.preventDefault(); save(status); }}>
      {tab === "story" && (
        <div role="tabpanel" id="workspace-panel-story" aria-labelledby="workspace-tab-story" className="space-y-5">
          <WritingDraftReview onBusyChange={setHandoffBusy} ownerId={user?.id || null} campaignId={id} disabled={disabled} onApply={copy => { setForm(previous => ({ ...previous, ...copy })); setError(""); setNotice(""); }} />
          <label className="block font-semibold">Campaign title
            <input id="campaign-title" required maxLength={TITLE_MAX} value={form.title} disabled={disabled}
              onChange={(e) => change("title", e.target.value)} className={fieldClass} />
          </label>
          <label className="block font-semibold">Short description
            <textarea id="campaign-summary" aria-label="Short description" rows={3} maxLength={SUMMARY_MAX} value={form.summary} disabled={disabled}
              onChange={(e) => change("summary", e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" />
          </label>
          <p className="text-sm text-muted-foreground">Full story format: 2–3 paragraphs separated by a blank line, each containing 3–5 complete sentences.</p>
          <label className="block font-semibold">Your story
            <textarea id="campaign-story" aria-label="Your story" rows={8} maxLength={STORY_MAX} value={form.story} disabled={disabled}
              onChange={(e) => change("story", e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" />
          </label>
          <label className="block font-semibold">Category
            <select id="campaign-category" value={form.category} disabled={disabled}
              onChange={(e) => change("category", e.target.value)} className={fieldClass}>
              {CATEGORY_ORDER.map((value) => <option key={value} value={value}>{categoryLabels[value] || value}</option>)}
            </select>
          </label>
          <CampaignReadinessScore form={form} />
          <PrepublicationGate form={form} campaignId={id} canSend={status !== "active"} disabled={disabled} onApply={value=>setForm(previous=>({...previous,story:value}))} onApplyFields={fields=>{setForm(previous=>({...previous,...fields}));setNotice("");}} />
          {!readiness.ready && status === "draft" && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Before you can publish</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {readiness.missing.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "media" && (
        <div role="tabpanel" id="workspace-panel-media" aria-labelledby="workspace-tab-media" className="space-y-5">
          <label className="block font-semibold">Cover image URL (optional)
            <input id="campaign-cover" type="url" maxLength={COVER_URL_MAX} value={form.cover_image_url} disabled={disabled}
              onChange={(e) => change("cover_image_url", e.target.value)} className={fieldClass} />
          </label>
          <CampaignLocationFields form={form} change={change} disabled={disabled} />
          <CampaignDocuments key={(user?.id||"guest")+":"+id} campaignId={id} ownerId={user?.id||null} />
          <p className="text-sm text-muted-foreground">
            Image and video generation live in Media Studio. For now, generate images in{" "}
            <Link to="/ai-images" className="font-semibold text-primary underline">AI Image Studio</Link>{" "}
            and paste the cover link above.
          </p>
        </div>
      )}

      {tab === "updates" && (
        <div role="tabpanel" id="workspace-panel-updates" aria-labelledby="workspace-tab-updates" className="space-y-4">
          <h2 className="text-xl font-semibold">Campaign updates</h2>
          <p className="text-sm text-muted-foreground">
            Campaign updates are shared through IFund Social. This workspace does not keep a separate updates list, so there is no update history to show here.
          </p>
          <Link to="/social" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground">
            Open the social composer
          </Link>
        </div>
      )}

      {tab === "goals" && (
        <div role="tabpanel" id="workspace-panel-goals" aria-labelledby="workspace-tab-goals" className="space-y-5">
          <label className="block font-semibold">Fundraising goal (USD)
            <input id="campaign-goal" inputMode="decimal" value={form.goal_amount} disabled={disabled}
              onChange={(e) => change("goal_amount", e.target.value)} className={fieldClass} />
          </label>
          <p className="text-sm text-muted-foreground">Set the fundraising goal in USD. The goal is required before publishing.</p>
        </div>
      )}

      {tab === "finance" && (
        <div role="tabpanel" id="workspace-panel-finance" aria-labelledby="workspace-tab-finance" className="space-y-4">
          <h2 className="text-xl font-semibold">Finance tasks</h2>
          <p className="text-sm text-muted-foreground">Finance tasks are not yet tracked for this campaign.</p>
          {financePhase === "loading" && <p role="status" className="text-sm text-muted-foreground">Loading verified donation totals…</p>}
          {financePhase === "error" && <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-4 text-sm"><p>{financeError}</p><button type="button" onClick={loadFinanceTotals} className="min-h-11 rounded-xl border px-4 font-semibold">Retry</button></div>}
          {financePhase === "ready" && financeTotals && (
            <p className="rounded-xl border border-border p-4 text-sm">
              Verified totals: <span className="font-semibold">{money(financeTotals.raised_amount)} raised</span> of {money(financeTotals.goal_amount)} goal · {financeTotals.donor_count} {financeTotals.donor_count === 1 ? "donor" : "donors"}.
              <span className="mt-1 block text-muted-foreground">Totals count provider-verified gifts only.</span>
            </p>
          )}
          {financePhase === "ready" && !financeTotals && (
            <p className="text-sm text-muted-foreground">Verified donation totals will appear here once this campaign is published and active.</p>
          )}
          <p>
            <Link to="/finances" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-6 font-semibold">Open Finance</Link>
          </p>
        </div>
      )}

      {tab === "spending" && (
        <div role="tabpanel" id="workspace-panel-spending" aria-labelledby="workspace-tab-spending" className="space-y-4">
          <h2 className="text-xl font-semibold">Spending</h2>
          <p className="text-sm text-muted-foreground">Spending is not yet tracked for this campaign.</p>
          <p className="text-sm text-muted-foreground">No spending entries have been recorded for this campaign, so there is nothing to show here.</p>
          <p>
            <Link to="/finances" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-6 font-semibold">Open Finance</Link>
          </p>
        </div>
      )}

      {tab === "tasks" && (
        <div role="tabpanel" id="workspace-panel-tasks" aria-labelledby="workspace-tab-tasks" className="space-y-4">
          <h2 className="text-xl font-semibold">Tasks</h2>
          <p className="text-sm text-muted-foreground">Tasks come from private Missions linked to this campaign.</p>
          {linkedPhase === "loading" && <p role="status" className="text-sm text-muted-foreground">Loading tasks from your linked private Missions…</p>}
          {linkedPhase === "error" && <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-4 text-sm"><p>{linkedError}</p><button type="button" onClick={loadLinkedMissions} className="min-h-11 rounded-xl border px-4 font-semibold">Retry</button></div>}
          {linkedPhase === "ready" && linkedTasks.length === 0 && (
            <p className="text-sm text-muted-foreground">No tasks from linked private Missions yet. Link a Mission to this campaign from <Link to="/missions" className="font-semibold text-primary underline">My Missions</Link>, or create a Mission first.</p>
          )}
          {linkedPhase === "ready" && linkedTasks.length > 0 && (
            <ul className="space-y-2">
              {linkedTasks.map(({ mission, task }) => (
                <li key={task.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                  <button type="button" onClick={() => toggleLinkedTask(mission.id, task)} disabled={!!taskBusy}
                    aria-pressed={task.state === "done"} aria-label={`${task.state === "done" ? "Mark not done" : "Mark done"}: ${task.title}`}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50">
                    {task.state === "done" ? "Done ✓" : "Mark done"}
                  </button>
                  <span className={task.state === "done" ? "line-through text-muted-foreground" : ""}>
                    <span className="font-medium">{task.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">Private Mission: {mission.title || "Untitled Mission"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "growth" && (
        <div role="tabpanel" id="workspace-panel-growth" aria-labelledby="workspace-tab-growth" className="space-y-5">
          <AgentAdviceReview ownerId={user?.id || null} campaignId={id} currentStory={form.story} disabled={disabled} onBusyChange={setHandoffBusy} onApply={text => { change("story",text); setNotice(""); setError(""); }} />
          <p className="text-sm text-muted-foreground">Open Campaign Strategy for per-campaign writing guidance, or Analytics for Command Center reporting.</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/strategy" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-6 font-semibold">Open Campaign Strategy</Link>
            <Link to="/analytics" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-6 font-semibold">Open Analytics</Link>
          </div>
        </div>
      )}

      {tab === "missions" && (
        <div role="tabpanel" id="workspace-panel-missions" aria-labelledby="workspace-tab-missions" className="space-y-5">
          <section aria-label="Private Missions" className="space-y-4 rounded-2xl border border-cyan-500/40 bg-cyan-500/5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><LockKeyhole size={20} aria-hidden="true" /> Missions</h2>
              <span className="rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-xs font-semibold">Private</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Missions are private goals, kept separate from this public campaign. A Mission never publishes a fundraiser on its own.
            </p>
            {linkedPhase === "loading" && <p role="status" className="text-sm text-muted-foreground">Loading your linked private Missions…</p>}
            {linkedPhase === "error" && <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-4 text-sm"><p>{linkedError}</p><button type="button" onClick={loadLinkedMissions} className="min-h-11 rounded-xl border px-4 font-semibold">Retry</button></div>}
            {linkedPhase === "ready" && linkedMissions.length === 0 && (
              <p className="text-sm text-muted-foreground">No private Missions are linked to this campaign yet.</p>
            )}
            {linkedPhase === "ready" && linkedMissions.length > 0 && (
              <ul className="space-y-2">
                {linkedMissions.map(({ mission }) => (
                  <li key={mission.id}>
                    <Link to={`/missions/${encodeURIComponent(mission.id)}`} className="block rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-primary underline-offset-2 hover:underline">
                      {mission.title || "Untitled Mission"} <span className="text-muted-foreground">· Private · Open Mission workspace</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <Link to="/missions" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-6 font-semibold">Open My Missions</Link>
              <Link to="/what-if" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground">Create a new Mission</Link>
            </div>
          </section>
          {linkedPhase === "ready" && allMissions.length > 0 && (
            <section aria-label="All my Missions" className="space-y-3">
              <h3 className="text-lg font-semibold">All my Missions</h3>
              <ul className="space-y-2">
                {allMissions.map((mission) => (
                  <li key={mission.id}>
                    <Link to={`/missions/${encodeURIComponent(mission.id)}`} className="block rounded-xl border border-border px-4 py-3 text-sm">
                      <span className="font-semibold">{mission.title || "Untitled Mission"}</span>
                      <span className="ml-2 text-xs text-muted-foreground">Private · {String(mission.status || "").replaceAll("_", " ")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
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
