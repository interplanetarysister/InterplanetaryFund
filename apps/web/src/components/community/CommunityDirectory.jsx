import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { createCommunity, listPublicCommunities } from "@/api/communityGroups";

export default function CommunityDirectory() {
  const { user } = useAuthSession();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", location: "" });
  const refresh = useCallback(async () => {
    setPhase("loading"); setError("");
    try {
      const result = await listPublicCommunities();
      setGroups(result);
      setPhase("ready");
    } catch (cause) {
      setError(cause?.message || "Community directory is unavailable.");
      setPhase("error");
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function submit(event) {
    event.preventDefault();
    if (creating) return;
    setCreating(true); setError("");
    try {
      const result = await createCommunity(form);
      navigate("/community/" + encodeURIComponent(result.id));
    } catch (cause) {
      setError(cause?.message || "The community could not be created.");
    } finally {
      setCreating(false);
    }
  }

  return <section aria-labelledby="ifund-community-directory" className="mx-auto max-w-5xl space-y-4 px-4 py-7">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="ifund-community-directory" className="text-2xl font-bold">Community groups</h2>
        <p className="mt-1 text-sm text-muted-foreground">Connect around shared interests and local causes. Groups are separate from the public discussion feed.</p>
      </div>
      {user && !user.is_anonymous
        ? <button type="button" className="min-h-11 rounded-xl bg-cyan-600 px-5 font-semibold text-white"
            onClick={() => setOpen(value => !value)} aria-expanded={open}>
            {open ? "Close form" : "Create a group"}
          </button>
        : <Link to="/register?returnTo=%2Fcommunity" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-semibold">
            Sign in to create a group
          </Link>}
    </header>
    {open && <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-border bg-card p-5" aria-label="Create a community group">
      <label className="text-sm font-semibold">Group name
        <input className="mt-2 block w-full rounded-xl border border-input bg-background p-3" required
          value={form.name} minLength={3} maxLength={90} onChange={event => setForm(v => ({ ...v, name: event.target.value }))}/>
      </label>
      <label className="text-sm font-semibold">Purpose and community guidelines
        <textarea className="mt-2 block w-full rounded-xl border border-input bg-background p-3" required rows={4}
          value={form.description} minLength={15} maxLength={2000} onChange={event => setForm(v => ({ ...v, description: event.target.value }))}/>
      </label>
      <label className="text-sm font-semibold">Location (optional)
        <input className="mt-2 block w-full rounded-xl border border-input bg-background p-3" maxLength={120}
          value={form.location} onChange={event => setForm(v => ({ ...v, location: event.target.value }))}/>
      </label>
      <p className="text-xs text-muted-foreground">Your account must be active and have accepted the current IFund terms. Public group details can be viewed by anyone; membership identities stay private.</p>
      <button type="submit" disabled={creating} className="min-h-11 rounded-xl bg-cyan-600 px-4 font-semibold text-white disabled:opacity-60">
        {creating ? "Creating group…" : "Create community group"}
      </button>
    </form>}
    {error && <p role="alert" className="rounded-xl border border-red-400/40 p-3 text-sm">{error}
      {phase === "error" && <button type="button" className="ml-3 underline" onClick={refresh}>Retry</button>}
    </p>}
    {phase === "loading" && <p role="status">Loading verified community groups…</p>}
    {phase === "ready" && (groups.length
      ? <div className="grid gap-3 sm:grid-cols-2">
          {groups.map(group => <Link key={group.id} to={"/community/" + encodeURIComponent(group.id)}
            className="block rounded-2xl border border-border bg-card p-5 hover:border-cyan-500">
            <h3 className="text-lg font-semibold">{group.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{group.location || "Worldwide"}</p>
            <p className="mt-3 line-clamp-3 text-sm">{group.description}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-cyan-600">Explore group</span>
          </Link>)}
        </div>
      : <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          No independently verified community groups have been created yet. Members can start one without importing unverified legacy records.
        </p>)}
  </section>;
}
