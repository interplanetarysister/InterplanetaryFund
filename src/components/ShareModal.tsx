import { useState } from "react";

export default function ShareModal({
  campaignTitle,
  campaignId,
  onClose,
}: {
  campaignTitle: string;
  campaignId: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/?campaign=${campaignId}`;
  const paypalLink = `https://www.paypal.com/donate/?cmd=_donations&business=interplanetarysister%40gmail.com&item_name=${encodeURIComponent(campaignTitle + " - Interplanetary Fund")}&currency_code=USD`;

  const handleShare = async (platform: string) => {
    const text = `Support "${campaignTitle}" on Interplanetary Fund`;
    const urls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + " " + shareUrl)}`,
      email: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(shareUrl)}`,
    };
    if (urls[platform]) {
      window.open(urls[platform], "_blank");
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50" onClick={onClose}>
      <div
        className="bg-ifbg2 rounded-t-2xl w-full max-w-md p-5 border-t border-ifborder"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">Share Campaign</h3>
          <button onClick={onClose} className="text-ifmuted text-xl">✕</button>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          <button onClick={() => handleShare("facebook")} className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-[#1877F2]/20 flex items-center justify-center text-xl">f</div>
            <span className="text-[10px] text-ifmuted">Facebook</span>
          </button>
          <button onClick={() => handleShare("twitter")} className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-ifbg flex items-center justify-center text-xl">𝕏</div>
            <span className="text-[10px] text-ifmuted">Twitter</span>
          </button>
          <button onClick={() => handleShare("whatsapp")} className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-[#25D366]/20 flex items-center justify-center text-xl">💬</div>
            <span className="text-[10px] text-ifmuted">WhatsApp</span>
          </button>
          <button onClick={() => handleShare("email")} className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-ifbg flex items-center justify-center text-xl">✉</div>
            <span className="text-[10px] text-ifmuted">Email</span>
          </button>
        </div>

        <div className="flex items-center gap-2 bg-ifbg rounded-lg p-2 border border-ifborder">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="flex-1 bg-transparent text-ifmuted text-xs outline-none"
          />
          <button
            onClick={copyLink}
            className="text-ifcyan text-xs font-medium px-2 py-1 rounded bg-ifbg2"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>

        <a
          href={paypalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-3 text-center bg-[#0070BA] text-white rounded-lg py-2.5 text-sm font-medium"
        >
          Donate via PayPal
        </a>
      </div>
    </div>
  );
}
