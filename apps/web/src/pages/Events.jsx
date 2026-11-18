import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, ExternalLink, MapPin, Plus, Ticket, XCircle } from "lucide-react";
import { authClient } from "@/api/auth";
import { listMyCampaigns } from "@/api/ownerCampaigns";
import {
  cancelEventActivity, getEvent, listEventItems, listMyEventActivity,
  listOwnerEvents, listPublicEvents,
  recordEventActivity, saveOwnerEvent, saveOwnerEventItem, updateOwnerEventStatus,
} from "@/api/events";

const EVENT_LABELS = {
  benefit_dinner: "Benefit dinner", art_auction: "Art auction",
  benefit_concert: "Benefit concert", community_event: "Community event",
  gala: "Benefit gala", other: "Fundraising event",
};
const ITEM_LABELS = {
  ticket: "Ticket", auction_item: "Auction item", meal: "Meal",
  experience: "Experience", raffle: "Raffle item",
};
const PROVIDERS = [
  ["eventbrite","Eventbrite"],["paypal","PayPal"],["32auctions","32auctions"],
  ["auctria","Auctria"],["givesmart","GiveSmart"],["givebutter","Givebutter"],
  ["zeffy","Zeffy"],["betterunite","BetterUnite"],["onecause","OneCause"],
];
const blankEvent = () => ({
  title:"", description:"", event_type:"benefit_dinner", starts_at:"", ends_at:"",
  timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  venue_name:"", location_label:"", checkout_provider:"", checkout_url:"",
  campaign_id:"", status:"draft", visibility:"public",
});
const blankItem = () => ({
  item_type:"auction_item", title:"", description:"",
  estimated_value:"", starting_bid:"", checkout_provider:"", checkout_url:"",
});
function Field({label,children}) {
  return <label className="block min-w-0 space-y-1.5 text-sm"><span className="font-medium">{label}</span>{children}</label>;
}
function Input({value,onChange,...props}) {
  return <input value={value} onChange={e=>onChange(e.target.value)} {...props}
    className={"min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm "+(props.className||"")}/>;
}
function Textarea({value,onChange,...props}) {
  return <textarea value={value} onChange={e=>onChange(e.target.value)} {...props}
    className="min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm"/>;
}
function ProviderSelect({value,onChange}) {
  return <select value={value||""} onChange={e=>onChange(e.target.value)}
    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
    <option value="">Choose external checkout provider</option>
    {PROVIDERS.map(([key,label])=><option key={key} value={key}>{label}</option>)}
  </select>;
}
function dateTime(value,timezone) {
  if(!value)return "Date to be announced";
  const date=new Date(value); if(!Number.isFinite(date.getTime()))return "Date unavailable";
  try{return new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZone:timezone||undefined}).format(date)+(timezone?" · "+timezone:"");}
  catch{return date.toLocaleString();}
}
function localDateTime(value) {
  if(!value)return "";
  const date=new Date(value); if(!Number.isFinite(date.getTime()))return "";
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function dollars(cents) {
  if(cents===null||cents===undefined)return "Not provided";
  return new Intl.NumberFormat(undefined,{style:"currency",currency:"USD"}).format(Number(cents)/100);
}
function dollarsInput(cents) {
  if(cents===null||cents===undefined||cents==="")return "";
  return (Number(cents)/100).toFixed(2);
}
function toCents(value) {
  if(value===""||value===null||value===undefined)return null;
  const amount=Number(value);
  if(!Number.isFinite(amount)||amount<0||amount>1000000)throw new Error("Enter an amount from $0 to $1,000,000.");
  const cents=Math.round(amount*100);
  if(!Number.isSafeInteger(cents))throw new Error("Enter a valid amount.");
  return cents;
}
function EventCard({event,onOpen}) {
  return <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <span className="rounded-full border border-border px-3 py-1 text-xs font-medium">{EVENT_LABELS[event.event_type]||"Fundraising event"}</span>
      {event.status==="published"&&<span className="text-xs text-emerald-700 dark:text-emerald-300">Published</span>}
    </div>
    <h3 className="mt-3 text-lg font-semibold">{event.title}</h3>
    <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{event.description||"An event supporting a community cause."}</p>
    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
      <p className="flex items-start gap-2"><CalendarDays size={16} className="mt-0.5 shrink-0"/><span>{dateTime(event.starts_at,event.timezone)}</span></p>
      {(event.venue_name||event.location_label)&&<p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0"/><span>{[event.venue_name,event.location_label].filter(Boolean).join(" · ")}</span></p>}
    </div>
    <button type="button" onClick={onOpen} className="mt-4 min-h-11 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800">View event</button>
  </article>;
}
function ProviderCheckout({url,provider,label="Continue to organizer checkout"}) {
  if(!url)return null;
  return <a href={url} target="_blank" rel="noopener noreferrer nofollow"
    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
    {label}<ExternalLink size={15}/>
    <span className="sr-only"> on {provider||"the organizer's provider"} (opens in a new tab)</span>
  </a>;
}
function MoneyInput({value,onChange,label="Amount (optional)"}) {
  return <Field label={label}><div className="flex min-h-11 items-center rounded-xl border border-border bg-background px-3"><span className="mr-2 text-muted-foreground">$</span><input inputMode="decimal" type="number" min="0" max="1000000" step="0.01" value={value} onChange={e=>onChange(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></div></Field>;
}

export default function Events() {
  const {id:eventId}=useParams();
  const [searchParams]=useSearchParams();
  const createFromLink=searchParams.get("create")==="1";
  const navigate=useNavigate();
  const [client]=useState(()=>authClient());
  const [user,setUser]=useState(null);
  const [publicEvents,setPublicEvents]=useState([]);
  const [ownedEvents,setOwnedEvents]=useState([]);
  const [activity,setActivity]=useState([]);
  const [campaigns,setCampaigns]=useState([]);
  const [event,setEvent]=useState(null);
  const [items,setItems]=useState([]);

  const [form,setForm]=useState(blankEvent);
  const [itemForm,setItemForm]=useState(blankItem);
  const [amount,setAmount]=useState("");
  const [reportedItemId,setReportedItemId]=useState("");
  const [editingEventId,setEditingEventId]=useState(null);
  const [editingItemId,setEditingItemId]=useState(null);
  const [showCreator,setShowCreator]=useState(false);
  const [showItemForm,setShowItemForm]=useState(false);
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [search,setSearch]=useState("");
  const [busy,setBusy]=useState("");

  const reload=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const [events,auth]=await Promise.all([listPublicEvents(client),client.auth.getUser()]);
      setPublicEvents(events);
      const current=auth.data?.user||null;setUser(current);
      if(current?.email_confirmed_at&&!current.is_anonymous){
        const [owned,mine,ownCampaigns]=await Promise.all([
          listOwnerEvents(client).catch(()=>[]),
          listMyEventActivity(client).catch(()=>[]),
          listMyCampaigns(client).catch(()=>[]),
        ]);
        setOwnedEvents(owned);setActivity(mine);setCampaigns(ownCampaigns);
      } else {setOwnedEvents([]);setActivity([]);setCampaigns([]);}
    } catch {setError("Fundraising events could not be loaded. Refresh to try again.");}
    finally {setLoading(false);}
  },[client]);
  useEffect(()=>{reload();},[reload]);
  useEffect(()=>{
    if(!eventId&&createFromLink&&user?.email_confirmed_at&&!user.is_anonymous){
      setForm(blankEvent());setEditingEventId(null);setShowCreator(true);
    }
  },[eventId,createFromLink,user?.id]);

  const loadDetail=useCallback(async()=>{
    if(!eventId){setEvent(null);setItems([]);return;}
    setLoading(true);setError("");setNotice("");
    try{
      const row=await getEvent(client,eventId);
      if(!row)throw new Error("This event is not available.");
      setEvent(row);
      const [eventItems,auth,ownRows]=await Promise.all([
        listEventItems(client,eventId),client.auth.getUser(),listOwnerEvents(client).catch(()=>[]),
      ]);
      setItems(eventItems);setOwnedEvents(ownRows);
      const current=auth.data?.user||null;setUser(current);
      const isOwnEvent=ownRows.some(row=>row.id===eventId);
      if(current?.id&&current.email_confirmed_at&&!current.is_anonymous){
        const myRows=await listMyEventActivity(client).catch(()=>[]);
        setActivity(myRows);
      }
      if(isOwnEvent){
        setForm({
          title:row.title,description:row.description||"",event_type:row.event_type,
          starts_at:localDateTime(row.starts_at),ends_at:localDateTime(row.ends_at),
          timezone:row.timezone||"UTC",venue_name:row.venue_name||"",
          location_label:row.location_label||"",checkout_provider:row.checkout_provider||"",
          checkout_url:row.checkout_url||"",campaign_id:row.campaign_id||"",
          status:row.status==="published"?"published":"draft",visibility:row.visibility||"public",
        });
      }
    }catch(cause){setError(cause?.message||"This event could not be loaded.");}
    finally{setLoading(false);}
  },[client,eventId]);
  useEffect(()=>{loadDetail();},[loadDetail]);

  const filteredEvents=useMemo(()=>{
    const unique=new Map();
    for(const row of [...publicEvents,...ownedEvents])unique.set(row.id,row);
    const term=search.trim().toLowerCase();
    return [...unique.values()]
      .filter(row=>row.status==="published"&&row.visibility==="public")
      .filter(row=>!term||[row.title,row.description,row.location_label,row.venue_name,EVENT_LABELS[row.event_type]].filter(Boolean).join(" ").toLowerCase().includes(term))
      .sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
  },[publicEvents,ownedEvents,search]);

  async function submitEvent(status=form.status) {
    setSaving(true);setError("");setNotice("");
    try {
      const payload={...form,status,campaign_id:form.campaign_id||null};
      if(payload.starts_at)payload.starts_at=new Date(payload.starts_at).toISOString();
      if(payload.ends_at)payload.ends_at=new Date(payload.ends_at).toISOString();
      const saved=await saveOwnerEvent(client,payload,{id:editingEventId});
      setEvent(saved);
      setNotice(status==="published"?"Your event is published.":"Your event draft was saved.");
      setEditingEventId(saved.id);
      setShowCreator(false);
      await reload();
      navigate("/events/"+saved.id,{replace:true});
    }catch(cause){setError(cause?.message||"The event could not be saved.");}
    finally{setSaving(false);}
  }

  async function submitItem(e) {
    e.preventDefault();if(!event)return;
    setSaving(true);setError("");setNotice("");
    try{
      const saved=await saveOwnerEventItem(client,event.id,{
        ...itemForm,
        estimated_value_cents:toCents(itemForm.estimated_value),
        starting_bid_cents:toCents(itemForm.starting_bid),
      },{id:editingItemId});
      setItems(current=>[saved,...current.filter(item=>item.id!==saved.id)]);
      setItemForm(blankItem());setEditingItemId(null);setShowItemForm(false);
      setNotice("The event item was saved.");
    }catch(cause){setError(cause?.message||"The event item could not be saved.");}
    finally{setSaving(false);}
  }

  async function joinEvent(activityType="rsvp",itemId=null) {
    if(!user?.email_confirmed_at||user.is_anonymous){navigate("/login?returnTo="+encodeURIComponent("/events/"+event.id));return;}
    setBusy(activityType+(itemId||""));setError("");setNotice("");
    try{
      const reported=activityType==="external_purchase_reported";
      const cents=reported?toCents(amount):null;
      const row=await recordEventActivity(client,{
        eventId:event.id,itemId,activityType,quantity:1,
        reportedAmountCents:cents,reportedCurrency:"USD",
      });
      setActivity(current=>[row,...current.filter(item=>item.id!==row.id)]);
      setNotice(reported?"Your external purchase was added to your event activity as self-reported. It is not an IFund receipt or verified payment.":"You're on the attendee list. Your RSVP is saved to your account.");
    }catch(cause){setError(cause?.message||"Your event activity could not be saved.");}
    finally{setBusy("");}
  }

  async function cancelActivity(row) {
    setBusy(row.id);setError("");setNotice("");
    try{await cancelEventActivity(client,row.id);setActivity(current=>current.map(item=>item.id===row.id?{...item,status:"cancelled"}:item));setNotice("Your event activity was cancelled.");}
    catch(cause){setError(cause?.message||"The activity could not be cancelled.");}
    finally{setBusy("");}
  }

  async function changeEventStatus(status) {
    if(!event)return;
    setBusy("event-status");setError("");setNotice("");
    try{const updated=await updateOwnerEventStatus(client,event.id,status);setEvent(updated);setNotice("Event status updated.");await reload();}
    catch(cause){setError(cause?.message||"Event status could not be updated.");}
    finally{setBusy("");}
  }

  async function editItem(item) {
    setEditingItemId(item.id);setItemForm({
      item_type:item.item_type,title:item.title,description:item.description||"",
      estimated_value:dollarsInput(item.estimated_value_cents),
      starting_bid:dollarsInput(item.starting_bid_cents),
      checkout_provider:item.checkout_provider||"",checkout_url:item.checkout_url||"",
    });setShowItemForm(true);
  }

  if(eventId){
    const isOwner=Boolean(user?.id&&ownedEvents.some(row=>row.id===event.id));
    const myEventActivity=activity.filter(row=>row.event_id===eventId&&row.status==="active");
    const hasRsvp=myEventActivity.some(row=>row.activity_type==="rsvp");
    return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <Link to="/events" className="inline-flex min-h-10 items-center gap-2 text-sm text-primary underline"><ArrowLeft size={16}/>All events</Link>
      {loading?<p role="status">Loading event…</p>:error&&!event?<p role="alert" className="rounded-xl border border-destructive/40 p-4">{error}</p>:event&&<>
        <header className="rounded-2xl border border-border bg-card p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium">{EVENT_LABELS[event.event_type]||"Fundraising event"}</span>
            {isOwner&&<span className="text-xs font-semibold">{event.status==="published"?"Published":event.status==="draft"?"Draft":event.status}</span>}
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{event.title}</h1>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{event.description}</p>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <p className="flex items-start gap-2"><CalendarDays size={18}/><span>{dateTime(event.starts_at,event.timezone)}{event.ends_at?" · Ends "+dateTime(event.ends_at,event.timezone):""}</span></p>
            {(event.venue_name||event.location_label)&&<p className="flex items-start gap-2"><MapPin size={18}/><span>{[event.venue_name,event.location_label].filter(Boolean).join(" · ")}</span></p>}
          </div>
          {event.campaign_id&&<p className="mt-4 text-sm"><Link to={"/campaign/"+event.campaign_id} className="text-primary underline">View the supporting IFund campaign</Link></p>}
          {event.checkout_url&&<div className="mt-5 space-y-2"><ProviderCheckout url={event.checkout_url} provider={event.checkout_provider}/><p className="text-xs text-muted-foreground">Checkout is handled directly by the organizer's {event.checkout_provider} account, not by IFund.</p></div>}
        </header>

        {isOwner?<section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-xl font-semibold">Manage this event</h2>
            <p className="mt-2 text-sm text-muted-foreground">Edit the event information and manage its supporting items. External checkout remains with the listed provider.</p>
            <button type="button" onClick={()=>{setForm({...form,starts_at:localDateTime(event.starts_at),ends_at:localDateTime(event.ends_at)});setEditingEventId(event.id);setShowCreator(true);}} className="mt-4 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">Edit event details</button>
            <div className="mt-3 flex flex-wrap gap-2">
              {event.status==="draft"&&<button onClick={()=>changeEventStatus("cancelled")} disabled={busy==="event-status"} className="min-h-10 rounded-xl border px-3 text-sm">Cancel draft</button>}
              {event.status==="published"&&<button onClick={()=>changeEventStatus("cancelled")} disabled={busy==="event-status"} className="min-h-10 rounded-xl border px-3 text-sm">Cancel event</button>}
              {event.status==="published"&&<button onClick={()=>changeEventStatus("completed")} disabled={busy==="event-status"} className="min-h-10 rounded-xl border px-3 text-sm">Mark completed</button>}
            </div>
            <p className="mt-4 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">Attendee RSVPs and self-reported purchase details remain private in each member account. IFund does not expose member payment reports to event organizers.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Tickets, auction items & experiences</h2><button type="button" onClick={()=>{setItemForm(blankItem());setEditingItemId(null);setShowItemForm(!showItemForm);}} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm"><Plus size={16}/>Add item</button></div>
            {showItemForm&&<form onSubmit={submitItem} className="mt-4 space-y-3 border-t border-border pt-4">
              <Field label="Item type"><select value={itemForm.item_type} onChange={e=>setItemForm({...itemForm,item_type:e.target.value})} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">{Object.entries(ITEM_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Title"><Input value={itemForm.title} onChange={v=>setItemForm({...itemForm,title:v})} required minLength={2} maxLength={140}/></Field>
              <Field label="Description"><Textarea value={itemForm.description} onChange={v=>setItemForm({...itemForm,description:v})} maxLength={3000}/></Field>
              <Field label="Estimated value (USD)"><Input type="number" min="0" step=".01" value={itemForm.estimated_value} onChange={v=>setItemForm({...itemForm,estimated_value:v})}/></Field>
              {itemForm.item_type==="auction_item"&&<Field label="Starting bid (USD)"><Input type="number" min="0" step=".01" value={itemForm.starting_bid} onChange={v=>setItemForm({...itemForm,starting_bid:v})}/></Field>}
              <Field label="Checkout provider"><ProviderSelect value={itemForm.checkout_provider} onChange={v=>setItemForm({...itemForm,checkout_provider:v})}/></Field>
              <Field label="External item checkout URL"><Input type="url" placeholder="https://" value={itemForm.checkout_url} onChange={v=>setItemForm({...itemForm,checkout_url:v})}/></Field>
              <p className="text-xs text-muted-foreground">Use the selected provider's official event/item page. IFund does not process auction bids or ticket payments here.</p>
              <div className="flex flex-wrap gap-2"><button disabled={saving} className="min-h-10 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white">{saving?"Saving…":editingItemId?"Update item":"Save item"}</button><button type="button" onClick={()=>setShowItemForm(false)} className="min-h-10 rounded-xl border px-4 text-sm">Close</button></div>
            </form>}
            <div className="mt-4 space-y-3">
              {items.length===0?<p className="text-sm text-muted-foreground">No tickets or auction items have been listed yet.</p>:items.map(item=><div key={item.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">{ITEM_LABELS[item.item_type]||"Event item"}</p><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.description}</p>{item.estimated_value_cents!==null&&<p className="mt-1 text-xs">Estimated value: {dollars(item.estimated_value_cents)}</p>}{item.starting_bid_cents!==null&&<p className="text-xs">Starting bid: {dollars(item.starting_bid_cents)}</p>}</div><button onClick={()=>editItem(item)} className="min-h-9 rounded-lg border px-3 text-xs">Edit</button></div>
                {item.checkout_url&&<div className="mt-3"><ProviderCheckout url={item.checkout_url} provider={item.checkout_provider} label="View external item page"/></div>}
              </div>)}
            </div>
          </div>
        </section>:<section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-xl font-semibold">Attend this fundraiser</h2>
            <p className="mt-2 text-sm text-muted-foreground">Save your RSVP to your iFund account. This is an attendance record, not a ticket or a payment.</p>
            {hasRsvp?<p className="mt-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={17}/>Your RSVP is saved</p>:<button onClick={()=>joinEvent("rsvp")} disabled={Boolean(busy)} className="mt-4 min-h-11 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white">{busy==="rsvp"?"Saving…":"RSVP to event"}</button>}
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="font-semibold">Already purchased externally?</h3>
              <p className="mt-1 text-sm text-muted-foreground">Record your purchase in your activity so you can keep your event information together. IFund does not verify this provider payment.</p>
              <div className="mt-3 space-y-3">
                {items.filter(i=>i.status==="available"&&i.checkout_url).length>0&&<Field label="Item"><select value={reportedItemId} onChange={e=>setReportedItemId(e.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="">Whole event / event-level purchase</option>{items.filter(i=>i.status==="available"&&i.checkout_url).map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></Field>}
                <MoneyInput value={amount} onChange={setAmount} label="Amount paid (optional; self-reported)"/>
                <button onClick={()=>joinEvent("external_purchase_reported",reportedItemId||null)} disabled={Boolean(busy)||(!event.checkout_url&&!items.some(i=>i.id===reportedItemId&&i.checkout_url))} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50">{busy.startsWith("external_purchase_reported")?"Saving…":"Add purchase to my event activity"}</button>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-xl font-semibold">Event items</h2>
            {items.filter(i=>i.status==="available").length===0?<p className="mt-3 text-sm text-muted-foreground">No ticket, meal or auction item listings yet.</p>:<div className="mt-3 space-y-3">{items.filter(i=>i.status==="available").map(item=><article key={item.id} className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">{ITEM_LABELS[item.item_type]||"Event item"}</p><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              {item.estimated_value_cents!==null&&<p className="mt-1 text-xs">Estimated value: {dollars(item.estimated_value_cents)}</p>}
              {item.starting_bid_cents!==null&&<p className="text-xs">Starting bid: {dollars(item.starting_bid_cents)}</p>}
              <div className="mt-3 flex flex-wrap gap-2"><ProviderCheckout url={item.checkout_url||event.checkout_url} provider={item.checkout_provider||event.checkout_provider} label="Purchase / view on provider"/><button onClick={()=>joinEvent("external_purchase_reported",item.id)} disabled={Boolean(busy)||!item.checkout_url&&!event.checkout_url} className="min-h-10 rounded-xl border px-3 text-xs">I purchased this</button></div>
            </article>)}</div>}
          </div>
        </section>}

        {isOwner&&showCreator&&<section className="rounded-2xl border border-border bg-card p-5">
          <EventForm form={form} setForm={setForm} campaigns={campaigns} saving={saving} onSave={submitEvent} onClose={()=>setShowCreator(false)} edit/>
        </section>}
      </>}
      {error&&<p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">{error}</p>}
      {notice&&<p role="status" className="rounded-xl border border-emerald-500/30 p-3 text-sm">{notice}</p>}
    </main>;
  }

  const activeMine=activity.filter(row=>row.status==="active");
  const rsvpCount=activeMine.filter(row=>row.activity_type==="rsvp").length;
  const reportedCount=activeMine.filter(row=>row.activity_type==="external_purchase_reported").length;
  return <main className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Community fundraising</p><h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Fundraising events</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Benefit dinners, charity galas, art auctions, ticketed gatherings and community experiences — connected to your IFund account.</p></div>
      {user?.email_confirmed_at&&!user?.is_anonymous?<button onClick={()=>{setForm(blankEvent());setEditingEventId(null);setShowCreator(v=>!v);}} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white"><Plus size={17}/>Create event</button>:<Link to="/login?returnTo=%2Fevents" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold">Sign in to create an event</Link>}
    </header>

    {showCreator&&<section className="rounded-2xl border border-border bg-card p-5"><EventForm form={form} setForm={setForm} campaigns={campaigns} saving={saving} onSave={submitEvent} onClose={()=>setShowCreator(false)}/></section>}

    {user?.email_confirmed_at&&!user?.is_anonymous&&<section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Your RSVPs</p><p className="mt-1 text-2xl font-semibold">{rsvpCount}</p></div>
      <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Purchases you reported</p><p className="mt-1 text-2xl font-semibold">{reportedCount}</p><p className="mt-1 text-xs text-muted-foreground">Not provider-verified</p></div>
      <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Events you organize</p><p className="mt-1 text-2xl font-semibold">{ownedEvents.length}</p></div>
    </section>}

    {user?.email_confirmed_at&&!user?.is_anonymous&&ownedEvents.length>0&&<section className="space-y-3"><h2 className="text-xl font-semibold">Events you organize</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ownedEvents.map(row=><EventCard key={row.id} event={row} onOpen={()=>navigate("/events/"+row.id)}/>)}</div></section>}

    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Upcoming fundraisers</h2><p className="text-sm text-muted-foreground">Event information published by IFund members.</p></div><input aria-label="Search events" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events or locations" className="min-h-11 w-full max-w-sm rounded-xl border border-border bg-background px-3 text-sm"/></div>
      {loading?<p role="status" className="py-8 text-sm text-muted-foreground">Loading upcoming events…</p>:error?<p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm">{error}</p>:filteredEvents.length===0?<div className="rounded-2xl border border-dashed border-border p-8 text-center"><CalendarDays className="mx-auto mb-3" size={28}/><p className="font-semibold">No published upcoming events yet</p><p className="mt-1 text-sm text-muted-foreground">Create an event for your fundraiser and share its event page.</p></div>:<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filteredEvents.map(row=><EventCard key={row.id} event={row} onOpen={()=>navigate("/events/"+row.id)}/>)}</div>}
    </section>

    {user?.email_confirmed_at&&!user?.is_anonymous&&activeMine.length>0&&<section className="space-y-3"><h2 className="text-xl font-semibold">Your event activity</h2><div className="space-y-2">{activeMine.slice(0,8).map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div><Link to={"/events/"+row.event_id} className="font-semibold text-primary underline">{publicEvents.find(e=>e.id===row.event_id)?.title||"Open event"}</Link><p className="text-xs text-muted-foreground">{row.activity_type==="rsvp"?"RSVP saved":"External purchase reported · not verified"}{row.reported_amount_cents!==null?" · "+dollars(row.reported_amount_cents):""}</p></div>
      <button onClick={()=>cancelActivity(row)} disabled={busy===row.id} className="min-h-9 rounded-lg border px-3 text-xs">{busy===row.id?"Saving…":"Remove"}</button>
    </div>)}</div></section>}

    <div className="rounded-2xl border border-amber-500/30 p-4 text-sm"><strong>Payment clarity:</strong> IFund event pages link to organizer-selected external checkout providers. Tickets, auction bids and purchases happen directly with those providers. A purchase you report in IFund is personal event activity only; it is not an IFund payment, donation, provider-verified receipt or ledger entry.</div>
    {error&&<p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-emerald-500/30 p-3 text-sm">{notice}</p>}
  </main>;
}

function EventForm({form,setForm,campaigns,saving,onSave,onClose,edit=false}) {
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  return <form onSubmit={e=>{e.preventDefault();onSave(form.status);}} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{edit?"Edit event":"Create a fundraising event"}</h2><p className="mt-1 text-sm text-muted-foreground">Connect the event to an IFund campaign and, if needed, an organizer checkout page.</p></div><button type="button" onClick={onClose} aria-label="Close event form" className="min-h-10 rounded-lg border px-3"><XCircle size={17}/></button></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Event title"><Input value={form.title} onChange={v=>update("title",v)} required minLength={5} maxLength={140} placeholder="Community benefit dinner"/></Field>
      <Field label="Event type"><select value={form.event_type} onChange={e=>update("event_type",e.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">{Object.entries(EVENT_LABELS).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></Field>
      <Field label="Start date and time"><Input type="datetime-local" value={form.starts_at} onChange={v=>update("starts_at",v)} required/></Field>
      <Field label="End date and time (optional)"><Input type="datetime-local" value={form.ends_at} onChange={v=>update("ends_at",v)}/></Field>
      <Field label="Time zone"><Input value={form.timezone} onChange={v=>update("timezone",v)} required maxLength={80}/></Field>
      <Field label="Venue name"><Input value={form.venue_name} onChange={v=>update("venue_name",v)} maxLength={140} placeholder="Community art center"/></Field>
      <Field label="City / public location"><Input value={form.location_label} onChange={v=>update("location_label",v)} maxLength={180} placeholder="City, State"/></Field>
      <Field label="Link to your IFund campaign"><select value={form.campaign_id||""} onChange={e=>update("campaign_id",e.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="">No campaign attached</option>{campaigns.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
    </div>
    <Field label="Event details"><Textarea value={form.description} onChange={v=>update("description",v)} maxLength={5000} placeholder="What the event supports, what guests can expect and how the fundraiser benefits the cause."/></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="External checkout provider"><ProviderSelect value={form.checkout_provider} onChange={v=>update("checkout_provider",v)}/></Field>
      <Field label="Event ticket / donation / registration link"><Input type="url" value={form.checkout_url} onChange={v=>update("checkout_url",v)} placeholder="https://"/></Field>
    </div>
    <p className="text-xs text-muted-foreground">Supported organizer destinations: Eventbrite, PayPal, 32auctions, Auctria, GiveSmart, Givebutter, Zeffy, BetterUnite and OneCause. Links are checked against the selected provider. IFund does not collect or forward payments from these links.</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={saving} onClick={()=>onSave("draft")} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">{saving?"Saving…":"Save draft"}</button>
      <button type="button" disabled={saving} onClick={()=>onSave("published")} className="min-h-11 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white">{saving?"Saving…":"Publish event"}</button>
      <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-sm">Close</button>
    </div>
  </form>;
}
