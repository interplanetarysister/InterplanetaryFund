import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { loadOwnedCampaigns, deleteOwnedDraft } from "@/lib/ownerCampaigns";
import CampaignCard from "@/components/campaigns/CampaignCard";

export default function MyCampaigns() {
  const [items, setItems] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const refresh = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const campaigns = await loadOwnedCampaigns(authClient());
      setItems(campaigns);
      setPhase("ready");
    } catch (cause) {
      setPhase("error");
      setError(cause?.message || "Campaigns could not be loaded.");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function removeDraft(id) {
    if (confirmId !== id || deletingId) return;
    setDeletingId(id);
    setError("");
    try {
      const removedId = await deleteOwnedDraft(authClient(), id);
      setItems(old => old.filter(item => item.id !== removedId));
      setConfirmId(null);
    } catch (cause) {
      setError(cause?.message || "Unable to delete this draft.");
    } finally {
      setDeletingId(null);
    }
  }

  return <main className="mx-auto max-w-6xl space-y-7 px-4 py-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold">My campaigns</h1>
        <p className="mt-2 text-muted-foreground">Manage campaigns saved to your own IFund account.</p>
      </div>
      <Link to="/create" className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Create a campaign</Link>
    </header>

    {error && <p role="alert" className="rounded-xl border border-border p-4 text-destructive">{error}
      {phase === "error" && <button type="button" className="ml-3 underline" onClick={refresh}>Retry</button>}
    </p>}
    {phase === "loading" && <p role="status">Loading your campaigns…</p>}
    {phase === "ready" && items.length === 0 && <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-semibold">No saved campaigns</h2>
      <p className="mt-2 text-muted-foreground">A private draft will appear here after you save one.</p>
      <Link to="/create" className="mt-3 inline-block underline">Start your first draft</Link>
    </section>}

    {phase === "ready" && items.length > 0 && <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(item => <li key={item.id} className="space-y-3">
        <CampaignCard campaign={item} ownerView />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold capitalize">{item.status}</span>
          {item.status === "draft" ? <>
            <Link className="text-sm font-semibold text-primary underline" to={"/create?draft=" + encodeURIComponent(item.id)}>Continue editing</Link>
            <button type="button" onClick={() => setConfirmId(confirmId === item.id ? null : item.id)}
              className="text-sm font-semibold text-destructive underline">
              {confirmId === item.id ? "Cancel removal" : "Remove draft"}
            </button>
          </> : <Link className="text-sm font-semibold text-primary underline" to={"/campaign/" + encodeURIComponent(item.id)}>View campaign</Link>}
        </div>
        {item.status === "draft" && confirmId === item.id && <section className="rounded-xl border border-destructive/40 p-4" aria-label="Confirm draft removal">
          <p className="text-sm">Remove this private draft permanently? This cannot be undone. Published campaigns cannot be removed here.</p>
          <div className="mt-3 flex gap-3">
            <button disabled={Boolean(deletingId)} type="button" onClick={() => removeDraft(item.id)}
              className="rounded-lg bg-destructive px-4 py-2 font-semibold text-destructive-foreground disabled:opacity-50">
              {deletingId === item.id ? "Removing…" : "Confirm removal"}
            </button>
            <button type="button" onClick={() => setConfirmId(null)} className="rounded-lg border border-border px-4 py-2">Keep draft</button>
          </div>
        </section>}
      </li>)}
    </ul>}
    <p className="text-sm text-muted-foreground">Campaign donations, withdrawals, and external distribution are paused until independent provider and accounting checks pass.</p>
  </main>;
}
