import { useEffect, useRef, useState } from "react";
import { analyzeMediaResponse } from "../../lib/audiencePostReview.mjs";
import { analyzeAudioSamples } from "../../lib/mediaAudioMetrics.mjs";
import PlatformVariantEditor from "./PlatformVariantEditor";
import { authClient } from "../../api/auth";
import { consumeMediaForOptimization, consumeAudioForMediaOptimization } from "../../lib/mediaDraftHandoff.mjs";
import { sampleLocalVideoFrames } from "../../lib/videoTimelineSampling.mjs";

const PLATFORM_PROFILES = Object.freeze([
  { id: "ifund", name: "iFund", ratio: null, notes: ["Check campaign-card cropping and make the purpose apparent.", "Avoid exposing an anonymous organizer's face, name or identifying metadata."], source: null },
  { id: "instagram-reels", name: "Instagram Reels", ratio: 9 / 16, notes: ["Review a vertical 9:16 preview.", "For Reels ads, Meta recommends keeping important content clear of approximately 14% top, 35% bottom and 6% side overlay areas. Organic placement may differ."], source: "https://business.facebook.com/business/ads-guide/update/video/instagram-reels" },
  { id: "facebook-reels", name: "Facebook Reels", ratio: 9 / 16, notes: ["Review vertical framing with platform controls visible.", "Verify each Facebook placement's current text-overlay and caption-safe area before exporting."], source: "https://www.facebook.com/business/ads/facebook-instagram-reels-ads" },
  { id: "tiktok", name: "TikTok", ratio: 9 / 16, notes: ["Review vertical 9:16 framing and the first seconds in a phone preview.", "TikTok says In-Feed ad safe zones depend on framing, caption length and interactive add-ons. Use current placement-specific templates."], source: "https://ads.tiktok.com/resources/help/article/tiktok-reservation-in-feed-ads-reach-frequency" },
  { id: "youtube-shorts", name: "YouTube Shorts", ratio: 9 / 16, notes: ["Review vertical framing, mobile captions and audio-off comprehensibility.", "Verify current Shorts requirements and any reused music rights in YouTube Studio."], source: "https://support.google.com/youtube/answer/10059070" },
  { id: "instagram-feed", name: "Instagram Feed", ratio: null, notes: ["Preview feed cropping and choose a clear focal subject.", "Use a legible caption and alternative text where supported."], source: "https://www.facebook.com/business/ads-guide/update/video/instagram-feed" },
  { id: "facebook-feed", name: "Facebook Feed", ratio: null, notes: ["Check the exact feed placement's crop before export.", "Keep the explanation and next action understandable without sound."], source: "https://www.facebook.com/business/ads-guide" },
  { id: "x-feed", name: "X Feed", ratio: 16 / 9, notes: ["Review a landscape 16:9 crop for feed sharing.", "Check platform-specific current upload limits before posting."], source: null },
  { id: "linkedin-feed", name: "LinkedIn Feed", ratio: 4 / 5, notes: ["Review a professional portrait 4:5 crop with readable facts and context.", "Keep image provenance and campaign claims verifiable."], source: null },
  { id: "meta-square", name: "Meta Feed Square", ratio: 1, notes: ["Preview square content separately from Reels and landscape feeds.", "Confirm platform overlays and caption placement before publishing."], source: null },
]);

function inspectMedia(file, url, setMetadata) {
  const isVideo = file.type.startsWith("video/");
  const isAudio = file.type.startsWith("audio/");
  if (!isVideo && !isAudio) return () => {};
  const element = document.createElement(isVideo ? "video" : "audio");
  element.preload = "metadata";
  element.src = url;
  const loaded = () => setMetadata({
    duration: Number.isFinite(element.duration) ? element.duration : null,
    width: isVideo ? element.videoWidth : null,
    height: isVideo ? element.videoHeight : null,
    type: file.type,
  });
  element.addEventListener("loadedmetadata", loaded, { once: true });
  return () => { element.removeEventListener("loadedmetadata", loaded); element.removeAttribute("src"); element.load(); };
}

export default function PrePostMediaOptimizer() {
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [postText, setPostText] = useState("");
  const [audience, setAudience] = useState("");
  const [destinations, setDestinations] = useState(["ifund"]);
  const [captions, setCaptions] = useState(false);
  const [observedSound, setObservedSound] = useState(false);
  const [message, setMessage] = useState("");
  const [soundMetrics, setSoundMetrics] = useState(null);
  const [inspectingSound, setInspectingSound] = useState(false);
  const [visualMetrics, setVisualMetrics] = useState(null);
  const [inspectingVideo, setInspectingVideo] = useState(false);
  const visualAbort = useRef(null);
  const mediaUrl = useRef(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [layeredAudioUrl, setLayeredAudioUrl] = useState("");
  const layeredAudioObject = useRef(null);
  const layeredAudioRef = useRef(null);
  const videoPlaybackRef = useRef(null);
  useEffect(() => () => {
    visualAbort.current?.abort();
    if (mediaUrl.current) URL.revokeObjectURL(mediaUrl.current);
    if (layeredAudioObject.current) URL.revokeObjectURL(layeredAudioObject.current);
  }, []);
  useEffect(() => {
    if (!file || !previewUrl) return undefined;
    return inspectMedia(file, previewUrl, setMetadata);
  }, [file, previewUrl]);
  function loadFile(next) {
    visualAbort.current?.abort();
    if (mediaUrl.current) URL.revokeObjectURL(mediaUrl.current);
    mediaUrl.current = null; setPreviewUrl(""); setFile(null); setMetadata(null); setMessage(""); setSoundMetrics(null); setVisualMetrics(null); setInspectingVideo(false);
    if (!next) return;
    if (next.size > 50 * 1024 * 1024 || !/^(video|audio|image)\//.test(next.type)) {
      setMessage("Choose an image, video or audio file of 50 MB or less. It will be inspected locally."); return;
    }
    const url = URL.createObjectURL(next);
    mediaUrl.current = url; setFile(next); setPreviewUrl(url);
    if (next.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () => {
        if (mediaUrl.current !== url) return;
        setMetadata({ width: img.naturalWidth, height: img.naturalHeight, duration: null, type: next.type });
      };
      img.onerror = () => setMessage("Image dimensions could not be inspected.");
      img.src = url;
    }
  }
  function selectFile(event) { loadFile(event.target.files?.[0] || null); }
  useEffect(() => {
    let active = true;
    authClient().auth.getUser().then(({data,error}) => {
      if (!active || error || !data?.user?.id) return;
      if (!mediaUrl.current) {
        const prepared = consumeMediaForOptimization(data.user.id);
        if (prepared) loadFile(prepared);
      }
      const mix = consumeAudioForMediaOptimization(data.user.id);
      if (mix) {
        if (layeredAudioObject.current) URL.revokeObjectURL(layeredAudioObject.current);
        layeredAudioObject.current = URL.createObjectURL(mix);
        setLayeredAudioUrl(layeredAudioObject.current);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  async function playVideoWithLayeredAudio() {
    const video = videoPlaybackRef.current;
    const audioTrack = layeredAudioRef.current;
    if (!video || !audioTrack) return;
    setMessage("");
    try {
      video.pause(); audioTrack.pause();
      video.currentTime = 0; audioTrack.currentTime = 0;
      await Promise.all([video.play(), audioTrack.play()]);
    } catch { video.pause(); audioTrack.pause(); setMessage("Combined preview needs a user-enabled audio and video playback device."); }
  }
  async function inspectVideo() {
    if (!file?.type.startsWith("video/") || !previewUrl || inspectingVideo) return;
    const abort = new AbortController();
    visualAbort.current?.abort(); visualAbort.current = abort;
    setInspectingVideo(true); setMessage(""); setVisualMetrics(null);
    try {
      const result = await sampleLocalVideoFrames(previewUrl, {signal: abort.signal});
      if (!abort.signal.aborted) setVisualMetrics(result);
    } catch (cause) {
      if (!abort.signal.aborted) setMessage(cause.message || "Video frames could not be inspected.");
    } finally {
      if (visualAbort.current === abort) { visualAbort.current = null; setInspectingVideo(false); }
    }
  }
  async function inspectSound() {
    if (!file || !file.type.startsWith("audio/") || inspectingSound) return;
    setInspectingSound(true); setMessage(""); setSoundMetrics(null);
    let ctx;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("This browser cannot decode audio locally.");
      ctx = new AudioContextClass();
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, i) => buffer.getChannelData(i));
      setSoundMetrics(analyzeAudioSamples(channels, buffer.sampleRate));
    } catch (e) { setMessage(e.message || "Audio cannot be inspected."); }
    finally { await ctx?.close?.().catch(() => {}); setInspectingSound(false); }
  }
  function toggle(id) {
    setDestinations(existing => existing.includes(id) ? existing.filter(item => item !== id) : [...existing, id]);
  }
  const analysis = analyzeMediaResponse({
    text: postText,
    seconds: metadata?.duration ?? null,
    format: file?.type.startsWith("video/") ? "short-video" : file?.type.startsWith("audio/") ? "audio" : "post",
    audio: observedSound || Boolean(file?.type.startsWith("audio/")),
    captions,
    audience,
  });
  const ratio = metadata?.width && metadata?.height ? metadata.width / metadata.height : null;
  return <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="Pre-posting media optimization">
    <header className="space-y-2">
      <h2 className="text-xl font-semibold">Pre-post Optimization</h2>
      <p className="text-sm text-muted-foreground">Inspect media before publishing, evaluate research-informed attention and memorability signals, and receive separate recommendations for every selected destination. This review does not upload files, publish posts or change permissions.</p>
    </header>
    <label className="block text-sm font-semibold">Media to analyze (local file, up to 50 MB)
      <input className="mt-2 block w-full text-sm" type="file" accept="video/*,audio/*,image/*" onChange={selectFile}/>
    </label>
    {previewUrl && file?.type.startsWith("video/") && <video ref={videoPlaybackRef} src={previewUrl} controls playsInline className="max-h-80 w-full rounded-xl bg-black" onPause={() => layeredAudioRef.current?.pause()} onEnded={() => layeredAudioRef.current?.pause()} />}
    {previewUrl && file?.type.startsWith("audio/") && <audio src={previewUrl} controls className="w-full" />}
    {previewUrl && file?.type.startsWith("image/") && <img src={previewUrl} alt="Selected media for review" className="max-h-80 max-w-full rounded-xl object-contain" />}
    {layeredAudioUrl && <section className="space-y-3 rounded-xl border p-4" aria-label="Layered audio mix preview">
      <h3 className="font-semibold">Imported layered audio mix</h3>
      <audio ref={layeredAudioRef} src={layeredAudioUrl} controls className="w-full" aria-label="Layered voice music and sound effect mix"/>
      {file?.type.startsWith("video/") && <button type="button" onClick={playVideoWithLayeredAudio} className="ifund-interactive min-h-11 rounded-lg border px-4 font-semibold">Preview video with layered audio</button>}
      <p className="text-xs text-muted-foreground">Local preview only: the audio and video remain separate source files. Exporting an audio-mixed video requires a verified video encoding/muxing workflow. Use headphones for spoken review where useful.</p>
    </section>}
    {metadata && <p role="status" className="text-xs text-muted-foreground">Measured file metadata: {metadata.width && metadata.height ? metadata.width + " × " + metadata.height + " pixels" : "No image dimensions"}{metadata.duration != null ? " · " + metadata.duration.toFixed(1) + " seconds" : ""}. Scene boundaries and speech timing have not been measured; any interest-peak markers are editable planning suggestions, not validated optimums.</p>}
    <label className="block text-sm font-medium">Caption, spoken script or transcript
      <textarea rows={4} className="mt-2 w-full rounded-xl border bg-background p-3" value={postText} onChange={e => setPostText(e.target.value)} maxLength={6000} placeholder="Add actual words spoken, shown or planned, for better wording analysis."/>
    </label>
    <label className="block text-sm font-medium">Intended audience (optional)
      <input type="text" className="mt-2 min-h-11 w-full rounded-xl border bg-background px-3" maxLength={160} value={audience} onChange={e => setAudience(e.target.value)} placeholder="Who will view this content?"/>
    </label>
    <div className="flex flex-wrap gap-4 text-sm">
      <label className="flex items-center gap-2"><input type="checkbox" checked={observedSound} onChange={e => setObservedSound(e.target.checked)}/>Media includes sound</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={captions} onChange={e => setCaptions(e.target.checked)}/>Captions are present</label>
    </div>
    <fieldset className="space-y-3 rounded-xl border p-4">
      <legend className="px-1 text-sm font-semibold">Platforms for planned posting</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PLATFORM_PROFILES.map(p => <label key={p.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={destinations.includes(p.id)} onChange={() => toggle(p.id)} />{p.name}
        </label>)}
      </div>
    </fieldset>
    {file?.type.startsWith("video/") && <section className="space-y-2 rounded-xl border p-4" aria-label="Measured video timing">
      <h3 className="font-semibold">Measured video transitions</h3>
      <button type="button" disabled={inspectingVideo} onClick={inspectVideo}
        className="ifund-interactive min-h-11 rounded-lg border px-4 font-semibold disabled:opacity-50">
        {inspectingVideo ? "Inspecting video frames locally…" : "Analyze visual timeline locally"}
      </button>
      {visualMetrics && <p role="status" className="text-sm">Analyzed {visualMetrics.sampledFrames} sampled frames. Detected {visualMetrics.transitions.filter(t => t.change >= 0.15).length} stronger visual transitions. {visualMetrics.caveat}</p>}
    </section>}
    {file?.type.startsWith("audio/") && <section className="space-y-3 rounded-xl border p-4" aria-label="Measured audio analysis">
      <h3 className="font-semibold">Measured audio characteristics</h3>
      <button type="button" onClick={inspectSound} disabled={inspectingSound} className="ifund-interactive min-h-11 rounded-lg border px-4 font-semibold disabled:opacity-50">{inspectingSound ? "Analyzing locally…" : "Analyze sound locally"}</button>
      {soundMetrics && <div className="space-y-2 text-sm">
        <p>Peak level: {soundMetrics.peak.toFixed(3)} · RMS level: {soundMetrics.rms.toFixed(3)} · Quiet segments: {soundMetrics.quietSeconds.toFixed(1)} seconds · Near-clipped sample share: {(soundMetrics.clippedSampleFraction * 100).toFixed(2)}%</p>
        <p className="text-xs text-muted-foreground">Measured in half-second windows. Review quiet sections and sudden changes against the intended message. No universal sound frequency predicts a response; {soundMetrics.limitations}</p>
      </div>}
    </section>}
    <PlatformVariantEditor file={file} previewUrl={previewUrl} metadata={metadata} destinations={destinations} audioWindows={soundMetrics?.windows || []} visualTransitions={visualMetrics?.transitions || []} caption={postText} />
    <section aria-label="Media psychology analysis" className="space-y-3">
      <h3 className="text-lg font-semibold">Psychology-informed assessment</h3>
      <p className="text-sm text-muted-foreground">Research-informed, uncalibrated estimates of risk and opportunity—not numerical probabilities or verified audience outcomes. Memory and behavior depend on the viewer, content, context and exposure. Frequency or wavelength alone does not reliably predict emotion.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {analysis.signals.map(item => <article key={item.outcome} className="space-y-2 rounded-xl border p-3">
          <h4 className="font-semibold text-sm">{item.outcome}</h4>
          <p className="text-sm">{item.observed}</p>
          <p className="text-xs text-muted-foreground">{item.limitation}</p>
          <p className="text-xs text-muted-foreground">Evidence area: {item.evidence}</p>
        </article>)}
      </div>
    </section>
    <section aria-label="Platform optimization results" className="space-y-3">
      <h3 className="text-lg font-semibold">Platform-specific optimization</h3>
      {destinations.length === 0 && <p className="text-sm">Select at least one platform to compare its placement guidance.</p>}
      {PLATFORM_PROFILES.filter(p => destinations.includes(p.id)).map(p => <article key={p.id} className="space-y-2 rounded-xl border p-4">
        <h4 className="font-semibold">{p.name}</h4>
        {ratio && p.ratio && <p className="text-sm">{Math.abs(ratio - p.ratio) < 0.015 ? "The measured aspect ratio matches this vertical format." : "Your measured aspect ratio differs from the usual vertical 9:16 placement. Preview the intended crop."}</p>}
        {!ratio && p.ratio && <p className="text-sm">Image dimensions were not available for aspect-ratio validation.</p>}
        <ul className="list-disc space-y-1 pl-5 text-sm">{p.notes.map(note => <li key={note}>{note}</li>)}</ul>
        {p.source && <a href={p.source} target="_blank" rel="noopener noreferrer" className="text-sm underline">Current platform guidance</a>}
      </article>)}
      <p className="text-xs text-muted-foreground">Platform recommendations are placement-specific starting points, not a live posting-eligibility decision. Recheck official policies before delivery. More granular visual/audio measurements and calibrated response probabilities require additional analysis and consented validation data.</p>
    </section>
    {message && <p role="alert" className="text-sm text-red-500">{message}</p>}
  </section>;
}
