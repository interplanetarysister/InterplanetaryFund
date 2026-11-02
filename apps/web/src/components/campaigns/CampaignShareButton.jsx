import { useEffect, useRef, useState } from "react";
import { Share2, Copy, Check, Mail } from "lucide-react";
import {
  campaignShareUrl, shareTargets, buildSharePayload, canUseWebShare,
} from "@/lib/campaignShare";

// Public share kit for a campaign. Sharing is a plain browser action: it opens
// the visitor's own share sheet or a third-party compose page with a
// pre-filled, percent-encoded link. Nothing is sent to IFund and no tracking
// identifier is added, so this works for anonymous visitors too.
export default function CampaignShareButton({ campaign }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const url = campaignShareUrl(campaign?.id, typeof window === "undefined" ? undefined : window.location.origin);
  // Only a published campaign has a public page worth sharing.
  if (campaign?.status !== "active" || !url) return null;

  const targets = shareTargets(campaign, url);
  const shareSheetAvailable = canUseWebShare(typeof navigator === "undefined" ? undefined : navigator);

  async function copy() {
    setNotice("");
    try {
      await navigator.clipboard.writeText(url);
      if (!alive.current) return;
      setCopied(true);
      setTimeout(() => { if (alive.current) setCopied(false); }, 2500);
    } catch {
      // Clipboard access can be denied; never claim the link was copied.
      if (alive.current) setNotice("Copying is unavailable in this browser. Select the link and copy it manually.");
    }
  }

  async function nativeShare() {
    setNotice("");
    try {
      await navigator.share(buildSharePayload(campaign, url));
    } catch (cause) {
      // A user dismissing the sheet is not an error worth reporting.
      if (alive.current && cause?.name !== "AbortError") {
        setNotice("Your device could not open the share sheet.");
      }
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <button
        type="button"
        onClick={() => { setOpen((value) => !value); setNotice(""); }}
        aria-expanded={open}
        aria-controls="campaign-share-panel"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 py-3 font-semibold text-stone-800 hover:border-primary/40"
      >
        <Share2 aria-hidden="true" className="h-4 w-4" />
        {open ? "Close share options" : "Share this campaign"}
      </button>

      {open && (
        <div id="campaign-share-panel" className="mt-3 space-y-3">
          <p className="text-xs text-stone-500">
            Share a public link. Nothing is posted on your behalf and no account connection is needed.
          </p>
          <ul className="space-y-2">
            {shareSheetAvailable && (
              <li>
                <button
                  type="button"
                  onClick={nativeShare}
                  className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium"
                >
                  <Share2 aria-hidden="true" className="h-4 w-4" /> Share with your device
                </button>
              </li>
            )}
            {targets.map((target) => (
              <li key={target.id}>
                <a
                  href={target.href}
                  target={target.id === "email" ? undefined : "_blank"}
                  rel={target.id === "email" ? undefined : "noopener noreferrer"}
                  className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium"
                >
                  {target.id === "email" ? <Mail aria-hidden="true" className="h-4 w-4" /> : <Share2 aria-hidden="true" className="h-4 w-4" />}
                  {target.label}
                </a>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={copy}
                className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium"
              >
                {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                {copied ? "Link copied" : "Copy link"}
              </button>
            </li>
          </ul>
          <p className="break-all rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">{url}</p>
          {notice && <p role="alert" className="text-xs text-destructive">{notice}</p>}
        </div>
      )}
    </div>
  );
}
