import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VerifiedBadge({ className }) {
  return (
    <span title="Verified campaign" className={cn('inline-flex items-center', className)}>
      <BadgeCheck className="w-4 h-4 text-sky-400 fill-sky-400/20" />
    </span>
  );
}