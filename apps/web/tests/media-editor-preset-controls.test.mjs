import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { synthesizeSoundSamples, SOUND_PRESETS } from "../src/lib/mediaNoisePresets.mjs";
import { AUDIO_MIX_PRESETS, VIDEO_LOOK_PRESETS, chooseAudioPreset, chooseVideoLook } from "../src/lib/mediaPresetCollections.mjs";
import { AUDIO_EFFECT_DEFAULTS, newAudioTrack, validateTrackEdit } from "../src/lib/multitrackAudio.mjs";
const read = relative => readFileSync(new URL("../src/" + relative, import.meta.url), "utf8");
const fakeBuffer = () => ({duration:3,length:132300,sampleRate:44100,numberOfChannels:1,getChannelData(){return new Float32Array(132300);}});

test("pink, white, brown and sine tone are synthesized locally with limited amplitude", () => {
  assert.deepEqual(SOUND_PRESETS.map(x=>x.id), ["pink","white","brown","tone"]);
  for (const preset of SOUND_PRESETS) {
    const samples = synthesizeSoundSamples({preset:preset.id, seconds:0.5,sampleRate:44100});
    assert.equal(samples.length,22050);
    let max=0, sum=0;
    for(const sample of samples){
      assert.ok(Number.isFinite(sample));
      max=Math.max(max,Math.abs(sample));sum+=sample*sample;
    }
    assert.ok(max<=0.250001, "peak safety bound");
    assert.ok(sum>0, "nonempty signal");
  }
  assert.throws(()=>synthesizeSoundSamples({preset:"pink",seconds:181}),/outside the supported range/);
  assert.throws(()=>synthesizeSoundSamples({preset:"tone",frequency:0}),/outside the supported range/);
});

test("one-click mix presets retain editable per-track EQ, filters, pan and fades", () => {
  assert.deepEqual(Object.keys(AUDIO_MIX_PRESETS),["neutral","voice","warm","soft","crisp"]);
  const track=newAudioTrack({id:"sound",role:"voice",name:"spoken",buffer:fakeBuffer()});
  for(const name of Object.keys(AUDIO_MIX_PRESETS)){
    const fx=chooseAudioPreset(name,track.trimEnd-track.trimStart);
    assert.equal(validateTrackEdit({...track,effects:fx}),true);
  }
  assert.deepEqual(chooseAudioPreset("neutral",3),{...AUDIO_EFFECT_DEFAULTS});
  assert.ok(chooseAudioPreset("soft",3).fadeIn>0);
  assert.throws(()=>chooseAudioPreset("unknown",3),/Unknown preset/);
  assert.throws(()=>chooseAudioPreset("voice",0),/Unknown preset/);
});

test("video looks produce bounded, independent editable settings",()=>{
  assert.deepEqual(Object.keys(VIDEO_LOOK_PRESETS),["natural","vivid","soft","accessible","muted"]);
  for(const id of Object.keys(VIDEO_LOOK_PRESETS)){
    const look=chooseVideoLook(id);
    assert.ok(look.brightness>=0.5&&look.brightness<=1.5);
    assert.ok(look.contrast>=0.5&&look.contrast<=1.5);
    assert.ok(look.saturation>=0&&look.saturation<=2);
  }
  assert.throws(()=>chooseVideoLook("unvalidated"),/Unknown video/);
});

test("presets enhance the established studio rather than create another page",()=>{
  const audio=read("components/communications/MultitrackAudioEditor.jsx");
  const video=read("components/communications/PlatformVariantEditor.jsx");
  const nav=read("components/communications/CreatorMediaTools.jsx");
  for(const marker of ["Sound textures & frequency presets","makeSoundPresetBuffer","Noise & tone textures","Advanced audio effects","AUDIO_MIX_PRESETS","getUserMedia","playBacking"])
    assert.ok(audio.includes(marker),marker);
  for(const marker of ["VIDEO_LOOK_PRESETS","Visual adjustments","Playback speed","Original video audio","Interest peak / breakdown timing"])
    assert.ok(video.includes(marker),marker);
  assert.match(nav,/<MultitrackAudioEditor/);
  assert.match(nav,/<PrePostMediaOptimizer/);
  assert.doesNotMatch(audio,/\/api\/.*publish|\/api\/.*upload/);
});
