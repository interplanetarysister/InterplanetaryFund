import {useEffect,useRef,useState} from "react";
import {makeRecognition,speakAgent,stopSpeaking} from "@/lib/agentSpeech.mjs";
import {Mic,Volume2} from "lucide-react";

const QUESTIONS={
 mode:"Welcome. I am NEXUS, your iFund Chief of Staff. Would you like a quick campaign setup, or to go through each detail together?",
 details:"Tell me what you would like to make possible.",
 beneficiary:"Who or what will benefit from this goal? You can say skip.",
 need:"What funding, supplies, connections, or help would make the biggest difference? You can say skip.",
 goal:"What dollar amount would you like to raise if you choose to publish a donation campaign? Say a number, or skip if you are still exploring.",
 story:"What happened or inspired this goal? Tell me in your own words. You can say skip.",
 tone:"How would you like the story and artwork to feel: hopeful, practical, warm, bold, or something else? You can say skip.",
 image:"Finally, would you rather upload your own photograph, or generate an original iFund illustration?"
};
export default function CampaignVoiceGuide({supportType,onDetails,onBeneficiary,onNeed,onGoal,onStory,onTone,disabled=false}){
 const [step,setStep]=useState("mode");
 const [mode,setMode]=useState("");
 const [status,setStatus]=useState("");
 const [listening,setListening]=useState(false);
 const recognition=useRef(null);
 const token=useRef(0);
 useEffect(()=>()=>{token.current++;recognition.current?.abort();stopSpeaking();},[]);
 function nextStep(previous,currentMode){
  if(previous==="mode")return "details";
  if(previous==="details")return "beneficiary";
  if(previous==="beneficiary")return "need";
  if(previous==="need")return supportType==="money"?"goal":currentMode==="detailed"?"story":"tone";
  if(previous==="goal")return currentMode==="detailed"?"story":"tone";
  if(previous==="story")return "tone";
  if(previous==="tone")return "image";
  return "done";
 }
 function say(text){const utterance=text||QUESTIONS[step];setStatus(utterance);speakAgent(utterance,"nexus");}
 function answer(value){
  const text=value.trim();if(!text)return;
  if(step==="mode"){
   if(/\b(quick|short|fast|simple)\b/i.test(text)){setMode("quick");setStep("details");say(QUESTIONS.details);return;}
   if(/\b(detailed|step.by.step|in.depth|thorough|guided)\b/i.test(text)){setMode("detailed");setStep("details");say(QUESTIONS.details);return;}
   say("Please say quick, or detailed, or select one of the buttons.");return;
  }
  const skip=/^(skip|pass|not now|i don.t know|unsure)$/i.test(text);
  if(!skip){
    if(step==="details")onDetails(text.slice(0,1500));
    else if(step==="beneficiary")onBeneficiary(text.slice(0,100));
    else if(step==="need")onNeed(text.slice(0,100));
    else if(step==="story")onStory(text.slice(0,15000));
    else if(step==="tone")onTone(text.slice(0,200));
    else if(step==="goal"){
      const amount=text.replace(/,/g,"").match(/\b\d+(?:\.\d{1,2})?\b/);
      if(!amount||!(Number(amount[0])>0)){say("Please say a dollar amount in numbers, such as one hundred written as 100, or say skip.");return;}
      onGoal(amount[0]);
    }
  }
  if(step==="image"){
   const imageAction=/\b(upload|my photo|my picture|camera)\b/i.test(text)?"upload":
     /\b(generate|create|illustration|art|ai image)\b/i.test(text)?"generate":"review";
   setStep("done");
   const nextMessage=imageAction==="upload"?"Choose Upload your cover below to select a photograph you own.":
     imageAction==="generate"?"Open the original iFund illustration option under the cover image to choose an art style and generate it.":
     "Choose a cover option when you are ready. Your answers remain editable.";
   say(nextMessage+" Nothing is published until you review and confirm it.");
   document.getElementById("campaign-cover")?.scrollIntoView({behavior:"smooth",block:"center"});
   return;
  }
  const next=nextStep(step,mode);setStep(next);
  say(QUESTIONS[next]||"Your details have been entered. Review your information and save a private draft, then choose when to publish.");
 }
 function startListen(){
  if(disabled||listening)return;
  stopSpeaking();
  const current=++token.current;
  let recognized=false;
  const item=makeRecognition({
    onText:({final})=>{
      if(current!==token.current||!final||recognized)return;
      recognized=true;answer(final);
    },
    onError:message=>{if(current===token.current){setStatus(message);setListening(false);}},
    onEnd:()=>{if(current===token.current){recognition.current=null;setListening(false);}}
  });
  if(!item){setStatus("Your browser does not support speech recognition. You can still use the existing form.");return;}
  recognition.current=item;
  try{item.start();setListening(true);setStatus("Listening for your answer…");}
  catch{setStatus("Microphone access is unavailable. You can type in the form instead.");}
 }
 if(step==="done")return <div role="status" className="space-y-2 text-sm text-muted-foreground">
   <p>Your answers have been placed in the campaign editor. Review your draft and choose an illustration or photo when you are ready.</p>
   <button type="button" onClick={()=>{setStep("mode");setMode("");}} className="min-h-11 rounded-lg border border-border px-3">Start voice guide again</button>
 </div>;
 return <details className="rounded-xl border border-cyan-400/35 p-3" aria-label="NEXUS spoken campaign walkthrough">
   <summary className="cursor-pointer text-sm font-semibold">Have NEXUS guide me by voice (optional)</summary>
   <p className="mt-3 text-xs text-muted-foreground">Answer each question aloud. You stay in control; spoken answers only fill draft fields. No microphone is kept constantly active, and voice answers do not authorize publication.</p>
   <p className="mt-3 font-medium">{QUESTIONS[step]}</p>
   {step==="mode"&&<div className="mt-2 flex flex-wrap gap-2">
     <button type="button" disabled={disabled} onClick={()=>{setMode("quick");setStep("details");say(QUESTIONS.details);}} className="min-h-11 rounded-lg border border-border px-3">Quick setup</button>
     <button type="button" disabled={disabled} onClick={()=>{setMode("detailed");setStep("details");say(QUESTIONS.details);}} className="min-h-11 rounded-lg border border-border px-3">Detailed guidance</button>
   </div>}
   <div className="mt-3 flex flex-wrap gap-2">
     <button type="button" disabled={disabled||listening} onClick={startListen} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-400/50 px-4 text-sm font-semibold disabled:opacity-50"><Mic size={17}/> {listening?"Listening…":"Answer by voice"}</button>
     <button type="button" disabled={disabled} onClick={()=>say()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold"><Volume2 size={17}/> Hear question</button>
     {step!=="mode"&&<button type="button" disabled={disabled} onClick={()=>answer("skip")} className="min-h-11 rounded-xl border border-border px-3 text-sm">Skip</button>}
   </div>
   {status&&<p role="status" className="mt-2 text-xs text-muted-foreground">{status}</p>}
 </details>;
}
