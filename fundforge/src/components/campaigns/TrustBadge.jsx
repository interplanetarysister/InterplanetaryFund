import { cn } from '@/lib/utils';

export default function TrustBadge({ donorCount }) {
  if (!donorCount || donorCount < 10) return null;
  const { label, cls } = donorCount >= 100
    ? { label: 'Trusted', cls: 'bg-sky-400/15 text-sky-300' }
    : donorCount >= 50
    ? { label: 'Popular', cls: 'bg-violet-400/15 text-violet-300' }
    : { label: 'Rising', cls: 'bg-emerald-400/15 text-emerald-300' };
  return <span className={cn('text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-semibold', cls)}>{label}</span>;
}