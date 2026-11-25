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
  return Object.fromEntries(Object.entries(preset.effects).map(([key,value])=>
    [key,key==="fadeIn" || key==="fadeOut"?Math.min(value,duration):value]));
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
