import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronRight, Link2, Loader2, RefreshCw, Search, ShieldCheck, Unplug, UsersRound } from "lucide-react";
import { authClient } from "@/api/auth";
import { listOwnerCampaigns } from "@/api/ownerCampaigns";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { CONNECTION_PLATFORMS, OAUTH_PLATFORM_IDS, PLATFORM_KIND_NAMES, selectedConnectionPlatform, connectionSteps } from "@/lib/connectionCatalog.mjs";
import { validatePublicConnectionLink } from "@/lib/connectionLinkValidation.mjs";
import { connectionCapabilityReadiness } from "@/lib/connectionCapabilityReadiness.mjs";

const BUTTON = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40";
const PRIMARY = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
const INPUT = "min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm";
const ICON_OVERRIDES = { wordpress_com: "wordpress", google_contacts: "googlecontacts", google_photos: "googlephotos", one_drive: "onedrive", microsoft_teams: "microsoftteams", outlook: "microsoftoutlook" };
const TRUSTED_LOGIN_HOSTS = {
  facebook_pages: ["facebook.com"], instagram: ["instagram.com"],
  youtube: ["accounts.google.com"], google: ["accounts.google.com"],
  linkedin: ["linkedin.com"], tiktok: ["tiktok.com"], x: ["x.com", "twitter.com"]
};
const SHARING_CHOICES = [
  {value:"manual",label:"I'll share it myself"},
  {value:"draft",label:"Help me prepare a draft"},
  {value:"review",label:"Ask me to review first"},
  {value:"off",label:"Don't suggest this platform"}
];

function BrandMark({ platform, size = "small" }) {
  const [failed, setFailed] = useState(false);
  const slug = ICON_OVERRIDES[platform.id] || platform.icon || platform.id;
  const source = "https://api.iconify.design/simple-icons/" + encodeURIComponent(slug) + ".svg";
  const letters = platform.name.replace(/[^a-zA-Z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join("").toUpperCase() || "?";
  return <span aria-hidden="true" className={"inline-flex shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-white text-slate-900 shadow-sm " + (size==="large" ? "size-16" : "size-12")} style={{borderBottomColor:platform.accent}}>
    {failed ? <span className="font-bold">{letters}</span> : <img src={source} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} className={size==="large" ? "size-9 object-contain" : "size-7 object-contain"}/>}
  </span>;
}
function VerifiedLabel({ row, link }) {
  if (row?.status === "connected" && row.verified_at) return <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={15}/> Securely connected</span>;
  if (row && row.status !== "disconnected") return <span className="text-sm text-amber-700 dark:text-amber-300">Finish connecting</span>;
  if (link) return <span className="text-sm text-cyan-700 dark:text-cyan-300">Public page saved</span>;
  return <span className="text-sm text-muted-foreground">Choose how to connect</span>;
}
function hostIsTrusted(provider, url) {
  const hosts=TRUSTED_LOGIN_HOSTS[provider] || [];
  try {
    const u=new URL(url);
    return u.protocol==="https:" && !u.username && !u.password &&
      hosts.some(host => u.hostname===host || u.hostname.endsWith("."+host));
  } catch { return false; }
}
export default function Connections() {
  const { user, status: sessionStatus } = useAuthSession();
  const adminStatus = useAdminAccess(user);
  const [params, setParams] = useSearchParams();
  const requested = params.get("connect") || params.get("platform") || params.get("provider");
  const selected = selectedConnectionPlatform(requested) || CONNECTION_PLATFORMS[0];
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [links, setLinks] = useState([]);
  const [choices, setChoices] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [providerReady, setProviderReady] = useState({});
  const [loading, setLoading] = useState(true);
  const [recordError, setRecordError] = useState("");
  const [diagnosticError, setDiagnosticError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState("");
  const busyLock = useRef(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [pairedCampaign, setPairedCampaign] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(Boolean(user?.id));
    setRecordError("");
    setDiagnosticError("");
    if (!user?.id) {
      setRecords([]); setLinks([]); setChoices([]); setCampaigns([]); setProviderReady({});
      setLoading(false);
      return () => { active = false; };
    }
    async function load() {
      const client = authClient();
      const jobs = await Promise.allSettled([
        client.from("ifund_connections").select("id,provider,status,verified_at,created_at").eq("owner_id",user.id).order("created_at",{ascending:false}),
        client.rpc("ifund_my_public_links"),
        client.rpc("ifund_my_share_choices"),
        listOwnerCampaigns(client),
        (async () => {
          const { data, error: issue }=await client.auth.getSession();
          if (issue || !data?.session?.access_token) return {};
          const result=await fetch("/api/oauth/status",{headers:{Authorization:"Bearer "+data.session.access_token}});
          const payload=await result.json().catch(()=>({}));
          if (!result.ok || payload.enabled!==true) return {};
          return payload.providers || {};
        })()
      ]);
      if (!active) return;
      const extract = (index) => jobs[index].status==="fulfilled" && !jobs[index].value?.error && Array.isArray(jobs[index].value.data) ? jobs[index].value.data : [];
      const accountRows=extract(0);
      setRecords(accountRows);
      setLinks(extract(1));
      setChoices(extract(2));
      setCampaigns(jobs[3].status==="fulfilled" && Array.isArray(jobs[3].value) ? jobs[3].value : []);
      setProviderReady(jobs[4].status==="fulfilled" ? jobs[4].value || {} : {});
      if (jobs[0].status!=="fulfilled" || jobs[0].value?.error) setRecordError("Your saved accounts could not be loaded. Choose Refresh to try again.");
      if (jobs[1].status!=="fulfilled" || jobs[1].value?.error) setRecordError("Your saved public pages could not be loaded. Choose Refresh to try again.");
      if (jobs[2].status!=="fulfilled" || jobs[2].value?.error) setRecordError("Your sharing choices could not be loaded. Choose Refresh to try again.");
      setDiagnosticError(jobs.map((entry,i)=>entry.status==="rejected" ? "Load "+i+": "+String(entry.reason) : entry.value?.error ? "Load "+i+": "+entry.value.error.message : "").filter(Boolean).join("; "));
      setLoading(false);
    }
    load().catch(()=>{ if (active) { setLoading(false); setRecordError("Connections could not be loaded right now. Choose Refresh to try again."); } });
    return () => { active=false; };
  }, [user?.id,refreshKey]);

  const selectedOAuth = OAUTH_PLATFORM_IDS[selected.id] || null;
  const connected = useMemo(() => records.filter(row=>row.status==="connected" && Boolean(row.verified_at)),[records]);
  const saved = links.find(row=>row.provider===selected.id);
  const account = selectedOAuth ? records.find(row=>row.provider===selectedOAuth && row.status!=="disconnected") : null;
  const canStart = Boolean(selectedOAuth && providerReady[selectedOAuth]===true && user?.id);
  const isLinked = Boolean(account?.status==="connected" && account.verified_at);
  const selectedChoice = choices.find(row=>row.provider===selected.id)?.choice || "manual";
  const savedId = saved?.provider || "";

  useEffect(() => {
    setLinkInput(saved?.page_url || "");
    setLinkLabel(saved?.label || "");
    setPairedCampaign(saved?.campaign_id || "");
    setConfirmDisconnect(false);
    setError("");
    setNotice("");
  }, [selected.id,saved?.page_url,saved?.label,saved?.campaign_id]);

  const tiles=useMemo(()=>CONNECTION_PLATFORMS.filter(p=>
    (category==="all" || p.kind===category) &&
    (!search || (p.name+" "+p.kind).toLowerCase().includes(search.trim().toLowerCase()))
  ),[category,search]);
  const readyToAdd=CONNECTION_PLATFORMS.filter(p=>
    p.kind!=="app" || (OAUTH_PLATFORM_IDS[p.id] && providerReady[OAUTH_PLATFORM_IDS[p.id]]===true)
  ).length;

  function choosePlatform(platform) {
    setParams({connect:platform.id});
  }
  async function manage(operation) {
    if (!selectedOAuth || !user?.id || busyLock.current || (operation!=="disconnect" && !canStart)) return;
    busyLock.current=true; setBusy(operation); setError(""); setNotice("");
    let redirect=false;
    try {
      const { data, error: issue } = await authClient().auth.getSession();
      if (issue || !data?.session?.access_token) throw new Error("Sign in again, then return here to connect.");
      const response = await fetch("/api/oauth/"+selectedOAuth+"/"+operation,{
        method:"POST", headers:{Authorization:"Bearer "+data.session.access_token}
      });
      const payload = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error("Please try connecting again from your iFund account.");
      if (operation==="start") {
        if (!hostIsTrusted(selectedOAuth,payload.authorization_url)) throw new Error("The sign-in page could not be verified. Try connecting again.");
        window.location.assign(payload.authorization_url); redirect=true;
        return;
      }
      const expected=operation==="disconnect"?"disconnected":"connected";
      if (payload.status!==expected || payload.provider!==selectedOAuth) throw new Error("Please refresh your connection status.");
      setConfirmDisconnect(false);
      setNotice(operation==="disconnect" ? selected.name+" was disconnected from iFund." : selected.name+" connection updated.");
      setRefreshKey(i=>i+1);
    } catch (cause) { setError(cause.message || "Choose Connect to try again."); }
    finally { if (!redirect) { busyLock.current=false; setBusy(""); } }
  }
  async function saveLink(event) {
    event.preventDefault();
    if (!user?.id || busyLock.current) return;
    const validated=validatePublicConnectionLink(selected.id,linkInput);
    if (!validated.ok) { setError(validated.message); return; }
    busyLock.current=true; setBusy("save-link"); setError(""); setNotice("");
    try {
      const { data, error: issue }=await authClient().rpc("ifund_save_public_link",{
        p_provider:selected.id,p_url:validated.url,p_label:linkLabel.trim(),p_campaign_id:pairedCampaign||null
      });
      if (issue || data!==true) throw new Error("Please check your page address and try saving again.");
      setNotice("Your "+selected.name+" public page is saved privately.");
      setRefreshKey(i=>i+1);
    } catch(cause) { setError(cause.message || "Could not save the link. Try again."); }
    finally { busyLock.current=false; setBusy(""); }
  }
  async function removeLink() {
    if (!savedId || busyLock.current) return;
    busyLock.current=true;setBusy("remove-link");setError("");setNotice("");
    try {
      const {error:issue}=await authClient().rpc("ifund_remove_public_link",{p_provider:selected.id});
      if(issue) throw new Error("Please retry removing this page.");
      setNotice("Saved page removed.");setRefreshKey(i=>i+1);
    } catch(cause) { setError(cause.message); }
    finally { busyLock.current=false;setBusy("");}
  }
  async function saveChoice(value) {
    if (!user?.id || busyLock.current) return;
    busyLock.current=true;setBusy("share-choice");setError("");setNotice("");
    try {
      const { data, error:issue }=await authClient().rpc("ifund_set_share_choice",{p_provider:selected.id,p_choice:value});
      if(issue || data!==true) throw new Error("Please try saving that preference again.");
      setChoices(prev=>[...prev.filter(p=>p.provider!==selected.id),{provider:selected.id,choice:value}]);
      setNotice("Your sharing preference was saved.");
    } catch(cause) { setError(cause.message); }
    finally {busyLock.current=false;setBusy("");}
  }
  const sourcePlatform=selected.id==="facebook"?"Facebook Page":selected.name;
  const canSaveLink=selected.kind!=="app";
  const instructions=connectionSteps(selected,{secure:canStart,hasSavedLink:Boolean(saved)});
  const knownConnections=connected.map(row=> {
    const provider=CONNECTION_PLATFORMS.find(item=>OAUTH_PLATFORM_IDS[item.id]===row.provider || item.id===row.provider);
    return provider ? {provider,row}:null;
  }).filter(Boolean);
  const oauthStepsVisible=canStart && !isLinked;

  return <main className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.17em] text-cyan-600 dark:text-cyan-300">Your accounts</p>
        <h1 className="font-display text-3xl font-bold">Connections</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Keep the fundraising pages, social profiles, and accounts you use together. Select a platform to see the steps for that account.</p>
      </div>
      <Link to="/profile" className={BUTTON}>Back to profile</Link>
    </header>

    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Connection overview">
      <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Actively connected</p><p className="mt-1 text-3xl font-bold tabular-nums">{connected.length}</p></div>
      <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Available to add</p><p className="mt-1 text-3xl font-bold tabular-nums">{readyToAdd}</p></div>
      <div className="col-span-2 rounded-2xl border border-border bg-card p-4 sm:col-span-1"><p className="text-xs text-muted-foreground">Saved public pages</p><p className="mt-1 text-3xl font-bold tabular-nums">{links.length}</p></div>
    </section>

    {knownConnections.length>0 && <section className="space-y-2" aria-label="Active connected platforms">
      <h2 className="text-lg font-semibold">Your connected accounts</h2>
      <div className="flex flex-wrap gap-2">
        {knownConnections.map(({provider,row})=><button key={row.id} type="button" onClick={()=>choosePlatform(provider)}
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-emerald-500/30 bg-card px-3 text-sm font-semibold hover:border-primary">
          <BrandMark platform={provider}/><span>{provider.name}</span><CheckCircle2 size={16} className="text-emerald-600"/>
        </button>)}
      </div>
    </section>}

    <section className="space-y-4" aria-label="Choose a platform">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Choose a platform</h2><p className="text-sm text-muted-foreground">Select an icon to see the connection options and account instructions.</p></div>
        <button type="button" disabled={loading} onClick={()=>setRefreshKey(i=>i+1)} className={BUTTON}>
          <RefreshCw size={16} className={loading?"animate-spin":""}/>Refresh accounts
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Platform categories">
        {Object.entries(PLATFORM_KIND_NAMES).map(([id,label])=><button key={id} type="button" aria-pressed={category===id}
          onClick={()=>setCategory(id)} className={BUTTON+(category===id?" border-primary bg-primary/10":"")}>{label}</button>)}
      </div>
      <label className="relative block max-w-lg">
        <Search size={17} className="pointer-events-none absolute left-3 top-3 text-muted-foreground"/>
        <input type="search" aria-label="Search platforms" className={INPUT+" pl-10"} value={search}
          onChange={event=>setSearch(event.target.value)} placeholder="Find a platform…"/>
      </label>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8" aria-label="Platform icons">
        {tiles.map(platform=>{
          const active=selected.id===platform.id;
          const savedLink=links.some(link=>link.provider===platform.id);
          const verified=records.some(row=>row.status==="connected" && row.verified_at &&
            OAUTH_PLATFORM_IDS[platform.id]===row.provider);
          return <button type="button" key={platform.id} aria-pressed={active} aria-controls="connection-details"
            onClick={()=>choosePlatform(platform)} title={"View "+platform.name+" connection steps"}
            className={"relative flex min-h-28 flex-col items-center justify-start gap-2 rounded-2xl border bg-card px-2 py-3 text-center text-xs font-semibold leading-tight hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary "+(active?"border-primary ring-2 ring-primary/30":"border-border")}>
            <BrandMark platform={platform}/>
            <span className="break-words">{platform.name}</span>
            {(verified||savedLink)&&<span className={"absolute right-1 top-1 size-2.5 rounded-full "+(verified?"bg-emerald-500":"bg-cyan-500")} aria-label={verified?"Securely connected":"Saved page link"}/>}
          </button>;
        })}
      </div>
      {tiles.length===0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No matching platforms. Try another name or category.</p>}
    </section>

    <section id="connection-details" className="space-y-5 rounded-3xl border border-border bg-card p-5 sm:p-7" aria-label={selected.name+" connection instructions"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4"><BrandMark platform={selected} size="large"/><div><h2 className="text-2xl font-bold">{selected.name}</h2><p className="text-sm text-muted-foreground">{selected.kind==="crowdfunding"?"Fundraising page":selected.kind==="social"?"Social profile":"Account connection"}</p></div></div>
        <VerifiedLabel row={account} link={saved}/>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        {selected.kind==="crowdfunding" ? "Add an existing fundraiser from "+sourcePlatform+" so you can return to its public page and pair it with an iFund campaign." :
        selected.kind==="social" ? "Keep your "+sourcePlatform+" profile close to your campaigns and choose how you want to prepare future updates." :
        "Access your "+sourcePlatform+" account through its official sign-in page."}
      </p>
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
        <h3 className="font-semibold">How to connect</h3>
        <ol className="mt-3 space-y-2 text-sm">{instructions.map((step,i)=><li className="flex gap-3" key={i}><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i+1}</span><span>{step}</span></li>)}</ol>
      </div>
      <div className="flex flex-wrap gap-3">
        {canStart && <button type="button" className={PRIMARY} disabled={Boolean(busy)||loading} onClick={()=>manage("start")}>
          <ShieldCheck size={17}/>{busy==="start"?"Opening sign-in…":isLinked?"Reconnect securely":"Connect securely"}
        </button>}
        {selected.site && <a href={selected.site} target="_blank" rel="noopener noreferrer" className={BUTTON}>
          Open {selected.name} <ChevronRight size={16}/>
        </a>}
        {isLinked && <button type="button" className={BUTTON} disabled={Boolean(busy)} onClick={()=>manage("refresh")}>
          <RefreshCw size={16}/>{busy==="refresh"?"Checking…":"Check connection"}
        </button>}
      </div>
      {isLinked && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm">
        Your {selected.name} account is securely connected. Review each share before posting outside iFund.
      </div>}
      {account && <div className="space-y-3 rounded-xl border border-border p-4">
        {confirmDisconnect ? <>
          <p className="text-sm">Disconnect {selected.name} from iFund? Your existing posts on {selected.name} will remain there.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={()=>manage("disconnect")} disabled={Boolean(busy)} className={BUTTON+" text-destructive"}>
              <Unplug size={16}/> {busy==="disconnect"?"Disconnecting…":"Confirm disconnect"}
            </button>
            <button type="button" className={BUTTON} onClick={()=>setConfirmDisconnect(false)}>Keep connected</button>
          </div>
        </> : <button type="button" className={BUTTON} onClick={()=>setConfirmDisconnect(true)}>Disconnect {selected.name}</button>}
      </div>}

      {canSaveLink && <form className="space-y-4 rounded-2xl border border-border p-4" onSubmit={saveLink}>
        <div><h3 className="font-semibold">Save a public {selected.kind==="crowdfunding"?"fundraiser":"profile"} link</h3>
          <p className="mt-1 text-xs text-muted-foreground">This saves a page address privately. It does not sign in to the outside service or read your earnings.</p></div>
        <label className="block space-y-1 text-sm font-medium">Public page address
          <input type="url" required value={linkInput} maxLength={1500} placeholder={selected.site||"https://example.com/my-page"}
            onChange={event=>setLinkInput(event.target.value)} className={INPUT} autoComplete="url"/>
        </label>
        <label className="block space-y-1 text-sm font-medium">My label (optional)
          <input type="text" value={linkLabel} maxLength={100} onChange={event=>setLinkLabel(event.target.value)}
            className={INPUT} placeholder="My fundraising page"/>
        </label>
        <label className="block space-y-1 text-sm font-medium">Pair with an iFund campaign (optional)
          <select value={pairedCampaign} className={INPUT} onChange={event=>setPairedCampaign(event.target.value)}>
            <option value="">Keep this page separate</option>
            {campaigns.map(item=><option key={item.id} value={item.id}>{item.title||"Untitled campaign"}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {user?<button disabled={Boolean(busy)||loading} className={PRIMARY} type="submit">
            <Link2 size={16}/>{busy==="save-link"?"Saving…":saved?"Update saved link":"Save public link"}
          </button>:<Link to="/login?returnTo=%2Fconnections" className={PRIMARY}>Sign in to save</Link>}
          {saved && validatePublicConnectionLink(selected.id,saved.page_url).ok && <a className={BUTTON} href={saved.page_url} target="_blank" rel="noopener noreferrer">Open saved page</a>}
          {saved && <button type="button" disabled={Boolean(busy)} className={BUTTON} onClick={removeLink}>Remove saved link</button>}
        </div>
      </form>}

      {selected.kind==="social" && <div className="space-y-3 rounded-2xl border border-border p-4">
        <h3 className="font-semibold">How do you want help sharing?</h3>
        <p className="text-xs text-muted-foreground">Choose the type of suggestions you prefer. This setting does not post to outside accounts or grant anyone permission to post for you.</p>
        <label className="block space-y-2 text-sm font-medium">My sharing preference
          <select className={INPUT} value={selectedChoice} disabled={!user||Boolean(busy)} onChange={event=>saveChoice(event.target.value)}>
            {SHARING_CHOICES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <Link to="/social" className={BUTTON}>Write a Social Feed update</Link>
      </div>}

      {selected.kind==="crowdfunding" && <div className="flex flex-wrap gap-3">
        <Link to="/my-campaigns" className={BUTTON}><UsersRound size={16}/> Manage iFund campaigns</Link>
        <Link to="/discover" className={BUTTON}>Explore campaigns</Link>
      </div>}
      {notice && <p role="status" className="rounded-xl border border-emerald-500/30 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      {adminStatus==="admin" && <details className="rounded-xl border border-border p-4 text-xs">
        <summary className="cursor-pointer font-semibold">Administrator diagnostics</summary>
        <div className="mt-3 space-y-2 break-words">
          <p>Provider ID: {selectedOAuth || selected.id}</p>
          <p>OAuth API ready: {selectedOAuth?String(providerReady[selectedOAuth]===true):"not applicable"}</p>
          <p>Provider grant: {account?.status || "no stored record"}</p>
          <p>LINK publishing readiness: {connectionCapabilityReadiness({record:account,authorizationEnabled:canStart}).reason}</p>
          {diagnosticError && <p>Read errors: {diagnosticError}</p>}
          <Link to="/admin/integrations" className="underline">Open admin integrations</Link>
        </div>
      </details>}
    </section>

    {recordError && <div role="alert" className="rounded-xl border border-amber-500/30 p-4 text-sm">{recordError}</div>}
    {loading && <div role="status" className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin"/>Updating your connections…</div>}
    {sessionStatus==="signed-out" && <div className="rounded-2xl border border-border p-4 text-sm">
      <p>Explore the platforms above. Sign in when you're ready to save your account links and sharing preferences.</p>
      <Link className="mt-2 inline-flex text-primary underline" to="/login?returnTo=%2Fconnections">Sign in to iFund</Link>
    </div>}
    <section className="flex flex-wrap gap-3 border-t border-border pt-5 text-sm">
      <Link to="/agents" className={BUTTON}>Ask the iFund team for help</Link>
      <Link to="/social" className={BUTTON}>Social Feed</Link>
      <Link to="/help" className={BUTTON}>Connection help</Link>
    </section>
  </main>;
}
