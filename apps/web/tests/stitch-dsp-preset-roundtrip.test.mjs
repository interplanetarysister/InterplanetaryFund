import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {AUDIO_EFFECT_DEFAULTS,newAudioTrack,validateTrackEdit} from "../src/lib/multitrackAudio.mjs";
import {exportAudioSettings,parseAudioSettings,MASTERING_PROFILES} from "../src/lib/mediaPresetCollections.mjs";
const fixture={duration:3,sampleRate:44100,length:132300,numberOfChannels:1,getChannelData:()=>new Float32Array(132300)};
const make=role=>newAudioTrack({id:role,role,buffer:fixture});

test("custom per-lane audio preset exports no source bytes, file names, or uploaded media",()=>{
 const original=[make("voice"),make("music")];
 original[1].volume=.22;original[1].effects={...AUDIO_EFFECT_DEFAULTS,speechCarveDb:-3.2,lowGain:-2};
 const json=exportAudioSettings({tracks:original,masterProfile:"reels",duckDb:-6,
   duckAttackMs:32,duckReleaseMs:180,duckLookaheadMs:12,
   compressionEnabled:true,compressionThreshold:-16,compressionRatio:3});
 assert.ok(json.length<12000);
 assert.match(json,/ifund-audio-dsp-v1/);
 assert.doesNotMatch(json,/ArrayBuffer|base64|data:audio|source_audio/);
 const restored=parseAudioSettings(json,[make("voice"),make("music")]);
 assert.equal(restored.settings.duckDb,-6);
 assert.equal(restored.settings.compressionEnabled,true);
 assert.equal(restored.tracks[1].volume,.22);
 assert.equal(restored.tracks[1].effects.speechCarveDb,-3.2);
 for(const track of restored.tracks)assert.equal(validateTrackEdit(track),true);
});
test("imported presets cannot bypass audio effect, gain, or DSP bounds",()=>{
 const base=JSON.parse(exportAudioSettings({tracks:[make("voice")]}));
 for(const [section,change] of [
  ["gain",b=>b.roles.voice[0].volume=100],
  ["unknown filter",b=>b.roles.voice[0].effects.injected_secret=4],
  ["invalid carve",b=>b.roles.voice[0].effects.speechCarveQ=100],
  ["invalid compression",b=>b.compressionRatio=50],
  ["invalid duck",b=>b.duckDb=-70],
 ]) {
   const altered=structuredClone(base);change(altered);
   assert.throws(()=>parseAudioSettings(JSON.stringify(altered),[make("voice")]),undefined,section);
 }
 assert.throws(()=>parseAudioSettings("{bad json",[make("voice")]),/could not be read/);
 assert.throws(()=>parseAudioSettings(JSON.stringify({...base,schema:"foreign"}),[make("voice")]),/not a supported/);
});
test("Stitch seven master profiles and channel waveforms are available without publishing",()=>{
 assert.equal(Object.keys(MASTERING_PROFILES).length,7);
 const editor=readFileSync(new URL("../src/components/communications/MultitrackAudioEditor.jsx",import.meta.url),"utf8");
 const waveform=readFileSync(new URL("../src/components/communications/AudioTrackWaveform.jsx",import.meta.url),"utf8");
 for(const name of ["Export DSP preset (.json)","Import a saved iFund DSP preset","<AudioTrackWaveform","Master dynamics compressor","Pink-noise blend"])
   assert.ok(editor.toLowerCase().includes(name.toLowerCase()),name);
 assert.match(waveform,/getChannelData/);
 assert.doesNotMatch(editor,/\/api\/.*post|\/api\/.*upload/);
});
