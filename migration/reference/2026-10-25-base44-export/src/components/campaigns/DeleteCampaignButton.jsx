import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

export default function DeleteCampaignButton({ campaign }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDelete = async () => {
    setBusy(true);
    try {
      const { data } = await base44.functions.invoke("deleteCampaign", { campaign_id: campaign.id });
      if (data?.archived) toast({ title: "Campaign removed from public use", description: "Public campaign content was removed. Financial records were retained securely for payout and audit history." });
      else toast({ title: "Campaign deleted", description: "Your campaign and its non-financial related data have been removed." });
      navigate("/dashboard", { replace: true });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not delete", description: "Please try again or contact support." });
    }
    setBusy(false);
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-stone-500 hover:text-red-600 hover:bg-red-50">
          <Trash2 className="w-4 h-4 mr-2" /> Delete campaign
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{campaign.title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the campaign from public use along with its updates, posts, and agent activity. If the campaign has financial history, Interplanetary Fund keeps a private archived record so donations, payouts, and audit history remain intact. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Removing…</> : "Remove campaign"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}