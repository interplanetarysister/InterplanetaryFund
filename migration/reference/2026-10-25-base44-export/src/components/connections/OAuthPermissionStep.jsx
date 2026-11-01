import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ShieldCheck } from "lucide-react";
import { ALL_PLATFORMS } from "@/components/connections/platformCatalog";

export default function OAuthPermissionStep({ pending, busy, error, onDecide }) {
  const platform = ALL_PLATFORMS.find(p => p.id === pending.platform);
  const title = platform?.name || pending.platform;
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg rounded-2xl" aria-describedby="oauth-delegation-details">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            <ShieldCheck className="w-5 h-5 inline-block mr-2 text-primary" />
            Allow AI help for {title}?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground" id="oauth-delegation-details">
          You have returned from {title} sign-in. Choose whether Interplanetary Fund AI may
          act as your authorized extension through this account.
        </p>
        <div className="rounded-xl border border-border p-3 text-sm space-y-2">
          <p className="font-semibold">With your permission, IFund may:</p>
          <p>Prepare, publish, edit and update posts; respond to messages or comments;
            read available account information; and maintain this connection.</p>
          <p className="text-xs text-muted-foreground">
            Only actions expressly supported and permitted by {title} can run.
            AI permission does not grant unavailable provider access, permit payments,
            or bypass platform requirements. Revoke AI permission or disconnect anytime.
          </p>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <Button disabled={busy} onClick={() => onDecide(true)} className="rounded-xl min-h-11">
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Allow AI help and finish connection
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => onDecide(false)} className="rounded-xl min-h-11">
          Connect without AI access
        </Button>
      </DialogContent>
    </Dialog>
  );
}
