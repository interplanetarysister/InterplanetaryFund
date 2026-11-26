import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { uploadCampaignCover } from "@/api/campaignCovers";
import {deleteCampaignCover} from "@/api/campaignMedia.js";
import PrivateMediaLibrary from "@/components/media/PrivateMediaLibrary";
import AIImageStudio from "./AIImageStudio";
import {
  AUDIO_LAYERS,
  AUDIO_PRESETS,
  FRAME_OPTIONS,
  MEDIA_STUDIO_TABS,
  STUDIO_LIBRARY_KEY,
  VIEW_GRADES,
  buildVideoFilter,
  classifyMixLevel,
  describeBalance,
  frameForId,
  presetForId,
  tabFromParam,
  toneForId,
  TONE_PRESETS,
} from "@/lib/mediaStudio.mjs";

const field = "mt-2 w-full min-h-11 rounded-xl border border-input bg-background px-4 py-2";
const button = "ifund-interactive min-h-11 rounded-xl border border-border px-4 py-2 font-semibold disabled:opacity-60";
const tabButton = "ifund-interactive min-h-11 rounded-xl border px-4 py-2 font-semibold";
const hazardStripe = "h-2 w-full rounded-full";
const hazardStyle = { background: "repeating-linear-gradient(-45deg,#facc15 0 12px,#0b0f1e 12px 24px)" };

let itemCounter = 0;
function nextItemId() {
  itemCounter += 1;
  return `studio-${Date.now().toString(36)}-${itemCounter}`;
}

function kindForFile(file) {
  if (file?.type?.startsWith("video/")) return "video";
  if (file?.type?.startsWith("audio/")) return "audio";
  return "image";
}

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function loadPersistedLibrary() {
  try {
    const raw = localStorage.getItem(STUDIO_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && (item.dataUrl || item.savedUrl) && ["image", "video", "audio"].includes(item.kind))
      .map((item) => ({
        id: String(item.id || nextItemId()),
        kind: item.kind,
        name: String(item.name || "Studio item"),
        url: item.dataUrl || item.savedUrl,
        savedUrl: item.savedUrl || "",
        source: item.source || "saved",
        sessionOnly: false,
        persisted: true,
        createdAt: item.createdAt || Date.now(),
      }));
  } catch {
    return [];
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Media Studio (40-page list, page 23): one page for making media for
 * social posts, campaigns and marketing. Generator and Editor are separate
 * tabs; generated or uploaded items move into the Editor. Image generation
 * reuses the existing AI Image Studio — no second generator is built here.
 * Video generation has no provider wired into iFund, so the Generator says
 * so instead of faking it. Audio is mixed in this browser with the Web
 * Audio API; there is no audio backend. Viewing controls under the video
 * change the live preview the moment they move.
 */
export default function MediaStudio() {
  const [params, setParams] = useSearchParams();
  const tab = tabFromParam(params.get("tab"));
  const setTab = (next) => setParams({ tab: tabFromParam(next) });

  const [items, setItems] = useState(() => loadPersistedLibrary());
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const lastGeneratedRef = useRef(null);

  // Editor state: crash-test lab look, real preview only.
  const [frameId, setFrameId] = useState("9:16");
  const [safeZone, setSafeZone] = useState(true);
  const [viewing, setViewing] = useState({ brightness: 100, contrast: 100, saturation: 100, warmth: 0, grade: "none" });
  const [videoMeta, setVideoMeta] = useState(null);
  const videoRef = useRef(null);
  const filter = useMemo(() => buildVideoFilter(viewing), [viewing]);
  const frame = frameForId(frameId);

  // Audio state: three uploaded layers mixed in the browser.
  const [tracks, setTracks] = useState({ voice: null, music: null, effects: null });
  const [gains, setGains] = useState({ ...presetForId("balanced").gains });
  const [presetId, setPresetId] = useState("balanced");
  const [balance, setBalance] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [meter, setMeter] = useState({ peak: 0, rms: 0 });
  const [snapshotA, setSnapshotA] = useState(null);
  const [snapshotB, setSnapshotB] = useState(null);
  const [activeSnapshot, setActiveSnapshot] = useState("");
  const [toneId, setToneId] = useState("528");
  const [tonePlaying, setTonePlaying] = useState("");
  const audioRef = useRef({ ctx: null, master: null, analyser: null, panner: null, gainNodes: {}, sources: [], raf: 0, buffers: new Map(), tone: null });
  const spectrumRef = useRef(null);

  const selected = items.find((item) => item.id === selectedId) || null;
  const mixCheck = classifyMixLevel(meter);

  // Persist only what survives a reload: saved cover links and image data.
  // Video/audio bytes stay in this browser session and are labelled as such.
  useEffect(() => {
    try {
      const durable = items
        .filter((item) => item.savedUrl || item.dataUrl)
        .map((item) => ({ id: item.id, kind: item.kind, name: item.name, savedUrl: item.savedUrl || "", source: item.source, createdAt: item.createdAt, dataUrl: item.dataUrl || "" }));
      localStorage.setItem(STUDIO_LIBRARY_KEY, JSON.stringify(durable));
    } catch {
      // Storage full or unavailable: session items still work; nothing is faked.
    }
  }, [items]);

  useEffect(() => () => {
    const engine = audioRef.current;
    if (engine.raf) cancelAnimationFrame(engine.raf);
    for (const source of engine.sources) { try { source.stop(); } catch { /* already stopped */ } }
    if (engine.tone) {
      try { engine.tone.source.stop(); } catch { /* already stopped */ }
      try { engine.tone.gain.disconnect(); } catch { /* already disconnected */ }
    }
    if (engine.ctx) { try { void engine.ctx.close(); } catch { /* already closed */ } }
  }, []);

  // The File is kept in memory only (never persisted) so the Audio tab can
  // load an uploaded track without a second upload.
  function addItem({ file, url, name, kind, source, savedUrl = "", sessionOnly = true }) {
    const item = {
      id: nextItemId(), file, kind, name, url, savedUrl, source,
      sessionOnly, persisted: !sessionOnly, createdAt: Date.now(),
    };
    setItems((current) => [item, ...current]);
    return item;
  }

  async function addUpload(file, source = "uploaded") {
    if (!file) return null;
    const kind = kindForFile(file);
    const url = URL.createObjectURL(file);
    const item = addItem({ file, url, name: file.name, kind, source });
    if (kind === "image") {
      const dataUrl = await readAsDataUrl(file);
      // Prefer the data URL as the item's address: the blob URL is owned by
      // the uploader and may be revoked, while the data URL survives.
      if (dataUrl) setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, dataUrl, url: dataUrl } : entry)));
    }
    return item;
  }

  async function deleteStoredCover(item){
    if(!item?.savedUrl||busy)return;
    if(!window.confirm("Permanently delete this saved cover image from iFund storage? Campaigns using it must be updated first."))return;
    setBusy("delete-cover");setError("");setNotice("");
    try{
      await deleteCampaignCover(authClient(),item.savedUrl);
      setItems(current=>current.flatMap(entry=>{
        if(entry.savedUrl!==item.savedUrl)return [entry];
        if(!entry.file&&!entry.dataUrl)return [];
        return [{...entry,savedUrl:"",sessionOnly:true,persisted:false}];
      }));
      setNotice("Stored image deleted from R2. Campaign images in use are protected.");
    }catch(error){setError(error?.message||"Stored image deletion was not verified.");}
    finally{setBusy("");}
  }
  function removeItem(id) {
    setItems((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target?.url?.startsWith("blob:")) URL.revokeObjectURL(target.url);
      return current.filter((entry) => entry.id !== id);
    });
    if (selectedId === id) setSelectedId("");
  }

  function sendToEditor(item) {
    if (!item) return;
    setSelectedId(item.id);
    setVideoMeta(null);
    setTab("editor");
  }

  // --- Generator wiring: AI Image Studio stays the only image generator. ---
  function handleArtworkReady({ file, url, kind }) {
    if (!file || !url) return;
    const item = addItem({ file, url, name: file.name || "Generated artwork", kind: "image", source: "generated" });
    lastGeneratedRef.current = { id: item.id, file };
    readAsDataUrl(file).then((dataUrl) => {
      if (dataUrl) setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, dataUrl, url: dataUrl } : entry)));
    });
    setNotice("Artwork added to your Studio Library. Send it to the Editor when you are ready to frame it.");
  }

  function handleArtworkSaved(savedUrl) {
    if (!savedUrl) return;
    const targetId = lastGeneratedRef.current?.id;
    setItems((current) => {
      const target = targetId ? current.find((entry) => entry.id === targetId) : current.find((entry) => entry.kind === "image" && !entry.savedUrl);
      if (!target) return current;
      return current.map((entry) => (entry.id === target.id ? { ...entry, savedUrl, sessionOnly: false, persisted: true } : entry));
    });
    setNotice("Cover link saved to IFund cover storage and added to your Studio Library.");
  }

  async function saveItemToCoverStorage(item) {
    if (!item || item.kind !== "image" || busy) return;
    setBusy("save-cover"); setError(""); setNotice("");
    try {
      let file = item.file || null;
      if (!file && item.dataUrl) {
        const response = await fetch(item.dataUrl);
        const blob = await response.blob();
        file = new File([blob], item.name || "studio-image.jpg", { type: blob.type || "image/jpeg" });
      } else if (!file && item.url && !item.url.startsWith("blob:")) {
        const response = await fetch(item.url);
        const blob = await response.blob();
        file = new File([blob], item.name || "studio-image.jpg", { type: blob.type || "image/jpeg" });
      }
      if (!file) {
        throw new Error("This image lives only in this browser session. Download it first, then upload it from the Editor to save it.");
      }
      const savedUrl = await uploadCampaignCover(authClient(), file);
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, savedUrl, sessionOnly: false, persisted: true } : entry)));
      setNotice("Saved to IFund cover storage. The link is ready in the Publish tab.");
    } catch (cause) {
      setError(cause?.message || "The image could not be saved.");
    } finally {
      setBusy("");
    }
  }

  // --- Editor: frame still export (real render of the current preview). ---
  async function downloadFrameStill() {
    if (!selected || busy) return;
    setBusy("frame"); setError(""); setNotice("");
    try {
      const [widthRatio, heightRatio] = frame.aspect.split("/").map(Number);
      const width = 1080;
      const height = Math.round((width * heightRatio) / widthRatio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser could not prepare a frame still.");
      context.filter = filter;
      const drawCover = (sourceWidth, sourceHeight, draw) => {
        const sourceAspect = sourceWidth / sourceHeight;
        const targetAspect = width / height;
        let sx = 0; let sy = 0; let sw = sourceWidth; let sh = sourceHeight;
        if (sourceAspect > targetAspect) { sw = sourceHeight * targetAspect; sx = (sourceWidth - sw) / 2; }
        else { sh = sourceWidth / targetAspect; sy = (sourceHeight - sh) / 2; }
        draw(sx, sy, sw, sh);
      };
      if (selected.kind === "video") {
        const video = videoRef.current;
        if (!video || !video.videoWidth) throw new Error("Load a video and let it play a frame before downloading a still.");
        drawCover(video.videoWidth, video.videoHeight, (sx, sy, sw, sh) => context.drawImage(video, sx, sy, sw, sh, 0, 0, width, height));
      } else if (selected.kind === "image") {
        const image = new Image();
        image.src = selected.url;
        await image.decode();
        drawCover(image.naturalWidth, image.naturalHeight, (sx, sy, sw, sh) => context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height));
      } else {
        throw new Error("Frame stills are available for video and image items.");
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("The frame still could not be rendered.");
      downloadBlob(blob, `ifund-frame-${frameId.replace(":", "x")}.jpg`);
      setNotice(`Frame still downloaded at ${frameId} with the current viewing settings applied. The original file is unchanged.`);
    } catch (cause) {
      setError(cause?.message || "The frame still could not be downloaded.");
    } finally {
      setBusy("");
    }
  }

  function downloadOriginal(item) {
    if (!item) return;
    const anchor = document.createElement("a");
    anchor.href = item.url;
    anchor.download = item.name || "ifund-media";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  // --- Audio: real Web Audio mixing, metering and test tones. ---
  function ensureAudioEngine() {
    const engine = audioRef.current;
    if (!engine.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("This browser does not support the Web Audio API, so audio mixing is unavailable here.");
      engine.ctx = new AudioContextClass();
      engine.master = engine.ctx.createGain();
      engine.analyser = engine.ctx.createAnalyser();
      engine.analyser.fftSize = 2048;
      engine.panner = engine.ctx.createStereoPanner();
      engine.master.connect(engine.analyser);
      engine.analyser.connect(engine.panner);
      engine.panner.connect(engine.ctx.destination);
      engine.gainNodes = {};
      for (const layer of AUDIO_LAYERS) {
        const node = engine.ctx.createGain();
        node.gain.value = gains[layer.id] ?? 0;
        node.connect(engine.master);
        engine.gainNodes[layer.id] = node;
      }
    }
    return engine;
  }

  function applyGains(next, engine = audioRef.current) {
    if (!engine.ctx) return;
    for (const layer of AUDIO_LAYERS) {
      const node = engine.gainNodes[layer.id];
      if (node) node.gain.setTargetAtTime(next[layer.id] ?? 0, engine.ctx.currentTime, 0.03);
    }
  }

  async function decodeTrack(file) {
    const engine = ensureAudioEngine();
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (engine.buffers.has(key)) return engine.buffers.get(key);
    const bytes = await file.arrayBuffer();
    const buffer = await engine.ctx.decodeAudioData(bytes);
    engine.buffers.set(key, buffer);
    return buffer;
  }

  function stopSources() {
    const engine = audioRef.current;
    if (engine.raf) cancelAnimationFrame(engine.raf);
    engine.raf = 0;
    for (const source of engine.sources) { try { source.stop(); } catch { /* already stopped */ } }
    engine.sources = [];
  }

  function drawSpectrum() {
    const engine = audioRef.current;
    const canvas = spectrumRef.current;
    if (!engine.analyser || !canvas) return;
    const frequency = new Uint8Array(engine.analyser.frequencyBinCount);
    engine.analyser.getByteFrequencyData(frequency);
    const time = new Float32Array(engine.analyser.fftSize);
    engine.analyser.getFloatTimeDomainData(time);
    let peak = 0; let sum = 0;
    for (const sample of time) { peak = Math.max(peak, Math.abs(sample)); sum += sample * sample; }
    setMeter({ peak, rms: Math.sqrt(sum / time.length) });
    const context = canvas.getContext("2d");
    if (context) {
      const width = canvas.width; const height = canvas.height;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#0b0f1e";
      context.fillRect(0, 0, width, height);
      const bars = 48;
      const step = Math.floor(frequency.length / bars);
      for (let i = 0; i < bars; i += 1) {
        const value = frequency[i * step] / 255;
        const barHeight = Math.max(2, value * height);
        context.fillStyle = value > 0.8 ? "#facc15" : "#2dd4bf";
        context.fillRect((width / bars) * i + 1, height - barHeight, width / bars - 2, barHeight);
      }
    }
    engine.raf = requestAnimationFrame(drawSpectrum);
  }

  async function playMix({ keepSnapshot = false } = {}) {
    setError(""); setNotice("");
    try {
      const engine = ensureAudioEngine();
      if (engine.ctx.state === "suspended") await engine.ctx.resume();
      stopSources();
      let loaded = 0;
      for (const layer of AUDIO_LAYERS) {
        const file = tracks[layer.id];
        if (!file) continue;
        const buffer = await decodeTrack(file);
        const source = engine.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(engine.gainNodes[layer.id]);
        source.start();
        engine.sources.push(source);
        loaded += 1;
      }
      if (!loaded) throw new Error("Add at least one audio file — a voice, music, or effects track — before playing the mix.");
      engine.panner.pan.value = balance;
      applyGains(gains, engine);
      setPlaying(true);
      if (!keepSnapshot) setActiveSnapshot("");
      drawSpectrum();
    } catch (cause) {
      // A failed decode mid-mix must not leave earlier layers playing.
      stopSources();
      setPlaying(false);
      setError(cause?.message || "The mix could not be played.");
    }
  }

  function stopMix() {
    stopSources();
    setPlaying(false);
    setMeter({ peak: 0, rms: 0 });
  }

  function applyPreset(preset) {
    setPresetId(preset.id);
    setGains({ ...preset.gains });
    setActiveSnapshot("");
    applyGains(preset.gains);
  }

  function setLayerGain(layerId, value) {
    const next = { ...gains, [layerId]: value };
    setGains(next);
    setPresetId("");
    setActiveSnapshot("");
    applyGains(next);
  }

  function listenSnapshot(which) {
    const snapshot = which === "A" ? snapshotA : snapshotB;
    if (!snapshot) { setError(`Save a ${which} mix first, then listen to compare it.`); return; }
    setGains({ ...snapshot });
    setActiveSnapshot(which);
    applyGains(snapshot);
    if (!playing) void playMix({ keepSnapshot: true });
  }

  function playTone(kind) {
    try {
      const engine = ensureAudioEngine();
      if (engine.ctx.state === "suspended") void engine.ctx.resume();
      stopTone();
      const gain = engine.ctx.createGain();
      gain.gain.value = 0.12;
      gain.connect(engine.ctx.destination);
      let source;
      if (kind === "noise") {
        const length = engine.ctx.sampleRate * 2;
        const buffer = engine.ctx.createBuffer(length, 1, engine.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < length; i += 1) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.5;
        }
        source = engine.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
      } else {
        source = engine.ctx.createOscillator();
        source.type = "sine";
        source.frequency.value = toneForId(toneId).frequency;
      }
      source.connect(gain);
      source.start();
      engine.tone = { source, gain };
      setTonePlaying(kind);
    } catch (cause) {
      setError(cause?.message || "The test tone could not be played.");
    }
  }

  function stopTone() {
    const engine = audioRef.current;
    if (engine.tone) {
      try { engine.tone.source.stop(); } catch { /* already stopped */ }
      try { engine.tone.gain.disconnect(); } catch { /* already disconnected */ }
      engine.tone = null;
    }
    setTonePlaying("");
  }

  function loadAudioItem(item) {
    if (!item?.file) {
      setError("That audio file lives only in its original upload. Upload it again in the Audio tab to mix it.");
      return;
    }
    const empty = AUDIO_LAYERS.find((layer) => !tracks[layer.id]);
    if (!empty) {
      setError("All three layers are already loaded. Clear a layer in the Audio tab first, then load this file.");
      return;
    }
    setTracks((current) => ({ ...current, [empty.id]: item.file }));
    setError("");
    setNotice(`${item.name} loaded as the ${empty.label} track. Move it to another layer by uploading it there instead.`);
    setTab("audio");
  }

  function copyPostText() {
    if (!selected?.savedUrl) return;
    const text = `New artwork for my fundraiser:\n\n${selected.savedUrl}`;
    const done = () => setNotice("Post text copied. Paste it into the social composer to share the link.");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => setError("Copy is unavailable. Select the link below and copy it by hand."));
    else setError("Copy is unavailable in this browser. Select the link below and copy it by hand.");
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">IFund Creative Studio</p>
        <h1 className="text-3xl font-bold">Media Studio</h1>
        <p className="text-sm text-muted-foreground">
          Make images, video and audio for social posts, campaigns and marketing materials — in one place.
          Generate artwork, frame it in the Editor, mix audio for your clips, and share the finished item.
          Nothing here invents an audience result: checks show only your real files and settings.
        </p>
      </header>

      <div className={hazardStripe} style={hazardStyle} aria-hidden="true" />

      <div role="tablist" aria-label="Media Studio sections" className="flex flex-wrap gap-2">
        {MEDIA_STUDIO_TABS.map((item) => (
          <button key={item.id} type="button" role="tab" id={`studio-tab-${item.id}`}
            aria-selected={tab === item.id} aria-controls={`studio-panel-${item.id}`}
            className={`${tabButton} ${tab === item.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
            onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="ifund-feedback-error">{error}</p>}
      {notice && <p role="status" className="ifund-feedback-success">{notice}</p>}

      {tab === "generator" && (
        <div role="tabpanel" id="studio-panel-generator" aria-labelledby="studio-tab-generator" className="space-y-6">
          <AIImageStudio
            onArtworkReady={handleArtworkReady}
            onArtworkSaved={handleArtworkSaved}
            onSendToEditor={({ file, url, kind }) => {
              // Match by File identity: the library item's url may already have
              // been replaced by its data URL (see handleArtworkReady).
              const item = items.find((entry) => entry.file === file || entry.url === url) || addItem({ file, url, name: file?.name || "Generated artwork", kind: "image", source: "generated" });
              sendToEditor(item);
            }}
          />
          <section className="space-y-3 rounded-2xl border border-border bg-card p-5" aria-label="Video generation status">
            <h2 className="text-xl font-semibold">Video generation</h2>
            <p className="text-sm text-muted-foreground">
              Video generation is not connected yet. iFund has no video-generation provider wired in — image
              generation above is live through Cloudflare Workers AI, but there is no video model to call, so
              this Studio does not pretend to generate a video. Upload a video you already have in the Editor
              tab to frame it, adjust how it looks, and download a frame still.
            </p>
          </section>
        </div>
      )}

      {tab === "editor" && (
        <div role="tabpanel" id="studio-panel-editor" aria-labelledby="studio-tab-editor" className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-yellow-400/60 bg-[#0b0f1e] p-5 text-slate-100 sm:p-6" aria-label="Crash-test editor">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-mono text-lg font-bold tracking-wide">CRASH-TEST LAB // EDITOR</h2>
              <span className="rounded-full border border-yellow-400/70 px-3 py-1 font-mono text-xs font-semibold text-yellow-300">TEST RIG — PREVIEW ONLY</span>
            </div>
            <div className={hazardStripe} style={hazardStyle} aria-hidden="true" />
            <p className="text-sm text-slate-300">
              The crash-test look stays: this is the bench where media gets checked before it goes out.
              Everything on this bench shows your real file and your real settings — no audience scores,
              no invented reach, no test characters.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <label className="ifund-interactive inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-yellow-400 px-4 font-semibold text-black">
                Upload video or image
                <input type="file" accept="video/*,image/*" className="hidden"
                  onChange={async (e) => {
                    const file = e.currentTarget.files?.[0] || null;
                    e.currentTarget.value = "";
                    if (!file) return;
                    setError(""); setNotice("");
                    const item = await addUpload(file);
                    if (item) { setSelectedId(item.id); setVideoMeta(null); }
                  }} />
              </label>
              {items.length > 0 && (
                <label className="block text-sm font-medium">Open an item from the Library
                  <select className="mt-2 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 sm:w-auto"
                    value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setVideoMeta(null); }}>
                    <option value="">Choose media…</option>
                    {items.filter((item) => item.kind !== "audio").map((item) => (
                      <option key={item.id} value={item.id}>{item.name} ({item.kind})</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {!selected || selected.kind === "audio" ? (
              <p className="rounded-xl border border-dashed border-slate-600 p-5 text-sm text-slate-300">
                {selected?.kind === "audio"
                  ? "That item is audio. Open it in the Audio tab to mix it — the Editor works with video and images."
                  : "No media on the bench yet. Generate artwork in the Generator tab and send it to the Editor, or upload a video or image above."}
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-slate-300">
                    <span>FILE: {selected.name}</span>
                    <span>{selected.kind === "video" && videoMeta ? `DURATION ${videoMeta.duration} · ` : ""}FRAME {frame.label.toUpperCase()}</span>
                  </div>
                  <div className="mx-auto w-full overflow-hidden rounded-xl border border-slate-700 bg-black"
                    style={{ aspectRatio: frame.aspect, maxWidth: frame.id === "16:9" ? "100%" : "540px" }}>
                    <div className="relative h-full w-full">
                      {selected.kind === "video" ? (
                        <video ref={videoRef} key={selected.id} src={selected.url} controls playsInline
                          className="h-full w-full object-cover" style={{ filter }}
                          onLoadedMetadata={(e) => {
                            const video = e.currentTarget;
                            setVideoMeta({
                              duration: `${Math.floor(video.duration / 60)}:${String(Math.floor(video.duration % 60)).padStart(2, "0")}`,
                            });
                          }} />
                      ) : (
                        <img src={selected.url} alt={`Preview of ${selected.name}`} className="h-full w-full object-cover" style={{ filter }} />
                      )}
                      {safeZone && (
                        <div aria-hidden="true" className="pointer-events-none absolute inset-[10%] rounded-lg border-2 border-dashed border-yellow-400/90">
                          <span className="absolute -top-3 left-2 bg-yellow-400 px-2 py-0.5 font-mono text-[10px] font-bold text-black">SAFE ZONE — KEEP TEXT INSIDE</span>
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/70 px-2 py-0.5 font-mono text-[10px] text-slate-200">Captions sit above the bottom edge on most apps</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="font-mono text-xs text-slate-400">
                    PREVIEW CHECK — frame {frame.label} · safe zone {safeZone ? "on" : "off"} · brightness {viewing.brightness}% · contrast {viewing.contrast}% · colour {viewing.saturation}% · warmth {viewing.warmth} · grade {VIEW_GRADES.find((grade) => grade.id === viewing.grade)?.label}
                  </p>
                </div>

                <fieldset className="space-y-3 rounded-xl border border-slate-700 p-4">
                  <legend className="px-2 font-mono text-sm font-semibold text-yellow-300">PLATFORM FRAMING</legend>
                  <div className="flex flex-wrap gap-2">
                    {FRAME_OPTIONS.map((option) => (
                      <button key={option.id} type="button" onClick={() => setFrameId(option.id)}
                        aria-pressed={frameId === option.id}
                        className={`${button} ${frameId === option.id ? "bg-yellow-400 text-black" : "text-slate-100"}`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input type="checkbox" checked={safeZone} onChange={(e) => setSafeZone(e.target.checked)} />
                    Show the safe-zone guide (where apps cover the edges with buttons and captions)
                  </label>
                </fieldset>

                <fieldset className="space-y-4 rounded-xl border border-slate-700 p-4">
                  <legend className="px-2 font-mono text-sm font-semibold text-yellow-300">VIEWING CONTROLS — UNDER THE VIDEO, LIVE AS CHANGED</legend>
                  <p className="text-sm text-slate-300">
                    These controls change this preview the moment you move them, and only for this moment:
                    move a slider and the picture changes now. They do not change the original file.
                    A downloaded frame still keeps the current look and frame.
                  </p>
                  {[["brightness", "Brightness", 0, 200], ["contrast", "Contrast", 0, 200], ["saturation", "Colour", 0, 200], ["warmth", "Warmth (cool to warm)", -50, 50]].map(([key, label, min, max]) => (
                    <label key={key} className="block text-sm font-medium">
                      {label}: {viewing[key]}%
                      <input type="range" min={min} max={max} value={viewing[key]} aria-label={label}
                        className="mt-2 w-full accent-yellow-400"
                        onChange={(e) => setViewing((current) => ({ ...current, [key]: Number(e.target.value) }))} />
                    </label>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {VIEW_GRADES.map((grade) => (
                      <button key={grade.id} type="button" onClick={() => setViewing((current) => ({ ...current, grade: grade.id }))}
                        aria-pressed={viewing.grade === grade.id}
                        className={`${button} ${viewing.grade === grade.id ? "bg-yellow-400 text-black" : "text-slate-100"}`}>
                        {grade.label}
                      </button>
                    ))}
                    <button type="button" className={`${button} text-slate-100`}
                      onClick={() => setViewing({ brightness: 100, contrast: 100, saturation: 100, warmth: 0, grade: "none" })}>
                      Reset viewing controls
                    </button>
                  </div>
                </fieldset>

                <div className="flex flex-wrap gap-3">
                  <button type="button" className="ifund-interactive min-h-11 rounded-xl bg-yellow-400 px-5 font-semibold text-black disabled:opacity-60"
                    disabled={busy === "frame"} onClick={downloadFrameStill}>
                    {busy === "frame" ? "Rendering still…" : "Download frame still (current look + frame)"}
                  </button>
                  <button type="button" className={`${button} text-slate-100`} onClick={() => downloadOriginal(selected)}>
                    Download original file
                  </button>
                  {selected.kind === "image" && !selected.savedUrl && (
                    <button type="button" className={`${button} text-slate-100`} disabled={busy === "save-cover"}
                      onClick={() => saveItemToCoverStorage(selected)}>
                      {busy === "save-cover" ? "Saving…" : "Save to IFund cover storage"}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {tab === "audio" && (
        <div role="tabpanel" id="studio-panel-audio" aria-labelledby="studio-tab-audio" className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-label="Audio for social posts">
            <h2 className="text-xl font-semibold">Audio for social posts</h2>
            <p className="text-sm text-muted-foreground">
              Mix sound for the clips and posts you make here. Add up to three tracks — one voice track, one
              music track, one effects track — and mix them in this browser with the Web Audio API. There is
              no audio backend and no separate sound files are created: a mixed file is never claimed to be
              split into layers, and the levels below are measured from your real mix as it plays.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {AUDIO_LAYERS.map((layer) => (
                <div key={layer.id} className="space-y-2 rounded-xl border border-border p-4">
                  <h3 className="font-semibold">{layer.label} track</h3>
                  <label className="block text-sm">Choose an audio file
                    <input type="file" accept="audio/*" className="mt-2 w-full rounded-xl border border-input bg-background p-3 text-sm"
                      onChange={(e) => {
                        const file = e.currentTarget.files?.[0] || null;
                        e.currentTarget.value = "";
                        setTracks((current) => ({ ...current, [layer.id]: file }));
                      }} />
                  </label>
                  <p className="break-all text-xs text-muted-foreground">{tracks[layer.id] ? tracks[layer.id].name : "No file loaded."}</p>
                  {tracks[layer.id] && (
                    <button type="button" className="min-h-11 text-sm font-semibold text-primary underline"
                      onClick={() => setTracks((current) => ({ ...current, [layer.id]: null }))}>
                      Clear {layer.label.toLowerCase()} track
                    </button>
                  )}
                  <label className="block text-sm font-medium">Level: {Math.round((gains[layer.id] ?? 0) * 100)}%
                    <input type="range" min={0} max={100} value={Math.round((gains[layer.id] ?? 0) * 100)} aria-label={`${layer.label} level`}
                      className="mt-2 w-full"
                      onChange={(e) => setLayerGain(layer.id, Number(e.target.value) / 100)} />
                  </label>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Mix presets</h3>
              <div className="flex flex-wrap gap-2">
                {AUDIO_PRESETS.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => applyPreset(preset)} aria-pressed={presetId === preset.id}
                    className={`${button} ${presetId === preset.id ? "bg-primary text-primary-foreground" : ""}`}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{describeBalance(gains)}</p>
              <label className="block text-sm font-medium">Left / right balance: {balance === 0 ? "Centred" : balance < 0 ? `Left ${Math.round(-balance * 100)}%` : `Right ${Math.round(balance * 100)}%`}
                <input type="range" min={-100} max={100} value={Math.round(balance * 100)} aria-label="Left right balance"
                  className="mt-2 w-full"
                  onChange={(e) => {
                    const next = Number(e.target.value) / 100;
                    setBalance(next);
                    if (audioRef.current.panner) audioRef.current.panner.pan.value = next;
                  }} />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" className="ifund-interactive min-h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"
                disabled={playing} onClick={() => playMix()}>Play mix</button>
              <button type="button" className={button} disabled={!playing} onClick={stopMix}>Stop</button>
              <button type="button" className={button} onClick={() => setSnapshotA({ ...gains })}>Save mix as A</button>
              <button type="button" className={button} onClick={() => setSnapshotB({ ...gains })}>Save mix as B</button>
              <button type="button" className={button} disabled={!snapshotA} onClick={() => listenSnapshot("A")}>Listen to A{activeSnapshot === "A" ? " (playing)" : ""}</button>
              <button type="button" className={button} disabled={!snapshotB} onClick={() => listenSnapshot("B")}>Listen to B{activeSnapshot === "B" ? " (playing)" : ""}</button>
            </div>
            <p className="text-xs text-muted-foreground">A/B compare: save two mixes, then switch between them while listening. Only saved mixes can be compared — nothing is guessed.</p>

            <div className="space-y-2">
              <h3 className="font-semibold">Sound check — measured live from your mix</h3>
              <canvas ref={spectrumRef} width={640} height={120} className="w-full rounded-xl border border-border" aria-label="Live sound spectrum of the playing mix" />
              <p className="text-sm" role="status">
                {playing ? `${mixCheck.level}: ${mixCheck.note}` : "Press Play mix to measure the sound. The spectrum and level above come from the audio actually playing — not from a stored score."}
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-border p-4">
              <h3 className="font-semibold">Tone check (made in your browser)</h3>
              <p className="text-sm text-muted-foreground">Test tones for checking headphones and speakers before you share a clip. They are generated here by the Web Audio API — no audio file is downloaded or claimed as mastered.</p>
              <div className="flex flex-wrap gap-2">
                {TONE_PRESETS.map((tone) => (
                  <button key={tone.id} type="button" onClick={() => setToneId(tone.id)} aria-pressed={toneId === tone.id}
                    className={`${button} ${toneId === tone.id ? "bg-primary text-primary-foreground" : ""}`}>{tone.label}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={button} onClick={() => playTone("tone")}>
                  {tonePlaying === "tone" ? `Playing ${toneForId(toneId).label}` : `Play ${toneForId(toneId).label}`}
                </button>
                <button type="button" className={button} onClick={() => playTone("noise")}>
                  {tonePlaying === "noise" ? "Playing soft noise" : "Play soft noise"}
                </button>
                <button type="button" className={button} disabled={!tonePlaying} onClick={stopTone}>Stop tone</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === "library" && (
        <div role="tabpanel" id="studio-panel-library" aria-labelledby="studio-tab-library" className="space-y-5">
          <PrivateMediaLibrary onOpenMedia={async file=>{
            const item=await addUpload(file,"cloud-library");
            if(item){setSelectedId(item.id);setVideoMeta(null);setTab("editor");}
          }}/>
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-label="Studio library">
            <h2 className="text-xl font-semibold">Library</h2>
            <p className="text-sm text-muted-foreground">
              Locally edited items remain on this device. For persistent, private image, audio and video storage,
              use the saved media section above. Deleting a local item does not delete a previously
              stored cover image or cloud file; use the separate permanent deletion controls.
            </p>
            <label className="ifund-interactive inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-border px-4 font-semibold">
              Upload media
              <input type="file" accept="video/*,image/*,audio/*" className="hidden"
                onChange={async (e) => {
                  const file = e.currentTarget.files?.[0] || null;
                  e.currentTarget.value = "";
                  if (!file) return;
                  const item = await addUpload(file);
                  if (item) setNotice(`${item.name} added to your Library.`);
                }} />
            </label>
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                No media yet. Generate artwork in the Generator tab or upload a file above.
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.kind} · {item.source === "generated" ? "Generated here" : item.source === "saved" ? "Saved on this device" : "Uploaded"} · {item.sessionOnly ? "This session only" : "Saved on this device"}
                        {item.savedUrl ? " · Cover link saved" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.kind !== "audio" && (
                        <button type="button" className={button} onClick={() => sendToEditor(item)}>Open in Editor</button>
                      )}
                      {item.kind === "audio" && (
                        <button type="button" className={button} onClick={() => loadAudioItem(item)}>Load into Audio mix</button>
                      )}
                      {item.kind === "image" && !item.savedUrl && (
                        <button type="button" className={button} disabled={busy === "save-cover"} onClick={() => saveItemToCoverStorage(item)}>
                          Save to cover storage
                        </button>
                      )}
                      <button type="button" className={button} onClick={() => downloadOriginal(item)}>Download</button>
                      {item.savedUrl&&<button type="button" className={button} disabled={!!busy}
                        onClick={()=>void deleteStoredCover(item)}>Delete saved cover</button>}
                      <button type="button" className={button} onClick={() => removeItem(item.id)}>Remove locally</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === "publish" && (
        <div role="tabpanel" id="studio-panel-publish" aria-labelledby="studio-tab-publish" className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-label="Publish finished media">
            <h2 className="text-xl font-semibold">Publish</h2>
            <p className="text-sm text-muted-foreground">
              Share the finished item to IFund Social. The social composer publishes text, so a saved cover
              link travels as a link in your post. Video and audio cannot be attached to an IFund Social post
              yet — download the file and share it where that platform accepts uploads.
            </p>
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                Nothing to publish yet. Make or upload media first.
              </p>
            ) : (
              <>
                <label className="block text-sm font-medium">Choose the finished item
                  <select className={field} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                    <option value="">Choose media…</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} ({item.kind})</option>
                    ))}
                  </select>
                </label>
                {selected && selected.kind === "image" && selected.savedUrl && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium">Saved cover link
                      <input type="text" readOnly value={selected.savedUrl} className={field} onFocus={(e) => e.target.select()} />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" className={button} onClick={copyPostText}>Copy post text with link</button>
                      <Link to="/social" className={`${button} inline-flex items-center`}>Open the social composer</Link>
                    </div>
                  </div>
                )}
                {selected && selected.kind === "image" && !selected.savedUrl && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">This image has no shareable link yet. Save it to IFund cover storage first, then copy the post text here.</p>
                    <button type="button" className={button} disabled={busy === "save-cover"} onClick={() => saveItemToCoverStorage(selected)}>
                      {busy === "save-cover" ? "Saving…" : "Save to IFund cover storage"}
                    </button>
                  </div>
                )}
                {selected && selected.kind !== "image" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">IFund Social posts do not take {selected.kind} attachments yet. Download the finished file and share it from the app or platform that accepts it.</p>
                    <button type="button" className={button} onClick={() => downloadOriginal(selected)}>Download {selected.kind} file</button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
