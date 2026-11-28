import { useEffect, useRef, useState } from "react";
import { authClient } from "@/api/auth";
import { listMyMedia, downloadMyMedia } from "@/api/memberMedia";
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
];
const ACTIVE_STATES = new Set(["submitted", "running", "provider_pending"]);

/**
 * AI video generation through the allowance-gated Worker (Cloudflare
 * Workers AI). Generation is a durable job: submit reserves one shared AI
 * creation, Advance runs the provider and stores the finished video in the
 * member's private media library through the same pipeline as an upload.
 * A generated video is never discarded because saving failed — the job
 * keeps the finished generation and Advance retries only the save. When
 * the deployment has not enabled the provider flag, this section says so
 * plainly instead of pretending to generate.
 */
export default function AIVideoStudio({ onSendToEditor } = {}) {
  const [availability, setAvailability] = useState("checking");
  const [prompt, setPrompt] = useState("");
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
      .then((data) => { if (mounted.current) setAvailability(data?.videoGeneration === "enabled" ? "enabled" : "not_configured"); })
      .catch(() => { if (mounted.current) setAvailability("not_configured"); });
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
    const response = await fetch(path, {
      method,
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      ...(method === "POST" && path.endsWith("/generate")
        ? { body: JSON.stringify({ prompt: prompt.trim(), resolution, ratio, duration, request_id: requestId.current }) }
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
    setBusy("generate"); setError(""); setMessage(""); setJob(null);
    setPreviewUrl(""); setPreviewFile(null);
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const token = await sessionToken();
      const finished = await runJob(token);
      if (!mounted.current || !finished) return;
      if (finished.state === "failed")
        setError(finished.error || "The video provider could not finish this generation.");
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
            : <>Video generation is wired to Cloudflare Workers AI — the same provider as image generation
              above — but it is not enabled on this deployment yet. The video model is billed per generated
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
          Generate a short original video with Cloudflare Workers AI. One generation uses one of your shared
          AI creations. The finished video is saved to your private media library — never to a public link —
          and can be attached to a social post or opened in the Editor, exactly like an upload.
        </p>
      </div>
      <TrialCreationBalance />
      <PremiumOpportunity context="video" />
      <form onSubmit={generate} className="space-y-4">
        <label className="block text-sm font-medium">Describe the video
          <textarea className={field} rows={3} minLength={20} maxLength={900} required
            value={prompt} disabled={Boolean(busy)}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A slow sunrise over a community garden, volunteers setting up a free book stall, warm morning light" />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">Resolution
            <select className={field} value={resolution} disabled={Boolean(busy)} onChange={(e) => setResolution(e.target.value)}>
              {RESOLUTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
