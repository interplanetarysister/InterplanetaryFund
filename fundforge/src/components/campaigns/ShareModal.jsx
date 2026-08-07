import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { X, Copy, Facebook, Twitter, Linkedin, MessageCircle, Mail, Check, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import LazyImage from '@/components/campaigns/LazyImage';

export default function ShareModal({ open, onClose, campaign, shareUrl }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [shares, setShares] = useState(campaign?.shares || 0);

  useEffect(() => {
    setShares(campaign?.shares || 0);
  }, [campaign?.id]);

  if (!open || !campaign) return null;

  const url = shareUrl || (typeof window !== 'undefined' ? window.location.href : '');
  const text = campaign.social_captions?.split('\n')[0] || campaign.short_description || campaign.title || '';
  const hashtags = (campaign.tags || []).join(',');
  const embed = `<iframe src="${url}" width="400" height="600" frameborder="0" title="${campaign.title || 'Kindred Campaign'}"></iframe>`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(url)}`;
  const host = url.replace(/^https?:\/\//, '').split('/')[0];

  const trackShare = () => {
    const next = shares + 1;
    setShares(next);
    base44.entities.Campaign.update(campaign.id, { shares: next }).catch(() => {});
  };

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    trackShare();
    toast({ title: 'Link copied!', variant: 'success' });
    setTimeout(() => setCopied(false), 2000);
  };
  const copyEmbed = () => {
    navigator.clipboard.writeText(embed);
    toast({ title: 'Embed code copied!', variant: 'success' });
  };

  const socials = [
    { label: 'Facebook', icon: Facebook, url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { label: 'X', icon: Twitter, url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}` },
    { label: 'LinkedIn', icon: Linkedin, url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { label: 'WhatsApp', icon: MessageCircle, url: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}` },
    { label: 'Email', icon: Mail, url: `mailto:?subject=${encodeURIComponent(campaign.title || 'Support this cause')}&body=${encodeURIComponent(text + '\n\n' + url)}` },
  ];

  const openSocial = (s) => { trackShare(); window.open(s.url, '_blank'); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0E1311] border border-white/10 rounded-2xl overflow-y-auto max-h-[92vh]">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="font-semibold">Share Campaign</h3>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-stone-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-stone-400">Campaign link</p>
              {shares > 0 && <span className="text-[10px] text-stone-500 flex items-center gap-1"><Share2 className="w-3 h-3" /> Shared {shares} {shares === 1 ? 'time' : 'times'}</span>}
            </div>
            <div className="flex gap-2">
              <input readOnly value={url} className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 text-xs text-stone-400 truncate" />
              <button onClick={copyLink} className={cn('px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors', copied ? 'bg-emerald-400 text-[#0B0F0E]' : 'bg-white/[0.06] text-stone-200 hover:bg-white/[0.1]')}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-stone-400 mb-2">Share via</p>
            <div className="grid grid-cols-5 gap-2">
              {socials.map((s) => (
                <button key={s.label} onClick={() => openSocial(s)} aria-label={`Share on ${s.label}`} className="flex flex-col items-center gap-1.5 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-stone-300 transition-colors">
                  <s.icon className="w-4 h-4" />
                  <span className="text-[10px]">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-stone-400 mb-2">Share to feed preview</p>
            <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.02]">
              {campaign.image_url && (
                <div className="h-32 bg-white/[0.03] overflow-hidden">
                  <LazyImage src={campaign.image_url} alt={campaign.title} className="w-full h-full" />
                </div>
              )}
              <div className="p-3 text-left">
                <p className="text-[10px] text-stone-500 uppercase truncate">{host}</p>
                <p className="text-sm font-medium line-clamp-1 mt-0.5">{campaign.title}</p>
                <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{text}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl bg-white/[0.03] border border-white/5 p-4">
            <img src={qr} alt="QR code linking to this campaign" className="w-24 h-24 rounded-lg bg-white p-1" />
            <div>
              <p className="text-sm font-medium mb-1">Scan to donate</p>
              <p className="text-xs text-stone-500 leading-relaxed">Point a phone camera at this code to open the campaign page instantly.</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-stone-400 mb-2">Embed code</p>
            <textarea readOnly value={embed} rows={3} className="w-full bg-white/[0.03] border border-white/10 rounded-lg p-3 text-[11px] text-stone-400 font-mono resize-none" />
            <button onClick={copyEmbed} className="mt-2 w-full py-2 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-stone-200 flex items-center justify-center gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Copy embed code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}