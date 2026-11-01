import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Globe2, MapPin, Compass } from "lucide-react";
import { db } from "../lib/supabase";

const FIELDS = "id,title,summary,category,latitude,longitude";
const valid = (c) => Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude)) && c.latitude !== null && c.longitude !== null && Number(c.latitude) >= -90 && Number(c.latitude) <= 90 && Number(c.longitude) >= -180 && Number(c.longitude) <= 180;
const position = (c) => ({ left: ((Number(c.longitude) + 180) / 360 * 100) + "%", top: ((90 - Number(c.latitude)) / 180 * 100) + "%" });

export default function PlanetaryAtlas() {
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("loading");
  useEffect(() => {
    let live = true;
    if (!db) { setState("unavailable"); return; }
    db.from("ifund_campaigns").select(FIELDS).eq("status", "active").limit(200)
      .then(({ data, error }) => {
        if (!live) return;
        if (error) { setState("unavailable"); return; }
        setCampaigns((data || []).filter(valid));
        setState("ready");
      }).catch(() => { if (live) setState("unavailable"); });
    return () => { live = false; };
  }, []);
  const visible = campaigns.filter(c => (c.title || "").toLowerCase().includes(query.trim().toLowerCase()));
  return <main className="ifund-atlas">
    <section className="ifund-atlas-heading">
      <Globe2 size={32} aria-hidden="true" />
      <p className="eyebrow">GLOBAL FUNDRAISING EXPLORATION</p>
      <h1>Planetary Atlas</h1>
      <p>Discover fundraising missions around the world. Select a glowing marker to learn about a cause.</p>
    </section>
    <div className="ifund-atlas-map" role="group" aria-label="World map of fundraising campaigns">
      <svg viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
        <defs><pattern id="atlasGrid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#2f6983" strokeWidth="1" opacity=".55"/></pattern></defs>
        <rect width="1000" height="500" fill="url(#atlasGrid)"/>
        <g fill="#145b69" stroke="#4de2e6" strokeWidth="2" opacity=".85">
          <path d="M65 85L160 38 250 53 295 96 274 135 230 148 215 200 181 219 160 188 115 181 89 135Z"/>
          <path d="M216 220L276 226 303 280 280 337 252 402 219 451 204 383 176 326 188 264Z"/>
          <path d="M420 101L476 69 539 77 566 116 532 153 487 157 465 187 424 171Z"/>
          <path d="M462 186L534 180 567 230 548 302 512 375 479 341 453 274Z"/>
          <path d="M549 85L650 54 758 75 864 114 903 164 849 197 785 184 739 217 684 201 634 177 577 171 543 134Z"/>
          <path d="M756 329L831 315 877 356 861 403 795 418 748 377Z"/>
          <path d="M320 58L354 42 381 68 360 111 324 100Z"/>
        </g>
      </svg>
      {visible.map(c => <button key={c.id} type="button" className="ifund-atlas-marker" style={position(c)}
        aria-label={"View " + c.title} aria-pressed={selected?.id === c.id} onClick={() => setSelected(c)}><span /></button>)}
      <span className="ifund-atlas-map-label"><Compass size={16}/> EARTH // LIVE LOCATIONS ONLY</span>
    </div>
    {state === "loading" && <p role="status">Loading campaign locations...</p>}
    {state === "unavailable" && <p role="status">Campaign locations are not available yet. Location coordinates must be enabled in the campaign database.</p>}
    {state === "ready" && campaigns.length === 0 && <p>No published campaigns with verified map coordinates are available yet. Browse all campaigns instead.</p>}
    {state === "ready" && campaigns.length > 0 && <section className="ifund-atlas-directory" aria-label="Campaign location directory">
      <h2>Find a mission on Earth</h2>
      <label>Search mapped campaigns<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Campaign name" /></label>
      <p role="status">{visible.length} mapped {visible.length === 1 ? "campaign" : "campaigns"}</p>
      <div className="ifund-atlas-directory-list">{visible.map(c => <button key={c.id} type="button" aria-pressed={selected?.id === c.id} onClick={() => setSelected(c)}><MapPin size={18} aria-hidden="true" />{c.title || "Fundraising mission"}</button>)}</div>
    </section>}
    {selected && <section className="card ifund-atlas-selection" aria-live="polite">
      <MapPin size={24} aria-hidden="true"/>
      <div><h2>{selected.title || "Fundraising mission"}</h2><p>{selected.summary || "Explore this campaign to learn more."}</p><Link className="primary" to={"/campaign/" + selected.id}>View campaign</Link></div>
    </section>}
    <Link className="secondary" to="/discover">Explore all campaigns</Link>
    <p className="ifund-atlas-note">Stylized world map, not satellite imagery. Only campaigns with coordinates appear as markers. Coordinates must be intentionally public and approximate, never a private home address.</p>
  </main>;
}
