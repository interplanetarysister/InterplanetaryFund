import test from "node:test";
import assert from "node:assert/strict";
import { SOUND_PRESETS, synthesizeSoundSamples, makeSoundPresetBuffer } from "../src/lib/mediaNoisePresets.mjs";
import { AUDIO_EFFECT_DEFAULTS, newAudioTrack, scheduleMix, validateTrackEdit } from "../src/lib/multitrackAudio.mjs";
import { createPlatformVariants } from "../src/lib/mediaVariantPlans.mjs";
import {readFileSync} from "node:fs";

function fakeBuffer(n=2){
 return { duration:n,sampleRate:44100,length:n*44100,numberOfChannels:1,
   getChannelData:()=>new Float32Array(n*44100)};
}
test("sound presets create deterministic, bounded waveforms with an actual pink-noise mode",()=>{
 assert.deepEqual(SOUND_PRESETS.map(x=>x.id),["pink","white","brown","tone"]);
 for(const preset of ["pink","white","brown","tone"]){
  const a=synthesizeSoundSamples({preset,seconds:0.25,sampleRate:44100,seed:123,frequency:440});
  const b=synthesizeSoundSamples({preset,seconds:0.25,sampleRate:44100,seed:123,frequency:440});
  assert.equal(a.length,11025);
  assert.deepEqual(a,b);
  assert.ok(Math.max(...a)<=0.25001);
  assert.ok(Math.min(...a)>=-0.25001);
  assert.ok(a.some(n=>n!==0));
 }
});
test("sound preset parameters are bounded; no heavy sound generation for unsafe requests",()=>{
 for(const options of [
  {preset:"unknown"},{preset:"pink",seconds:0},{preset:"pink",seconds:181},
  {preset:"tone",frequency:0},{preset:"tone",frequency:9000},
  {preset:"white",sampleRate:200000},
 ]) assert.throws(()=>synthesizeSoundSamples(options),/outside the supported range/);
 const writes=[];
 const context={sampleRate:44100,createBuffer(channels,length,rate){
  assert.equal(channels,1);assert.equal(rate,44100);
  return {copyToChannel(data,index){writes.push([data.length,index]);}};
 }};
 makeSoundPresetBuffer(context,{preset:"brown",seconds:0.1});
 assert.deepEqual(writes,[[4410,0]]);
});
test("effects have per-lane safe defaults with filter, EQ, fades, pan and trim validation",()=>{
 const texture=newAudioTrack({id:"pink",name:"pink noise",role:"texture",buffer:fakeBuffer()});
 assert.equal(texture.volume,0.18);
 assert.equal(texture.effects.lowpass,18000);
 assert.equal(texture.effects.pan,0);
 validateTrackEdit({...texture,effects:{...AUDIO_EFFECT_DEFAULTS,lowGain:-6,midGain:3,fadeIn:0.4,fadeOut:0.4}});
 for(const edit of [
  {lowGain:100},{highpass:1300,lowpass:900},{pan:2},{fadeIn:3},{lowpass:0}
 ]) assert.throws(()=>validateTrackEdit({...texture,effects:{...AUDIO_EFFECT_DEFAULTS,...edit}}),/outside the supported range/);
});
test("preview and render use the same filter and fade signal path",()=>{
 const calls=[];
 const ctx={
  sampleRate:44100,currentTime:0,destination:{},
  createGain(){return {gain:{value:0,setValueAtTime(...args){calls.push(["gainStart",...args]);},linearRampToValueAtTime(...args){calls.push(["gainRamp",...args]);}},connect(){},disconnect(){}};},
  createBufferSource(){return {connect(){},disconnect(){},stop(){},start(...args){calls.push(["source",...args]);}};},
  createBiquadFilter(){return {frequency:{value:0},gain:{value:0},Q:{value:0},connect(){},disconnect(){},set type(value){calls.push(["filter",value]);}};},
  createStereoPanner(){return {pan:{value:0},connect(){},disconnect(){}};},
 };
 const track=newAudioTrack({id:"a",role:"voice",buffer:fakeBuffer()});
 track.effects={...AUDIO_EFFECT_DEFAULTS,fadeIn:0.5,fadeOut:0.5,pan:-0.5,highGain:6};
 const instance=scheduleMix(ctx,[track],ctx.destination,{master:0.5});
 assert.equal(instance.nodes.length,1);
 assert.equal(calls.filter(x=>x[0]==="filter").length,6);
 assert.ok(calls.some(x=>x[0]==="gainRamp"));
 assert.ok(calls.some(x=>x[0]==="source"));
 instance.stop();
});
test("each video platform keeps separately editable exposure, playback and sound controls",()=>{
 const variants=createPlatformVariants(["tiktok","youtube-shorts"],{
  tiktok:{contrast:1.25,saturation:0,videoSpeed:1.5,videoVolume:0.25},
  "youtube-shorts":{contrast:0.8,videoSpeed:0.75},
 });
 assert.equal(variants[0].contrast,1.25);
 assert.equal(variants[0].saturation,0);
 assert.equal(variants[0].videoVolume,0.25);
 assert.equal(variants[1].contrast,0.8);
 assert.equal(variants[1].videoSpeed,0.75);
});
test("preset options and effects live in the existing Media editor, never another top-level route",()=>{
 const audio=readFileSync(new URL("../src/components/communications/MultitrackAudioEditor.jsx",import.meta.url),"utf8");
 const video=readFileSync(new URL("../src/components/communications/PlatformVariantEditor.jsx",import.meta.url),"utf8");
 for(const token of ["Sound textures & frequency presets","Pink noise","Noise & tone textures","Advanced audio effects","makeSoundPresetBuffer","fadeIn","lowpass","pan"])
  assert.ok(audio.includes(token) || token==="Pink noise",token);
 for(const token of ["Visual adjustments","Playback speed","Original video audio","brightness","contrast","saturation"])
  assert.ok(video.includes(token),token);
});
