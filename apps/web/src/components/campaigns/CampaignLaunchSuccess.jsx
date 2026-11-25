import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Rocket, CheckCircle2, ArrowRight, X } from "lucide-react";
import "@/styles-connected-interactions.css";

/**
 * Only mount after the campaign owner receives a confirmed published receipt.
 * Never display this overlay for an attempted or failed checkout/publish action.
 */
export default function CampaignLaunchSuccess({ onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = [...document.querySelectorAll("[data-ifund-launch] button, [data-ifund-launch] a")];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault(); controls.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
        event.preventDefault(); controls[0].focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [onClose]);

  return <div className="ifund-launch-backdrop" role="presentation">
    <section data-ifund-launch role="dialog" aria-modal="true" aria-labelledby="ifund-launch-heading"
      aria-describedby="ifund-launch-description" className="ifund-launch-panel">
      <button ref={closeRef} type="button" className="ifund-launch-close ifund-interactive" aria-label="Close launch celebration" onClick={onClose}>
        <X size={20} aria-hidden="true" />
      </button>
      <div className="ifund-launch-orbit" aria-hidden="true">
        <div className="ifund-launch-stars" />
        <Rocket className="ifund-launch-rocket" size={74} strokeWidth={1.6} />
      </div>
      <CheckCircle2 className="mx-auto text-emerald-300" size={30} aria-hidden="true"/>
      <p className="ifund-launch-eyebrow">Launch confirmed</p>
      <h2 id="ifund-launch-heading" className="font-display text-3xl font-bold text-white">Your campaign is live.</h2>
      <p id="ifund-launch-description" className="mx-auto max-w-sm text-sm leading-6 text-slate-200">
        Your campaign was published successfully. Share your story whenever you're ready.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" className="ifund-interactive min-h-12 rounded-xl bg-cyan-300 px-5 font-semibold text-slate-950" onClick={onClose}>
          View my campaign <ArrowRight className="ml-2 inline-block" size={16} />
        </button>
        <Link to="/social" className="ifund-interactive inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-5 font-semibold text-white">
          Explore the feed
        </Link>
      </div>
    </section>
  </div>;
}
