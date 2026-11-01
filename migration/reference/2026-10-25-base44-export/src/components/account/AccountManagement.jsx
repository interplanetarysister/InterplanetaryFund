import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Trash2, Bell, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import CountMyMoney from "@/components/account/CountMyMoney";
import { isAndroidApp, disableAndroidPush } from "@/lib/androidFirebaseFeatures";

// Account management surface: global notification preferences (respected by
// the sendCommunication function), data export, and permanent account deletion.
export default function AccountManagement({ user, onUserChanged }) {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState(user?.comm_prefs || { email_updates: true, in_app_updates: true });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const savePref = async (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSavingPrefs(true);
    try {
      await base44.auth.updateMe({ comm_prefs: next });
      onUserChanged?.({ ...user, comm_prefs: next });
      toast({ title: "Notification preference saved" });
    } catch (e) {
      console.error("Account preference update failed:", e?.name || "UnknownError");
      toast({ title: "Couldn't save preference", description: "Your preference could not be saved. Please try again.", variant: "destructive" });
      setPrefs(prefs);
    }
    setSavingPrefs(false);
  };

  const downloadData = async () => {
    setExporting(true);
    try {
      const me = await base44.auth.me();
      const [campaigns, follows, notifications, connectionResponse, inbox, donations] = await Promise.all([
        base44.entities.Campaign.filter({ created_by_id: me.id }),
        base44.entities.FollowedCampaign.filter({ user_id: me.id }),
        base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 200),
        base44.functions.invoke("listConnections", {}),
        base44.entities.InboxItem.filter({ user_id: me.id }, "-created_date", 200),
        base44.entities.Donation.filter({ donor_user_id: me.id }, "-created_date", 200),
      ]);
      const connections = (connectionResponse.data?.connections || [])
        .filter((connection) => connection.created_by_id === me.id)
        .map(({ credentials, credentials_meta, ...connection }) => connection);
      const payload = { exported_at: new Date().toISOString(), profile: me, campaigns, followed_campaigns: follows, notifications, connections, inbox, donations };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-interplanetary-fund-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Your data has been downloaded" });
    } catch (e) {
      console.error("Account export failed:", e?.name || "UnknownError");
      toast({ title: "Couldn't export data", description: "Your data export could not be completed. Please try again.", variant: "destructive" });
    }
    setExporting(false);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      if (isAndroidApp) await disableAndroidPush().catch(() => {});
      const res = await base44.functions.invoke("deleteAccount", {});
      if (res.data?.error) throw new Error("Server operation rejected");
      toast({ title: "Account deleted" });
      await base44.auth.logout("/login");
    } catch (e) {
      console.error("Account deletion failed:", e?.name || "UnknownError");
      toast({ title: "Couldn't delete account", description: "Account deletion could not be confirmed. Your account remains active unless the app confirms deletion.", variant: "destructive" });
      setDeleting(false);
      setDeleteOpen(false);
      setConfirmText("");
    }
  };

  return (
    <div className="space-y-5">
      {/* Notification preferences */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-4">
          <Bell className="w-3.5 h-3.5" /> Notification preferences
        </p>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-stone-800">Email updates</p>
              <p className="text-xs text-stone-500">Receive campaign updates and thank-you messages by email.</p>
            </div>
            <Switch checked={prefs.email_updates !== false} onCheckedChange={(v) => savePref("email_updates", v)} disabled={savingPrefs} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-stone-800">In-app notifications</p>
              <p className="text-xs text-stone-500">Receive alerts inside the Interplanetary Fund app.</p>
            </div>
            <Switch checked={prefs.in_app_updates !== false} onCheckedChange={(v) => savePref("in_app_updates", v)} disabled={savingPrefs} />
          </div>
        </div>
      </div>

      {/* Data export */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
          <Download className="w-3.5 h-3.5" /> Your data
        </p>
        <p className="text-sm text-stone-600 mb-4">Download a copy of your campaigns, donations, follows, and notifications.</p>
        <Button variant="outline" onClick={downloadData} disabled={exporting} className="rounded-xl">
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Download my data
        </Button>
      </div>

      {/* Count My Money — reconcile funds across connected platforms */}
      <div className="mb-5">
        <CountMyMoney />
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl border border-rose-200 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-500 mb-2">
          <ShieldAlert className="w-3.5 h-3.5" /> Danger zone
        </p>
        <p className="text-sm text-stone-600 mb-4">Permanently delete your account and all of your data. This cannot be undone.</p>
        <Button variant="outline" onClick={() => setDeleteOpen(true)} className="rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50">
          <Trash2 className="w-4 h-4 mr-2" /> Delete my account
        </Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setConfirmText(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your campaigns, donations, follows, and everything else tied to your account. Type <span className="font-semibold text-stone-800">DELETE</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm">Type DELETE to confirm</Label>
            <Input id="confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="rounded-xl" disabled={deleting}>Cancel</Button>
            <Button onClick={deleteAccount} disabled={deleting || confirmText !== "DELETE"} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white">
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}