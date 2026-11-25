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
