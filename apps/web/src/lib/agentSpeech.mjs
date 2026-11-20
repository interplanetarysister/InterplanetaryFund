// Browser-local speech adapters. No raw audio is uploaded or persisted by this module.
// Speech is optional; typed chat works without these browser capabilities.
// The browser's speech recognition or synthesis implementation may use remote services.
export const AGENT_VOICE_PROFILES = Object.freeze({
  nexus: {pitch:0.94,rate:0.94,voiceHint:"en-US"},
  story: {pitch:1.08,rate:0.93,voiceHint:"en-GB"},
  echo: {pitch:1.06,rate:1.02,voiceHint:"en-US"},
  pulse: {pitch:1.01,rate:1.06,voiceHint:"en-AU"},
  orbit: {pitch:0.90,rate:0.90,voiceHint:"en-US"},
  polaris: {pitch:0.95,rate:0.91,voiceHint:"en-GB"},
  forge: {pitch:1.00,rate:1.04,voiceHint:"en-US"},
  link: {pitch:0.92,rate:0.96,voiceHint:"en-CA"},
  discover: {pitch:1.07,rate:0.98,voiceHint:"en-IE"}
});
export const speechRecognitionConstructor = (browser=typeof window === "undefined" ? null : window) =>
  browser?.SpeechRecognition || browser?.webkitSpeechRecognition || null;
export const canSpeak = (browser=typeof window === "undefined" ? null : window) =>
  Boolean(browser?.speechSynthesis && browser?.SpeechSynthesisUtterance);
export function makeRecognition({onText,onError,onEnd,browser=typeof window==="undefined"?null:window}){
  const Constructor=speechRecognitionConstructor(browser);
  if(!Constructor) return null;
  const recognition=new Constructor();
  recognition.lang="en-US";
  recognition.continuous=false;
  recognition.interimResults=true;
  recognition.maxAlternatives=1;
  recognition.onresult=event=>{
    let final="",interim="";
    for(let i=event.resultIndex;i<event.results.length;i++){
      const phrase=event.results[i]?.[0]?.transcript || "";
      if(event.results[i].isFinal) final+=phrase; else interim+=phrase;
    }
    onText?.({final:final.trim(),interim:interim.trim()});
  };
  recognition.onerror=event=>onError?.(event.error==="not-allowed"?"Microphone permission was denied. You can still type.":"Speech recognition is unavailable. Please type instead.");
  recognition.onend=()=>onEnd?.();
  return recognition;
}
export function speakAgent(text,agent,{browser=typeof window==="undefined"?null:window,onEnd}={}){
  if(!canSpeak(browser) || typeof text!=="string" || !text.trim()) return false;
  const profile=AGENT_VOICE_PROFILES[agent] || AGENT_VOICE_PROFILES.nexus;
  const synth=browser.speechSynthesis;
  synth.cancel();
  const utterance=new browser.SpeechSynthesisUtterance(text.slice(0,6000));
  utterance.lang=profile.voiceHint;
  utterance.rate=profile.rate;
  utterance.pitch=profile.pitch;
  const voices=synth.getVoices?.() || [];
  // Prefer natural voices where the browser provides them, with agent-specific locale.
  const candidates=voices.filter(voice=>voice.lang?.toLowerCase().startsWith("en"));
  // Give agents different installed voices whenever the device has enough.
  // A stable index avoids multiple agents collapsing to the same default voice.
  // With fewer voices, rate/pitch remain agent-specific.
  const agentIndex=Object.keys(AGENT_VOICE_PROFILES).indexOf(agent);
  const position=Math.max(0,agentIndex);
  const ordered=[...candidates].sort((a,b)=>
    Number(Boolean(b.localService))-Number(Boolean(a.localService)) ||
    String(a.name).localeCompare(String(b.name)));
  utterance.voice=ordered.length ? ordered[position % ordered.length] : null;
  if(utterance.voice) utterance.lang=utterance.voice.lang;
  utterance.onend=()=>onEnd?.();
  utterance.onerror=()=>onEnd?.();
  synth.speak(utterance);
  return true;
}
export function stopSpeaking(browser=typeof window==="undefined"?null:window){
  browser?.speechSynthesis?.cancel();
}
