import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, Sparkles } from "lucide-react";

/** Optional local browser speech support. No recording or transcript is sent
 * to IFund outside the ordinary user-controlled campaign editor. */
export default function CampaignVoiceInput({ value, onChange, disabled = false }) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const recognition = useRef(null);
  const latestValue = useRef(value);
  latestValue.current = value;
  useEffect(() => () => { try { recognition.current?.abort(); } catch {} }, []);
  function start() {
    if (listening) { recognition.current?.stop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setMessage("Speech dictation is not available in this browser. You can type your idea instead."); return; }
    try {
      const item = new Recognition();
      recognition.current = item;
      item.lang = navigator.language || "en-US";
      item.interimResults = false; item.continuous = false;
      item.onresult = event => {
        const spoken = Array.from(event.results).map(result => result[0]?.transcript || "").join(" ").trim();
        if (spoken) onChange([latestValue.current.trim(),spoken].filter(Boolean).join(" ").slice(0,1500));
      };
      item.onerror = () => setMessage("Voice input stopped. You can continue typing.");
      item.onend = () => { setListening(false); recognition.current = null; };
      item.start(); setListening(true); setMessage("Listening… say what you want to make possible.");
    } catch { setListening(false); setMessage("Microphone access is unavailable. You can type instead."); }
  }
  function readPrompt() {
    if (!("speechSynthesis" in window)) { setMessage("Voice talkback is not supported in this browser."); return; }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance("Tell us what you want to make possible, and who or what it would help. You can give a few clues and change them later.");
    speech.lang = navigator.language || "en-US";
    speech.rate = 0.95;
    window.speechSynthesis.speak(speech);
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={disabled} onClick={start} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-400/40 px-4 text-sm font-semibold disabled:opacity-50" aria-label={listening ? "Stop voice input" : "Dictate your campaign idea"}>{listening?<MicOff size={17}/>:<Mic size={17}/>} {listening?"Stop listening":"Talk instead"}</button>
      <button type="button" disabled={disabled} onClick={()=>{
        window.dispatchEvent(new CustomEvent("ifund-open-agent",{detail:{agent:"nexus",
          prefill:"Please help me build an accurate, compelling iFund campaign or Mission about: "+(latestValue.current.trim()||"my goal")+
          ". I may need money, supplies, skills, volunteers or other support. Guide me one step at a time."}}));
      }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-400/50 bg-violet-500/10 px-4 text-sm font-semibold disabled:opacity-50">
        <Sparkles size={17}/> Ask NEXUS
      </button>
      <button type="button" disabled={disabled} onClick={readPrompt} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"><Volume2 size={17}/> Hear the question</button>
    </div>
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
  </div>;
}
