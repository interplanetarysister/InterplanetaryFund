import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, ExternalLink, MapPin, RefreshCw, Ticket } from "lucide-react";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  cancelEventActivity, getEvent, listEventItems, listMyEventActivity,
  listOwnerEvents, listPublicEvents, recordEventActivity,
} from "@/api/events";

const LABELS = {
  benefit_dinner:"Benefit dinner", art_auction:"Art auction",
  benefit_concert:"Benefit concert", community_event:"Community event",
  gala:"Benefit gala", other:"Fundraising event",
};
const ITEM_LABELS = {
  ticket:"Ticket", auction_item:"Auction item", meal:"Meal",
  experience:"Experience", raffle:"Raffle item",
};
function eventDate(row) {
  const date=new Date(row.starts_at);
  if(!Number.isFinite(date.getTime()))return "Date to be announced";
  try {
    return new Intl.DateTimeFormat(undefined,{
      weekday:"short",month:"short",day:"numeric",year:"numeric",
      hour:"numeric",minute:"2-digit",timeZone:row.timezone||undefined,
    }).format(date)+(row.timezone?" · "+row.timezone:"");
  } catch { return date.toLocaleString(); }
}
function money(cents) {
  if(cents===null||cents===undefined)return null;
  return new Intl.NumberFormat(undefined,{style:"currency",currency:"USD"}).format(Number(cents)/100);
}
function ExternalOrganizerLink({url,label="View organizer checkout"}) {
  if(!url)return null;
  return <a href={url} target="_blank" rel="noopener noreferrer nofollow"
    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/40 px-4 py-2 text-sm font-semibold text-emerald-100">
    {label}<ExternalLink size={15} aria-hidden="true"/>
  </a>;
}
function EventCard({row,onOpen}) {
  return <article className="space-y-3 rounded-2xl border border-emerald-300/20 bg-white/5 p-4">
    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">{LABELS[row.event_type]||"Fundraising event"}</p>
    <h3 className="text-lg font-bold">{row.title}</h3>
    <p className="line-clamp-3 text-sm leading-6 text-slate-300">{row.description||"A community fundraiser."}</p>
    <p className="flex items-start gap-2 text-xs text-slate-300"><CalendarDays size={15} className="mt-0.5 shrink-0"/>{eventDate(row)}</p>
    {(row.venue_name||row.location_label)&&<p className="flex items-start gap-2 text-xs text-slate-300"><MapPin size={15} className="mt-0.5 shrink-0"/>{[row.venue_name,row.location_label].filter(Boolean).join(" · ")}</p>}
    <button type="button" onClick={onOpen} className="min-h-11 rounded-xl bg-emerald-200 px-4 text-sm font-bold text-slate-950">View event</button>
  </article>;
}

export default function MobileStoreEvents({embedded=false}) {
  const {id:eventId}=useParams();
  const navigate=useNavigate();
  const {user,status:sessionStatus}=useAuthSession();
  const [client]=useState(()=>authClient());
  const [events,setEvents]=useState([]);
  const [ownedIds,setOwnedIds]=useState([]);
  const [activity,setActivity]=useState([]);
  const [event,setEvent]=useState(null);
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState("");
  const [search,setSearch]=useState("");
  const [reload,setReload]=useState(0);

  const verified=Boolean(user?.id&&user.email_confirmed_at&&!user.is_anonymous);
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      if(eventId) {
        const row=await getEvent(client,eventId);
        if(!row)throw new Error("This event is not available.");
        const [eventItems,ownRows,myRows]=await Promise.all([
          listEventItems(client,eventId),
          verified?listOwnerEvents(client).catch(()=>[]):Promise.resolve([]),
          verified?listMyEventActivity(client).catch(()=>[]):Promise.resolve([]),
        ]);
        setEvent(row);setItems(eventItems);
        setOwnedIds(ownRows.map(item=>item.id));
        setActivity(myRows);
      } else {
        const [rows,ownRows,myRows]=await Promise.all([
          listPublicEvents(client,{limit:60}),
          verified?listOwnerEvents(client).catch(()=>[]):Promise.resolve([]),
          verified?listMyEventActivity(client).catch(()=>[]):Promise.resolve([]),
        ]);
        setEvents(rows);setOwnedIds(ownRows.map(item=>item.id));setActivity(myRows);
      }
    } catch(cause) {
      setError(cause?.message||"Fundraising events could not be loaded.");
    } finally {setLoading(false);}
  },[client,eventId,verified]);
  useEffect(()=>{load();},[load,reload]);

  const filtered=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return events.filter(row=>!term||[row.title,row.description,row.venue_name,row.location_label,LABELS[row.event_type]]
      .filter(Boolean).join(" ").toLowerCase().includes(term));
  },[events,search]);

  async function saveActivity(eventIdValue,activityType,itemId=null) {
    if(!verified) {
      navigate("/login?returnTo="+encodeURIComponent(eventIdValue?"/events/"+eventIdValue:"/events"));
      return;
    }
    const key=activityType+(itemId||eventIdValue);
    setBusy(key);setError("");setNotice("");
    try {
      const row=await recordEventActivity(client,{
        eventId:eventIdValue,itemId,activityType,quantity:1,
        reportedAmountCents:null,reportedCurrency:"USD",
      });
      setActivity(current=>[row,...current.filter(item=>item.id!==row.id)]);
      setNotice(activityType==="rsvp"
        ?"Your RSVP is saved to your IFund account."
        :"Your purchase note is saved to your account as self-reported activity, not a verified payment or receipt.");
    } catch(cause) {
      setError(cause?.message||"This event activity could not be saved.");
    } finally {setBusy("");}
  }
  async function removeActivity(row) {
    setBusy(row.id);setError("");setNotice("");
    try {
      await cancelEventActivity(client,row.id);
      setActivity(current=>current.map(item=>item.id===row.id?{...item,status:"cancelled"}:item));
      setNotice("The event activity was removed from your account.");
    } catch(cause) {
      setError(cause?.message||"The event activity could not be removed.");
    } finally {setBusy("");}
  }

  const activeActivity=activity.filter(row=>row.status==="active");
  const rsvps=activeActivity.filter(row=>row.activity_type==="rsvp");
  const reported=activeActivity.filter(row=>row.activity_type==="external_purchase_reported");

  if(embedded) {
    return <section aria-labelledby="mobile-events-title" className="space-y-4 rounded-2xl border border-emerald-300/20 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="mobile-events-title" className="text-xl font-bold">Fundraising events</h2><p className="mt-1 text-sm leading-6 text-slate-300">Benefit dinners, galas, art auctions and community experiences connected to your IFund account.</p></div>
        <Link to="/events" className="inline-flex min-h-10 items-center rounded-lg border border-emerald-300/40 px-3 text-sm font-semibold text-emerald-100">Browse events</Link>
      </div>
      {loading?<p role="status" className="text-sm text-slate-300">Loading events…</p>:error?<p role="alert" className="text-sm text-amber-200">{error}</p>:events.length?
        <div className="space-y-3">{events.slice(0,3).map(row=><Link key={row.id} to={"/events/"+row.id} className="block rounded-xl border border-white/15 p-3">
          <p className="text-xs text-emerald-300">{LABELS[row.event_type]||"Fundraising event"}</p>
          <p className="mt-1 font-semibold">{row.title}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-300"><CalendarDays size={13}/>{eventDate(row)}</p>
          {row.location_label&&<p className="mt-1 flex items-center gap-1 text-xs text-slate-300"><MapPin size={13}/>{row.location_label}</p>}
        </Link>)}</div>:<p className="text-sm text-slate-300">No upcoming events are published yet.</p>}
      {verified&&<div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-black/15 p-3"><p className="text-xs text-slate-300">Your RSVPs</p><p className="mt-1 text-xl font-bold">{rsvps.length}</p></div>
        <div className="rounded-xl bg-black/15 p-3"><p className="text-xs text-slate-300">Purchases you noted</p><p className="mt-1 text-xl font-bold">{reported.length}</p><p className="text-[10px] text-slate-400">Not payment-verified</p></div>
      </div>}
      {verified&&activeActivity.length>0&&<div className="space-y-2 border-t border-white/10 pt-3">
        <h3 className="text-sm font-semibold">Your event activity</h3>
        {activeActivity.slice(0,4).map(row=><div key={row.id} className="flex items-center justify-between gap-2 text-xs">
          <Link to={"/events/"+row.event_id} className="min-w-0 truncate text-emerald-100 underline">{events.find(item=>item.id===row.event_id)?.title||"Open saved event"}</Link>
          <span className="shrink-0 text-slate-300">{row.activity_type==="rsvp"?"RSVP":"Purchase note"}</span>
        </div>)}
      </div>}
      <p className="text-xs leading-5 text-slate-400">Purchases happen directly with the event organizer outside the IFund app. Notes you add here are not provider-verified payments or official receipts.</p>
    </section>;
  }

  if(eventId) {
    const isOwn=ownedIds.includes(eventId);
    const activeForEvent=activeActivity.filter(row=>row.event_id===eventId);
    const hasRsvp=activeForEvent.some(row=>row.activity_type==="rsvp");
    return <div className="space-y-5">
      <Link to="/events" className="inline-flex min-h-10 items-center gap-2 text-sm text-emerald-200 underline">← All events</Link>
      {loading?<p role="status">Loading event details…</p>:error&&!event?<p role="alert" className="rounded-xl border border-amber-300/40 p-4 text-sm text-amber-100">{error}</p>:event&&<>
        <header className="space-y-4 rounded-2xl border border-emerald-300/20 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">{LABELS[event.event_type]||"Fundraising event"}</p>
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{event.description}</p>
          <p className="flex items-start gap-2 text-sm text-slate-300"><CalendarDays size={17} className="mt-0.5 shrink-0"/>{eventDate(event)}</p>
          {(event.venue_name||event.location_label)&&<p className="flex items-start gap-2 text-sm text-slate-300"><MapPin size={17} className="mt-0.5 shrink-0"/>{[event.venue_name,event.location_label].filter(Boolean).join(" · ")}</p>}
          {event.campaign_id&&<Link to={"/campaign/"+event.campaign_id} className="inline-flex min-h-10 items-center text-sm text-emerald-200 underline">View supporting IFund campaign</Link>}
          {event.checkout_url&&<div className="space-y-2 border-t border-white/10 pt-4">
            <ExternalOrganizerLink url={event.checkout_url} label="Open organizer's event website"/>
            <p className="text-xs leading-5 text-slate-400">This opens the organizer's provider outside the IFund app. IFund does not process this ticket or auction payment.</p>
          </div>}
        </header>
        {!isOwn&&<section className="space-y-3 rounded-2xl border border-white/15 p-5">
          <h2 className="text-lg font-bold">Your event activity</h2>
          {hasRsvp?<p className="flex items-center gap-2 text-sm text-emerald-200"><CheckCircle2 size={17}/>RSVP saved to your account</p>:<button type="button" onClick={()=>saveActivity(event.id,"rsvp")} disabled={Boolean(busy)||!verified} className="min-h-11 rounded-xl bg-emerald-200 px-4 text-sm font-bold text-slate-950 disabled:opacity-50">{verified?"Save RSVP to my account":"Sign in to RSVP"}</button>}
          {event.checkout_url&&<button type="button" onClick={()=>saveActivity(event.id,"external_purchase_reported")} disabled={Boolean(busy)||!verified} className="block min-h-11 rounded-xl border border-emerald-300/40 px-4 text-sm font-semibold disabled:opacity-50">{verified?"I purchased outside IFund":"Sign in to record a purchase"}</button>}
          <p className="text-xs leading-5 text-slate-400">A purchase note is self-reported. It is not a verified payment, IFund donation, tax receipt or organizer confirmation.</p>
        </section>}
        {items.filter(item=>item.status==="available").length>0&&<section className="space-y-3">
          <h2 className="text-lg font-bold">Tickets, auction items & experiences</h2>
          {items.filter(item=>item.status==="available").map(item=><article key={item.id} className="space-y-2 rounded-xl border border-white/15 p-4">
            <p className="text-xs text-emerald-300">{ITEM_LABELS[item.item_type]||"Event item"}</p>
            <h3 className="font-semibold">{item.title}</h3>
            {item.description&&<p className="text-sm text-slate-300">{item.description}</p>}
            {item.estimated_value_cents!==null&&<p className="text-xs text-slate-300">Estimated value: {money(item.estimated_value_cents)}</p>}
            {item.starting_bid_cents!==null&&<p className="text-xs text-slate-300">Starting bid: {money(item.starting_bid_cents)}</p>}
            <div className="flex flex-wrap gap-2">
              <ExternalOrganizerLink url={item.checkout_url||event.checkout_url} label="Open organizer's item page"/>
              {item.checkout_url&&verified&&!isOwn&&<button type="button" onClick={()=>saveActivity(event.id,"external_purchase_reported",item.id)} disabled={Boolean(busy)} className="min-h-11 rounded-xl border border-white/30 px-3 text-xs">I purchased this item</button>}
            </div>
          </article>)}
        </section>}
      </>}
      {error&&event&&<p role="alert" className="rounded-xl border border-amber-300/40 p-3 text-sm text-amber-100">{error}</p>}
      {notice&&<p role="status" className="rounded-xl border border-emerald-300/30 p-3 text-sm text-emerald-100">{notice}</p>}
    </div>;
  }

  return <div className="space-y-6">
    <header className="space-y-3">
      <h1 className="text-3xl font-bold">Fundraising events</h1>
      <p className="text-sm leading-6 text-slate-300">Browse benefit dinners, charity galas, art auctions, tickets and community events. Save RSVPs and personal purchase notes to your IFund account.</p>
      <label className="block"><span className="sr-only">Search events</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events or locations" className="min-h-12 w-full rounded-xl border border-emerald-300/30 bg-white/10 px-3 text-sm text-white placeholder:text-slate-300"/></label>
      <button type="button" onClick={()=>setReload(n=>n+1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/30 px-3 text-xs"><RefreshCw size={14}/>Refresh</button>
    </header>
    {loading?<p role="status">Loading published events…</p>:error?<p role="alert" className="rounded-xl border border-amber-300/40 p-4 text-sm">{error}</p>:filtered.length===0?<div className="rounded-xl border border-dashed border-white/20 p-6 text-center"><Ticket className="mx-auto mb-2 h-7 w-7 text-emerald-200"/><p className="font-semibold">No upcoming events published</p><p className="mt-1 text-sm text-slate-300">New fundraisers and experiences will appear here.</p></div>:<div className="grid gap-4">{filtered.map(row=><EventCard key={row.id} row={row} onOpen={()=>navigate("/events/"+row.id)}/>)}</div>}
    {verified&&activeActivity.length>0&&<section className="space-y-3 rounded-2xl border border-white/15 p-5"><h2 className="font-bold">Your saved event activity</h2>{activeActivity.map(row=><div key={row.id} className="flex items-center justify-between gap-2 text-sm"><Link to={"/events/"+row.event_id} className="truncate text-emerald-100 underline">{events.find(item=>item.id===row.event_id)?.title||"Open event"}</Link><button type="button" onClick={()=>removeActivity(row)} disabled={Boolean(busy)} className="min-h-9 rounded-lg border border-white/20 px-3 text-xs">Remove</button></div>)}</section>}
    <p className="rounded-xl border border-amber-300/20 bg-amber-500/5 p-4 text-xs leading-5 text-slate-300">Event organizers handle ticket purchases and auction checkout on their own provider websites outside the IFund app. An event purchase note in IFund is self-reported and is not a verified payment or receipt.</p>
    {notice&&<p role="status" className="rounded-xl border border-emerald-300/30 p-3 text-sm text-emerald-100">{notice}</p>}
  </div>;
}
