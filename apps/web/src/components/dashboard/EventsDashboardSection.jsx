import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock3, MapPin, Palette, Utensils, Users } from "lucide-react";
import { authClient } from "@/api/auth";
import { listMyEventActivity, listOwnerEvents, listPublicEvents } from "@/api/events";

const TYPES = [
  { title:"Benefit dinners & galas", detail:"Charity dinners, benefit nights and fundraising gatherings.", icon:Utensils },
  { title:"Art auctions & experiences", detail:"Artwork, donated items and special experiences.", icon:Palette },
  { title:"Community events", detail:"Local celebrations, performances and cause-based meetups.", icon:Users },
];
function eventDate(row) {
  const date=new Date(row.starts_at);
  if(!Number.isFinite(date.getTime()))return "Date to be announced";
  try{return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZone:row.timezone||undefined}).format(date);}
  catch{return date.toLocaleDateString();}
}

export default function EventsDashboardSection() {
  const [data,setData]=useState({loading:true,available:false,events:[],owned:[],rsvps:0,reported:0});
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const client=authClient();
        const [events,owned,activity]=await Promise.all([
          listPublicEvents(client,{limit:4}),
          listOwnerEvents(client).catch(()=>[]),
          listMyEventActivity(client).catch(()=>[]),
        ]);
        if(!active)return;
        const activeRows=activity.filter(row=>row.status==="active");
        setData({
          loading:false,available:true,events:events.slice(0,3),owned,
          rsvps:activeRows.filter(row=>row.activity_type==="rsvp").length,
          reported:activeRows.filter(row=>row.activity_type==="external_purchase_reported").length,
        });
      }catch{
        if(active)setData(current=>({...current,loading:false,available:false}));
      }
    })();
    return()=>{active=false;};
  },[]);

  return <section aria-labelledby="dashboard-events-title" className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">Fundraising beyond the campaign page</p><h2 id="dashboard-events-title" className="mt-1 text-xl font-semibold">Events & experiences</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Discover benefit dinners, art auctions, galas and community events. Keep event details and your attendance connected to your IFund account.</p></div>
      <Link to="/events" className="inline-flex min-h-10 items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold">Open events</Link>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {TYPES.map(({title,detail,icon:Icon})=><article key={title} className="rounded-xl border border-border bg-background p-3">
        <Icon size={19} className="text-cyan-700 dark:text-cyan-300"/>
        <h3 className="mt-2 text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </article>)}
    </div>
    {data.available?<>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Upcoming published events</p><p className="mt-1 text-xl font-semibold">{data.events.length}</p></div>
        <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Your event RSVPs</p><p className="mt-1 text-xl font-semibold">{data.rsvps}</p></div>
        <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Purchases you reported</p><p className="mt-1 text-xl font-semibold">{data.reported}</p><p className="text-[11px] text-muted-foreground">Self-reported, not verified payments</p></div>
      </div>
      {data.events.length>0?<div className="space-y-2"><h3 className="text-sm font-semibold">Coming up</h3>{data.events.map(row=><Link key={row.id} to={"/events/"+row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 hover:bg-muted/30">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{row.title}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 size={13}/>{eventDate(row)}</p>{row.location_label&&<p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={13}/>{row.location_label}</p>}</div>
        <span className="text-xs font-semibold text-primary">View event</span>
      </Link>)}</div>:<p className="text-sm text-muted-foreground">No upcoming events are published yet. Create one for a fundraiser you support or organize.</p>}
      <p className="text-xs text-muted-foreground">Organize and manage {data.owned.length} event{data.owned.length===1?"":"s"} · RSVP and external purchase activity stays linked to your account.</p>
    </>:<p className="text-sm text-muted-foreground">Event services are being connected. Event ticketing and auction checkout remain with the organizer's chosen provider.</p>}
    <div className="flex flex-wrap gap-4 text-sm"><Link to="/events" className="font-semibold text-primary underline underline-offset-4">Browse events</Link><Link to="/events?create=1" className="font-semibold text-primary underline underline-offset-4">Create an event fundraiser</Link></div>
    <p className="text-xs text-muted-foreground">External ticket and auction payments go directly to organizers through their checkout providers. Purchases reported in IFund are not IFund receipts, donations or verified financial transactions.</p>
  </section>;
}
