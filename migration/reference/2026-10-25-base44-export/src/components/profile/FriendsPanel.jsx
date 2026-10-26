import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, Check, X } from "lucide-react";

// Linked friend-account relationships. No private user-to-user messaging —
// relationships only; communication happens through Community / feed.
// Authorization is enforced server-side in manageFriends (only the recipient
// can accept/decline; only participants or admin can remove).
export default function FriendsPanel() {
  const [outgoing, setOutgoing] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      const { data } = await base44.functions.invoke("manageFriends", { action: "list" });
      setOutgoing(data.outgoing || []);
      setIncoming(data.incoming || []);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, []);

  const doLookup = async () => {
    setBusy(true); setMsg("");
    try {
      const { data } = await base44.functions.invoke("manageFriends", { action: "lookup", query });
      if (!data.found && data.can_invite) {
        await base44.functions.invoke("manageFriends", { action: "invite", email: query.trim() });
        setLookup(null); setQuery(""); setMsg("No account was found, so Interplanetary Fund sent an invitation.");
      } else {
        setLookup(data);
      }
    } catch { setMsg("Couldn't find that account."); }
    setBusy(false);
  };
  const sendRequest = async (userId) => {
    setBusy(true);
    try {
      await base44.functions.invoke("manageFriends", { action: "request", addressee_user_id: userId });
      setLookup(null); setQuery(""); setMsg("Friend request sent."); load();
    } catch { setMsg("Couldn't send the request."); }
    setBusy(false);
  };
  const respond = async (id, action) => { await base44.functions.invoke("manageFriends", { action, friendship_id: id }); load(); };
  const remove = async (id) => { await base44.functions.invoke("manageFriends", { action: "remove", friendship_id: id }); load(); };

  const pendingIncoming = incoming.filter((f) => f.status === "pending");
  const friends = [...outgoing, ...incoming].filter((f) => f.status === "accepted");

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">
        <Users className="w-3.5 h-3.5" /> Friends
      </p>
      <p className="text-sm text-stone-600 mb-3">Link friend accounts. Conversations happen in Community — there's no private messaging.</p>
      <div className="flex gap-2 mb-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find by email or handle" />
        <Button onClick={doLookup} disabled={busy || !query} size="sm" className="shrink-0"><UserPlus className="w-4 h-4" /></Button>
      </div>
      {lookup?.found && (
        <div className="flex items-center justify-between rounded-lg border border-stone-200 p-2 mb-3">
          <span className="text-sm text-stone-800 truncate min-w-0">{lookup.display_name}</span>
          <Button size="sm" onClick={() => sendRequest(lookup.user_id)} disabled={busy} className="shrink-0">Add friend</Button>
        </div>
      )}
      {lookup && !lookup.found && <p className="text-xs text-stone-500 mb-3">No account found. Enter an email address to invite them automatically.</p>}
      {msg && <p className="text-xs text-stone-500 mb-3">{msg}</p>}
      {pendingIncoming.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-stone-500 mb-1">Requests</p>
          {pendingIncoming.map((f) => (
            <div key={f.id} className="flex items-center justify-between text-sm py-1">
              <span className="text-stone-700 truncate min-w-0">{f.other_name || "Friend request"}</span>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => respond(f.id, "accept")}><Check className="w-4 h-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => respond(f.id, "decline")}><X className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-stone-500 mb-1">Your friends</p>
        {friends.length === 0 ? <p className="text-xs text-stone-400">No friends yet.</p> : friends.map((f) => (
          <div key={f.id} className="flex items-center justify-between text-sm py-1">
            <span className="text-stone-700 truncate min-w-0">{f.other_name || "Friend"}</span>
            <Button size="sm" variant="ghost" onClick={() => remove(f.id)} className="shrink-0 text-red-600">Remove</Button>
          </div>
        ))}
      </div>
    </div>
  );
}