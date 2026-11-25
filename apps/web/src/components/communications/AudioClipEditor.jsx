import { useEffect, useRef, useState } from "react";

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_CLIP_SECONDS = 120;
const MAX_OUTPUT_BYTES = 30 * 1024 * 1024;

function wavBytes(buffer, fromSeconds, toSeconds, normalize) {
  const sampleRate = buffer.sampleRate;
  const channels = Math.min(2, buffer.numberOfChannels);
  const start = Math.max(0, Math.floor(fromSeconds * sampleRate));
  const end = Math.min(buffer.length, Math.floor(toSeconds * sampleRate));
  const frames = end - start;
  if (!Number.isSafeInteger(frames) || frames <= 0) throw Error("Choose a nonempty audio selection.");
  const payload = frames * channels * 2;
  if (payload + 44 > MAX_OUTPUT_BYTES) throw Error("Selection is too large to export locally. Choose a shorter clip.");
  let gain = 1;
  if (normalize) {
    let peak = 0;
    for (let c = 0; c < channels; c++) {
      const samples = buffer.getChannelData(c);
      for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(samples[i]));
    }
    if (peak > 0) gain = Math.min(2, 0.95 / peak);
  }
  const raw = new ArrayBuffer(44 + payload);
  const view = new DataView(raw);
  const ascii = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, "RIFF"); view.setUint32(4, 36 + payload, true);
  ascii(8, "WAVE"); ascii(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); ascii(36, "data"); view.setUint32(40, payload, true);
  let offset = 44;
  for (let i = start; i < end; i++) for (let c = 0; c < channels; c++) {
    const v = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i] * gain));
    view.setInt16(offset, v < 0 ? Math.round(v * 32768) : Math.round(v * 32767), true);
    offset += 2;
  }
  return new Blob([raw], { type: "audio/wav" });
}

export default function AudioClipEditor() {
  const context = useRef(null);
  const decoded = useRef(null);
  const objectUrl = useRef(null);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [normalize, setNormalize] = useState(false);
  const [clipUrl, setClipUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    context.current?.close?.().catch(() => {});
  }, []);
  async function choose(event) {
    const file = event.target.files?.[0];
    if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; }
    decoded.current = null; setClipUrl(""); setError(""); setDuration(0); setName(file?.name || "");
    if (!file) return;
    if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|aac|wav|ogg|flac|webm)$/i.test(file.name)) {
      setError("Choose an audio file."); return;
    }
    if (file.size > MAX_INPUT_BYTES) { setError("Choose audio no larger than 25 MB."); return; }
    setBusy(true);
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw Error("Audio editing is not supported on this device.");
      if (!context.current) context.current = new AudioContextClass();
      const audio = await context.current.decodeAudioData(await file.arrayBuffer());
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) throw Error("Audio length is invalid.");
      decoded.current = audio;
      setDuration(audio.duration); setStart(0); setEnd(Math.min(MAX_CLIP_SECONDS, audio.duration));
    } catch (cause) { setError(cause.message || "This audio format cannot be decoded on your device."); }
    finally { setBusy(false); }
  }
  function exportClip() {
    setError("");
    if (!decoded.current) return;
    if (!(Number.isFinite(start) && Number.isFinite(end) && end > start && start >= 0 &&
      end <= duration && end - start <= MAX_CLIP_SECONDS)) {
      setError("Choose a start and end time within the file, up to 120 seconds long."); return;
    }
    try {
      const blob = wavBytes(decoded.current, start, end, normalize);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(blob);
      setClipUrl(objectUrl.current);
    } catch (cause) { setError(cause.message || "Unable to export this audio clip."); }
  }
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="Local audio editor">
    <h2 className="text-xl font-semibold">Audio editor</h2>
    <p className="text-sm text-muted-foreground">Trim an audio clip and optionally adjust its peak level. Processing stays on this device; iFund does not upload, publish or save the recording. Exported clips use WAV format.</p>
    <label className="block text-sm font-semibold">Choose an audio recording (up to 25 MB)
      <input type="file" accept="audio/*,.m4a,.flac" onChange={choose} className="mt-2 block w-full text-sm" />
    </label>
    {busy && <p role="status">Reading audio on your device…</p>}
    {duration > 0 && <div className="space-y-3">
      <p className="text-sm">{name} · {duration.toFixed(1)} seconds</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Start time, seconds
          <input className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" type="number" min="0" max={duration} step="0.1"
            value={start} onChange={e => {setStart(Number(e.target.value)); setClipUrl("");}} />
        </label>
        <label className="text-sm font-medium">End time, seconds
          <input className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" type="number" min="0" max={duration} step="0.1"
            value={end} onChange={e => {setEnd(Number(e.target.value)); setClipUrl("");}} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={normalize} onChange={e => {setNormalize(e.target.checked); setClipUrl("");}} />
        Normalize peak volume (maximum 2× amplification)
      </label>
      <button type="button" onClick={exportClip} className="ifund-interactive min-h-11 rounded-lg bg-cyan-600 px-4 font-semibold text-white">Preview edited audio</button>
      {clipUrl && <div className="space-y-2">
        <audio controls src={clipUrl} className="w-full" aria-label="Edited audio preview" />
        <a href={clipUrl} download="ifund-edited-audio.wav" className="ifund-interactive inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold">Save edited WAV to device</a>
      </div>}
    </div>}
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
  </section>;
}
