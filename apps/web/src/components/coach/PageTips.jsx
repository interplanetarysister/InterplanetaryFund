import React, { useState } from "react";
import { Sparkles, Play } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pageTips } from "./pageTips";

// A small, unobtrusive Tips control. Opens a dismissible dialog with
// page-specific guidance. Never auto-opens. For pages with an element
// spotlight tour, pass tourId to also offer "Take a tour" (CoachMarks).
export default function PageTips({ pageId, tourId, className }) {
  const [open, setOpen] = useState(false);
  const tip = pageTips[pageId];
  if (!tip) return null;

  const takeTour = () => {
    setOpen(false);
    if (tourId) window.dispatchEvent(new CustomEvent("coach-restart", { detail: tourId }));
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors min-h-[44px] ${className || ""}`}
        aria-label={`Tips for ${tip.title}`}
      >
        <Sparkles className="w-4 h-4" /> Tips
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{tip.title}</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2.5">
            {tip.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          {tourId && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={takeTour}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors min-h-[44px]"
              >
                <Play className="w-3.5 h-3.5" /> Take a tour
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}