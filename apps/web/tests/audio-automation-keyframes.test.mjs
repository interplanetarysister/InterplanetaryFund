import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_AUTOMATION_POINTS, appendAutomationPoint, automationGainAt, newAudioTrack,
  scheduleMix, validateTrackEdit,
} from "../src/lib/multitrackAudio.mjs";
import {exportAudioSettings,parseAudioSettings} from "../src/lib/mediaPresetCollections.mjs";

const buffer={duration:4,sampleRate:44100,numberOfChannels:1,
  getChannelData:()=>new Float32Array(176400)};
const track=()=>newAudioTrack({id:"music",role:"music",buffer});
test("volume keyframes validate timestamps and reject duplicates or unsafe gains",()=>{
 const t=track();
 t.automation=[{time:0,gain:0},{time:2,gain:1.5},{time:4,gain:1}];
 assert.equal(validateTrackEdit(t),true);
 assert.equal(automationGainAt(t.automation,1),0.75);
 assert.equal(automationGainAt(t.automation,3),1.25);
 assert.equal(automationGainAt(t.automation,5),1);
 const added=appendAutomationPoint(t.automation,4);
 assert.equal(added.length,4);
 assert.ok(added.every((point,index)=>index===0 || point.time>added[index-1].time));
 for(const invalid of [
  [{time:1,gain:1},{time:1,gain:0.5}],
  [{time:5,gain:1}], [{time:1,gain:3}], [{time:-1,gain:1}],
  Array.from({length:MAX_AUTOMATION_POINTS+1},(_,i)=>({time:i/10,gain:1})),
 ])
  assert.throws(()=>validateTrackEdit({...t,automation:invalid}),/automation/);
});
test("automation playback schedules relative gain at original and skipped positions",()=>{
 const t=track();
 t.automation=[{time:0,gain:0},{time:2,gain:1.5},{time:4,gain:1}];
 const events=[];
 const ctx={currentTime:10,sampleRate:44100,destination:{},
  createGain:()=>({gain:{value:1,setValueAtTime:(v,at)=>events.push(["set",v,at]),
   linearRampToValueAtTime:(v,at)=>events.push(["ramp",v,at])},connect(){},disconnect(){}}),
  createBufferSource:()=>({connect(){},start(){},stop(){},disconnect(){}}),
  createBiquadFilter:()=>({frequency:{value:0},gain:{value:0},Q:{value:0},connect(){},disconnect(){}}),
  createStereoPanner:()=>({pan:{value:0},connect(){},disconnect(){}}),
 };
 const output=scheduleMix(ctx,[t],ctx.destination,{from:1});
 output.stop();
 assert.ok(events.some(([kind,gain,time])=>kind==="set"&&gain===0.75&&time===10));
 assert.ok(events.some(([kind,gain,time])=>kind==="ramp"&&gain===1.5&&time===11));
 assert.ok(events.some(([kind,gain,time])=>kind==="ramp"&&gain===1&&time===13));
});
test("audio preset JSON preserves validated keyframes without original media bytes",()=>{
 const a=track();
 a.automation=[{time:0,gain:0},{time:1,gain:1},{time:4,gain:0.2}];
 const json=exportAudioSettings({tracks:[a]});
 assert.doesNotMatch(json,/ArrayBuffer|base64|source_audio/);
 const imported=parseAudioSettings(json,[track()]);
 assert.deepEqual(imported.tracks[0].automation,a.automation);
 const tampered=JSON.parse(json);
 tampered.roles.music[0].automation[1].gain=15;
 assert.throws(()=>parseAudioSettings(JSON.stringify(tampered),[track()]),/automation/);
});
test("Creator Media displays and edits volume keyframes inside existing music lanes",()=>{
 const ui=readFileSync(new URL("../src/components/communications/MultitrackAudioEditor.jsx",import.meta.url),"utf8");
 assert.match(ui,/Timeline volume keyframes/);
 assert.match(ui,/Add volume keyframe/);
 assert.match(ui,/editVolumePoint/);
 assert.match(ui,/Reset keyframes/);
 assert.doesNotMatch(ui,/\.rpc\(.*publish/);
});
