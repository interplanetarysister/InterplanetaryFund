import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { X, Heart, Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { currencySymbol } from '@/utils/currency';

const quickAmounts = [10, 25, 50, 100];

export default function DonationModal({ open, onClose, campaign }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount('');
      setMessage('');
      setAnonymous(false);
      setSubmitting(false);
    }
  }, [open, campaign?.id]);

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt < 0.5) {
      toast({ title: 'Minimum donation is $0.50', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      let donor_user_id = '';
      try { const u = await base44.auth.me(); donor_user_id = u.id; } catch {}
      const res = await base44.functions.invoke('create-checkout', {
        campaign_id: campaign.id,
        campaign_title: campaign.title,
        amount: amt,
        message,
        anonymous,
        currency: campaign.currency || 'USD',
        donor_user_id,
      });
      const redirectUrl = res?.data?.redirectUrl;
      if (!redirectUrl) throw new Error('No checkout URL returned');
      window.location.href = redirectUrl;
    } catch (e) {
      toast({ title: 'Could not start checkout', description: e.message, variant: 'destructive' });
      setSubmitting(false);
    }
  };

  if (!open || !campaign) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[#0E1311] border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-y-auto max-h-[92vh]">
        <div className="relative h-28 bg-white/5">
          {campaign.image_url && <img src={campaign.image_url} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0E1311] to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-stone-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">Support this cause</p>
          <h3 className="font-semibold text-lg mb-1 line-clamp-2">{campaign.title}</h3>
          {campaign.organizer_name && <p className="text-xs text-stone-500 mb-5">by {campaign.organizer_name}</p>}

          <label className="text-xs font-medium text-stone-400 mb-2 block">Choose an amount</label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {quickAmounts.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(String(a))}
                className={cn(
                  'py-2.5 rounded-lg text-sm font-medium transition-colors border',
                  Number(amount) === a ? 'bg-emerald-400 text-[#0B0F0E] border-emerald-400' : 'bg-white/[0.04] border-white/10 text-stone-300 hover:bg-white/[0.08]'
                )}
              >
                {currencySymbol(campaign.currency)}{a}
              </button>
            ))}
          </div>
          <div className="relative mb-4">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-sm">{currencySymbol(campaign.currency)}</span>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Custom amount"
              min="0.50"
              className="pl-7 bg-white/[0.03] border-white/10 rounded-xl"
            />
          </div>

          <label className="text-xs font-medium text-stone-400 mb-2 block">Message of support (optional)</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share why you're supporting this cause…"
            rows={2}
            className="bg-white/[0.03] border-white/10 rounded-xl resize-none mb-4"
          />

          <button
            onClick={() => setAnonymous(!anonymous)}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/10 mb-5"
          >
            <span className="flex items-center gap-2 text-sm text-stone-300">
              {anonymous ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} Donate anonymously
            </span>
            <span className={cn('w-9 h-5 rounded-full transition-colors relative', anonymous ? 'bg-emerald-400' : 'bg-white/10')}>
              <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', anonymous ? 'translate-x-4' : 'translate-x-0.5')} />
            </span>
          </button>

          <Button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-[#0B0F0E] font-medium gap-2 rounded-xl h-11"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
            {submitting ? 'Preparing checkout…' : `Donate${amount ? ' ' + currencySymbol(campaign.currency) + amount : ''}`}
          </Button>

          <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] text-stone-600">
            <Lock className="w-3 h-3" /> Secure checkout via Base44 Payments
          </div>
        </div>
      </div>
    </div>
  );
}