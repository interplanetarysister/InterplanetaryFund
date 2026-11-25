import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {synthesizeBinauralSamples,BINAURAL_BEAT_PRESETS,CARRIER_TONE_CHOICES} from "../src/lib/mediaBinauralPresets.mjs";
import {AUDIO_EFFECT_DEFAULTS,newAudioTrack,scheduleMix,validateTrackEdit} from "../src/lib/multitrackAudio.mjs";
import {MASTERING_PROFILES,applyMasteringProfile} from "../src/lib/mediaPresetCollections.mjs";
import {createPlatformVariants} from "../src/lib/mediaVariantPlans.mjs";
const source=name=>readFileSync(new URL("../src/components/communications/"+name,import.meta.url),"utf8");

test("original Stitch seven mastering profiles are selectable and preserve editable stems",()=>{
 assert.equal(Object.keys(MASTERING_PROFILES).length,7);
 for(const id of ["podcast","interview","bass","lofi","cinematic","radio","reels"])
   assert.ok(MASTERING_PROFILES[id]);
 const buffer={duration:2,numberOfChannels:1,sampleRate:44100,getChannelData:()=>new Float32Array(88200)};
 const input=["voice","music","effects"].map(role=>newAudioTrack({id:role,role,buffer}));
 for(const id of Object.keys(MASTERING_PROFILES)) {
   const updated=applyMasteringProfile(input,id);
   assert.equal(updated.length,3);
   for(const track of updated) assert.equal(validateTrackEdit(track),true);
 }
});
test("stereo tone plus pink masking has bounded levels with distinct ear channels",()=>{
 const result=synthesizeBinauralSamples({seconds:0.5,sampleRate:44100,carrierHz:528,deltaHz:6,pinkRatio:0.35});
 assert.equal(result.left.length,22050);
 assert.equal(result.right.length,22050);
 assert.notDeepEqual(result.left,result.right);
 for(const channel of [result.left,result.right])
   for(const value of channel)assert.ok(Number.isFinite(value)&&Math.abs(value)<0.26);
 assert.equal(BINAURAL_BEAT_PRESETS.find(p=>p.id==="theta").deltaHz,6);
 assert.ok(CARRIER_TONE_CHOICES.includes(528));
 for(const options of [{carrierHz:-1},{deltaHz:80},{pinkRatio:1.1},{seconds:181}])
   assert.throws(()=>synthesizeBinauralSamples(options),/supported safety bounds/);
});
test("voice energy gates music ducking and optional dynamics compression",()=>{
 const signal=Float32Array.from({length:44100},(_,i)=>i<22050?0.08:0);
 const buffer={duration:1,sampleRate:44100,numberOfChannels:1,getChannelData:()=>signal};
 const tracks=[
   newAudioTrack({id:"voice",role:"voice",buffer}),
   newAudioTrack({id:"music",role:"music",buffer}),
 ];
 const filters=[],targetGains=[],compressors=[];
 const context={
  sampleRate:44100,currentTime:0,destination:{},
  createGain:()=>({gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(v){targetGains.push(v);}},connect(){},disconnect(){}}),
  createBufferSource:()=>({connect(){},disconnect(){},start(){},stop(){}}),
  createBiquadFilter:()=>({frequency:{value:0},gain:{value:0},Q:{value:0},set type(v){filters.push(v);},connect(){},disconnect(){}}),
  createStereoPanner:()=>({pan:{value:0},connect(){},disconnect(){}}),
  createDynamicsCompressor:()=>{compressors.push(true);return {threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(){},disconnect(){}};},
 };
 const output=scheduleMix(context,tracks,context.destination,{duckDb:-6,compress:true,duckAttackMs:32,duckReleaseMs:180,duckLookaheadMs:12});
 assert.equal(output.nodes.length,2);
 assert.equal(filters.filter(v=>v==="peaking").length,4);
 assert.ok(targetGains.some(v=>v<1));
 assert.ok(targetGains.some(v=>v===1));
 assert.equal(compressors.length,1);
 output.stop();
 assert.throws(()=>scheduleMix(context,tracks,context.destination,{duckDb:-30}),/Invalid playback/);
 assert.throws(()=>validateTrackEdit({...tracks[0],effects:{...AUDIO_EFFECT_DEFAULTS,speechCarveQ:7}}),/outside/);
});
test("Stitch audio and video controls remain tabs and previews, not fabricated provider outcomes",()=>{
 const audio=source("MultitrackAudioEditor.jsx");
 const video=source("PlatformVariantEditor.jsx");
 const optimizer=source("PrePostMediaOptimizer.jsx");
 for(const s of ["Studio mastering profiles","Master dynamics compressor","Speech masking carve","stereo binaural tones","duckAttackMs","duckReleaseMs","duckLookaheadMs","A/B bypass"])
   assert.ok(audio.toLowerCase().includes(s.toLowerCase()),s);
 for(const s of ["Display approximate platform UI safe areas","Preview clip in","Preview clip out","Video and image look presets","Interest peak / breakdown timing"])
   assert.ok(video.includes(s),s);
 assert.match(optimizer,/PlatformVariantEditor/);
 assert.match(audio,/not measured LUFS/i);
 assert.match(video,/no video has been transcoded/);
 const t=createPlatformVariants(["tiktok"],{tiktok:{trimStart:2,trimEnd:10,showSafeZone:true}});
 assert.equal(t[0].trimStart,2);
 assert.equal(t[0].showSafeZone,true);
});
