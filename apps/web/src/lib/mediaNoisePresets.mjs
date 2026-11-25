/**
 * Local, original synthesized sound textures. Pink noise approximates a 1/f
 * power spectrum; it is NOT a single "pink frequency", a therapeutic signal,
 * or evidence that a listener will remember or engage more.
 */
export const SOUND_PRESETS = Object.freeze([
  {id:"pink", label:"Pink noise", description:"Balanced spectral-noise texture with lower-frequency emphasis"},
  {id:"white", label:"White noise", description:"Broadband, approximately equal-power-per-Hz texture"},
  {id:"brown", label:"Brown noise", description:"Slowly varying noise, stronger low-frequency emphasis"},
  {id:"tone", label:"Sine tone", description:"Pure adjustable frequency for an effect or a reference tone"},
]);
export const PRESET_SECONDS = 30;
export const MAX_PRESET_SECONDS = 60;
export const PRESET_RATE = 44100;
export function validPreset(id) { return SOUND_PRESETS.some(p=>p.id===id); }
function seededRandom(seed) {
  let state=(seed >>> 0)||0x742f819b;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state>>>0)/4294967296 * 2-1;
  };
}
export function synthesizeSoundSamples({preset="pink",seconds=PRESET_SECONDS,sampleRate=PRESET_RATE,frequency=440,seed=0x4a7d31a5}={}) {
  if (!validPreset(preset) || !Number.isFinite(seconds) || seconds<=0 || seconds>MAX_PRESET_SECONDS ||
      !Number.isInteger(sampleRate) || sampleRate<8000 || sampleRate>48000 ||
      !Number.isFinite(frequency) || frequency<40 || frequency>4000 || frequency>=sampleRate/2)
    throw Error("Sound preset parameters are outside the supported range.");
  const frames=Math.floor(seconds*sampleRate);
  const output=new Float32Array(frames);
  const random=seededRandom(seed);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  let brown=0;
  let peak=0;
  for(let i=0;i<frames;i++){
    const w=random();
    let v=0;
    if(preset==="white") v=w;
    if(preset==="brown"){
      brown=(brown+0.02*w)/1.02;
      v=brown*3.5;
    }
    if(preset==="pink"){
      // Paul Kellet's pinking filter, normalized after synthesis.
      b0=0.99886*b0+w*0.0555179;
      b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520;
      b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522;
      b5=-0.7616*b5-w*0.0168980;
      v=b0+b1+b2+b3+b4+b5+b6+w*0.5362;
      b6=w*0.115926;
    }
    if(preset==="tone") v=Math.sin(2*Math.PI*frequency*i/sampleRate);
    output[i]=v;
    peak=Math.max(peak,Math.abs(v));
  }
  // Internal -12 dBFS peak ceiling leaves headroom for stacked audio lanes.
  const gain=peak>0 ? 0.25/peak : 0;
  for(let i=0;i<frames;i++)output[i]*=gain;
  return output;
}
export function makeSoundPresetBuffer(context,opts={}) {
  if(!context || typeof context.createBuffer!=="function")throw Error("Audio context is unavailable.");
  const sampleRate=context.sampleRate;
  const samples=synthesizeSoundSamples({...opts,sampleRate});
  const buffer=context.createBuffer(1,samples.length,sampleRate);
  buffer.copyToChannel(samples,0);
  return buffer;
}
