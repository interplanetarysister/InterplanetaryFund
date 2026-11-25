import { synthesizeSoundSamples } from "./mediaNoisePresets.mjs";

// Names describe beat rates, not clinically established states or outcomes.
// Stereo headphones are needed to hear the ear-to-ear difference as intended.
export const BINAURAL_BEAT_PRESETS=Object.freeze([
  {id:"delta",label:"Delta-rate difference",deltaHz:2.5},
  {id:"theta",label:"Theta-rate difference",deltaHz:6},
  {id:"schumann",label:"7.83 Hz difference",deltaHz:7.83},
  {id:"alpha",label:"Alpha-rate difference",deltaHz:10},
  {id:"beta",label:"Beta-rate difference",deltaHz:18},
]);
export const CARRIER_TONE_CHOICES=Object.freeze([432,528,639,741,852]);
export function synthesizeBinauralSamples({seconds=30,sampleRate=44100,carrierHz=528,deltaHz=6,pinkRatio=0.35,seed=0x8fb34621}={}) {
  if (!Number.isFinite(seconds) || seconds<=0 || seconds>180 ||
    !Number.isInteger(sampleRate) || sampleRate<8000 || sampleRate>48000 ||
    !Number.isFinite(carrierHz) || carrierHz<40 || carrierHz>4000 ||
    !Number.isFinite(deltaHz) || deltaHz<0 || deltaHz>40 ||
    !Number.isFinite(pinkRatio) || pinkRatio<0 || pinkRatio>1 ||
    carrierHz+deltaHz >= sampleRate/2)
    throw Error("Binaural sound settings exceed supported safety bounds.");
  const length=Math.floor(seconds*sampleRate);
  const left=new Float32Array(length),right=new Float32Array(length);
  const noise=pinkRatio>0?synthesizeSoundSamples({preset:"pink",seconds,sampleRate,seed}):null;
  const toneGain=0.18*(1-pinkRatio);
  const noiseGain=0.24*pinkRatio;
  for(let i=0;i<length;i++){
    const t=i/sampleRate;
    const mask=noise?noise[i]*noiseGain:0;
    left[i]=toneGain*Math.sin(2*Math.PI*carrierHz*t)+mask;
    right[i]=toneGain*Math.sin(2*Math.PI*(carrierHz+deltaHz)*t)+mask;
  }
  return {left,right};
}
export function makeBinauralBuffer(context,opts={}) {
  if (!context || !context.sampleRate || typeof context.createBuffer!=="function")
    throw Error("Audio context unavailable.");
  const {left,right}=synthesizeBinauralSamples({...opts,sampleRate:context.sampleRate});
  const buffer=context.createBuffer(2,left.length,context.sampleRate);
  buffer.copyToChannel(left,0);buffer.copyToChannel(right,1);
  return buffer;
}
