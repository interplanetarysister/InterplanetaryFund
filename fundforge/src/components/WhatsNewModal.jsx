import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';

const updates = [
  { date: 'Jul 2026', title: 'Featured Campaigns & Success Stories', desc: 'A curated carousel and goal-reached spotlights on your dashboard.' },
  { date: 'Jul 2026', title: 'AI Recommendations', desc: 'Personalized campaign suggestions based on your activity.' },
  { date: 'Jul 2026', title: 'Trust Badges & Live Activity', desc: 'Rising/Popular/Trusted badges plus a live donation feed.' },
  { date: 'Jul 2026', title: 'Saved Campaigns', desc: 'Bookmark campaigns and revisit them anytime.' },
  { date: 'Jul 2026', title: 'Help Center', desc: 'Searchable FAQ articles and support tickets.' },
  { date: 'Jul 2026', title: 'Smarter Sharing', desc: 'Share counts, QR codes, and a social feed preview.' },
];

export default function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('kindred_whatsnew_v1')) setOpen(true);
    const handler = () => setOpen(true);
    window.addEventListener('kindred:whatsnew', handler);
    return () => window.removeEventListener('kindred:whatsnew', handler);
  }, []);

  const close = () => {
    setOpen(false);
    localStorage.setItem('kindred_whatsnew_v1', '1');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-md bg-[#0E1311] border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-400" /> What's New</h3>
          <button onClick={close} className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-stone-400 hover:text-white" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {updates.map((u, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <div>
                <p className="text-xs text-stone-500">{u.date}</p>
                <p className="text-sm font-medium">{u.title}</p>
                <p className="text-xs text-stone-400 leading-relaxed">{u.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-5 border-t border-white/5">
          <button onClick={close} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] font-medium text-sm">Got it</button>
        </div>
      </div>
    </div>
  );
}