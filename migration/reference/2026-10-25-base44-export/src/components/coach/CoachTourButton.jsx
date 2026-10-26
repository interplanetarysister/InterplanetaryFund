import React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { coachTours } from "./coachTours";

// Restarts the page's coach-mark tour on demand. Mount <CoachMarks tourId=... />
// on the page for the actual overlay; this button just (re)triggers it.
export default function CoachTourButton({ tourId, className }) {
  if (!coachTours[tourId]) return null;
  const start = () => window.dispatchEvent(new CustomEvent("coach-restart", { detail: tourId }));
  return (
    <Button variant="outline" size="sm" onClick={start} className={`rounded-xl ${className || ""}`}>
      <Sparkles className="w-4 h-4 mr-1.5" /> Take a tour
    </Button>
  );
}