import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logPlatformEvent } from "./logPlatformEvent";
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

const services = [
  { name: "Identity & Auth", check: () => base44.auth.me() },
  { name: "Campaign OS", check: () => base44.entities.Campaign.list("-created_date", 1) },
  { name: "Donation & Financial OS", check: () => base44.entities.Donation.list("-created_date", 1) },
  { name: "Communications OS", check: () => base44.entities.Message.list("-created_date", 1) },
  { name: "Mission Control", check: () => base44.entities.Recommendation.list("-created_date", 1) },
  { name: "Community OS", check: () => base44.entities.Community.list("-created_date", 1) },
  { name: "Institution OS", check: () => base44.entities.Institution.list("-created_date", 1) },
  { name: "Platform Intelligence", check: () => base44.entities.ExecutiveReport.list("-created_date", 1) },
];

const SAFE_SERVICE_ERROR = "Service health check failed.";

export default function ServiceHealthPanel() {
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async (log) => {
    setRunning(true);
    const out = await Promise.all(
      services.map(async (s) => {
        const start = performance.now();
        try {
          await s.check();
          return { name: s.name, status: "operational", latency: Math.round(performance.now() - start) };
        } catch (e) {
          console.error(`Service health check failed for ${s.name}:`, e);
          return { name: s.name, status: "degraded", latency: Math.round(performance.now() - start), error: SAFE_SERVICE_ERROR };
        }
      })
    );
    setResults(out);
    setRunning(false);
    if (log) {
      const failed = out.filter((r) => r.status !== "operational");
      await logPlatformEvent({
        action: "Health check executed",
        category: "health_check",
        affected_resource: "All operating systems",
        outcome: failed.length ? "warning" : "success",
        details: `${out.length - failed.length}/${out.length} services operational${failed.length ? ` — degraded: ${failed.map((f) => f.name).join(", ")}` : ""}`,
      });
    }
  }, []);

  useEffect(() => { run(false); }, [run]);

  if (!results) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const healthy = results.filter((r) => r.status === "operational").length;
  const avg = Math.round(results.reduce((s, r) => s + r.latency, 0) / results.length);

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-3xl text-white">{healthy}/{results.length} operational</p>
          <p className="text-sm text-stone-400 mt-1">Average response time {avg}ms · infrastructure managed by Base44</p>
        </div>
        <Button onClick={() => run(true)} disabled={running} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Run health check
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
        {results.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              {r.status === "operational"
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                : <XCircle className="w-4 h-4 text-red-500" aria-hidden="true" />}
              <div>
                <p className="text-sm font-medium text-stone-900">{r.name}</p>
                {r.error && <p className="text-xs text-red-600">{r.error}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-stone-400">{r.latency}ms</span>
              <Badge className={r.status === "operational" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                {r.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}