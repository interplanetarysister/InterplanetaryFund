import { useEffect, useMemo, useState } from "react";
import { coverCrop, createPlatformVariants, PLATFORM_FRAMES, proposeInterestCue } from "../../lib/mediaVariantPlans.mjs";
import { packageMediaVariants } from "../../lib/mediaVariantZip.mjs";
import { VIDEO_LOOK_PRESETS, chooseVideoLook } from "../../lib/mediaPresetCollections.mjs";

const boundedTime = (number, duration) => Math.max(0, Math.min(duration, Number.isFinite(Number(number)) ? Number(number) : 0));

async function renderImageVariant(url, variant) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = variant.width; canvas.height = variant.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering is unavailable.");
  const crop = coverCrop(image.naturalWidth, image.naturalHeight, variant.width, variant.height,
    variant.focalX, variant.focalY, variant.scale);
  ctx.filter = "brightness("+variant.brightness+") contrast("+variant.contrast+") saturate("+variant.saturation+")";
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(
    result => result ? resolve(result) : reject(new Error("PNG rendering failed.")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  // Do not revoke synchronously before the browser begins saving the file.
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
function percent(number) { return Math.round(number * 100) + "%"; }
function filters(variant) { return "brightness("+variant.brightness+") contrast("+variant.contrast+") saturate("+variant.saturation+")"; }

export default function PlatformVariantEditor({ file, previewUrl, metadata, destinations, audioWindows = [], visualTransitions = [], caption = "" }) {
  const [edits, setEdits] = useState({});
  const [selected, setSelected] = useState("");
  const [exporting, setExporting] = useState(false);
  const [issue, setIssue] = useState("");
  const variants = useMemo(() => createPlatformVariants(destinations, edits), [destinations, edits]);
  const duration = Number(metadata?.duration);
  const timed = Number.isFinite(duration) && duration > 0 && (file?.type.startsWith("video/") || file?.type.startsWith("audio/"));
  const current = variants.find(v => v.id === selected) || variants[0] || null;
  useEffect(() => {
    setSelected("");
    setEdits({});
    setIssue("");
  }, [previewUrl]);
  function edit(id, patch) {
    setEdits(currentEdits => ({ ...currentEdits, [id]: { ...currentEdits[id], ...patch } }));
  }
  async function exportImages() {
    if (!file?.type.startsWith("image/") || !previewUrl || variants.length === 0 || exporting) return;
    setExporting(true); setIssue("");
    try {
      const entries = [];
      for (const variant of variants) {
        const bytes = await renderImageVariant(previewUrl, variant);
        entries.push({ name: "ifund-" + variant.id + ".png", bytes });
      }
      saveBlob(packageMediaVariants(entries), "ifund-platform-variants.zip");
    } catch (error) { setIssue(error.message || "The images could not be rendered."); }
    finally { setExporting(false); }
  }
  if (!file || !previewUrl) return <p className="text-sm text-muted-foreground">Add or generate media to compare versions for the platforms you selected.</p>;
  return <section aria-label="Side-by-side platform variants" className="space-y-4 rounded-2xl border border-border p-4">
    <header className="space-y-2">
      <h3 className="text-lg font-semibold">Platform versions · side-by-side</h3>
      <p className="text-sm text-muted-foreground">One original, separate non-destructive versions. Select a preview to edit its crop and proposed interest-peak marker independently. The original file is never modified.</p>
    </header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {variants.map(variant => {
        const frame = PLATFORM_FRAMES[variant.id];
        const cue = timed ? proposeInterestCue({ duration, platformId: variant.id, audioWindows, visualTransitions, preferredTime: variant.cueTime }) : null;
        return <button type="button" key={variant.id} onClick={() => setSelected(variant.id)}
          aria-pressed={current?.id === variant.id}
          className={"min-w-0 space-y-2 rounded-xl border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 " +
            (current?.id === variant.id ? "border-cyan-500 bg-cyan-500/10" : "border-border")}>
          <strong className="block text-sm">{frame.name}</strong>
          <div className="mx-auto max-h-52 overflow-hidden rounded-lg bg-black/90"
            style={{ aspectRatio: String(frame.width) + "/" + String(frame.height), maxWidth: 220 }}>
            {file.type.startsWith("image/") ? <img src={previewUrl} alt={frame.name + " crop preview"} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:percent(variant.focalX)+" "+percent(variant.focalY),transform:"scale("+variant.scale+")",filter:filters(variant),filter:filters(variant)}}/> :
              file.type.startsWith("video/") ? <video src={previewUrl} muted playsInline preload="metadata" aria-label={frame.name + " silent visual preview"} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:percent(variant.focalX)+" "+percent(variant.focalY),transform:"scale("+variant.scale+")"}}/> :
                <span className="flex h-full items-center justify-center p-4 text-xs text-white">Audio-only variant</span>}
          </div>
          <p className="text-xs text-muted-foreground">{frame.width} × {frame.height} · {frame.placement}</p>
          {cue && <p className="text-xs">Interest peak candidate: {cue.suggestedAt.toFixed(1)}s</p>}
        </button>;
      })}
    </div>
    {current && <section className="space-y-4 rounded-xl border p-4" aria-label={"Edit " + PLATFORM_FRAMES[current.id].name}>
      <h4 className="font-semibold">Edit: {PLATFORM_FRAMES[current.id].name}</h4>
      <p className="text-sm text-muted-foreground">Changes affect only this selected version. Other platform previews stay independent.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {[["focalX","Horizontal focus"],["focalY","Vertical focus"]].map(([key, label]) =>
          <label className="text-sm" key={key}>{label} · {percent(current[key])}
            <input type="range" className="mt-2 w-full" min="0" max="1" step="0.01" value={current[key]}
              onChange={event => edit(current.id, {[key]: Number(event.target.value)})}/>
          </label>)}
        <label className="text-sm">Zoom · {current.scale.toFixed(2)}×
          <input type="range" className="mt-2 w-full" min="1" max="2" step="0.05" value={current.scale}
            onChange={event => edit(current.id, {scale:Number(event.target.value)})}/>
        </label>
      </div>
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-semibold">Visual adjustments</summary>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Video and image look presets">
          {Object.entries(VIDEO_LOOK_PRESETS).map(([id,preset])=><button key={id} type="button"
            onClick={()=>edit(current.id,chooseVideoLook(id))}
            className="ifund-interactive min-h-10 rounded-lg border border-border px-3 text-xs font-semibold">{preset.label}</button>)}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["brightness","Brightness",0.5,1.5],
            ["contrast","Contrast",0.5,1.5],
            ["saturation","Color saturation",0,2],
          ].map(([id,label,min,max])=><label key={id} className="text-sm">{label}: {current[id].toFixed(2)}×
            <input type="range" className="mt-2 w-full" min={min} max={max} step="0.05" value={current[id]}
              onChange={e=>edit(current.id,{[id]:Number(e.target.value)})}/>
          </label>)}
        </div>
      </details>
      {file.type.startsWith("video/") && <section className="space-y-3 rounded-xl border p-3" aria-label="Selected video preview controls">
        <h5 className="font-semibold text-sm">Selected video preview settings</h5>
        <p className="text-xs text-muted-foreground">Change playback speed and source-audio level for this preview. These controls do not transcode the original video.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs">Playback speed: {current.videoSpeed.toFixed(2)}×
            <input type="range" min="0.5" max="2" step="0.05" value={current.videoSpeed}
              onChange={e=>edit(current.id,{videoSpeed:Number(e.target.value)})} className="mt-2 w-full"/>
          </label>
          <label className="text-xs">Original video audio: {Math.round(current.videoVolume*100)}%
            <input type="range" min="0" max="1" step="0.05" value={current.videoVolume}
              onChange={e=>edit(current.id,{videoVolume:Number(e.target.value)})} className="mt-2 w-full"/>
          </label>
        </div>
        <div className="mx-auto max-h-[360px] overflow-hidden rounded-xl bg-black" style={{aspectRatio:String(current.width)+"/"+String(current.height),maxWidth:360}}>
          <video controls playsInline src={previewUrl} aria-label={"Preview "+PLATFORM_FRAMES[current.id].name}
            onLoadedMetadata={event=>{event.currentTarget.playbackRate=current.videoSpeed;event.currentTarget.volume=current.videoVolume;}}
            style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:percent(current.focalX)+" "+percent(current.focalY),transform:"scale("+current.scale+")",filter:filters(current)}}
            key={current.id+"-"+current.videoSpeed+"-"+current.videoVolume}/>
        </div>
      </section>}
      {timed && (() => {
        const cue = proposeInterestCue({ duration, platformId: current.id, audioWindows, visualTransitions, preferredTime: current.cueTime });
        return <div className="space-y-3 rounded-xl border p-3" aria-label="Interest peak editing timeline">
          <div className="flex items-baseline justify-between gap-2">
            <h5 className="font-semibold text-sm">Interest peak / breakdown timing</h5>
            <span className="text-xs">{cue.suggestedAt.toFixed(1)}s of {duration.toFixed(1)}s</span>
          </div>
          <div className="relative h-3 rounded-full bg-muted" role="img"
            aria-label={"Storyboard suggestion interval from " + cue.windowStart + " to " + cue.windowEnd + " seconds"}>
            <div className="absolute top-0 h-full rounded-full bg-cyan-500/30"
              style={{left:(cue.windowStart / duration * 100)+"%",width:((cue.windowEnd - cue.windowStart) / duration * 100)+"%"}}/>
            <div className="absolute top-0 h-full w-1 rounded bg-cyan-500"
              style={{left:Math.min(99,cue.suggestedAt / duration * 100)+"%"}}/>
          </div>
          <label className="block text-sm">Adjust interest-peak or reveal marker
            <input type="range" min="0" max={duration} step="0.1" className="mt-2 w-full"
              value={boundedTime(cue.suggestedAt,duration)}
              onChange={event => edit(current.id,{cueTime:boundedTime(event.target.value,duration)})}/>
          </label>
          <p className="text-xs text-muted-foreground">{cue.basis}. {cue.note}</p>
          <button type="button" className="min-h-10 rounded-lg border px-3 text-sm" onClick={() => edit(current.id,{cueTime:null})}>Reset suggested marker</button>
        </div>;
      })()}
      <label className="block text-sm">Version-specific post text
        <textarea className="mt-2 w-full rounded-xl border bg-background p-3" rows={3} maxLength={6000}
          value={current.caption || caption} onChange={event => edit(current.id,{caption:event.target.value})}/>
      </label>
      <button type="button" className="min-h-10 rounded-lg border px-3 text-sm"
        onClick={() => edit(current.id,{focalX:0.5,focalY:0.5,scale:1,cueTime:null,caption:"",brightness:1,contrast:1,saturation:1,videoSpeed:1,videoVolume:1})}>
        Reset this version to the original
      </button>
    </section>}
    {file.type.startsWith("image/") && variants.length > 0 && <button type="button" disabled={exporting}
      onClick={exportImages} className="min-h-11 rounded-lg bg-cyan-600 px-4 font-semibold text-white disabled:opacity-50">
      {exporting ? "Rendering platform images…" : "Render and download all image versions (ZIP)"}
    </button>}
    {(file.type.startsWith("video/") || file.type.startsWith("audio/")) && <p className="text-sm text-muted-foreground">
      Video and audio versions currently support side-by-side storyboarding, crop previews, platform-specific cue editing and text variants. File transcoding and audio-synchronized multi-platform exports require a validated encoding pipeline; preview is not represented as a finished rendered video.
    </p>}
    {issue && <p role="alert" className="text-sm text-red-500">{issue}</p>}
  </section>;
}
