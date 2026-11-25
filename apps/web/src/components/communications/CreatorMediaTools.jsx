import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";

const AIImageStudio = lazy(() => import("../../pages/AIImageStudio"));
const MultitrackAudioEditor = lazy(() => import("./MultitrackAudioEditor"));
const PrePostMediaOptimizer = lazy(() => import("./PrePostMediaOptimizer"));

const MEDIA_TOOLS = [
  ["artwork", "AI artwork"],
  ["audio", "Layered audio editor"],
  ["optimization", "Pre-post Optimization"],
];

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
      {active === "artwork" ? <AIImageStudio embedded /> : active === "audio" ? <MultitrackAudioEditor /> : <PrePostMediaOptimizer />}
    </Suspense>
  </div>;
}
