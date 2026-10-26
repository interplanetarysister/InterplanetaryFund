import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { coachTours } from "./coachTours";

// Renders an inline coach-mark tour over elements tagged with data-coach on
// the current page. Auto-shows ONCE per user: the dismissal is persisted to
// the user profile (tips_completed) via base44.auth.updateMe, so it never
// auto-appears again on future logins or other devices — it no longer relies
// on per-session localStorage. The CoachTourButton / PageTips "Take a tour"
// control can restart it on demand.
export default function CoachMarks({ tourId }) {
  const tour = coachTours[tourId];
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  const current = tour?.steps[step];

  // Auto-show only once per user, gated by a persisted profile flag.
  useEffect(() => {
    if (!tour) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await base44.auth.me();
        if (cancelled) return;
        if (!me?.tips_completed) {
          setActive(true);
          setStep(0);
        }
      } catch {
        /* not authenticated — don't auto-show */
      }
    })();
    return () => { cancelled = true; };
  }, [tourId]);

  // Restart on demand (from CoachTourButton / PageTips).
  useEffect(() => {
    const onRestart = (e) => {
      if (e.detail !== tourId) return;
      setActive(true);
      setStep(0);
    };
    window.addEventListener("coach-restart", onRestart);
    return () => window.removeEventListener("coach-restart", onRestart);
  }, [tourId]);

  // Read-only measurement of the current target's box.
  const measure = useCallback(() => {
    if (!current) { setRect(null); return; }
    const el = document.querySelector(`[data-coach="${current.selector}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [current]);

  // Scroll the current target into view when the step changes.
  useEffect(() => {
    if (!active || !current) return;
    const el = document.querySelector(`[data-coach="${current.selector}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active, step, current]);

  // Re-measure on scroll/resize (read-only, no scroll side effect).
  useEffect(() => {
    if (!active) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, measure]);

  if (!active || !tour || !current) return null;

  const finish = () => {
    setActive(false);
    // Persist dismissal so the tour never auto-shows again, across devices.
    base44.auth.updateMe({ tips_completed: true }).catch(() => {});
  };
  const next = () => (step < tour.steps.length - 1 ? setStep(step + 1) : finish());
  const back = () => step > 0 && setStep(step - 1);

  const pad = 8;
  const spotlightStyle = rect
    ? {
        position: "fixed",
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        borderRadius: 14,
        boxShadow: "0 0 0 9999px rgba(15,23,42,0.6)",
        pointerEvents: "none",
        transition: "all 0.2s ease",
        zIndex: 60,
      }
    : { position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 60, pointerEvents: "none" };

  const below = (current.placement || "bottom") === "bottom";
  const cardW = 320;
  const cardStyle = { position: "fixed", zIndex: 61, width: cardW, maxWidth: "calc(100vw - 24px)" };
  if (rect) {
    if (below) cardStyle.top = rect.bottom + 16;
    else cardStyle.bottom = window.innerHeight - rect.top + 16;
    let left = rect.left + rect.width / 2 - cardW / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - cardW - 12));
    cardStyle.left = left;
  } else {
    cardStyle.top = "50%";
    cardStyle.left = "50%";
    cardStyle.transform = "translate(-50%,-50%)";
  }

  return (
    <>
      <div style={spotlightStyle} />
      <div style={cardStyle} className="rounded-2xl bg-card border border-border shadow-xl p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step {step + 1} of {tour.steps.length}</p>
          <button onClick={finish} aria-label="Close tour" className="text-muted-foreground hover:text-foreground p-1 -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h3 className="font-display text-lg text-foreground mb-1">{current.title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{current.body}</p>
        <div className="flex items-center justify-between">
          <button onClick={back} disabled={step === 0} className="text-sm text-muted-foreground disabled:opacity-70 flex items-center gap-1 min-h-[44px] px-2">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <button onClick={next} className="rounded-xl bg-primary text-primary-foreground text-sm font-medium px-4 h-9 min-h-[44px] flex items-center gap-1">
            {step === tour.steps.length - 1 ? (<><Check className="w-4 h-4" /> Done</>) : (<>Next <ChevronRight className="w-4 h-4" /></>)}
          </button>
        </div>
      </div>
    </>
  );
}