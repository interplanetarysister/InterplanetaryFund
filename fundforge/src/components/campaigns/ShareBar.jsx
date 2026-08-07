import { useToast } from '@/components/ui/use-toast';
import { Link2, Twitter, Facebook } from 'lucide-react';

export default function ShareBar({ campaign }) {
  const { toast } = useToast();
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const text = campaign?.social_captions?.split('\n')[0] || campaign?.title || '';
  const hashtags = (campaign?.tags || []).join(',');

  const copy = () => {
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied!', variant: 'success' });
  };
  const tweet = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`, '_blank');
  const share = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');

  const btn = 'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-stone-300 transition-colors';

  return (
    <div className="flex gap-1.5">
      <button onClick={copy} className={btn}><Link2 className="w-3.5 h-3.5" /> Copy</button>
      <button onClick={tweet} className={btn}><Twitter className="w-3.5 h-3.5" /> Tweet</button>
      <button onClick={share} className={btn}><Facebook className="w-3.5 h-3.5" /> Share</button>
    </div>
  );
}