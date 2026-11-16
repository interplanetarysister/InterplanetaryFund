import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listPublicVideoCampaigns } from "@/api/publicData";
import { listPublicPosts } from "@/lib/publicSocialFeed";
import { createShortsFeedController, loadPublicVideoPosts, loadShortsFeed, moveShortIndex } from "@/lib/shortsFeed";

const initialFeed = { phase: "loading", items: [], partial: false };
const loadPublicFeed = () => loadShortsFeed({
  loadCampaigns: () => listPublicVideoCampaigns({ limit: 150 }),
  loadPosts: () => loadPublicVideoPosts({ loadPage: listPublicPosts }),
});

export function ShortsVideo({ item }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div className="relative aspect-[9/16] max-h-[65dvh] w-full bg-slate-950">
    {!loaded ? <div className="flex h-full min-h-72 flex-col items-center justify-center gap-4 px-6 text-center text-slate-100">
      <p className="text-sm">Loading this clip connects your browser to {item.video.provider}. Nothing plays until you choose to load it.</p>
      {failed && <p role="alert" className="text-sm text-amber-200">The video could not be loaded. Try again or open its original page.</p>}
      <button type="button" onClick={() => { setFailed(false); setLoaded(true); }}
        className="min-h-12 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950">
        {failed ? "Retry" : "Load"} {item.video.provider} video
      </button>
    </div> : item.video.type === "direct" ? <video src={item.video.src} controls playsInline muted preload="none"
      aria-label={item.title} onError={() => { setFailed(true); setLoaded(false); }} className="h-full w-full object-contain" /> :
      <iframe src={item.video.src} title={item.title + " — " + item.video.provider}
        allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation"
        referrerPolicy="no-referrer" onError={() => { setFailed(true); setLoaded(false); }}
        className="h-full w-full border-0" />}
  </div>;
}

export function ShortsCard({ item, index, count, onMove }) {
  const touch = useRef(null);
  return <section aria-label="Swipeable video shorts" aria-roledescription="video carousel" tabIndex={0}
    onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") { event.preventDefault(); onMove(1); }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") { event.preventDefault(); onMove(-1); }
    }}
    onTouchStart={event => { touch.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }}
    onTouchCancel={() => { touch.current = null; }}
    onTouchEnd={event => {
      const start = touch.current, end = event.changedTouches[0]; touch.current = null;
      if (!start || !end) return;
      const dy = start.y - end.clientY, dx = start.x - end.clientX;
      if (Math.abs(dy) > 55 && Math.abs(dy) > Math.abs(dx)) onMove(dy > 0 ? 1 : -1);
    }}
    className="overflow-hidden rounded-3xl border border-cyan-400/25 bg-slate-950 text-slate-100 shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
    <ShortsVideo key={item.id} item={item} />
    <div className="space-y-3 p-4">
      <p role="status" aria-atomic="true" className="text-xs font-semibold uppercase tracking-widest text-cyan-200">{item.kind} · {index + 1} of {count}</p>
      <h2 className="text-xl font-semibold">{item.title}</h2>
      {item.description && <p className="break-words text-sm text-slate-200">{item.description}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onMove(-1)} disabled={index <= 0}
          className="min-h-11 rounded-xl border border-slate-500 px-4 disabled:opacity-40">Previous</button>
        <button type="button" onClick={() => onMove(1)} disabled={index >= count - 1}
          className="min-h-11 rounded-xl border border-slate-500 px-4 disabled:opacity-40">Next</button>
        <Link to={item.href} className="inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950">{item.kind === "Campaign" ? "Full campaign story" : "View community post"}</Link>
        <a href={item.video.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
          className="inline-flex min-h-11 items-center px-2 text-cyan-200 underline">Open on {item.video.provider}</a>
      </div>
    </div>
  </section>;
}

export default function OrbitShorts({ loadFeed = loadPublicFeed }) {
  const [feed, setFeed] = useState(initialFeed);
  const [index, setIndex] = useState(0);
  const controller = useRef(null);
  useEffect(() => {
    const current = createShortsFeedController({ load: loadFeed, onChange: next => { setFeed(next); setIndex(0); } });
    controller.current = current;
    void current.reload();
    return () => { current.dispose(); if (controller.current === current) controller.current = null; };
  }, [loadFeed]);
  const item = feed.items[index];
  return <main className="mx-auto max-w-xl space-y-5 px-3 py-6 sm:px-5">
    <header className="space-y-2">
      <h1 className="font-display text-3xl font-bold">Orbit Shorts</h1>
      <p className="text-sm text-muted-foreground">Discover videos linked in published campaigns and public community posts.</p>
      <nav aria-label="Public discovery" className="flex flex-wrap items-center gap-4 text-sm text-primary underline">
        <Link className="inline-flex min-h-11 items-center" to="/discover">Campaign grid</Link>
        <Link className="inline-flex min-h-11 items-center" to="/social">Social feed</Link>
        <button type="button" disabled={feed.phase === "loading"} onClick={() => { void controller.current?.reload(); }}
          className="min-h-11 disabled:opacity-40">{feed.phase === "error" ? "Retry videos" : "Refresh videos"}</button>
      </nav>
    </header>
    {feed.phase === "loading" && <p role="status" className="rounded-xl border border-border p-6">Loading public videos…</p>}
    {feed.phase === "error" && <p role="alert" className="rounded-xl border border-destructive p-6">Public videos could not be loaded. Use Retry videos to try again.</p>}
    {feed.partial && <p role="status" className="rounded-xl border border-amber-400/40 p-4 text-sm">One public feed is unavailable. These clips come from the source that could be loaded.</p>}
    {feed.phase === "ready" && !item && <p role="status" className="rounded-xl border border-border p-6">No supported public clips are available in the loaded feed. Explore campaigns or share a YouTube or Vimeo link in a public community post.</p>}
    {item && <ShortsCard item={item} index={index} count={feed.items.length}
      onMove={step => setIndex(current => moveShortIndex(current, step, feed.items.length))} />}
    <p className="text-xs leading-relaxed text-muted-foreground">Swipe up for next, down for previous. Focus the video card and use arrow keys, or use the Previous and Next buttons. Players load only after your choice; no clip starts automatically. A video link is not evidence of a donation or campaign outcome.</p>
  </main>;
}
