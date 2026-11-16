import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { projectUsPoint, mainlandOutlinePath, US_REGIONS } from "@/lib/usAtlasProjection.mjs";
import { isApprovedAtlasLocation } from "@/lib/atlasLocations.mjs";
import { groupUSCampaignMarkers } from "@/lib/usAtlasClusters.mjs";

/** Public-safe, vendor-free geographic schematic. No inference or geocoding. */
export default function USCampaignMap({ campaigns = [] }) {
  const [selectedKey,setSelectedKey]=useState(null);
  const clusters=useMemo(()=>groupUSCampaignMarkers(campaigns),[campaigns]);
  const plotted=clusters.reduce((sum,cluster)=>sum+cluster.campaigns.length,0);
  // Derive selection from current props to prevent cross-owner data persistence.
  const selected=clusters.find(cluster=>cluster.key===selectedKey)||null;
  const outside=campaigns.filter(c=>c.status==="active"&&isApprovedAtlasLocation(c)&&!projectUsPoint(c.latitude,c.longitude)).length;
  return <section className="ifund-us-map rounded-2xl border border-emerald-500/30 bg-[#0b1928] p-4 text-slate-100 sm:p-5" aria-label="United States campaign location map">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Living Earth · U.S. location overview</p>
        <h2 className="mt-1 text-xl font-semibold">Campaigns across America</h2>
        <p className="mt-1 text-xs text-slate-300">Schematic latitude/longitude layout with separate Alaska and Hawaii insets. For approximate campaign discovery, not navigation.</p>
      </div>
      <span className="rounded-full border border-emerald-300/30 px-3 py-1 text-sm font-semibold text-emerald-200">{plotted} plotted</span>
    </div>
    <svg role="group" aria-label={plotted+" approved U.S. campaigns at "+clusters.length+" locations"} viewBox="0 0 960 510" className="block w-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="us-atlas-sea" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#102b3b"/><stop offset=".58" stopColor="#092337"/><stop offset="1" stopColor="#17213d"/>
        </linearGradient>
        <linearGradient id="us-atlas-land" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#21776e" stopOpacity=".36"/><stop offset=".65" stopColor="#406f78" stopOpacity=".22"/><stop offset="1" stopColor="#8496a4" stopOpacity=".18"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="960" height="510" rx="24" fill="url(#us-atlas-sea)"/>
      {Array.from({length:9},(_,i)=><line key={"v"+i} x1={56+i*105} y1="26" x2={56+i*105} y2="375" stroke="#7ac6bc" strokeOpacity=".10" strokeWidth="1"/>)}
      {Array.from({length:5},(_,i)=><line key={"h"+i} x1="30" y1={60+i*73} x2="930" y2={60+i*73} stroke="#7ac6bc" strokeOpacity=".10" strokeWidth="1"/>)}
      <path d={mainlandOutlinePath()} fill="url(#us-atlas-land)" stroke="#76d6bc" strokeWidth="1.5" strokeOpacity=".70" strokeLinejoin="round"/>
      <text x="85" y="70" fill="#a5d2d2" fontSize="13" letterSpacing="2">PACIFIC</text>
      <text x="786" y="325" fill="#a5d2d2" fontSize="13" letterSpacing="2">ATLANTIC</text>
      <text x="410" y="170" fill="#b7ebe0" fillOpacity=".50" fontSize="18" letterSpacing="3" textAnchor="middle">UNITED STATES</text>
      {US_REGIONS.filter(r=>r.id!=="mainland").map(r=><g key={r.id}>
        <rect x={r.view.x} y={r.view.y} width={r.view.w} height={r.view.h} rx="14" fill="#1a3e4b" fillOpacity=".62" stroke="#71bba8" strokeOpacity=".4" strokeWidth="1.4"/>
        <text x={r.view.x+12} y={r.view.y+22} fontSize="14" fill="#c3f2de" fontWeight="600">{r.name}</text>
      </g>)}
      {clusters.map(({key,point,campaigns:items})=><g key={key} role="button" tabIndex={0} className="ifund-us-pin"
        aria-label={"Select "+items.length+" campaign"+(items.length===1?"":"s")+" at this approximate map point"}
        onClick={()=>setSelectedKey(key)}
        onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelectedKey(key);}}}
        transform={`translate(${point.x} ${point.y})`}>
        <circle r="22" fill="transparent" className="ifund-us-pin-target"/>
        <circle r="18" fill="#6de5b1" fillOpacity=".18"/>
        <circle r="12" fill="#081f2c" stroke="#8ffff0" strokeWidth="2.5"/>
        <text y="4.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#e3fff3">{items.length}</text>
        <title>{items.length} campaign{items.length===1?"":"s"} at this approximate map point</title>
      </g>)}
      <text x="930" y="494" textAnchor="end" fill="#b5cbd1" fontSize="11">Approximate organizer-approved locations · schematic</text>
    </svg>
    {outside>0 && <p className="mt-2 text-sm text-slate-300">{outside} approved location{outside===1?" is":"s are"} outside the U.S. view. Switch to Earth globe to see them.</p>}
    {selected && <div className="mt-3 rounded-xl border border-emerald-400/35 bg-emerald-950/20 p-4">
      <h3 className="font-semibold">{selected.campaigns.length} campaign{selected.campaigns.length===1?"":"s"} at this approximate location</h3>
      <ul className="mt-2 space-y-2">{selected.campaigns.map(c=><li key={c.id}>
        <Link to={"/campaign/"+encodeURIComponent(c.id)} className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-300 underline">{c.title}</Link>
        <p className="text-xs text-slate-300">{c.location}</p>
      </li>)}</ul>
    </div>}
    {!plotted && <p className="mt-3 text-sm text-slate-300">No approved U.S. campaign locations yet. Organizers can choose an approximate city area in the campaign editor.</p>}
  </section>;
}
