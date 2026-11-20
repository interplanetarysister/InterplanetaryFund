import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_VOICE_PROFILES, speechRecognitionConstructor, makeRecognition, speakAgent, stopSpeaking, canSpeak } from "../src/lib/agentSpeech.mjs";

test("nine named agents have distinct speech styles",()=>{
  assert.equal(Object.keys(AGENT_VOICE_PROFILES).length,9);
  const signatures=Object.values(AGENT_VOICE_PROFILES).map(({pitch,rate,voiceHint})=>[pitch,rate,voiceHint].join(":"));
  assert.equal(new Set(signatures).size,9);
});
test("unsupported browsers fail closed without recording or speech",()=>{
  assert.equal(speechRecognitionConstructor({}),null);
  assert.equal(makeRecognition({browser:{}}),null);
  assert.equal(canSpeak({}),false);
  assert.equal(speakAgent("hello","nexus",{browser:{}}),false);
  stopSpeaking({});
});
test("speech transcription remains a draft and requires explicit user send",()=>{
  let recognized=null;
  class Recognition {
    start(){this.started=true;}
    abort(){this.aborted=true;}
  }
  const browser={SpeechRecognition:Recognition};
  const input=makeRecognition({browser,onText:value=>{recognized=value}});
  assert.equal(input.interimResults,true);
  assert.equal(input.continuous,false);
  input.start();
  input.onresult({resultIndex:0,results:[Object.assign([{transcript:"Please review my campaign"}],{isFinal:true})]});
  assert.deepEqual(recognized,{final:"Please review my campaign",interim:""});
  input.abort();
  assert.equal(input.aborted,true);
});
test("speech synthesis cancels previous audio and obeys agent profiles",()=>{
  const calls=[];
  class SpeechSynthesisUtterance { constructor(text){this.text=text;} }
  const browser={SpeechSynthesisUtterance,speechSynthesis:{
    cancel(){calls.push("cancel");},
    speak(utterance){calls.push(utterance);},
    getVoices(){return [{name:"Test",lang:"en-GB",localService:true}]}
  }};
  assert.equal(speakAgent("Hello there","story",{browser}),true);
  assert.equal(calls[0],"cancel");
  assert.equal(calls[1].text,"Hello there");
  assert.equal(calls[1].rate,AGENT_VOICE_PROFILES.story.rate);
  assert.equal(calls[1].pitch,AGENT_VOICE_PROFILES.story.pitch);
  stopSpeaking(browser);
  assert.equal(calls.at(-1),"cancel");
});
