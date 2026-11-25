/**
 * Non-destructive audio session: all edits are clip instructions over decoded
 * source buffers. No media is sent to the server.
 */
export const MAX_AUDIO_TRACKS = 12;
export const MAX_AUTOMATION_POINTS = 16;
export const MAX_MIX_SECONDS = 180;
export const MIX_SAMPLE_RATE = 44100;
export const MAX_WAV_BYTES = 38 * 1024 * 1024;
export const TRACK_ROLES = Object.freeze(["music", "voice", "effects", "texture"]);
export const AUDIO_EFFECT_DEFAULTS = Object.freeze({
  lowGain: 0, midGain: 0, highGain: 0,
  highpass: 20, lowpass: 18000, pan: 0, fadeIn: 0, fadeOut: 0,
  speechCarveHz: 2800, speechCarveDb: 0, speechCarveQ: 1.42,
});

const finite = value => typeof value === "number" && Number.isFinite(value);
const limit = (n, min, max) => Math.min(max, Math.max(min, n));
export function validateTrackEdit(track, sourceDuration = track?.buffer?.duration ?? track?.duration) {
  if (!track || !TRACK_ROLES.includes(track.role)) throw new Error("Unsupported audio lane.");
  if (![track.start, track.trimStart, track.trimEnd, track.volume, sourceDuration].every(finite))
    throw new Error("Audio timing or level is invalid.");
  if (sourceDuration <= 0 || track.start < 0 || track.trimStart < 0 ||
    track.trimEnd > sourceDuration || track.trimStart >= track.trimEnd ||
    track.volume < 0 || track.volume > 2 || track.start + track.trimEnd - track.trimStart > MAX_MIX_SECONDS + 0.001)
    throw new Error("Audio clip timing or level is outside the supported range.");
  const fx = {...AUDIO_EFFECT_DEFAULTS,...(track.effects || {})};
  if (![fx.lowGain,fx.midGain,fx.highGain,fx.highpass,fx.lowpass,fx.pan,fx.fadeIn,fx.fadeOut,fx.speechCarveHz,fx.speechCarveDb,fx.speechCarveQ].every(finite) ||
      [fx.lowGain,fx.midGain,fx.highGain].some(v=>Math.abs(v)>12) ||
      fx.highpass<20 || fx.highpass>8000 || fx.lowpass<300 || fx.lowpass>20000 ||
      fx.lowpass<=fx.highpass || Math.abs(fx.pan)>1 || fx.fadeIn<0 || fx.fadeOut<0 ||
      fx.fadeIn>track.trimEnd-track.trimStart || fx.fadeOut>track.trimEnd-track.trimStart ||
      fx.speechCarveHz<1500 || fx.speechCarveHz>4500 || fx.speechCarveDb>0 || fx.speechCarveDb< -12 ||
      fx.speechCarveQ<0.5 || fx.speechCarveQ>4)
    throw new Error("Audio effect parameters are outside the supported range.");
  const points = track.automation ?? [];
  if (!Array.isArray(points) || points.length > MAX_AUTOMATION_POINTS)
    throw new Error("Audio volume automation is invalid.");
  let previous = -1;
  const clipDuration = track.trimEnd - track.trimStart;
  for (const point of points) {
    if (!point || !finite(point.time) || !finite(point.gain) ||
      point.time < 0 || point.time > clipDuration + 0.00001 ||
      point.time <= previous || point.gain < 0 || point.gain > 2)
      throw new Error("Audio volume automation is outside the supported range.");
    previous = point.time;
  }
  return true;
}
export function automationGainAt(points = [], position = 0) {
  if (!points.length) return 1;
  if (position <= points[0].time) return points[0].gain;
  for (let i=1;i<points.length;i++){
    if (position <= points[i].time) {
      const before=points[i-1],after=points[i];
      const part=(position-before.time)/(after.time-before.time);
      return before.gain+(after.gain-before.gain)*part;
    }
  }
  return points[points.length-1].gain;
}
export function appendAutomationPoint(points = [], duration) {
  if (!finite(duration) || duration <= 0 || duration > MAX_MIX_SECONDS ||
    !Array.isArray(points) || points.length >= MAX_AUTOMATION_POINTS)
    throw Error("Audio automation limit reached.");
  const existing = new Set(points.map(p => p.time.toFixed(3)));
  const step = duration / (MAX_AUTOMATION_POINTS + 1);
  let time = null;
  for (let i=1; i<=MAX_AUTOMATION_POINTS+1; i++){
    const candidate = Number(Math.min(duration,step*i).toFixed(3));
    if (!existing.has(candidate.toFixed(3))) { time = candidate; break; }
  }
  if (time === null) throw Error("No free automation position.");
  return [...points,{time,gain:1}].sort((a,b)=>a.time-b.time);
}
export function newAudioTrack({ id, name, role, buffer, start = 0 }) {
  if (!id || !buffer || !finite(buffer.duration) || buffer.duration <= 0)
    throw new Error("A decoded audio source is required.");
  if (!TRACK_ROLES.includes(role)) throw new Error("Unsupported audio lane.");
  const duration = Math.min(buffer.duration, MAX_MIX_SECONDS - start);
  if (duration <= 0 || !finite(start) || start < 0) throw new Error("Audio starts outside the timeline.");
  const track = { id, name: String(name || role).slice(0, 120), role,
    start, trimStart: 0, trimEnd: duration,
    volume: role === "music" ? 0.3 : role === "texture" ? 0.18 : role === "effects" ? 0.55 : 1,
    muted: false, solo: false, buffer, effects: {...AUDIO_EFFECT_DEFAULTS}, automation: [] };
  validateTrackEdit(track, buffer.duration);
  return track;
}
export function mixLength(tracks) {
  if (!Array.isArray(tracks) || tracks.length > MAX_AUDIO_TRACKS) throw new Error("Too many tracks.");
  return Math.max(0, ...tracks.map(track => {
    validateTrackEdit(track, track.buffer?.duration);
    return track.start + track.trimEnd - track.trimStart;
  }));
}
export function audibleTracks(tracks) {
  const solo = tracks.some(track => track.solo && !track.muted);
  return tracks.filter(track => !track.muted && track.volume > 0 && (!solo || track.solo));
}
/**
 * Schedule source nodes on an AudioContext or OfflineAudioContext, with an
 * output gain to prevent sudden summing overload. Source nodes are never
 * connected to microphone inputs or the MediaRecorder.
 */
export function scheduleMix(context, tracks, destination = context.destination, { from = 0, master = 0.8, duckDb = 0, compress = false, threshold = -16, ratio = 3,
  duckAttackMs = 32, duckReleaseMs = 180, duckLookaheadMs = 12 } = {}) {
  if (!finite(from) || from < 0 || from > MAX_MIX_SECONDS || !finite(master) || master < 0 || master > 1 ||
      !finite(duckDb) || duckDb < -18 || duckDb > 0 ||
      !finite(threshold) || threshold < -36 || threshold > -6 ||
      !finite(ratio) || ratio < 1 || ratio > 8 ||
      ![duckAttackMs,duckReleaseMs,duckLookaheadMs].every(finite) ||
      duckAttackMs<5 || duckAttackMs>200 || duckReleaseMs<50 || duckReleaseMs>1000 ||
      duckLookaheadMs<0 || duckLookaheadMs>50)
    throw new Error("Invalid playback position or master volume.");
  mixLength(tracks);
  const masterGain = context.createGain();
  masterGain.gain.value = master;
  let compressor = null;
  if(compress && typeof context.createDynamicsCompressor==="function"){
    compressor=context.createDynamicsCompressor();
    compressor.threshold.value=threshold;
    compressor.knee.value=10;
    compressor.ratio.value=ratio;
    compressor.attack.value=0.005;
    compressor.release.value=0.18;
    masterGain.connect(compressor);
    compressor.connect(destination);
  }else masterGain.connect(destination);
  const nodes = [];
  for (const track of audibleTracks(tracks)) {
    const clipEnd = track.start + track.trimEnd - track.trimStart;
    if (clipEnd <= from) continue;
    const skip = Math.max(0, from - track.start);
    const remaining = track.trimEnd - track.trimStart - skip;
    if (remaining <= 0) continue;
    const source = context.createBufferSource();
    source.buffer = track.buffer;
    const gain = context.createGain();
    const startAt=context.currentTime + Math.max(0, track.start - from);
    const effects={...AUDIO_EFFECT_DEFAULTS,...(track.effects || {})};
    const fadeInRemaining=Math.max(0,effects.fadeIn-skip);
    const fadeOutStart=Math.max(0,track.trimEnd-track.trimStart-effects.fadeOut-skip);
    gain.gain.value=track.volume;
    if(typeof gain.gain.setValueAtTime==="function"){
      const firstLevel=fadeInRemaining>0?Math.max(0,track.volume*skip/Math.max(effects.fadeIn,0.001)):
        effects.fadeOut>0 && fadeOutStart===0 ? track.volume*Math.max(0,remaining/effects.fadeOut) : track.volume;
      gain.gain.setValueAtTime(firstLevel,startAt);
      if(fadeInRemaining>0)gain.gain.linearRampToValueAtTime(track.volume,startAt+Math.min(remaining,fadeInRemaining));
      if(effects.fadeOut>0 && fadeOutStart<remaining){
        const fadeAt=startAt+fadeOutStart;
        if(fadeOutStart>fadeInRemaining)gain.gain.setValueAtTime(track.volume,fadeAt);
        gain.gain.linearRampToValueAtTime(0,startAt+remaining);
      }
    }
    let tail=source;
    const effectNodes=[];
    if(typeof context.createBiquadFilter==="function"){
      const filters=[
        ["highpass",effects.highpass,0],["lowshelf",220,effects.lowGain],
        ["peaking",1100,effects.midGain],["peaking",effects.speechCarveHz,effects.speechCarveDb],
        ["highshelf",4200,effects.highGain],
        ["lowpass",effects.lowpass,0],
      ];
      for(const [type,frequency,level] of filters){
        const filter=context.createBiquadFilter();
        filter.type=type;filter.frequency.value=Math.min(frequency,context.sampleRate/2-1);
        if(filter.gain)filter.gain.value=level;
        if(type==="peaking" && filter.Q)filter.Q.value=frequency===effects.speechCarveHz ? effects.speechCarveQ : 0.8;
        tail.connect(filter);tail=filter;effectNodes.push(filter);
      }
    }
    tail.connect(gain);
    let end=gain;
    if (track.automation?.length && typeof context.createGain === "function") {
      const automationNode=context.createGain();
      const automation=track.automation;
      const envelope=automationNode.gain;
      const initial=automationGainAt(automation,skip);
      envelope.value=initial;
      if (typeof envelope.setValueAtTime==="function") {
        envelope.setValueAtTime(initial,startAt);
        for(const point of automation){
          if(point.time>skip && point.time<=skip+remaining && typeof envelope.linearRampToValueAtTime==="function")
            envelope.linearRampToValueAtTime(point.gain,startAt+point.time-skip);
        }
      }
      end.connect(automationNode);
      end=automationNode;
      effectNodes.push(automationNode);
    }
    if(track.role==="music" && duckDb<0 && typeof context.createGain==="function"){
      const duck=context.createGain();
      duck.gain.value=1;
      end.connect(duck);end=duck;effectNodes.push(duck);
      const voiceTracks=audibleTracks(tracks).filter(v=>v.role==="voice" && v.id!==track.id);
      if(voiceTracks.length && typeof duck.gain.setTargetAtTime==="function"){
        const sampleInterval=0.1;
        const activeLevel=Math.pow(10,duckDb/20);
        duck.gain.setValueAtTime(1,startAt);
        for(let offset=0;offset<remaining;offset+=sampleInterval){
          const timelineTime=from+Math.max(0,track.start-from)+offset+duckLookaheadMs/1000;
          const voiceActive=voiceTracks.some(v=>{
            const elapsed=timelineTime-v.start;
            const sourceTime=v.trimStart+elapsed;
            if(elapsed<0 || sourceTime<v.trimStart || sourceTime>=v.trimEnd || !v.buffer?.getChannelData)return false;
            const channel=v.buffer.getChannelData(0);
            const first=Math.floor(sourceTime*v.buffer.sampleRate);
            if(first>=channel.length)return false;
            const endIndex=Math.min(channel.length,first+512);
            let energy=0,found=0;
            for(let i=first;i<endIndex;i+=16){energy+=channel[i]*channel[i];found++;}
            return Math.sqrt(energy/Math.max(1,found))*v.volume>=0.016;
          });
          duck.gain.setTargetAtTime(voiceActive?activeLevel:1,startAt+offset,voiceActive?duckAttackMs/1000:duckReleaseMs/1000);
        }
      }
    }
    if(typeof context.createStereoPanner==="function"){
      const panner=context.createStereoPanner();panner.pan.value=effects.pan;
      end.connect(panner);end=panner;effectNodes.push(panner);
    }
    end.connect(masterGain);
    source.start(startAt,track.trimStart+skip,remaining);
    nodes.push({ source, gain, effectNodes });
  }
  return {
    stop() {
      for (const item of nodes) {
        try { item.source.stop(); } catch { /* finished source */ }
        try { item.source.disconnect(); } catch {}
        try { item.gain.disconnect(); } catch {}
        for(const node of item.effectNodes)try{node.disconnect();}catch{}
      }
      masterGain.disconnect();
      compressor?.disconnect();
    },
    nodes,
  };
}
export function encodePcmWav(buffer) {
  if (!buffer || !finite(buffer.sampleRate) || !finite(buffer.length))
    throw new Error("Rendered audio is invalid.");
  const channels = Math.min(2, buffer.numberOfChannels);
  if (channels < 1) throw new Error("Audio has no channels.");
  const length = buffer.length;
  const payload = length * channels * 2;
  if (!Number.isSafeInteger(payload) || payload + 44 > MAX_WAV_BYTES)
    throw new Error("Rendered audio exceeds the WAV export limit.");
  const bytes = new ArrayBuffer(44 + payload);
  const out = new DataView(bytes);
  const label = (pos, text) => [...text].forEach((c,i) => out.setUint8(pos+i,c.charCodeAt(0)));
  label(0, "RIFF"); out.setUint32(4, payload+36, true); label(8, "WAVE");
  label(12, "fmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
  out.setUint16(22, channels, true); out.setUint32(24, buffer.sampleRate, true);
  out.setUint32(28, buffer.sampleRate * channels * 2, true);
  out.setUint16(32, channels * 2, true); out.setUint16(34, 16, true);
  label(36, "data"); out.setUint32(40, payload, true);
  const arrays = Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
  let p = 44;
  for(let i=0;i<length;i++) for(let ch=0;ch<channels;ch++){
    const v = limit(arrays[ch][i] || 0,-1,1);
    out.setInt16(p,Math.round(v < 0 ? v*32768 : v*32767),true);
    p+=2;
  }
  return new Blob([bytes],{type:"audio/wav"});
}
/** OfflineAudioContext is browser-native, with no provider upload or fee. */
export async function renderMix(tracks, { sampleRate = MIX_SAMPLE_RATE, master = 0.8, duckDb = 0, compress = false, threshold = -16, ratio = 3,
  duckAttackMs = 32, duckReleaseMs = 180, duckLookaheadMs = 12 } = {}) {
  const length = mixLength(tracks);
  if (length <= 0 || length > MAX_MIX_SECONDS || sampleRate !== MIX_SAMPLE_RATE)
    throw new Error("Mix length or sample rate is unavailable.");
  const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Offline) throw new Error("Offline audio rendering is not supported on this device.");
  const context = new Offline(2, Math.ceil(length*sampleRate), sampleRate);
  scheduleMix(context,tracks,context.destination,{from:0,master,duckDb,compress,threshold,ratio,duckAttackMs,duckReleaseMs,duckLookaheadMs});
  return encodePcmWav(await context.startRendering());
}
