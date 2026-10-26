import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { IFUND_RELEASE_ID } from "@/lib/ifundRelease";

export default function Base44ReleaseStatus() {
  const [status, setStatus] = useState({ state: "checking", id: "" });
  const check = async () => {
    setStatus({ state: "checking", id: "" });
    try {
      const response = await fetch("/ifund-release.json?v=" + Date.now(), {
        cache: "no-store", headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Published release file unavailable");
      const data = await response.json();
      const id = typeof data.release_id === "string" ? data.release_id : "";
      setStatus({ state: id === IFUND_RELEASE_ID ? "matches" : "outdated", id });
    } catch {
      setStatus({ state: "unavailable", id: "" });
    }
  };
  useEffect(() => { void check(); }, []);
  const matched = status.state === "matches";
  return (
    <section aria-label="Base44 publication status"
      className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            {matched ? <ShieldCheck className="w-5 h-5 text-emerald-700" /> : <ShieldAlert className="w-5 h-5 text-amber-700" />}
            Base44 publication
          </h2>
          <p role="status" className="mt-1 text-sm text-slate-700">
            {status.state === "checking" && "Checking published Base44 site files…"}
            {status.state === "matches" && "This frontend and its published Base44 release files are consistent."}
            {status.state === "outdated" && "Base44's published files do not match this running frontend. A fresh Base44 publish is required."}
            {status.state === "unavailable" && "Could not confirm the published Base44 release. Publish the latest saved checkpoint or retry."}
          </p>
          <p className="mt-2 break-all text-xs text-slate-500">Running release: {IFUND_RELEASE_ID}</p>
          {status.id && status.id !== IFUND_RELEASE_ID && (
            <p className="mt-1 break-all text-xs text-amber-800">Published release file: {status.id}</p>
          )}
          <p className="mt-2 text-xs text-slate-600">
            Source edits, a successful build, and a published website are separate steps.
            Publication must happen in Base44; no GitHub checks or Actions are necessary.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={check}
          disabled={status.state === "checking"} className="rounded-xl">
          <RefreshCw className="w-4 h-4" />
          Check published site
        </Button>
      </div>
    </section>
  );
}
