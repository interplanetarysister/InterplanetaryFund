import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Radio, Video, Newspaper, Compass, ShieldCheck } from "lucide-react";
import { authClient } from "@/api/auth";
import { listPublicLiveEvents } from "@/api/liveEvents";
import { useAuthSession } from "@/hooks/useAuthSession";

const sections = [
  { href: "/shorts", title: "Orbit Shorts", detail: "Explore existing campaign video posts and short-form content.", Icon: Video },
  { href: "/social", title: "IFund Social", detail: "Follow community conversations and shared campaign updates.", Icon: Radio },
  { href: "/news", title: "IFund Newscaster", detail: "Read published platform reports, announcements and editorial updates.", Icon: Newspaper },
  { href: "/discover", title: "Explore campaigns", detail: "Find publicly visible fundraisers and ways to connect.", Icon: Compass },
];
export default function IFundLive() {
  const { user } = useAuthSession();
  const [result, setResult] = useState({ phase: "loading", events: [] });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setResult({ phase: "loading", events: [] });
    Promise.resolve().then(() => listPublicLiveEvents(authClient())).then(data => {
      if (!active) return;
      setResult({ phase: data.available ? "ready" : "unavailable", events: data.events });
    }).catch(() => {
      if (active) setResult({ phase: "error", events: [] });
    });
    return () => { active = false; };
  }, [revision]);
  const scheduled = result.events.filter(e => e.status === "scheduled");
  const live = result.events.filter(e => e.status === "live" && e.provider_status === "verified");
  return <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
    <header className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">Interplanetary Fund / Media</p>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">IFund Live</h1>
      <p className="max-w-3xl text-muted-foreground">Find video stories, ongoing community discussions, and the latest published IFund reporting from one place.</p>
      {user && <Link to="/live/manage" className="inline-flex min-h-11 items-center text-primary underline">Plan a live event</Link>}
    </header>
    <section className="grid gap-4 sm:grid-cols-2" aria-label="Explore IFund media">
      {sections.map(({href,title,detail,Icon}) => <Link key={href} to={href} className="flex min-h-36 flex-col gap-3 rounded-2xl border border-border bg-card p-5 hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </Link>)}
    </section>
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="livestream-status">
      <h2 id="livestream-status" className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck aria-hidden="true" /> Live broadcasts and upcoming events</h2>
      <p className="text-sm text-muted-foreground">A scheduled event is an announcement, not a connected broadcast. IFund does not yet provide in-app live playback, verified streaming sessions, or a recording service.</p>
      {result.phase === "loading" && <p role="status">Loading event announcements…</p>}
      {result.phase === "unavailable" && <p>Event scheduling is in development. No broadcast is available yet.</p>}
      {result.phase === "error" && <div role="alert">Events could not be loaded. <button type="button" className="text-primary underline" onClick={() => setRevision(n => n + 1)}>Retry</button></div>}
      {result.phase === "ready" && <>
        {live.length > 0 && <div className="space-y-3"><h3 className="font-semibold">Verified live events</h3>
          <p className="text-sm text-muted-foreground">Streaming playback is not yet connected; these events are informational only.</p>
          {live.map(e => <EventCard key={e.id} event={e}/>)}
        </div>}
        <h3 className="font-semibold">Upcoming events</h3>
        {scheduled.length ? <ul className="grid gap-3 sm:grid-cols-2">{scheduled.map(e => <li key={e.id}><EventCard event={e} /></li>)}</ul>
          : <p className="text-sm text-muted-foreground">No upcoming public events are scheduled.</p>}
      </>}
      <p className="text-sm text-muted-foreground">Future broadcasts require host permission, provider-verified session state, moderation, and recording consent.</p>
      <Link to="/fundraising-tips" className="inline-flex min-h-11 items-center text-primary underline">Improve your fundraiser while you explore</Link>
    </section>
  </main>;
}

function EventCard({ event }) {
  const when = event.scheduled_at ? new Date(event.scheduled_at) : null;
  return <article className="rounded-xl border border-border p-4">
    <h4 className="font-semibold">{event.title}</h4>
    {event.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{event.description}</p>}
    {when && <p className="mt-2 text-sm"><time dateTime={event.scheduled_at}>{when.toLocaleString()}</time></p>}
    {event.campaign_id && <Link className="mt-3 inline-block text-sm text-primary underline" to={`/campaign/${encodeURIComponent(event.campaign_id)}`}>View related campaign</Link>}
  </article>;
}
