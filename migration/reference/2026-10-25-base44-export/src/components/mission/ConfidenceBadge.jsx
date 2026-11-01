import React from "react";
import { Badge } from "@/components/ui/badge";

const styles = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-stone-100 text-stone-600 border-stone-200",
};

export default function ConfidenceBadge({ level }) {
  return (
    <Badge variant="outline" className={`shrink-0 capitalize ${styles[level] || styles.low}`}>
      {level || "low"} confidence
    </Badge>
  );
}