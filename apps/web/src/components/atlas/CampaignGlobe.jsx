import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";


const DEG = Math.PI / 180;
const R = 251;
const CENTER = 300;

function project(lat, lon, rotation) {
  const a = lat * DEG;
  const b = (lon - rotation) * DEG;
  const visible = Math.cos(a) * Math.cos(b);
  return {
    x: CENTER + R * Math.cos(a) * Math.sin(b),
    y: CENTER - R * Math.sin(a),
    front: visible >= 0,
  };
}

function line(coords, rotation) {
  let result = "";
  let drawing = false;
  for (const [lat, lon] of coords) {
    const p = project(lat, lon, rotation);
    if (!p.front) { drawing = false; continue; }
    result += (drawing ? " L" : " M") + p.x.toFixed(2) + " " + p.y.toFixed(2);
    drawing = true;
  }
  return result;
}

// Broad illustrative coastlines: no administrative borders, navigation precision, or geocoding claims.
const LAND = [
  [[70,-160],[72,-125],[63,-105],[60,-85],[54,-60],[42,-64],[30,-83],[18,-88],[12,-97],[17,-106],[26,-110],[32,-117],[50,-127],[58,-146],[70,-160]],
  [[13,-81],[7,-78],[-4,-81],[-12,-77],[-19,-69],[-33,-71],[-53,-72],[-55,-66],[-44,-62],[-30,-52],[-12,-47],[-1,-49],[8,-61],[13,-81]],
  [[71,-10],[65,18],[56,31],[47,30],[40,43],[31,36],[14,42],[6,36],[-1,43],[-15,42],[-34,19],[-34,15],[-22,13],[-7,10],[10,-17],[21,-17],[35,-7],[42,-10],[47,-4],[56,-8],[71,-10]],
  [[71,22],[72,59],[60,80],[60,115],[55,142],[46,141],[38,128],[31,121],[22,109],[8,104],[1,118],[-8,113],[-6,104],[11,94],[20,85],[9,78],[7,74],[20,69],[26,60],[40,52],[49,42],[59,31],[71,22]],
  [[-10,113],[-18,122],[-13,135],[-18,146],[-35,151],[-43,145],[-38,122],[-25,113],[-10,113]],
  [[59,-44],[67,-52],[80,-41],[82,-20],[73,-17],[61,-42],[59,-44]],
  [[-13,43],[-17,50],[-25,50],[-26,44],[-13,43]],
];

function graticule(rotation) {
  const lines = [];
  for (let lat = -75; lat <= 75; lat += 15) {
    lines.push(line(Array.from({ length: 145 }, (_, i) => [lat, -180 + 2.5 * i]), rotation));
  }
  for (let lon = -180; lon < 180; lon += 15) {
    lines.push(line(Array.from({ length: 73 }, (_, i) => [-90 + 2.5 * i, lon]), rotation));
  }
  return lines;
}

export default function CampaignGlobe({ campaigns = [] }) {
  const [rotation, setRotation] = useState(-100);
  const [selected, setSelected] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  useEffect(() => {
    if (!autoRotate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setRotation(previous => ((previous + 0.6 + 540) % 360) - 180), 90);
    return () => window.clearInterval(timer);
  }, [autoRotate]);
  const dragging = useRef(null);
  const grid = useMemo(() => graticule(rotation), [rotation]);
  const landmarks = useMemo(() => LAND.map((shape) => line(shape, rotation)), [rotation]);
  const markers = useMemo(() => (showMarkers ? campaigns : []).filter(c => c.map_opt_in === true && c.latitude !== null && c.longitude !== null && Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude))).map((campaign) => ({
    campaign,
    point: project(campaign.latitude, campaign.longitude, rotation),
  })).filter((marker) => marker.point.front), [campaigns, rotation, showMarkers]);
  const rotate = (delta) => { setAutoRotate(false);
    setRotation((previous) => ((previous + delta + 540) % 360) - 180);
  };
  function down(e) {
    if (e.target !== e.currentTarget && e.target.closest(".globe-pin")) return;
    setAutoRotate(false); dragging.current = { x: e.clientX, rotation };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!dragging.current) return;
    setRotation(((dragging.current.rotation - (e.clientX - dragging.current.x) * 0.42 + 540) % 360) - 180);
  }
  function stop(e) {
    dragging.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return (
    <section className="panel demo-globe-panel" aria-label="IFund interactive Atlas globe">
      <header className="globe-header">
        <div><p className="eyebrow">Interactive orbit · Free map renderer</p><h2>Atlas of possibility</h2><p>Centered on North America. Drag to spin, use the rotate buttons, or turn on orbit. Markers show only organizer-approved approximate city/region coordinates.</p></div>
        <div className="globe-controls">
          <button className="secondary" onClick={() => rotate(-30)} aria-label="Rotate globe west"><ArrowLeft size={18}/></button>
          <button className="secondary" onClick={() => rotate(30)} aria-label="Rotate globe east"><ArrowRight size={18}/></button>
          <button className="secondary" onClick={() => { setRotation(-100); setSelected(null); setAutoRotate(false); }} aria-label="Focus globe on North America"><RotateCcw size={18}/> <span className="text-xs">North America</span></button>
          <button className="secondary" onClick={() => setShowMarkers(value => !value)} aria-pressed={showMarkers}>{showMarkers ? "Hide pins" : "Show pins"}</button>
          <button className="secondary" onClick={() => setAutoRotate(value => !value)} aria-pressed={autoRotate} aria-label={autoRotate ? "Pause globe rotation" : "Resume globe rotation"}>{autoRotate ? "Pause orbit" : "Resume orbit"}</button>
        </div>
      </header>
      <div className="globe-layout">
        <svg className="campaign-globe" viewBox="0 0 600 600" role="img" aria-label={`Rotatable illustrative globe. ${markers.length} opted-in campaign locations visible on this hemisphere.`}
          onPointerDown={down} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}>
          <defs>
            <radialGradient id="demo-globe-sea" cx="32%" cy="24%" r="82%">
              <stop offset="0%" stopColor="#2b7696"/><stop offset="52%" stopColor="#123f66"/><stop offset="88%" stopColor="#09203e"/><stop offset="100%" stopColor="#060c20"/>
            </radialGradient>
            <clipPath id="demo-globe-clip"><circle cx="300" cy="300" r="251"/></clipPath>
            <filter id="globe-glow"><feGaussianBlur stdDeviation="10"/></filter>
          </defs>
          {Array.from({length:72},(_,i)=><circle key={"star"+i} cx={(i*137+29)%600} cy={(i*227+61)%600} r={i%7===0?1.3:0.65} fill="#d9f6ff" opacity={0.3+(i%5)*0.1}/>)}
          <circle cx="300" cy="300" r="259" fill="#5bdff1" opacity=".18" filter="url(#globe-glow)" />
          <circle cx="300" cy="300" r="251" fill="url(#demo-globe-sea)" stroke="#7bd9ee" strokeWidth="2" />
          <g clipPath="url(#demo-globe-clip)" fill="none">
            {grid.map((d, i) => <path key={"grid"+i} d={d} stroke="#7ac8e1" strokeOpacity=".18" strokeWidth=".8" />)}
            {landmarks.map((d, i) => <path key={"land"+i} d={d} stroke="#a8f5dd" strokeOpacity=".67" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />)}
          </g>
          {markers.map(({ campaign, point }) => (
            <g className="globe-pin" key={campaign.id} tabIndex={0} role="button" aria-label={`Select public campaign: ${campaign.title}`}
              onClick={() => setSelected(campaign)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(campaign); } }}>
              <circle cx={point.x} cy={point.y} r="10" fill="#092942" stroke="#9ef9ff" strokeWidth="1.5"/>
              <circle cx={point.x} cy={point.y} r="4" fill="#e7ffff" />
              <title>{campaign.title} — {campaign.location}, approximate</title>
            </g>
          ))}
        </svg>
        <div className="globe-aside">
          <strong>{campaigns.length} approved locations · {markers.length} visible</strong>
          <p className="meta">Only campaigns whose owners explicitly publish a broad location appear here. This is a schematic vector globe, not a GPS map or a political reference.</p>
          {selected && (
            <article className="globe-selected">
              <p className="eyebrow">Selected fundraiser · live</p>
              <h3>{selected.title}</h3>
              {selected.summary && <p className="globe-summary">{selected.summary}</p>}
              <p>{String(selected.category || "Community campaign").replace(/_/g, " ")}</p>
              <p>{selected.location} · Approximate public location</p>
              <Link className="button small" to={"/campaign/"+encodeURIComponent(selected.id)}>View campaign</Link>
            </article>
          )}
          {!selected && <p className="meta">Select a glowing pin to inspect a campaign.</p>}
        </div>
      </div>
    </section>
  );
}
