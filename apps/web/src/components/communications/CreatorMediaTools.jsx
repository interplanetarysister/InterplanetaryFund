import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";

const AIImageStudio = lazy(() => import("../../pages/AIImageStudio"));
const AudioClipEditor = lazy(() => import("./AudioClipEditor"));

const MEDIA_TOOLS = [
  ["artwork", "AI artwork"],
  ["audio", "Edit audio"],
  ["settings", "Media settings"],
];

function MediaSettings() {
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
    <h2 className="text-xl font-semibold">Media optimization settings</h2>
    <p className="text-sm text-muted-foreground">Practical export guidance, not an AI analysis or automatic provider optimization. Check the destination's current format rules before posting.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-xl border p-4"><h3 className="font-semibold">Short vertical videos</h3>
        <p className="text-sm">Start with a 9:16 composition, readable captions, clear opening context and speech that can be understood on a phone. Preview with sound both on and off.</p></article>
      <article className="rounded-xl border p-4"><h3 className="font-semibold">Campaign image cards</h3>
        <p className="text-sm">Use a clear focal point, legible contrast, meaningful alt text and a crop preview. Avoid placing essential copy near the edges.</p></article>
      <article className="rounded-xl border p-4"><h3 className="font-semibold">Audio</h3>
        <p className="text-sm">Remove silence where useful, check speech intelligibility, and verify that peak normalization did not introduce distortion. Supply captions or a transcript when publishing.</p></article>
      <article className="rounded-xl border p-4"><h3 className="font-semibold">Privacy & approvals</h3>
        <p className="text-sm">Review personally identifying material, ownership rights, audience permissions and the actual media before sending to any connected platform.</p></article>
    </div>
    <p className="text-xs text-muted-foreground">AI-driven per-platform settings recommendations require an authorized optimization provider and current platform-specific validation. No such optimization has been performed by this guide.</p>
  </section>;
}

export default function CreatorMediaTools() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("tool");
  const active = MEDIA_TOOLS.some(([id]) => id === selected) ? selected : "artwork";
  function select(tool) {
    const next = new URLSearchParams(params);
    next.set("tab", "media");
    next.set("tool", tool);
    setParams(next);
  }
  return <div className="space-y-5">
    <nav aria-label="Media tools" className="flex flex-wrap gap-2">
      {MEDIA_TOOLS.map(([id, label]) => <button key={id} type="button" onClick={() => select(id)}
        aria-current={id === active ? "page" : undefined}
        className={"ifund-interactive min-h-11 rounded-xl border px-4 text-sm font-semibold " + (id === active ? "border-cyan-500 bg-cyan-500/10" : "border-border")}>{label}</button>)}
    </nav>
    <Suspense fallback={<p role="status">Loading media tools…</p>}>
      {active === "artwork" ? <AIImageStudio embedded /> : active === "audio" ? <AudioClipEditor /> : <MediaSettings />}
    </Suspense>
  </div>;
}
