import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, Bot, CircleHelp } from "lucide-react";
import { authClient } from "@/api/auth";
import { verifiedFundingProgress } from "@/lib/fundingTotals";

// Only AG Charts Community free donut series. Enterprise chart/maps are not loaded.
// A single deferred script is shared across the entire IFund app.
const CHART_URL = "https://cdn.jsdelivr.net/npm/ag-charts-community@14.2.0/dist/umd/ag-charts-community.min.js";
let loading;
function loadCharts() {
  if (typeof window === "undefined") return Promise.reject(Error("Browser rendering required"));
  if (window.agCharts?.AgCharts) return Promise.resolve(window.agCharts.AgCharts);
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = CHART_URL;
    script.onload = () => window.agCharts?.AgCharts
      ? resolve(window.agCharts.AgCharts)
      : reject(Error("AG Charts Community unavailable"));
    script.onerror = () => reject(Error("AG Charts Community CDN unavailable"));
    document.head.appendChild(script);
  }).catch(e => { loading = null; throw e; });
  return loading;
}
function usd(dollars) {
  return new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(dollars);
}
function DonutChart({ data, title, valueText }) {
  const host = useRef(null);
  const [unavailable, setUnavailable] = useState(false);
  const rows = useMemo(() => (data || []).filter(x => Number.isFinite(x.value) && x.value > 0), [data]);
  useEffect(() => {
    if (!rows.length) return;
    let active = true, chart = null;
    loadCharts().then(api => {
      if (!active || !host.current) return;
      chart = api.create({
        container:host.current, height:260,
        background:{fill:"#fff"},
        data:rows,
        legend:{position:"bottom"},
        series:[{ type:"donut", angleKey:"value", legendItemKey:"name",
          calloutLabelKey:"name",calloutLabel:{enabled:false},innerRadiusRatio:.72 }]
      });
      setUnavailable(false);
    }).catch(() => {if(active)setUnavailable(true)});
    return () => { active = false; chart?.destroy(); };
  }, [rows]);
  return <div>
    <div ref={host} className="ifund-free-chart" role="img" aria-label={title + ": " + valueText} />
    {unavailable && <p role="status" className="text-xs text-muted-foreground">Chart illustration unavailable. Verified data remains listed below.</p>}
    {!rows.length && <p className="text-sm text-muted-foreground">There is no positive value to plot.</p>}
    <ul className="ifund-chart-values">{(data || []).map(({name,value,label}) =>
      <li key={name}><span>{name}</span><strong>{label || value.toLocaleString()}</strong></li>)}</ul>
  </div>;
}

export function CampaignFundingDonut({ campaign }) {
  const verified = verifiedFundingProgress(campaign);
  const values = useMemo(() => !verified ? [] : [
    {name:"PayPal-confirmed campaign gifts", value:verified.raised, label:usd(verified.raised)},
    {name:"Remaining published goal", value:Math.max(0,verified.goal - verified.raised), label:usd(Math.max(0,verified.goal-verified.raised))}
  ], [verified?.raised,verified?.goal]);
  return <section aria-label="Verified campaign fundraising chart" className="ifund-chart-card">
    <p className="ifund-chart-eyebrow"><ShieldCheck size={16} /> Verified payment data · AG Charts Community</p>
    <h2>Campaign funding progress</h2>
    {!verified
      ? <p className="text-sm text-muted-foreground">Verified campaign funding is not available. A chart cannot be derived from targets or unconfirmed payments.</p>
      : <><DonutChart data={values} title="Verified campaign fundraising donut" valueText={usd(verified.raised)+" raised of "+usd(verified.goal)+" goal"}/>
        <p className="text-sm text-muted-foreground">Only canonical provider-confirmed, captured campaign donations count. PayPal Sandbox and platform support are excluded. Surplus over the goal is shown in the amount above, not credited to remaining goals.</p>
      </>}
  </section>;
}

export function CampaignAgentFocus({ campaignId }) {
  const [state,setState] = useState({phase:"loading",rows:[],message:""});
  useEffect(() => {
    let active=true;
    (async () => {
      try {
        const client=authClient();
        const {data,error}=await client.auth.getUser();
        if(error || !data?.user?.id) {
          if(active)setState({phase:"private",rows:[],message:"Agent activity is private to the campaign organizer."});
          return;
        }
        const result=await client.rpc("ifund_owner_campaign_agent_focus",{p_campaign_id:campaignId});
        if(result.error) {
          if(active)setState({phase:"private",rows:[],message:"Only a verified campaign owner can view stored agent task metrics."});
          return;
        }
        if(!Array.isArray(result.data) || result.data.some(row => !Number.isSafeInteger(Number(row.activity_count)) || Number(row.activity_count)<0))
          throw Error("Invalid agent activity summary");
        if(active)setState({phase:"ready",rows:result.data,message:""});
      } catch {
        if(active)setState({phase:"error",rows:[],message:"Agent activity could not be securely loaded."});
      }
    })();
    return ()=>{active=false};
  },[campaignId]);
  const data=useMemo(() => {
    const groups=new Map();
    for(const item of state.rows) {
      const category=String(item.category || "Other");
      groups.set(category,(groups.get(category)||0)+Number(item.activity_count || 0));
    }
    return [...groups].map(([name,value])=>({name,value,label:value+" recorded tasks"}));
  },[state.rows]);
  const count=state.rows.reduce((sum,row)=>sum+Number(row.activity_count || 0),0);
  return <section aria-label="Owner-only actual agent activity chart" className="ifund-chart-card">
    <p className="ifund-chart-eyebrow"><Bot size={16}/> Campaign agents · authorized owners only</p>
    <h2>Agent activity by focus</h2>
    {state.phase==="loading" && <p role="status" className="text-sm">Checking owner permission and agent records…</p>}
    {state.phase==="private" && <p className="text-sm text-muted-foreground">{state.message}</p>}
    {state.phase==="error" && <p role="alert" className="text-sm">{state.message}</p>}
    {state.phase==="ready" && <>
      <DonutChart data={data} title="Recorded agent tasks by campaign category" valueText={count+" task records"}/>
      <p className="flex items-start gap-2 text-sm text-muted-foreground"><CircleHelp size={16} className="shrink-0"/> {count} recorded task{count===1?"":"s"} across all statuses. This represents stored activity entries, not autonomous effort, hours, agent attention percentages, AI usage, or money. Pending tasks have not been completed.</p>
      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{state.rows.map((r,i)=>
        <li key={String(r.category)+String(r.status)+i}>{r.category || "Other"} · {r.status || "unknown"}: {r.activity_count}</li>)}</ul>
    </>}
  </section>;
}
