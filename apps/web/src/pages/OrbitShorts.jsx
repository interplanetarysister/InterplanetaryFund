import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listActiveCampaigns } from "@/api/publicData";
import { authClient } from "@/api/auth";
import { videoFromText, videoFromUrl } from "@/lib/videoLinks";

export function collectShorts(campaigns, posts) {
  const result = [];
  for (const campaign of campaigns) {
    const video = videoFromUrl(campaign.cover_image_url);
    if (video && campaign.id) result.push({ id: "campaign-" + campaign.id, video, title: campaign.title, description: campaign.summary, href: "/campaign/" + encodeURIComponent(campaign.id), kind: "Campaign" });
  }
  for (const post of posts) {
    const video = videoFromText(post.body);
    if (video && post.id) result.push({ id: "post-" + post.id, video, title: "Community video", description: String(post.body).replace(video.url, "").trim().slice(0, 350), href: "/social", kind: "Community" });
  }
  return result;
}
export default function OrbitShorts() {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(true);
  const start = useRef(null);
  const videoRef = useRef(null);
  const load = useCallback(async () => {
    setError("");
    try {
      const [campaignResult, postsResult] = await Promise.allSettled([
        listActiveCampaigns({ limit: 150 }),
        authClient().from("ifund_posts").select("id,body,created_at").order("created_at", { ascending: false }).limit(100)
      ]);
      if (campaignResult.status === "rejected" && postsResult.status === "rejected") throw new Error("Both feeds unavailable");
      const campaigns = campaignResult.status === "fulfilled" ? campaignResult.value : [];
      const posts = postsResult.status === "fulfilled" && !postsResult.value.error ? postsResult.value.data || [] : [];
      if (campaignResult.status === "rejected" && !posts.length && postsResult.status === "fulfilled" && postsResult.value.error) throw postsResult.value.error;
      setItems(collectShorts(campaigns, posts));
    } catch { setError("Videos are unavailable right now. Try again later."); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setIndex(i => Math.min(i, Math.max(0, items.length - 1))); }, [items.length]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || items[index]?.video?.type !== "direct") return;
    video.currentTime = 0;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) video.play().catch(() => {});
    return () => video.pause();
  }, [index, items]);
  const move = (step) => setIndex(i => Math.max(0, Math.min(items.length - 1, i + step)));
  const item = items[index];
  return <main className="mx-auto max-w-xl px-3 py-5 sm:px-5">
    <header className="mb-4 flex items-center justify-between gap-3"><div><h1 className="font-display text-3xl font-bold">Orbit Shorts</h1><p className="text-sm text-muted-foreground">Campaign videos and public community clips</p></div><Link to="/discover" className="text-sm text-primary underline">Campaign grid</Link></header>
    {error && <p role="alert" className="rounded-xl border border-destructive p-4">{error}</p>}
    {!error && !item && <p role="status" className="rounded-xl border border-border p-6">No public video shorts are available yet. Explore campaigns or share a video in the community.</p>}
    {item && <section aria-label="Swipeable video shorts" onTouchStart={e => { start.current = e.touches[0].clientY; }} onTouchEnd={e => { if (start.current == null) return; const delta = start.current - e.changedTouches[0].clientY; start.current = null; if (Math.abs(delta) > 55) move(delta > 0 ? 1 : -1); }} onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); move(1); } if (e.key === "ArrowUp") { e.preventDefault(); move(-1); } }} tabIndex={0} className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950 shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
      <div className="relative aspect-[9/16] max-h-[75dvh] w-full bg-slate-950">
        {item.video.type === "youtube" ? <iframe key={item.id} src={item.video.src} title={item.title} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="h-full w-full border-0" /> : <video key={item.id} ref={videoRef} src={item.video.src} controls playsInline loop muted={muted} preload="metadata" className="h-full w-full object-contain" aria-label={item.title} />}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent px-4 pb-5 pt-16 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">{item.kind} · {index + 1} / {items.length}</p><h2 className="mt-2 text-xl font-bold">{item.title}</h2><p className="mt-1 line-clamp-3 text-sm text-slate-200">{item.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-3 text-white">
        <div className="flex gap-2"><button type="button" onClick={() => move(-1)} disabled={index === 0} className="min-h-11 rounded-lg border border-slate-600 px-3 disabled:opacity-40">Previous</button><button type="button" onClick={() => move(1)} disabled={index === items.length - 1} className="min-h-11 rounded-lg border border-slate-600 px-3 disabled:opacity-40">Next</button></div>
        {item.video.type === "direct" && <button type="button" onClick={() => setMuted(v => !v)} className="min-h-11 rounded-lg border border-slate-600 px-3">{muted ? "Unmute" : "Mute"}</button>}
        <Link to={item.href} className="flex min-h-11 items-center rounded-lg bg-cyan-500 px-4 font-semibold text-slate-950">{item.kind === "Campaign" ? "Full story" : "Social feed"}</Link>
      </div>
    </section>}
    <p className="mt-3 text-center text-xs text-muted-foreground">Swipe up for next, down for previous. Arrow keys and buttons also work. Direct videos start muted; YouTube playback uses its embedded player.</p>
  </main>;
}
