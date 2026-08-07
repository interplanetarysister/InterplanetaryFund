import { useSavedCampaigns } from '@/hooks/useSavedCampaigns';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

export default function SaveButton({ campaign, className }) {
  const { isSaved, toggle } = useSavedCampaigns();
  const { toast } = useToast();
  const saved = isSaved(campaign.id);

  const onClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const nowSaved = await toggle(campaign.id, campaign.title);
    if (nowSaved) toast({ title: 'Saved for later', variant: 'success' });
  };

  return (
    <button onClick={onClick} className={cn('flex items-center justify-center transition-colors', className)} aria-label="Save campaign">
      {saved ? <BookmarkCheck className="w-4 h-4 text-emerald-400" /> : <Bookmark className="w-4 h-4 text-stone-400" />}
    </button>
  );
}