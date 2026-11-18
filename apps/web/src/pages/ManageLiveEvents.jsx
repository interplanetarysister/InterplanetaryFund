import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  verifiedLiveOwner, listLiveCampaignChoices, listOwnerLiveEvents,
  createLiveDraft, updateLiveDraft,
} from "@/api/liveEvents";

const empty = { title: "", description: "", scheduled_at: "", campaign_id: "", recording_consent: false };
const localTime = value => value ? new Date(value).toLocaleString() : "Time not selected";
function fromEvent(event) {
  return { title: event.title || "", description: event.description || "",
    scheduled_at: event.scheduled_at ? new Date(new Date(event.scheduled_at).getTime() -
      new Date(event.scheduled_at).getTimezoneOffset() * 60000).toISOString().slice(0,16) : "",
    campaign_id: event.campaign_id || "", recording_consent: event.recording_consent === true };
}
export default function ManageLiveEvents() {
  const { user } = useAuthSession();
  const [events, setEvents] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  // Invalidate responses created under the previous authenticated identity.
  const requestGeneration = useRef(0);
  const activeAccount = useRef(user?.id || null);
  activeAccount.current = user?.id || null;

  const refresh = useCallback(async () => {
    const generation = ++requestGeneration.current;
    const currentAccount = activeAccount.current;
    setStatus("loading"); setError("");
    try {
      const client = authClient();
      const owner = await verifiedLiveOwner(client);
      const [rows, choices] = await Promise.all([listOwnerLiveEvents(client), listLiveCampaignChoices(client, owner)]);
      const { data } = await client.auth.getUser();
      if (data?.user?.id !== owner || currentAccount !== owner)
        throw Error("Your account changed. Reload your events.");
      if (generation !== requestGeneration.current || activeAccount.current !== owner) return;
      setEvents(rows); setCampaigns(choices); setStatus("ready");
    } catch (cause) {
      if (generation !== requestGeneration.current || activeAccount.current !== currentAccount) return;
      setStatus("error"); setError(cause?.message || "Events are unavailable.");
    }
  }, []);
  useEffect(() => {
    refresh();
    return () => { requestGeneration.current++; };
  }, [refresh, user?.id]);
  useEffect(() => {
    setSelected(null); setForm(empty); setEvents([]); setCampaigns([]); setNotice(""); setError("");
  }, [user?.id]);

  function selectEvent(event) { setSelected(event); setForm(fromEvent(event)); setError(""); setNotice(""); }
  function newEvent() { setSelected(null); setForm(empty); setError(""); setNotice(""); }
  async function save(next) {
    if (busy) return;
    const generation = requestGeneration.current;
    const currentAccount = activeAccount.current;
    setBusy(true); setNotice(""); setError("");
    try {
      const client = authClient();
      const payload = { ...form, scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : "" };
      if (!selected && next !== "draft") throw Error("Save a private draft before scheduling.");
      const saved = selected
        ? await updateLiveDraft(client, selected, payload, next)
        : await createLiveDraft(client, payload);
      if (generation !== requestGeneration.current || activeAccount.current !== currentAccount) return;
      setSelected(saved); setForm(fromEvent(saved));
      setNotice(next === "scheduled" ? "Your event is listed as upcoming. Broadcasting is not enabled." :
        next === "cancelled" ? "This event was cancelled." : "Private event draft saved.");
      await refresh();
    } catch (cause) {
      if (generation === requestGeneration.current && activeAccount.current === currentAccount)
        setError(cause?.message || "The event could not be saved.");
    } finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
    <header>
      <Link className="text-primary underline" to="/live">IFund Live</Link>
      <h1 className="mt-3 font-display text-3xl font-bold">Manage live events</h1>
      <p className="mt-2 text-muted-foreground">Prepare or schedule a community video event. Scheduling does not start a broadcast or charge participants.</p>
    </header>
    <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
      Broadcasting is not connected to a verified streaming provider yet. No stream key, video recording, or payment will be created on this page.
    </p>
    {status === "loading" && <p role="status">Loading your event schedule…</p>}
    {status === "error" && <p role="alert">{error} <button className="text-primary underline" type="button" onClick={refresh}>Retry</button></p>}
    {status === "ready" && <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <section aria-label="Your scheduled and draft events" className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Your events</h2>
          <button type="button" className="rounded-lg border border-border px-3 py-2 text-primary" onClick={newEvent}>New draft</button>
        </div>
        {!events.length && <p className="text-sm text-muted-foreground">No event drafts yet. Start with a topic and an optional campaign.</p>}
        {events.map(event => <button type="button" key={event.id} onClick={() => selectEvent(event)}
          className={"block w-full rounded-xl border p-4 text-left hover:border-primary " + (selected?.id === event.id ? "border-primary bg-primary/5" : "border-border bg-card")}>
          <span className="block font-semibold">{event.title}</span>
          <span className="block text-sm text-muted-foreground">{event.status} · {localTime(event.scheduled_at)}</span>
        </button>)}
      </section>
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="Live event editor">
        <h2 className="text-xl font-semibold">{selected ? "Edit your event" : "Create an event draft"}</h2>
        <label className="block space-y-1 text-sm font-medium">Event title
          <input className="w-full rounded-lg border border-input bg-background p-3" minLength={8} maxLength={140} value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))} />
        </label>
        <label className="block space-y-1 text-sm font-medium">What will you discuss?
          <textarea className="w-full rounded-lg border border-input bg-background p-3" rows={4} maxLength={2000} value={form.description}
            onChange={e => setForm(f => ({...f,description:e.target.value}))} />
        </label>
        <label className="block space-y-1 text-sm font-medium">Planned time (your local time)
          <input className="w-full rounded-lg border border-input bg-background p-3" type="datetime-local" value={form.scheduled_at}
            onChange={e => setForm(f => ({...f,scheduled_at:e.target.value}))} />
        </label>
        <label className="block space-y-1 text-sm font-medium">Related fundraiser (optional)
          <select className="w-full rounded-lg border border-input bg-background p-3" value={form.campaign_id}
            onChange={e => setForm(f => ({...f,campaign_id:e.target.value}))}>
            <option value="">General iFund community event</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={form.recording_consent}
            onChange={e => setForm(f => ({...f,recording_consent:e.target.checked}))} />
          I consent to recording if verified recording infrastructure is enabled later. This does not record anything now.
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        <div className="flex flex-wrap gap-3">
          <button disabled={busy} onClick={() => save("draft")} className="min-h-11 rounded-lg border border-border px-5 font-semibold" type="button">{busy?"Saving…":"Save private draft"}</button>
          <button disabled={busy || !selected} onClick={() => save("scheduled")} className="min-h-11 rounded-lg bg-primary px-5 font-semibold text-primary-foreground" type="button">List upcoming event</button>
          {selected?.status === "scheduled" && <button disabled={busy} onClick={() => save("cancelled")} className="min-h-11 rounded-lg border border-border px-5" type="button">Cancel event</button>}
        </div>
      </section>
    </div>}
  </main>;
}
