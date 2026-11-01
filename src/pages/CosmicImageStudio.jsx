import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Image as ImageIcon, Copy, Sparkles, ShieldCheck } from "lucide-react";

const themes=["Hopeful and warm","Futuristic and cosmic","Community focused","Clean and professional","Playful and colorful"];
export default function CosmicImageStudio(){
 const [params] = useSearchParams();
 const [cause,setCause]=useState(() => (params.get("cause")||"").slice(0,1000));
 const [audience,setAudience]=useState("");
 const [theme,setTheme]=useState(() => themes.includes(params.get("theme")) ? params.get("theme") : themes[0]);
 const [details,setDetails]=useState("");
 const [copied,setCopied]=useState(false);
 const prompt=[cause.trim()&&"Create an original fundraising campaign image for: "+cause.trim(), "Visual direction: "+theme+".",audience.trim()&&"Audience: "+audience.trim()+".",details.trim()&&"Additional details: "+details.trim()+".","Use clear composition, welcoming imagery and accessible contrast. Avoid invented real people, misleading endorsements, false claims or fake donation totals. Do not include personal addresses."].filter(Boolean).join("\n");
 const copy=async()=>{try{await navigator.clipboard.writeText(prompt);setCopied(true);}catch{setCopied(false);}};
 return <main className="ifund-image-studio">
  <section className="ifund-workspace-hero"><ImageIcon size={30} aria-hidden="true"/><p className="eyebrow">YOUR CREATIVE UNIVERSE</p><h1>Cosmic Image Studio</h1><p>Build a clear creative brief for campaign artwork. Image generation will become available when a verified image service is connected.</p></section>
  <section className="card"><h2><ShieldCheck size={20} aria-hidden="true"/> Creative brief only</h2><p>This workspace prepares an image prompt. It does not yet generate or upload images, and it will not pretend a picture was created.</p></section>
  <section className="card"><h2><Sparkles size={20} aria-hidden="true"/> Design your campaign artwork</h2>
   <div className="form">
    <label>What is your campaign about?<textarea value={cause} onChange={e=>{setCause(e.target.value);setCopied(false);}} rows={3} maxLength={1000} placeholder="Describe the cause and what the artwork should communicate"/></label>
    <label>Who should this image speak to?<input value={audience} onChange={e=>{setAudience(e.target.value);setCopied(false);}} maxLength={200} placeholder="For example: neighbors and local supporters"/></label>
    <label>Image theme<select value={theme} onChange={e=>{setTheme(e.target.value);setCopied(false);}}>{themes.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
    <label>Other creative details<textarea value={details} onChange={e=>{setDetails(e.target.value);setCopied(false);}} rows={3} maxLength={1000} placeholder="Colors, setting, mood, and imagery to include or avoid"/></label>
   </div>
  </section>
  <section className="card"><h2>Your image brief</h2><p>Review the text below before sharing it with an image-generation tool.</p><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{cause.trim()?prompt:"Enter a campaign description above to create a brief."}</pre><div className="actions"><button type="button" disabled={!cause.trim()} onClick={copy}><Copy size={17} aria-hidden="true"/>{copied?"Copied":"Copy image brief"}</button><Link to="/create" state={{imageTheme:theme,imageBrief:prompt.slice(0,1800)}}>Use brief in a new campaign</Link></div></section>
 </main>;
}
