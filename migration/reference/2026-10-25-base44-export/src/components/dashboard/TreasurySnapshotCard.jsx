import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Landmark, ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import TreasurySummary from "@/components/ops/TreasurySummary";

const fmt = (n) => `$${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// Compact treasury snapshot for the Dashboard. Shows the four headline figures
// from the latest synced TreasurySnapshot; tapping opens a bottom sheet with
// the full per-campaign breakdown (reusing the Ops Center's TreasurySummary).
export default function TreasurySnapshotCard() {
  const [snapshot, setSnapshot] = useState(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    base44.entities.TreasurySnapshot.list("-created_date", 1)
      .then((r) => setSnapshot(r[0] || null))
      .catch(() => setSnapshot(null));
  }, []);

  if (snapshot === undefined) {
    return <div className="rounded-2xl border border-border bg-card p-5 h-28 animate-pulse" />;
  }

  if (!snapshot) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">No treasury data yet — </p>
        <Link to="/ops" className="text-sm font-medium text-primary hover:underline">
          sync from Ops Center
        </Link>
      </div>
    );
  }

  const cells = [
    { label: "Total Raised", value: fmt(snapshot.total_raised), accent: "text-cyan-600 dark:text-cyan-400" },
    { label: "Held (Clearing)", value: fmt(snapshot.total_held), accent: "text-amber-600 dark:text-amber-400" },
    { label: "Fees", value: fmt(snapshot.total_fees), accent: "text-muted-foreground" },
    { label: "Net Position", value: fmt(snapshot.net_position), accent: "text-emerald-600 dark:text-emerald-400" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Landmark className="w-4 h-4 text-primary" />
            </span>
            <span className="font-display text-sm text-foreground">Treasury</span>
          </div>
          {snapshot.synced_at && (
            <span className="text-[11px] text-muted-foreground">
              Synced {format(new Date(snapshot.synced_at), "MMM d, h:mm a")}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {cells.map((c) => (
            <div key={c.label}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className={`mt-0.5 font-display text-lg ${c.accent}`}>{c.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
          Tap for breakdown <ChevronRight className="w-3 h-3" />
        </div>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="bg-slate-950 border-white/10 text-slate-100 max-h-[85vh] overflow-y-auto pb-safe"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-slate-100">Treasury breakdown</SheetTitle>
            <SheetDescription className="text-slate-400">
              Per-campaign balances from the platform treasury ledger.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <TreasurySummary snapshot={snapshot} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}