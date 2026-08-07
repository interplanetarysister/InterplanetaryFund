import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-36 md:bottom-24 right-4 z-40 w-10 h-10 rounded-full bg-emerald-400 text-[#0B0F0E] shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:bg-emerald-300 transition-colors" aria-label="Back to top">
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}