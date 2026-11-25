import { AUDIO_EFFECT_DEFAULTS } from "./multitrackAudio.mjs";
/** Non-destructive editing presets. Names describe sound or appearance, not verified engagement results. */
export const AUDIO_MIX_PRESETS=Object.freeze({
  neutral:{ label:"Neutral", effects:{lowGain:0,midGain:0,highGain:0,highpass:20,lowpass:18000,pan:0,fadeIn:0,fadeOut:0}},
  voice:{label:"Speech clarity",effects:{lowGain:-3,midGain:2,highGain:1,highpass:85,lowpass:14000,pan:0,fadeIn:0.08,fadeOut:0.12}},
  warm:{label:"Warm music bed",effects:{lowGain:2,midGain:-2,highGain:-1,highpass:35,lowpass:14000,pan:0,fadeIn:0.5,fadeOut:1}},
  soft:{label:"Soft background",effects:{lowGain:-2,midGain:-3,highGain:-4,highpass:50,lowpass:8500,pan:0,fadeIn:1,fadeOut:1}},
  crisp:{label:"Crisp sound effect",effects:{lowGain:-1,midGain:2,highGain:3,highpass:90,lowpass:16000,pan:0,fadeIn:0.02,fadeOut:0.1}},
});
export function chooseAudioPreset(name, duration) {
  const preset=AUDIO_MIX_PRESETS[name];
  if(!preset || !Number.isFinite(duration) || duration<=0)throw Error("Unknown preset or invalid audio clip length.");
  return {...AUDIO_EFFECT_DEFAULTS,...Object.fromEntries(Object.entries(preset.effects).map(([key,value])=>
    [key,key==="fadeIn" || key==="fadeOut"?Math.min(value,duration):value])),
    ...(name==="soft" ? {speechCarveDb:-3.2} : {})};
}
export const VIDEO_LOOK_PRESETS=Object.freeze({
  natural:{label:"Natural",brightness:1,contrast:1,saturation:1},
  vivid:{label:"Vivid",brightness:1.03,contrast:1.15,saturation:1.2},
  soft:{label:"Soft light",brightness:1.08,contrast:0.9,saturation:0.9},
  accessible:{label:"Clear contrast",brightness:1,contrast:1.25,saturation:1},
  muted:{label:"Muted",brightness:0.98,contrast:0.95,saturation:0.7},
});
export function chooseVideoLook(name) {
  const preset=VIDEO_LOOK_PRESETS[name];
  if(!preset)throw Error("Unknown video appearance preset.");
  return {brightness:preset.brightness,contrast:preset.contrast,saturation:preset.saturation};
}

/**
 * The seven reference profiles from Stitch's Audio & Voice Studio.
 * LUFS numbers are editable targets only. No BS.1770 integrated loudness
 * measurement, true-peak limiter, AI stem separation or neural mastering is
 * claimed by choosing a profile.
 */
export const MASTERING_PROFILES=Object.freeze({
  podcast: {label:"Warm Podcast Host",category:"Podcast & Interviews",targetLufs:-16,voice:"voice",music:"soft",effects:"neutral",duckDb:-5},
  interview: {label:"Two-Host Dialogue / Interview",category:"Podcast & Interviews",targetLufs:-16,voice:"voice",music:"soft",effects:"neutral",duckDb:-6},
  bass: {label:"Bass Boost & Punchy Beat",category:"Music & Beats",targetLufs:-14,voice:"neutral",music:"warm",effects:"crisp",duckDb:-3},
  lofi: {label:"Acoustic & Lo-Fi Chill",category:"Music & Beats",targetLufs:-15,voice:"warm",music:"soft",effects:"soft",duckDb:-3},
  cinematic: {label:"Cinematic Narrative & Storytelling",category:"Voiceover / Audio Drama",targetLufs:-18,voice:"warm",music:"soft",effects:"crisp",duckDb:-8},
  radio: {label:"Radio Drama & Multi-Cast Voice",category:"Voiceover / Audio Drama",targetLufs:-16,voice:"voice",music:"soft",effects:"crisp",duckDb:-6},
  reels: {label:"Crystal Clear Voice (TikTok & Reels)",category:"Social Video & Reels",targetLufs:-14,voice:"voice",music:"soft",effects:"crisp",duckDb:-6},
});
export function applyMasteringProfile(tracks,profileId) {
  const profile=MASTERING_PROFILES[profileId];
  if(!profile)throw Error("Unknown mastering profile.");
  return tracks.map(track=>{
    const preset=track.role==="voice"?profile.voice:track.role==="music"?profile.music:track.role==="effects"?profile.effects:"neutral";
    return {...track,effects:chooseAudioPreset(preset,track.trimEnd-track.trimStart)};
  });
}

/** User-downloadable audio settings only; no embedded track audio or source labels. */
export function exportAudioSettings({tracks=[],masterProfile="none",duckDb=0,duckAttackMs=32,duckReleaseMs=180,
  duckLookaheadMs=12,compressionEnabled=false,compressionThreshold=-16,compressionRatio=3}={}) {
  if (!Array.isArray(tracks) || tracks.length>12 || !Number.isFinite(duckDb) || duckDb< -18 || duckDb>0 ||
    ![duckAttackMs,duckReleaseMs,duckLookaheadMs,compressionThreshold,compressionRatio].every(Number.isFinite) ||
    duckAttackMs<5 || duckAttackMs>200 || duckReleaseMs<50 || duckReleaseMs>1000 ||
    duckLookaheadMs<0 || duckLookaheadMs>50 || compressionThreshold< -36 || compressionThreshold> -6 ||
    compressionRatio<1 || compressionRatio>8)
    throw Error("Audio preset settings are invalid.");
  const roles={};
  for(const track of tracks){
    const list=roles[track.role]||[];
    if(list.length>12)throw Error("Too many lane settings.");
    list.push({volume:track.volume,effects:{...AUDIO_EFFECT_DEFAULTS,...track.effects}});
    roles[track.role]=list;
  }
  return JSON.stringify({
    schema:"ifund-audio-dsp-v1",masterProfile,duckDb,duckAttackMs,duckReleaseMs,
    duckLookaheadMs,compressionEnabled,compressionThreshold,compressionRatio,roles,
    note:"Settings only: no audio data, rights, actual loudness measurements or provider authorizations.",
  },null,2);
}
export function parseAudioSettings(json, tracks=[]) {
  if(typeof json!=="string"||json.length>12000)throw Error("Audio preset file is too large.");
  let data;
  try{data=JSON.parse(json);}catch{throw Error("Audio preset JSON could not be read.");}
  if(data?.schema!=="ifund-audio-dsp-v1" || !data.roles || typeof data.roles!=="object" ||
    !Array.isArray(tracks)) throw Error("This is not a supported iFund audio preset.");
  const canonical=exportAudioSettings({...data,tracks:[]});
  if(!canonical)throw Error("Audio preset validation failed.");
  const roleCounts={};
  const restored=tracks.map(track=>{
    const i=roleCounts[track.role]||0;roleCounts[track.role]=i+1;
    const stored=data.roles[track.role]?.[i];
    if(!stored)return track;
    if(typeof stored!=="object"||!Number.isFinite(stored.volume) ||
      stored.volume<0||stored.volume>2 || !stored.effects || typeof stored.effects!=="object")
      throw Error("Invalid lane settings.");
    const effects={...AUDIO_EFFECT_DEFAULTS,...stored.effects};
    if(Object.keys(effects).some(k=>!Object.hasOwn(AUDIO_EFFECT_DEFAULTS,k)))
      throw Error("Unknown audio effect.");
    const next={...track,volume:stored.volume,effects};
    // Validate track timing and effects together; invalid snapshots fail closed.
    if(!Number.isFinite(track.buffer?.duration))throw Error("Audio source is unavailable.");
    if(!Object.keys(effects).every(key=>Number.isFinite(effects[key])))
      throw Error("Invalid audio effects.");
    return next;
  });
  return {settings:{
    masterProfile:typeof data.masterProfile==="string"&&MASTERING_PROFILES[data.masterProfile] ? data.masterProfile:"none",
    duckDb:data.duckDb,duckAttackMs:data.duckAttackMs,duckReleaseMs:data.duckReleaseMs,
    duckLookaheadMs:data.duckLookaheadMs,compressionEnabled:data.compressionEnabled===true,
    compressionThreshold:data.compressionThreshold,compressionRatio:data.compressionRatio,
  },tracks:restored};
}
