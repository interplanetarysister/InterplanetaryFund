import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { STATUS_BADGE, UNKNOWN_STATUS_BADGE, AUTH_TYPE_LABEL, ENV_LABEL } from "@/lib/integrationRegistryUi";
import { Loader2, RefreshCw, ShieldOff, ShieldCheck } from "lucide-react";

function Row({ label, children }) {
  return (
    <div className="flex gap-3 py-2 border-b border-stone-100 last:border-0">
      <span className="text-xs uppercase tracking-wide text-stone-400 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-stone-700 flex-1 break-words">{children}</span>
    </div>
  );
}

export default function IntegrationDetailPanel({ entry, onClose, onUpdated }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);
  const operationLock = useRef(false);
  if (!entry) return null;
  const badge = STATUS_BADGE[entry.status] || UNKNOWN_STATUS_BADGE;

  const run = async (action, payload = {}) => {
    if (operationLock.current) return;
    operationLock.current = true;
    setBusy(action);
    try {
      await base44.functions.invoke("managePlatformAccess", { action, platform: entry.platform, ...payload });
      toast({
        title: action === "reauthorize" ? "Verification required" : "Updated",
        description: action === "reauthorize"
          ? `${entry.platform} will remain inactive until provider verification succeeds.`
          : `${entry.platform}: ${action}`,
      });
      onUpdated?.();
    } catch (e) {
      console.error("Integration update failed:", e?.name || "UnknownError");
      toast({ title: "Couldn't update", description: "The integration update could not be completed safely.", variant: "destructive" });
    } finally {
      setBusy(null);
      operationLock.current = false;
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {entry.platform}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
          </DialogTitle>
          <DialogDescription>{entry.purpose}</DialogDescription>
        </DialogHeader>

        <div className="px-1">
          <Row label="Kind">{entry.integration_kind}</Row>
          <Row label="Account">{entry.account_identifier || "—"}</Row>
          <Row label="Auth type">{AUTH_TYPE_LABEL[entry.auth_type] || entry.auth_type}</Row>
          <Row label="Secret refs">{(entry.secret_refs || []).length ? entry.secret_refs.join(", ") : <span className="text-stone-400">none / platform-managed</span>}</Row>
          <Row label="Environment">{ENV_LABEL[entry.environment] || entry.environment}</Row>
          <Row label="Authorized agents">{(entry.authorized_agents || []).length ? entry.authorized_agents.join(", ") : <span className="text-stone-400">service-role only</span>}</Row>
          <Row label="Dependencies">{(entry.dependencies || []).join(", ") || "—"}</Row>
          <Row label="Admin owner">{entry.admin_owner || "unassigned"}</Row>
          <Row label="Last verified">{entry.last_verified ? new Date(entry.last_verified).toLocaleString() : "never"}</Row>
          <Row label="Last success">{entry.last_successful_verification ? new Date(entry.last_successful_verification).toLocaleString() : "—"}</Row>
          {entry.last_failure ? <Row label="Last failure"><span className="text-red-600">Provider verification requires attention.</span></Row> : null}
          {(entry.cleanup_flags || []).length ? <Row label="Flags">{entry.cleanup_flags.join(", ")}</Row> : null}
          {entry.reauth_instructions ? <Row label="Reauth steps">{entry.reauth_instructions}</Row> : null}
        </div>

        {entry.platform === "github" && (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            GitHub-assisted syncing and workflow checks are paused. IFund development,
            local validation and publication use Base44 directly. Connection tests
            do not transfer source or publish the live app.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => run("reauthorize")} disabled={!!busy} className="rounded-lg">
            {busy === "reauthorize" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}Request reauthorization
          </Button>
          <Button size="sm" variant="outline" onClick={() => run("revoke")} disabled={!!busy} className="rounded-lg text-red-600 hover:text-red-700">
            {busy === "revoke" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5 mr-1.5" />}Revoke access
          </Button>
          {entry.status === "REVOKED" && (
            <Button size="sm" onClick={() => run("reauthorize")} disabled={!!busy} className="rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />Restore and verify
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
