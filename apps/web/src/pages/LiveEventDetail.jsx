import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { getPublicLiveEvent } from "@/api/liveEvents";

export default function LiveEventDetail() {
  const { id } = useParams();
  const [result, setResult] = useState({ phase:"loading", event:null });
  useEffect(() => {
    let active=true;
    setResult({phase:"loading",event:null});
    Promise.resolve().then(()=>getPublicLiveEvent(authClient(),id))
      .then(event=>{if(active)setResult({phase:event?"ready":"not-found",event});})
      .catch(()=>{if(active)setResult({phase:"error",event:null});});
    return()=>{active=false;};
  },[id]);
  const e=result.event;
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
    <Link to="/live" className="inline-flex min-h-11 items-center text-primary underline">Back to IFund Live</Link>
    {result.phase==="loading" && <p role="status">Loading event details…</p>}
    {result.phase==="error" && <p role="alert">The event could not be loaded. Try again later.</p>}
    {result.phase==="not-found" && <div className="space-y-3"><h1 className="text-2xl font-bold">Event unavailable</h1>
      <p>This event may be private, cancelled or not yet published.</p></div>}
    {e && <article className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">
        {e.status==="scheduled" ? "Upcoming event" : e.status==="live" ? "Provider-verified event status" : "Past event"}
      </p>
      <h1 className="font-display text-3xl font-bold">{e.title}</h1>
      {e.scheduled_at && <p className="text-muted-foreground">
        <time dateTime={e.scheduled_at}>{new Date(e.scheduled_at).toLocaleString()}</time>
      </p>}
      {e.description && <p className="whitespace-pre-wrap break-words leading-relaxed">{e.description}</p>}
      <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
        In-app broadcast viewing and recordings are not yet supported. An event listing is not a confirmed active video feed. Any livestream will require a verified streaming provider and host permissions.
      </p>
      <nav aria-label="Event-related destinations" className="flex flex-wrap gap-4 text-primary underline">
        {e.campaign_id && <Link to={`/campaign/${encodeURIComponent(e.campaign_id)}`}>View related fundraiser</Link>}
        <Link to="/social">Explore community discussions</Link>
        <Link to="/fundraising-tips">Fundraising tips</Link>
      </nav>
    </article>}
  </main>;
}
