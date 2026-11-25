import test from "node:test";
import assert from "node:assert/strict";
import { audibleTracks, encodePcmWav, MAX_AUDIO_TRACKS, MAX_MIX_SECONDS, mixLength, newAudioTrack, scheduleMix, validateTrackEdit } from "../src/lib/multitrackAudio.mjs";
import { readFileSync } from "node:fs";

const buffer = (duration=4) => ({
  duration, sampleRate: 1000, length: Math.floor(duration*1000), numberOfChannels: 1,
  getChannelData: () => new Float32Array(Math.floor(duration*1000)),
});
const music = () => newAudioTrack({id:"music",name:"Bed music",role:"music",buffer:buffer(4)});

test("separate audio lanes have safe default gains and preserve source buffers", () => {
  const first = music();
  const voice = newAudioTrack({id:"voice",name:"Narration",role:"voice",buffer:buffer(2),start:1});
  const fx = newAudioTrack({id:"fx",name:"Whoosh",role:"effects",buffer:buffer(1),start:3});
  assert.equal(first.volume,0.3);
  assert.equal(voice.volume,1);
  assert.equal(fx.volume,0.55);
  assert.equal(first.buffer.duration,4);
  assert.equal(mixLength([first,voice,fx]),4);
});

test("muting, solo selection, and out of range edits fail safely", () => {
  const first = music();
  const voice = newAudioTrack({id:"voice",name:"Narration",role:"voice",buffer:buffer(2)});
  assert.deepEqual(audibleTracks([first,voice]).map(t=>t.id),["music","voice"]);
  assert.deepEqual(audibleTracks([{...first,muted:true},{...voice,solo:true}]).map(t=>t.id),["voice"]);
  assert.throws(()=>validateTrackEdit({...first,volume:5}),/outside/);
  assert.throws(()=>validateTrackEdit({...first,start:MAX_MIX_SECONDS}),/outside/);
  assert.throws(()=>validateTrackEdit({...first,trimEnd:0}),/outside/);
  assert.throws(()=>mixLength(Array.from({length:MAX_AUDIO_TRACKS+1},(_,i)=>({...first,id:String(i)}))),/Too many/);
});

test("mix playback schedules lane start, offset and level separately", () => {
  const starts = [];
  const fake = {
    currentTime: 10, destination:{},
    createGain:()=>({gain:{value:0},connect(){},disconnect(){}}),
    createBufferSource:()=>({
      connect(){},disconnect(){},stop(){},
      start(...args){starts.push(args);},
    }),
  };
  const first = music();
  const voice = newAudioTrack({id:"voice",name:"Narration",role:"voice",buffer:buffer(2),start:2});
  const scheduled=scheduleMix(fake,[first,voice],fake.destination,{from:1,master:0.5});
  assert.deepEqual(starts,[[10,1,3],[11,0,2]]);
  scheduled.stop();
});

test("WAV bytes contain valid RIFF and stereo/channel payload sizes", async () => {
  const signal = {
    sampleRate:1000,length:100,numberOfChannels:2,
    getChannelData:channel=>Float32Array.from({length:100},(_,i)=>channel?0.5:-0.5),
  };
  const blob=encodePcmWav(signal);
  assert.equal(blob.type,"audio/wav");
  assert.equal(blob.size,44+100*2*2);
  const data=new DataView(await blob.arrayBuffer());
  assert.equal(data.getUint32(0,true),0x46464952);
  assert.equal(data.getUint16(22,true),2);
  assert.equal(data.getUint32(24,true),1000);
});

test("audio interface keeps stacked tracks and microphone option in the same Media workspace", () => {
  const c=readFileSync(new URL("../src/components/communications/MultitrackAudioEditor.jsx",import.meta.url),"utf8");
  const nav=readFileSync(new URL("../src/components/communications/CreatorMediaTools.jsx",import.meta.url),"utf8");
  for (const marker of ["roleNames", "music", "voice", "effects", "MediaRecorder", "getUserMedia", "playBacking", "scheduleMix", "renderMix"])
    assert.ok(c.includes(marker), "missing "+marker);
  assert.match(c,/stop recording/i);
  assert.match(nav,/<MultitrackAudioEditor/);
  assert.doesNotMatch(c,/\/api\/.*upload|publishPost\(/);
});
