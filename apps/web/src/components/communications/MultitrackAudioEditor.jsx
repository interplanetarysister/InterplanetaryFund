import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../../api/auth";
import { stageAudioForMediaOptimization } from "../../lib/mediaDraftHandoff.mjs";
import { MAX_AUDIO_TRACKS, MAX_MIX_SECONDS, newAudioTrack, mixLength, renderMix, scheduleMix, validateTrackEdit, AUDIO_EFFECT_DEFAULTS } from "../../lib/multitrackAudio.mjs";
import { SOUND_PRESETS, makeSoundPresetBuffer } from "../../lib/mediaNoisePresets.mjs";
import { AUDIO_MIX_PRESETS, chooseAudioPreset, MASTERING_PROFILES, applyMasteringProfile } from "../../lib/mediaPresetCollections.mjs";
import { BINAURAL_BEAT_PRESETS, CARRIER_TONE_CHOICES, makeBinauralBuffer } from "../../lib/mediaBinauralPresets.mjs";

const styles = {
  input: "mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3",
  button: "ifund-interactive min-h-11 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-40",
};
const roleNames = { music: "Background music", voice: "Voice / narration", effects: "Sound effects", texture: "Noise & tone textures" };
const acceptedAudio = /\.(mp3|m4a|aac|wav|ogg|flac|webm)$/i;

export default function MultitrackAudioEditor() {
  const navigate = useNavigate();
  const audio = useRef(null);
  const playback = useRef(null);
  const recording = useRef(null);
  const previewObject = useRef(null);
  const mounted = useRef(true);
  const [tracks, setTracks] = useState([]);
  const [role, setRole] = useState("music");
  const [soundPreset, setSoundPreset] = useState("pink");
  const [soundSeconds, setSoundSeconds] = useState(30);
  const [soundFrequency, setSoundFrequency] = useState(440);
  const [masterProfile, setMasterProfile] = useState("none");
  const [duckDb, setDuckDb] = useState(-6);
  const [duckAttackMs, setDuckAttackMs] = useState(32);
  const [duckReleaseMs, setDuckReleaseMs] = useState(180);
  const [duckLookaheadMs, setDuckLookaheadMs] = useState(12);
  const [bypass, setBypass] = useState(false);
  const [compressionEnabled, setCompressionEnabled] = useState(false);
  const [compressionThreshold, setCompressionThreshold] = useState(-16);
  const [compressionRatio, setCompressionRatio] = useState(3);
  const [binauralCarrier, setBinauralCarrier] = useState(528);
  const [binauralDelta, setBinauralDelta] = useState(6);
  const [pinkRatio, setPinkRatio] = useState(0.35);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recordingActive, setRecordingActive] = useState(false);
  const [playBacking, setPlayBacking] = useState(true);
  const [master, setMaster] = useState(0.8);
  const [issue, setIssue] = useState("");
  const [notice, setNotice] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const stopPlaying = () => {
    playback.current?.stop();
    playback.current = null;
    if (mounted.current) setPlaying(false);
  };
  function clearPreview() {
    if (previewObject.current) URL.revokeObjectURL(previewObject.current);
    previewObject.current = null;
    setPreviewUrl("");
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
    mounted.current = false;
    playback.current?.stop();
    if (recording.current) {
      const current = recording.current;
      current.stream.getTracks().forEach(track => track.stop());
      clearTimeout(current.limit);
      try { if (current.recorder.state !== "inactive") current.recorder.stop(); } catch {}
    }
    if (previewObject.current) URL.revokeObjectURL(previewObject.current);
    audio.current?.close?.().catch(() => {});
    };
  }, []);
  async function ensureAudio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error("This browser does not support audio mixing.");
    if (!audio.current) audio.current = new Ctx();
    if (audio.current.state === "suspended") await audio.current.resume();
    return audio.current;
  }
  async function addFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (tracks.length + files.length > MAX_AUDIO_TRACKS) {
      setIssue("You can stack up to 12 audio tracks."); return;
    }
    setBusy(true); setIssue(""); setNotice("");
    try {
      const context = await ensureAudio();
      const incoming = [];
      for (const file of files) {
        if (file.size > 25*1024*1024 ||
           (!file.type.startsWith("audio/") && !acceptedAudio.test(file.name)))
          throw new Error("Each selected file must be audio and no larger than 25 MB.");
        const buffer = await context.decodeAudioData(await file.arrayBuffer());
        incoming.push(newAudioTrack({ id: crypto.randomUUID(), name: file.name, role, buffer }));
      }
      stopPlaying(); clearPreview();
      setTracks(existing => [...existing, ...incoming]);
      setNotice(incoming.length + " track(s) added to " + roleNames[role] + ".");
    } catch (e) { setIssue(e.message || "Unable to load audio."); }
    finally { setBusy(false); }
  }
  function activeMixTracks() {
    return bypass ? tracks.map(track=>({...track,effects:{...AUDIO_EFFECT_DEFAULTS}})) : tracks;
  }
  function setMasteringProfile(id) {
    if(recording.current)return;
    if(id==="none") {
      stopPlaying();clearPreview();setMasterProfile("none");setDuckDb(0);
      setNotice("Custom profile selected. Your current lane edits are preserved.");
      return;
    }
    if(!MASTERING_PROFILES[id])return;
    stopPlaying();clearPreview();setIssue("");setNotice("");
    setMasterProfile(id);
    setDuckDb(MASTERING_PROFILES[id].duckDb);
    setTracks(existing=>applyMasteringProfile(existing,id));
    setNotice("Editing profile applied to existing tracks. Loudness targets are references, not measured LUFS. Audition the mix.");
  }
  async function addBinauralLayer() {
    if(busy || recording.current || tracks.length>=MAX_AUDIO_TRACKS)return;
    setBusy(true);setIssue("");setNotice("");
    try {
      const context=await ensureAudio();
      const buffer=makeBinauralBuffer(context,{seconds:Number(soundSeconds),carrierHz:Number(binauralCarrier),deltaHz:Number(binauralDelta),pinkRatio:Number(pinkRatio)});
      const track=newAudioTrack({id:crypto.randomUUID(),name:"Stereo "+binauralCarrier+"Hz + "+binauralDelta+"Hz difference",role:"texture",buffer});
      stopPlaying();clearPreview();setTracks(existing=>[...existing,track]);
      setNotice("Stereo acoustic texture added. Use headphones to hear separate ear channels; no physiological effect is promised.");
    } catch(e){setIssue(e.message||"Binaural texture could not be generated.");}
    finally{setBusy(false);}
  }
  async function addSynthesizedSound() {
    if (busy || recording.current || tracks.length >= MAX_AUDIO_TRACKS) {
      setIssue("Remove a track before adding a sound texture."); return;
    }
    setBusy(true); setIssue(""); setNotice("");
    try {
      const context = await ensureAudio();
      const buffer=makeSoundPresetBuffer(context,{
        preset:soundPreset, seconds:Number(soundSeconds), frequency:Number(soundFrequency),
      });
      const name=SOUND_PRESETS.find(item=>item.id===soundPreset)?.label||"Noise texture";
      const track=newAudioTrack({id:crypto.randomUUID(),name,role:"texture",buffer});
      stopPlaying();clearPreview();
      setTracks(existing=>[...existing,track]);
      setNotice(name+" added on its own lane at a low level. Adjust and preview before publishing.");
    } catch(e){setIssue(e.message||"Unable to generate this sound preset.");}
    finally{setBusy(false);}
  }
  function editEffects(id, effectPatch) {
    const track=tracks.find(item=>item.id===id);
    if(!track)return;
    editTrack(id,{effects:{...AUDIO_EFFECT_DEFAULTS,...track.effects,...effectPatch}});
  }
  function editTrack(id, patch) {
    stopPlaying(); clearPreview(); setIssue(""); setNotice("");
    setTracks(existing => existing.map(track => {
      if (track.id !== id) return track;
      const next = {...track,...patch};
      try { validateTrackEdit(next,track.buffer.duration); return next; }
      catch (e) { setIssue(e.message); return track; }
    }));
  }
  function deleteTrack(id) {
    stopPlaying(); clearPreview();
    setTracks(existing => existing.filter(t => t.id !== id));
  }
  async function play() {
    setIssue(""); setNotice("");
    if (!tracks.length) return;
    try {
      const context = await ensureAudio();
      stopPlaying();
      const scheduled = scheduleMix(context,activeMixTracks(),context.destination,{master,duckDb:bypass?0:duckDb,compress:!bypass&&compressionEnabled,threshold:compressionThreshold,ratio:compressionRatio,duckAttackMs,duckReleaseMs,duckLookaheadMs});
      playback.current = scheduled;
      setPlaying(true);
      const ms = Math.ceil(mixLength(tracks)*1000)+100;
      setTimeout(() => { if (playback.current === scheduled) stopPlaying(); }, ms);
    } catch (e) { setIssue(e.message || "Unable to play the mix."); }
  }
  async function exportMix() {
    if (!tracks.length || busy) return;
    setIssue(""); setNotice(""); setBusy(true);
    try {
      const blob = await renderMix(activeMixTracks(),{master,duckDb:bypass?0:duckDb,compress:!bypass&&compressionEnabled,threshold:compressionThreshold,ratio:compressionRatio});
      clearPreview();
      previewObject.current = URL.createObjectURL(blob);
      setPreviewUrl(previewObject.current);
      setNotice("Mixed WAV rendered locally. Review the preview before saving.");
    } catch (e) { setIssue(e.message || "Audio rendering failed."); }
    finally { setBusy(false); }
  }
  async function useMixForMedia() {
    if (!tracks.length || busy || recording.current) return;
    setBusy(true); setIssue(""); setNotice("");
    try {
      const client = authClient();
      const before = await client.auth.getUser();
      if (before.error || !before.data?.user?.id) throw new Error("Sign in before preparing media versions.");
      const blob = await renderMix(activeMixTracks(),{master,duckDb:bypass?0:duckDb});
      const after = await client.auth.getUser();
      if (after.error || after.data?.user?.id !== before.data.user.id)
        throw new Error("Your account changed while preparing audio.");
      stageAudioForMediaOptimization(blob,before.data.user.id);
      navigate("/communications?tab=media&tool=optimization");
    } catch (e) { if (mounted.current) setIssue(e.message || "Unable to prepare the audio mix."); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function beginRecording() {
    if (busy || recording.current || tracks.length >= MAX_AUDIO_TRACKS) {
      if (tracks.length >= MAX_AUDIO_TRACKS) setIssue("Remove a track before recording.");
      return;
    }
    setBusy(true); setIssue(""); setNotice("");
    let stream;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
        throw new Error("This browser requires microphone and MediaRecorder support.");
      const context = await ensureAudio();
      stopPlaying();
      stream = await navigator.mediaDevices.getUserMedia({audio:{
        echoCancellation: true, noiseSuppression: true, autoGainControl: false,
      }});
      if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const mime = ["audio/webm;codecs=opus","audio/mp4","audio/webm","audio/ogg"]
        .find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream,mime?{mimeType:mime}:{});
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
      const current = {recorder, stream, limit:null, backing:null};
      recorder.onerror = () => setIssue("Microphone recording encountered an error.");
      recorder.onstop = async () => {
        if (recording.current !== current) {
          stream.getTracks().forEach(t => t.stop()); return;
        }
        clearTimeout(current.limit);
        current.backing?.stop();
        stream.getTracks().forEach(t => t.stop());
        recording.current = null;
        if (mounted.current) { setRecordingActive(false); setBusy(true); }
        try {
          const blob = new Blob(chunks,{type:recorder.mimeType || "audio/webm"});
          if (!blob.size) throw new Error("No microphone audio was recorded.");
          if (blob.size > 25*1024*1024) throw new Error("Recording exceeds the local 25 MB limit.");
          const buffer = await context.decodeAudioData(await blob.arrayBuffer());
          const source = newAudioTrack({id:crypto.randomUUID(),name:"Microphone recording",role:"voice",buffer});
          if (mounted.current) {
            clearPreview(); setTracks(existing => [...existing,source]);
            setNotice("Voice recording added to its own editable lane. Nothing was uploaded.");
          }
        } catch (e) { if (mounted.current) setIssue(e.message || "Recording could not be decoded."); }
        finally { if (mounted.current) setBusy(false); }
      };
      recording.current = current;
      recorder.start(200);
      if (playBacking && tracks.length) {
        try { current.backing = scheduleMix(context, activeMixTracks(), context.destination, { master,duckDb:bypass?0:duckDb,compress:!bypass&&compressionEnabled,threshold:compressionThreshold,ratio:compressionRatio }); }
        catch (e) { setNotice("Recording started, but backing playback was unavailable."); }
      }
      current.limit = setTimeout(() => {
        if (recording.current === current && recorder.state === "recording") recorder.stop();
      },MAX_MIX_SECONDS*1000);
      setRecordingActive(true);
      setBusy(false);
    } catch (e) {
      stream?.getTracks().forEach(t => t.stop());
      setIssue(e.message || "Microphone permission or recording unavailable.");
      setBusy(false);
    }
  }
  function endRecording() {
    const current = recording.current;
    if (!current) return;
    if (current.recorder.state === "recording") current.recorder.stop();
  }
  const duration = tracks.length ? mixLength(tracks) : 0;
  return <section aria-label="Multitrack audio editor" className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
    <header className="space-y-2">
      <h2 className="text-xl font-semibold">Multitrack audio editor</h2>
      <p className="text-sm text-muted-foreground">Layer music, recorded speech, and sound effects on separate lanes. Edit each clip's position, trim, level, mute, and solo independently. Originals remain unchanged; processing and recordings stay on your device.</p>
    </header>
    <section className="space-y-3 rounded-xl border p-4" aria-label="Seven audio mastering profiles">
      <h3 className="font-semibold">Studio mastering profiles</h3>
      <p className="text-sm text-muted-foreground">Use a Stitch reference profile as a starting EQ and ducking configuration. Review your own clips and refine each lane independently. These are local DSP presets, not AI mastering or verified LUFS compliance.</p>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="text-sm font-semibold">Preset
          <select className={styles.input} value={masterProfile} onChange={e=>setMasteringProfile(e.target.value)}
            disabled={recordingActive}>
            <option value="none">Custom / no active preset</option>
            {Object.entries(MASTERING_PROFILES).map(([id,profile])=>
              <option key={id} value={id}>{profile.category} — {profile.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Voice-triggered music ducking
          <select className={styles.input} value={duckDb} disabled={recordingActive}
            onChange={e=>{stopPlaying();clearPreview();setDuckDb(Number(e.target.value));}}>
            <option value={0}>Off</option>
            <option value={-3}>-3 dB · subtle</option>
            <option value={-6}>-6 dB · standard</option>
            <option value={-12}>-12 dB · strong</option>
            <option value={-18}>-18 dB · voice priority</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Profile target: {MASTERING_PROFILES[masterProfile]?.targetLufs != null ? MASTERING_PROFILES[masterProfile].targetLufs+" LUFS reference (not measured)" : "not selected"}. Automatic ducking uses voice-lane signal levels rather than an AI speech-transcription service. Music gains recover smoothly between voiced segments.</p>
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-semibold">Music ducking attack, release & lookahead</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["duckAttackMs","Attack",duckAttackMs,setDuckAttackMs,5,200,1],
            ["duckReleaseMs","Release",duckReleaseMs,setDuckReleaseMs,50,1000,10],
            ["duckLookaheadMs","Lookahead",duckLookaheadMs,setDuckLookaheadMs,0,50,1],
          ].map(([id,label,value,setValue,min,max,step])=><label className="text-xs" key={id}>{label}: {value} ms
            <input className="mt-2 w-full" type="range" min={min} max={max} step={step}
              value={value} disabled={recordingActive}
              onChange={e=>{stopPlaying();clearPreview();setValue(Number(e.target.value));}}/>
          </label>)}
        </div>
        <p className="text-xs text-muted-foreground">Uses measured voice-lane signal energy, not semantic AI speech recognition. The 12 ms default anticipates the detected energy window and smooths music gain changes.</p>
      </details>
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-semibold">Master dynamics compressor</summary>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={compressionEnabled}
          onChange={e=>{stopPlaying();clearPreview();setCompressionEnabled(e.target.checked);}} disabled={recordingActive}/>Enable browser-native compression</label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Threshold · {compressionThreshold} dBFS
            <input type="range" min="-36" max="-6" step="1" value={compressionThreshold} disabled={recordingActive}
              onChange={e=>{stopPlaying();clearPreview();setCompressionThreshold(Number(e.target.value));}} className="mt-2 w-full"/>
          </label>
          <label className="text-sm">Ratio · {compressionRatio}:1
            <input type="range" min="1" max="8" step="0.5" value={compressionRatio} disabled={recordingActive}
              onChange={e=>{stopPlaying();clearPreview();setCompressionRatio(Number(e.target.value));}} className="mt-2 w-full"/>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Compression moderates dynamic range but is not a calibrated true-peak limiter or -14 LUFS loudness guarantee. Review final playback for distortion.</p>
      </details>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={bypass} disabled={recordingActive}
          onChange={e=>{stopPlaying();clearPreview();setBypass(e.target.checked);}} />
        A/B bypass: preview and export original track EQ without DSP effects or ducking
      </label>
    </section>
    <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_2fr]">
      <label className="text-sm font-semibold">Add files to lane
        <select className={styles.input} value={role} onChange={e => setRole(e.target.value)} disabled={recordingActive}>
          {Object.entries(roleNames).map(([id,name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">Audio files (25 MB each)
        <input type="file" multiple accept="audio/*,.m4a,.flac" className="mt-1 block w-full text-sm"
          disabled={busy || recordingActive} onChange={addFiles}/>
      </label>
    </section>
    <section className="space-y-3 rounded-xl border p-4" aria-label="Sound and frequency presets">
      <h3 className="font-semibold">Sound textures & frequency presets</h3>
      <p className="text-sm text-muted-foreground">Generate pink, white, or brown noise, or an adjustable sine tone. Pink noise is a broad frequency spectrum with more low-frequency power, not one fixed Hz. These effects have no proven universal memory or engagement benefit.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Texture
          <select className={styles.input} value={soundPreset} onChange={e=>setSoundPreset(e.target.value)} disabled={recordingActive}>
            {SOUND_PRESETS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="text-sm">Duration (seconds)
          <input type="number" min="1" max={MAX_MIX_SECONDS} step="1" value={soundSeconds}
            onChange={e=>setSoundSeconds(Number(e.target.value))} className={styles.input} disabled={recordingActive}/>
        </label>
        <label className="text-sm">Tone frequency (Hz)
          <input type="number" min="40" max="4000" step="1" value={soundFrequency}
            onChange={e=>setSoundFrequency(Number(e.target.value))} className={styles.input}
            disabled={recordingActive || soundPreset!=="tone"} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{SOUND_PRESETS.find(p=>p.id===soundPreset)?.description}. Generated textures start quietly (-12 dBFS peak internally, with an additional low lane volume). Playback volume and frequencies are editable after insertion.</p>
      <button type="button" onClick={addSynthesizedSound} disabled={busy || recordingActive || tracks.length>=MAX_AUDIO_TRACKS}
        className={styles.button}>Add preset to a new audio lane</button>
    </section>
    <details className="space-y-3 rounded-xl border p-4" aria-label="Advanced stereo frequency textures">
      <summary className="cursor-pointer text-sm font-semibold">Advanced: stereo binaural tones + pink-noise masking</summary>
      <p className="mt-3 text-sm text-muted-foreground">An optional stereo effect drawn from the Stitch audio reference. Each ear receives a slightly different tone. Requires headphones for the difference to be heard as intended. Descriptions such as theta and alpha classify rate ranges, not proven effects on consciousness, memory or fundraising.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Carrier frequency (Hz)
          <input type="number" min="40" max="4000" step="1" value={binauralCarrier} disabled={recordingActive}
            onChange={e=>setBinauralCarrier(Number(e.target.value))} className={styles.input}/>
          <span className="mt-1 flex flex-wrap gap-2">{CARRIER_TONE_CHOICES.map(hz=>
            <button key={hz} type="button" className="rounded-lg border px-2 py-1 text-xs" onClick={()=>setBinauralCarrier(hz)} disabled={recordingActive}>{hz}</button>)}</span>
        </label>
        <label className="text-sm">Ear-to-ear beat difference (Hz)
          <select className={styles.input} value={String(binauralDelta)} disabled={recordingActive}
            onChange={e=>setBinauralDelta(Number(e.target.value))}>
            {BINAURAL_BEAT_PRESETS.map(p=><option key={p.id} value={String(p.deltaHz)}>{p.label} · {p.deltaHz} Hz</option>)}
          </select>
        </label>
        <label className="text-sm">Pink-noise blend · {Math.round(pinkRatio*100)}%
          <input type="range" min="0" max="1" step="0.05" value={pinkRatio} disabled={recordingActive}
            onChange={e=>setPinkRatio(Number(e.target.value))} className="mt-2 w-full"/>
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Stereo: left {binauralCarrier} Hz · right {Number(binauralCarrier)+Number(binauralDelta)} Hz. Playback is user-initiated and quiet by default. The 432/528/639/741/852 Hz options are audio frequencies, not evidence of special physiological benefits.</p>
      <button type="button" className={styles.button} disabled={busy || recordingActive || tracks.length>=MAX_AUDIO_TRACKS}
        onClick={addBinauralLayer}>Add stereo texture as editable lane</button>
    </details>
    <section className="space-y-3 rounded-xl border p-4" aria-label="Microphone recording">
      <h3 className="font-semibold">Record narration or an effect</h3>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={playBacking}
        onChange={e => setPlayBacking(e.target.checked)} disabled={recordingActive}/>
        Play the existing mix while recording
      </label>
      <p className="text-xs text-muted-foreground">Use headphones when recording over music to prevent microphone bleed or feedback. Background playback is for monitoring; only microphone input is captured into the new lane. The browser asks for permission only when Record is clicked.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={beginRecording} disabled={busy || recordingActive || tracks.length >= MAX_AUDIO_TRACKS}
          className={styles.button}>{recordingActive ? "Recording…" : "Record microphone"}</button>
        <button type="button" onClick={endRecording} disabled={!recordingActive} className={styles.button}>Stop recording</button>
      </div>
      {recordingActive && <p role="status" className="text-sm">Microphone active · up to {MAX_MIX_SECONDS} seconds · stop when finished</p>}
    </section>
    <div className="space-y-3">
      <h3 className="font-semibold">Audio lanes ({tracks.length}/{MAX_AUDIO_TRACKS})</h3>
      {tracks.length===0 && <p className="text-sm text-muted-foreground">Add music, narration, effects, or record a voice to begin.</p>}
      {["music","voice","effects","texture"].map(lane => <section key={lane} className="space-y-3 rounded-xl border p-3" aria-label={roleNames[lane]}>
        <h4 className="text-sm font-semibold">{roleNames[lane]}</h4>
        {tracks.filter(track => track.role===lane).length === 0 && <p className="text-xs text-muted-foreground">No clips on this lane yet.</p>}
        {tracks.filter(track=>track.role===lane).map(track => <article key={track.id} className="space-y-3 rounded-lg border border-border bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="max-w-full break-words text-sm">{track.name}</strong>
            <button type="button" className={styles.button} onClick={() => deleteTrack(track.id)} disabled={recordingActive}>Remove</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs">Start on timeline (s)
              <input type="number" min="0" max={MAX_MIX_SECONDS} step="0.1" value={track.start} disabled={recordingActive}
                onChange={e=>editTrack(track.id,{start:Number(e.target.value)})} className={styles.input}/>
            </label>
            <label className="text-xs">Trim from source (s)
              <input type="number" min="0" max={track.trimEnd} step="0.1" value={track.trimStart} disabled={recordingActive}
                onChange={e=>editTrack(track.id,{trimStart:Number(e.target.value)})} className={styles.input}/>
            </label>
            <label className="text-xs">Trim until source (s)
              <input type="number" min="0" max={track.buffer.duration} step="0.1" value={track.trimEnd} disabled={recordingActive}
                onChange={e=>editTrack(track.id,{trimEnd:Number(e.target.value)})} className={styles.input}/>
            </label>
          </div>
          <label className="block text-xs">Volume · {Math.round(track.volume * 100)}%
            <input type="range" min="0" max="2" step="0.05" className="mt-2 w-full" value={track.volume}
              disabled={recordingActive} onChange={e=>editTrack(track.id,{volume:Number(e.target.value)})}/>
          </label>
          <details className="space-y-3 rounded-xl border p-3">
            <summary className="cursor-pointer text-sm font-semibold">Advanced audio effects: EQ, filters, fades and stereo</summary>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Audio mix presets">
              {Object.entries(AUDIO_MIX_PRESETS).map(([id,preset]) => <button key={id} type="button"
                className={styles.button} disabled={recordingActive}
                onClick={() => editTrack(track.id,{effects:chooseAudioPreset(id,track.trimEnd-track.trimStart)})}>
                {preset.label}
              </button>)}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["lowGain","Low shelf EQ (dB)",-12,12,1],["midGain","Mid EQ (dB)",-12,12,1],
                ["highGain","High shelf EQ (dB)",-12,12,1],
                ["highpass","Low-cut frequency (Hz)",20,8000,10],
                ["lowpass","High-cut frequency (Hz)",300,20000,100],
                ["pan","Stereo pan (L/R)",-1,1,0.1],
                ["speechCarveHz","Speech masking carve frequency (Hz)",1500,4500,100],
                ["speechCarveDb","Speech masking carve gain (dB)",-12,0,0.2],
                ["speechCarveQ","Speech carve bandwidth Q",0.5,4,0.1],
                ["fadeIn","Fade in (s)",0,Math.min(30,track.trimEnd-track.trimStart),0.1],
                ["fadeOut","Fade out (s)",0,Math.min(30,track.trimEnd-track.trimStart),0.1],
              ].map(([id,label,min,max,step])=><label key={id} className="text-xs">{label}: {track.effects?.[id]??AUDIO_EFFECT_DEFAULTS[id]}
                <input type="range" className="mt-2 w-full" min={min} max={max} step={step}
                  disabled={recordingActive} value={track.effects?.[id]??AUDIO_EFFECT_DEFAULTS[id]}
                  onChange={e=>editEffects(track.id,{[id]:Number(e.target.value)})}/>
              </label>)}
            </div>
            <button type="button" className={styles.button} disabled={recordingActive}
              onClick={()=>editTrack(track.id,{effects:{...AUDIO_EFFECT_DEFAULTS}})}>Reset effects</button>
          </details>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={track.muted} disabled={recordingActive}
              onChange={e=>editTrack(track.id,{muted:e.target.checked})}/>Mute</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={track.solo} disabled={recordingActive}
              onChange={e=>editTrack(track.id,{solo:e.target.checked})}/>Solo</label>
          </div>
        </article>)}
      </section>)}
    </div>
    <section className="space-y-3 rounded-xl border p-4">
      <label className="block text-sm">Master level · {Math.round(master*100)}%
        <input type="range" min="0" max="1" step="0.05" className="mt-2 w-full" value={master}
          disabled={recordingActive} onChange={e=>{stopPlaying();clearPreview();setMaster(Number(e.target.value));}}/>
      </label>
      <p className="text-xs text-muted-foreground">Timeline duration: {duration.toFixed(1)} seconds. Up to {MAX_MIX_SECONDS} seconds total. Levels above 100% on a clip may distort; review before publishing.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!tracks.length || busy || recordingActive} onClick={playing?stopPlaying:play} className={styles.button}>
          {playing ? "Stop playback" : "Play layered mix"}
        </button>
        <button type="button" disabled={!tracks.length || busy || recordingActive} onClick={exportMix} className={styles.button}>
          {busy ? "Processing…" : "Render mixed WAV"}
        </button>
      </div>
      {tracks.length > 0 && <button type="button" disabled={busy || recordingActive} onClick={useMixForMedia} className={styles.button}>Use layered audio in media optimization</button>}
      {previewUrl && <div className="space-y-2">
        <audio src={previewUrl} controls className="w-full" aria-label="Layered mix preview"/>
        <a href={previewUrl} download="ifund-layered-audio.wav" className={styles.button+" inline-flex items-center"}>Download mixed WAV</a>
      </div>}
    </section>
    {issue && <p role="alert" className="text-sm text-red-500">{issue}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
  </section>;
}
