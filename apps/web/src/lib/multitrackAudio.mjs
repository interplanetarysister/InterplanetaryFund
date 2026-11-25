/**
 * Non-destructive audio session: all edits are clip instructions over decoded
 * source buffers. No media is sent to the server.
 */
export const MAX_AUDIO_TRACKS = 12;
export const MAX_MIX_SECONDS = 180;
export const MIX_SAMPLE_RATE = 44100;
export const MAX_WAV_BYTES = 38 * 1024 * 1024;
export const TRACK_ROLES = Object.freeze(["music", "voice", "effects"]);

const finite = value => typeof value === "number" && Number.isFinite(value);
const limit = (n, min, max) => Math.min(max, Math.max(min, n));
export function validateTrackEdit(track, sourceDuration = track?.duration) {
  if (!track || !TRACK_ROLES.includes(track.role)) throw new Error("Unsupported audio lane.");
  if (![track.start, track.trimStart, track.trimEnd, track.volume, sourceDuration].every(finite))
    throw new Error("Audio timing or level is invalid.");
  if (sourceDuration <= 0 || track.start < 0 || track.trimStart < 0 ||
    track.trimEnd > sourceDuration || track.trimStart >= track.trimEnd ||
    track.volume < 0 || track.volume > 2 || track.start + track.trimEnd - track.trimStart > MAX_MIX_SECONDS + 0.001)
    throw new Error("Audio clip timing or level is outside the supported range.");
  return true;
}
export function newAudioTrack({ id, name, role, buffer, start = 0 }) {
  if (!id || !buffer || !finite(buffer.duration) || buffer.duration <= 0)
    throw new Error("A decoded audio source is required.");
  if (!TRACK_ROLES.includes(role)) throw new Error("Unsupported audio lane.");
  const duration = Math.min(buffer.duration, MAX_MIX_SECONDS - start);
  if (duration <= 0 || !finite(start) || start < 0) throw new Error("Audio starts outside the timeline.");
  const track = { id, name: String(name || role).slice(0, 120), role,
    start, trimStart: 0, trimEnd: duration,
    volume: role === "music" ? 0.3 : role === "effects" ? 0.55 : 1,
    muted: false, solo: false, buffer };
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
export function scheduleMix(context, tracks, destination = context.destination, { from = 0, master = 0.8 } = {}) {
  if (!finite(from) || from < 0 || from > MAX_MIX_SECONDS || !finite(master) || master < 0 || master > 1)
    throw new Error("Invalid playback position or master volume.");
  mixLength(tracks);
  const masterGain = context.createGain();
  masterGain.gain.value = master;
  masterGain.connect(destination);
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
    gain.gain.value = track.volume;
    source.connect(gain);
    gain.connect(masterGain);
    source.start(context.currentTime + Math.max(0, track.start - from), track.trimStart + skip, remaining);
    nodes.push({ source, gain });
  }
  return {
    stop() {
      for (const item of nodes) {
        try { item.source.stop(); } catch { /* finished source */ }
        try { item.source.disconnect(); } catch {}
        try { item.gain.disconnect(); } catch {}
      }
      masterGain.disconnect();
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
export async function renderMix(tracks, { sampleRate = MIX_SAMPLE_RATE, master = 0.8 } = {}) {
  const length = mixLength(tracks);
  if (length <= 0 || length > MAX_MIX_SECONDS || sampleRate !== MIX_SAMPLE_RATE)
    throw new Error("Mix length or sample rate is unavailable.");
  const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Offline) throw new Error("Offline audio rendering is not supported on this device.");
  const context = new Offline(2, Math.ceil(length*sampleRate), sampleRate);
  scheduleMix(context,tracks,context.destination,{from:0,master});
  return encodePcmWav(await context.startRendering());
}
