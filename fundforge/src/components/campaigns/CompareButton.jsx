import { useComparison } from '@/hooks/useComparison';
import { GitCompare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

export default function CompareButton({ campaign, className }) {
  const { has, toggle } = useComparison();
  const { toast } = useToast();
  const selected = has(campaign.id);

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggle(campaign.id);
    if (added) toast({ title: 'Added to comparison', variant: 'success' });
    else if (!selected) toast({ title: 'Comparison is full (max 3)', variant: 'destructive' });
  };

  return (
    <button onClick={onClick} className={cn('flex items-center justify-center transition-colors', className)} aria-label="Add to comparison">
      <GitCompare className={cn('w-4 h-4', selected ? 'text-emerald-400' : 'text-stone-400')} />
    </button>
  );
}