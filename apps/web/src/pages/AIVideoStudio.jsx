import { useEffect, useRef, useState } from "react";
import { authClient } from "@/api/auth";
import { listMyMedia, downloadMyMedia } from "@/api/memberMedia";
import { listOwnerCampaigns } from "@/api/ownerCampaigns";
import PremiumOpportunity from "@/components/subscriptions/PremiumOpportunity";
import TrialCreationBalance from "@/components/subscriptions/TrialCreationBalance";

const field = "mt-2 w-full min-h-11 rounded-xl border border-input bg-background px-4 py-2";
const button = "ifund-interactive min-h-11 rounded-xl border border-border px-4 py-2 font-semibold disabled:opacity-60";

const RESOLUTIONS = [
  ["480P", "480p — fastest, lowest provider cost"],
  ["720P", "720p"],
  ["1080P", "1080p — highest provider cost"],
];
const RATIOS = [
  ["adaptive", "Adaptive"],
  ["9:16", "Vertical 9:16 (Shorts/Reels)"],
  ["16:9", "Wide 16:9"],
  ["1:1", "Square 1:1"],
  ["4:3", "Classic 4:3"],
  ["3:4", "Portrait 3:4"],
];
const ACTIVE_STATES = new Set(["submitted", "running", "provider_pending"]);

/**
 * AI video generation through the allowance-gated Worker (provider-
 * swappable: Alibaba Wan adapters, or the executive-concierge queue).
 * Generation is a durable job: submit reserves one shared AI creation,
 * Advance runs the provider and stores the finished video in the
 * member's private media library through the same pipeline as an upload.
 * Concierge jobs are queued instead — the site AI prepares the video
 * from the chosen campaign and it lands in the library when ready; the
 * queued state says so plainly and never fakes an instant result.
 * A generated video is never discarded because saving failed — the job
 * keeps the finished generation and Advance retries only the save. When
 * the deployment has not enabled the provider flag, this section says so
 * plainly instead of pretending to generate.
 */
export default function AIVideoStudio({ onSendToEditor } = {}) {
  const [availability, setAvailability] = useState("checking");
  const [provider, setProvider] = useState(null);
  const [pilot, setPilot] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalCategory, setGoalCategory] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [resolution, setResolution] = useState("480P");
  const [ratio, setRatio] = useState("adaptive");
  const [duration, setDuration] = useState(5);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const mounted = useRef(true);
  const objectUrl = useRef("");
  const requestId = useRef("");

  useEffect(() => {
    mounted.current = true;
    fetch("/api/ai/videos/status")
      .then((r) => r.json())
      .then((data) => { if (mounted.current) {
        setAvailability(data?.videoGeneration === "enabled" ? "enabled" : "not_configured");
        setProvider(typeof data?.provider === "string" ? data.provider : null);
        if (Array.isArray(data?.pilot)) setPilot({ entries: data.pilot, expiresAt: data.pilot_expires_at || null });
      } })
      .catch(() => { if (mounted.current) setAvailability("not_configured"); });
    // Every video is anchored to a subject: offer the member's own
    // campaigns as that subject. A load failure simply leaves the picker
    // empty — the member can still name a goal or plan as the subject,
    // but a description alone is never enough to generate.
    listOwnerCampaigns(authClient())
      .then((rows) => { if (mounted.current) setCampaigns(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (mounted.current) setCampaigns([]); });
    return () => {
      mounted.current = false;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  async function sessionToken() {
    const client = authClient();
    const before = await client.auth.getUser();
    const { data: session, error: sessionError } = await client.auth.getSession();
    if (before.error || sessionError || !before.data?.user?.id ||
        before.data.user.id !== session?.session?.user?.id ||
        !session.session.access_token)
      throw new Error("Sign in to a verified account before generating a video.");
    return session.session.access_token;
  }

  async function call(path, token, method = "GET") {
    const imageMode = imageUrl.trim().length > 0;
    const effectiveResolution = imageMode && resolution === "480P" ? "720P" : resolution;
    const response = await fetch(path, {
      method,
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      ...(method === "POST" && path.endsWith("/generate")
        ? { body: JSON.stringify({
            prompt: prompt.trim(), resolution: effectiveResolution, ratio, duration,
            request_id: requestId.current,
            ...(campaignId ? { campaign_id: campaignId } : goalTitle.trim()
              ? { goal_title: goalTitle.trim(),
                  ...(goalCategory.trim() ? { goal_category: goalCategory.trim() } : {}) }
              : {}),
            ...(imageMode ? { image_url: imageUrl.trim(), rights_confirmed: rightsConfirmed } : {}),
          }) }
        : {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || "Video generation is currently unavailable.");
    return result?.job || null;
  }

  async function showStoredVideo(finished) {
    const rows = await listMyMedia(authClient());
    const row = rows.find((item) => item.id === finished.media_id);
    if (!row) throw new Error("The video was saved, but it could not be found in your media library yet. Check Saved media below in a moment.");
    const blob = await downloadMyMedia(authClient(), row);
    if (!mounted.current) return;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(blob);
    objectUrl.current = url;
    setPreviewUrl(url);
    setPreviewFile(new File([blob], row.file_name, { type: row.content_type }));
  }

  async function runJob(token) {
    let current = await call("/api/ai/videos/generate", token, "POST");
    if (mounted.current) setJob(current);
    // Concierge jobs are queued, not run by Advance: the site AI picks
    // the job up and prepares the video off-platform. Poll the job
    // itself for a bounded while so a quick return lands in this
    // session; after that the member checks Saved media — the job is
    // durable either way and nothing about it is faked as instant.
    for (let step = 0; step < 24 && current?.state === "awaiting_concierge"; step += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      if (!mounted.current) return null;
      current = await call(`/api/ai/videos/jobs/${current.request_id}`, token);
      if (mounted.current) setJob(current);
    }
    if (current?.state === "awaiting_concierge") return current;
    // Advance performs the provider call and the save. If the connection
    // drops mid-generation the job survives server-side; polling plus a
    // fresh Advance resumes it without repeating the provider call.
    for (let step = 0; step < 60 && current && ACTIVE_STATES.has(current.state); step += 1) {
      try {
        current = await call(`/api/ai/videos/jobs/${current.request_id}/advance`, token, "POST");
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        current = await call(`/api/ai/videos/jobs/${current.request_id}`, token);
      }
      if (!mounted.current) return null;
      setJob(current);
      if (ACTIVE_STATES.has(current?.state))
        await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    return current;
  }

  async function generate(event) {
    event?.preventDefault();
    if (busy) return;
    if (prompt.trim().length < 20 || prompt.trim().length > 900) {
      setError("Describe the video in 20 to 900 characters.");
      return;
    }
    if (imageUrl.trim() && !rightsConfirmed) {
      setError("Confirm you have the right to animate that image before generating.");
      return;
    }
    if (!campaignId && !goalTitle.trim()) {
      setError(campaigns.length > 0
        ? "Choose what this video is for — pick one of your campaigns, or name the goal or plan it promotes below."
        : "Name the goal or plan this video promotes — videos are prepared from a campaign's story or your plan's context, never from a description alone.");
      return;
    }
    setBusy("generate"); setError(""); setMessage(""); setJob(null);
    setPreviewUrl(""); setPreviewFile(null);
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const token = await sessionToken();
      const finished = await runJob(token);
      if (!mounted.current || !finished) return;
      if (finished.state === "failed")
        setError(finished.error || "The video provider could not finish this generation.");
      else if (finished.state === "awaiting_concierge")
        setMessage("Your video is queued — the site AI is preparing it from your campaign or plan. " +
          "That takes a little while, not seconds; when it is ready it will be saved to your " +
          "private media library below, exactly like an upload.");
      else if (finished.state === "provider_completed")
        setError(finished.error || "Your video was generated but could not be saved yet. Retry saving — the generation will not be repeated.");
      else if (finished.state === "completed") {
        await showStoredVideo(finished);
        window.dispatchEvent(new Event("ifund-ai-creation-completed"));
        setMessage("Video generated and saved to your private media library. Attach it to a social post from your library, or send it to the Editor.");
        requestId.current = "";
      } else
        setMessage("Your video is still generating. Check back in a moment — nothing was lost.");
    } catch (cause) {
      if (mounted.current) setError(cause?.message || "Video generation failed.");
    } finally {
      if (mounted.current) setBusy("");
    }
  }

  async function retrySave() {
    if (busy || !job) return;
    setBusy("save"); setError(""); setMessage("");
    try {
      const token = await sessionToken();
      const current = await call(`/api/ai/videos/jobs/${job.request_id}/advance`, token, "POST");
      if (!mounted.current || !current) return;
      setJob(current);
      if (current.state === "completed") {
        await showStoredVideo(current);
        window.dispatchEvent(new Event("ifund-ai-creation-completed"));
        setMessage("Video saved to your private media library.");
      } else if (current.state === "provider_completed")
        setError(current.error || "The video still could not be saved. Your library may be full — free space and retry.");
      else
        setError(current.error || "The save could not be finished yet. Retry in a moment.");
    } catch (cause) {
      if (mounted.current) setError(cause?.message || "The save could not be finished yet.");
    } finally {
      if (mounted.current) setBusy("");
    }
  }

  if (availability !== "enabled") {
    return (
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5" aria-label="Video generation status">
        <h2 className="text-xl font-semibold">Video generation</h2>
        <p className="text-sm text-muted-foreground">
          {availability === "checking"
            ? "Checking whether video generation is enabled on this deployment…"
            : provider === "executive-concierge"
              ? <>Video generation is wired to the site's AI concierge, which prepares a video
                from your campaign's own story and your direction — but it is
                not enabled on this deployment yet. This Studio does not pretend to generate a video meanwhile. Upload a video you already have in
                the Editor tab to frame it, adjust how it looks, and download a frame still.</>
              : <>Video generation is wired to the Alibaba Wan video models — the flagship open
              video family, reachable through the platform's AI provider — but it is
              not enabled on this deployment yet. Video models are billed per generated
              second rather than from the free daily allowance, so it stays off until the owner enables it;
              this Studio does not pretend to generate a video meanwhile. Upload a video you already have in
              the Editor tab to frame it, adjust how it looks, and download a frame still.</>}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="Video generation">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Video generation</h2>
        <p className="text-sm text-muted-foreground">
          {provider === "executive-concierge"
            ? <>Generate a short original video for one of your campaigns, or for a goal or plan you are
              working on. The site AI prepares it
              from that campaign's own story — or from your plan's name and category — plus your direction below, and the finished video is saved
              to your private media library — never to a public link — exactly like an upload.
              One generation uses one of your shared AI creations. Preparation is queued, not instant:
              it takes a little while, and the finished video appears in your library when it is ready.</>
            : <>Generate a short original video with AI (Alibaba Wan models) for one of your campaigns, or for a
              goal or plan you name below. One generation uses one of your shared
              AI creations. The finished video is saved to your private media library — never to a public link —
              and can be attached to a social post or opened in the Editor, exactly like an upload.</>}
        </p>
      </div>
      <TrialCreationBalance />
      <PremiumOpportunity context="video" />
      {pilot && pilot.entries.length > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Free pilot: {pilot.entries.map((entry) =>
            `${entry.remaining_seconds} of ${entry.quota_seconds} seconds left (${entry.model})`).join(" · ")}
          {pilot.expiresAt ? ` · pilot ends ${new Date(pilot.expiresAt).toLocaleDateString()}` : ""}.
          When the pilot fills, generation pauses — it never switches to paid generation on its own.
        </p>
      )}
      <form onSubmit={generate} className="space-y-4">
        {campaigns.length > 0 && (
          <label className="block text-sm font-medium">Campaign this video is for
            <select className={field} value={campaignId} disabled={Boolean(busy)}
              onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Choose a campaign…</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.title || "Untitled campaign"}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              The video is prepared from this campaign's story, goal and cover image, plus your direction below.
            </span>
          </label>
        )}
        {!campaignId && (
          <>
            <label className="block text-sm font-medium">Goal or plan this video promotes
              <input className={field} type="text" maxLength={120}
                value={goalTitle} disabled={Boolean(busy)}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="e.g. A tools library for our neighborhood" />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                No campaign? Name the goal or plan instead — the video is prepared from its name
                and category, plus your direction below. Every video needs a subject: a description alone is not enough.
              </span>
            </label>
            <label className="block text-sm font-medium">Goal category (optional)
              <input className={field} type="text" maxLength={60}
                value={goalCategory} disabled={Boolean(busy)}
                onChange={(e) => setGoalCategory(e.target.value)}
                placeholder="e.g. community" />
            </label>
          </>
        )}
        <label className="block text-sm font-medium">Describe the video
          <textarea className={field} rows={3} minLength={20} maxLength={900} required
            value={prompt} disabled={Boolean(busy)}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A slow sunrise over a community garden, volunteers setting up a free book stall, warm morning light" />
        </label>
        <label className="block text-sm font-medium">Starting image link (optional — image-to-video)
          <input className={field} type="url" inputMode="url" maxLength={2048}
            value={imageUrl} disabled={Boolean(busy)}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://… a public link to an image you have the right to animate" />
        </label>
        {imageUrl.trim() && (
          <div className="space-y-2">
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-5 shrink-0" checked={rightsConfirmed}
                disabled={Boolean(busy)} onChange={(e) => setRightsConfirmed(e.target.checked)} />
              <span>I confirm this image is mine or I have the right to animate it, and I understand the
                provider receives the image link to generate the video.</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Image-to-video generates at 720p or 1080p. Images from your private media library cannot be
              used as a starting image: your library is never given a public link, by design.
            </p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">Resolution
            <select className={field} value={imageUrl.trim() && resolution === "480P" ? "720P" : resolution} disabled={Boolean(busy)} onChange={(e) => setResolution(e.target.value)}>
              {RESOLUTIONS.filter(([value]) => !imageUrl.trim() || value !== "480P")
                .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Format
            <select className={field} value={ratio} disabled={Boolean(busy)} onChange={(e) => setRatio(e.target.value)}>
              {RATIOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Length (seconds)
            <select className={field} value={duration} disabled={Boolean(busy)} onChange={(e) => setDuration(Number(e.target.value))}>
              {[3, 4, 5, 6, 7, 8, 9, 10].map((seconds) => <option key={seconds} value={seconds}>{seconds}</option>)}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Use illustrative scenes only; do not imply that an AI-created person or scene is a real beneficiary,
          donor or event. Longer and higher-resolution videos cost the provider more per generation.
        </p>
        <button type="submit" className="ifund-interactive min-h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60" disabled={Boolean(busy)}>
          {busy === "generate" ? "Generating video… this can take a few minutes" : "Generate video"}
        </button>
      </form>
      {job && ACTIVE_STATES.has(job.state) && (
        <p role="status" className="text-sm text-muted-foreground">
          Generation in progress ({job.state.replace("_", " ")}). Keep this tab open; if the connection drops,
          the job is saved and generating again with the same description resumes it.
        </p>
      )}
      {job?.state === "awaiting_concierge" && (
        <p role="status" className="text-sm text-muted-foreground">
          Queued — the site AI is preparing your video{job.campaign_id ? " from your campaign" : ""}.
          This takes a little while, not seconds. When it is ready, the finished video will be saved
          to your private media library below, exactly like an upload.
        </p>
      )}
      {job?.state === "provider_completed" && (
        <div className="space-y-3">
          <p role="alert" className="ifund-feedback-error">
            {job.error || "Your video was generated but could not be saved yet."}
          </p>
          <button type="button" className={button} onClick={retrySave} disabled={Boolean(busy)}>
            {busy === "save" ? "Saving…" : "Retry saving the finished video"}
          </button>
        </div>
      )}
      {error && <p role="alert" className="ifund-feedback-error">{error}</p>}
      {message && <p role="status" className="ifund-feedback-success">{message}</p>}
      {previewUrl && (
        <div className="space-y-3">
          <video src={previewUrl} controls playsInline className="max-h-[550px] w-full rounded-xl" />
          <div className="flex flex-wrap gap-3">
            {onSendToEditor && previewFile && (
              <button type="button" className={button}
                onClick={() => onSendToEditor({ file: previewFile, url: previewUrl, kind: "video" })}>
                Send to Editor
              </button>
            )}
            <a href={previewUrl} download={previewFile?.name || "ifund-generated-video.mp4"} className={button}>Download video</a>
          </div>
        </div>
      )}
    </section>
  );
}
