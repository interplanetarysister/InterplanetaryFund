import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, LifeBuoy, HeartHandshake, MapPin } from "lucide-react";
import { db } from "../lib/supabase";
import { Loading, Message, CampaignCard } from "../components/UI";

const distanceKm = (a,b,c,d) => { const rad = Math.PI / 180; const x = (c-a)*rad, y = (d-b)*rad; const h = Math.sin(x/2)**2 + Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(y/2)**2; return 12742*Math.asin(Math.min(1,Math.sqrt(h))); };
const COLUMNS = "id,title,summary,story,category,goal_amount,cover_image_url,status,created_at";
export default function Discover() {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [locationMode, setLocationMode] = useState("all");
  const [locationText, setLocationText] = useState("");
  const [accountCity, setAccountCity] = useState("");
  const [locationSupported, setLocationSupported] = useState(false);
  const [nearby, setNearby] = useState(null);
  const [locations, setLocations] = useState(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    let active = true;
    if (!db) { setList([]); setError("Campaign data is not configured."); return; }
    setList(null);
    db.from("ifund_campaigns").select(COLUMNS).eq("status", "active")
      .order("created_at", { ascending: false }).limit(100)
      .then(({ data, error: e }) => {
        if (!active) return;
        setList(data || []);
        setError(e?.message || "");
      }).catch(() => {
        if (!active) return;
        setList([]);
        setError("Campaigns could not be loaded. Please try again later.");
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!db) return;
    let live = true;
    db.from("ifund_campaigns").select("id,atlas_city,atlas_country,atlas_visible,latitude,longitude").eq("status","active").eq("atlas_visible",true).limit(100)
      .then(({data,error}) => { if(live) { setLocations(error ? null : data || []); setLocationSupported(!error); if(error) setLocationMessage("Location search is not connected yet. All-campaign search still works."); } });
    // Profile city is not yet present in the verified production schema.
    // Do not request a missing column until a reviewed migration is deployed.
    return () => {live=false;};
  }, []);
  const requestNearby = () => {
    if (!locationSupported) { setLocationMessage("Location search is not available yet. Browse campaigns everywhere."); return; }
    if (!navigator.geolocation) { setLocationMessage("Your browser does not support location. Search by city instead."); return; }
    setLocationMessage("Requesting your permission to use your current location…");
    navigator.geolocation.getCurrentPosition(({coords}) => {setNearby({lat:coords.latitude,lon:coords.longitude});setLocationMode("nearby");setLocationMessage("Showing mapped campaigns within 100 km of your location.");}, () => setLocationMessage("Location was not shared. You can search by city instead."), {enableHighAccuracy:false,timeout:10000,maximumAge:300000});
  };
  const categories = useMemo(() => Array.from(new Set((list || []).map(c => c.category).filter(Boolean))).sort(), [list]);
  const category = params.get("category") || "all";
  const selected = category === "all" || categories.includes(category) ? category : "all";
  const mapped = new Map((locations || []).map(c => [c.id,c]));
  const filtered = (list || []).filter(c =>
    (selected === "all" || c.category === selected) &&
    (!query.trim() || (c.title + " " + (c.summary || "")).toLowerCase().includes(query.trim().toLowerCase())) &&
    (locationMode === "all" || (locations && (() => { const p = mapped.get(c.id); if(!p) return false; if(locationMode === "nearby") return nearby && p.latitude != null && p.longitude != null && distanceKm(nearby.lat,nearby.lon,Number(p.latitude),Number(p.longitude)) <= 100; const place = locationMode === "account" ? accountCity : locationText; return Boolean(place.trim()) && (p.atlas_city || "").toLowerCase().includes(place.trim().toLowerCase()); })()))
  );
  return <main className="ifund-discover">
    <div className="ifund-discover-heading">
      <div><p className="eyebrow">EXPLORE THE UNIVERSE OF GIVING</p><h1>Explore Universe</h1>
        <p>What if your support changed everything for someone today? These causes need help right now.</p></div>
      <Link className="secondary" to="/help"><LifeBuoy size={18}/> Help Center</Link>
    </div>
    <section className="ifund-discover-featured">
      <HeartHandshake size={28}/><div><h2>Find a cause that moves you</h2>
      <p>Explore active campaigns and discover the people making a difference.</p></div>
    </section>
    <label className="ifund-discover-search"><Search size={20}/><span className="sr-only">Search campaigns</span>
      <input type="search" value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Search campaigns by name or cause…" /></label>
    <div className="ifund-discover-filters" role="group" aria-label="Campaign category">
      {["all", ...categories].map(c => <button key={c} type="button" aria-pressed={selected === c}
        className={selected === c ? "is-active" : ""}
        onClick={() => setParams(c === "all" ? {} : { category: c })}>{c === "all" ? "All" : c}</button>)}
    </div>
    <section className="card ifund-location-search" aria-label="Find campaigns near you">
      <h2><MapPin size={20} aria-hidden="true"/> Find campaigns near you</h2>
      <p>Search by city, use your saved account city, or share your approximate location once. Your device location is not saved.</p>
      <div className="actions">
        <button type="button" onClick={() => setLocationMode("all")} aria-pressed={locationMode==="all"}>Everywhere</button>
        <button type="button" disabled={!locationSupported} onClick={requestNearby} aria-pressed={locationMode==="nearby"}>Near me (100 km)</button>
        <button type="button" disabled={!locationSupported || !accountCity} onClick={() => setLocationMode("account")} aria-pressed={locationMode==="account"}>My account city{accountCity ? ": "+accountCity : " (not set)"}</button>
        <button type="button" disabled={!locationSupported} onClick={() => setLocationMode("city")} aria-pressed={locationMode==="city"}>Choose a city</button>
      </div>
      {locationMode==="city" && <label>City name<input type="search" value={locationText} onChange={e=>setLocationText(e.target.value)} placeholder="Enter a city name" /></label>}
      {locationMessage && <p role="status">{locationMessage}</p>}
      {locationMode!=="all" && !locations && <p>Nearby campaign data is not available yet.</p>}
    </section>
    <Message error>{error}</Message>
    {list === null ? <Loading /> : filtered.length
      ? <div className="cards">{filtered.map(c => <CampaignCard c={c} key={c.id} />)}</div>
      : <p className="ifund-discover-empty">No active campaigns match this search yet — what if yours was the first?</p>}
  </main>;
}
