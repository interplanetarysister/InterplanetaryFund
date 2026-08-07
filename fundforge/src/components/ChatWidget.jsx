import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MessageCircle, X, Send, Minus, LifeBuoy } from 'lucide-react';
import { cn } from '@/lib/utils';

const QUICK = [
  'How do I create a campaign?',
  'How do donations work?',
  'How do payouts work?',
  'Is my payment secure?',
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('kindred_chat') || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef();

  useEffect(() => {
    sessionStorage.setItem('kindred_chat', JSON.stringify(messages));
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || typing) return;
    const next = [...messages, { role: 'user', content: msg }];
    setMessages(next);
    setInput('');
    setTyping(true);
    try {
      const res = await base44.functions.invoke('chat-assistant', { message: msg, history: messages });
      const reply = res?.data?.reply || res?.reply || "I couldn't process that — try rephrasing, or contact human support.";
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Something went wrong. Please try again or visit the Help Center.' }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setMinimized(false); }}
        className={cn('fixed bottom-20 md:bottom-6 right-4 z-[90] w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[#0B0F0E] shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:scale-105 transition-transform', open && !minimized && 'hidden')}
        aria-label="Open chat assistant"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {open && (
        <div className={cn('fixed bottom-20 md:bottom-6 right-4 z-[90] w-[calc(100vw-2rem)] sm:w-96 bg-[#0E1311] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all', minimized ? 'h-14' : 'h-[28rem]')}>
          <div className="flex items-center justify-between p-3 border-b border-white/5 bg-gradient-to-r from-emerald-500/10 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center"><MessageCircle className="w-4 h-4 text-[#0B0F0E]" /></div>
              <div>
                <p className="text-sm font-medium leading-none">Kindred Assistant</p>
                <p className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Online</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMinimized(!minimized)} className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-stone-400" aria-label="Minimize"><Minus className="w-4 h-4" /></button>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-stone-400" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
          </div>
          {!minimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-2">
                    <p className="text-sm text-stone-400 mb-4">Hi! 👋 How can I help you today?</p>
                    <div className="space-y-2">
                      {QUICK.map((q) => (
                        <button key={q} onClick={() => send(q)} className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] text-stone-300 transition-colors">{q}</button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap', m.role === 'user' ? 'bg-emerald-400 text-[#0B0F0E] rounded-br-sm' : 'bg-white/[0.06] text-stone-100 rounded-bl-sm')}>{m.content}</div>
                  </div>
                ))}
                {typing && (
                  <div className="flex justify-start">
                    <div className="px-3 py-2.5 rounded-2xl bg-white/[0.06] rounded-bl-sm flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
              <div className="p-3 border-t border-white/5">
                <Link to="/help" onClick={() => setOpen(false)} className="text-[11px] text-stone-500 hover:text-emerald-300 flex items-center gap-1 mb-2"><LifeBuoy className="w-3 h-3" /> Contact human support</Link>
                <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
                  <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message…" className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-stone-600 focus:outline-none focus:border-emerald-400/40" />
                  <button type="submit" disabled={!input.trim() || typing} className="w-9 h-9 rounded-lg bg-emerald-400 text-[#0B0F0E] flex items-center justify-center disabled:opacity-40"><Send className="w-4 h-4" /></button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}