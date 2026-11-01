import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Users, ShieldCheck, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { effectiveSubscription } from "@/lib/subscriptionEntitlements";

const TIER_LABELS = {
  free: "Free",
  basic: "Basic",
  outreach: "Outreach",
  professional: "Professional",
  enterprise: "Enterprise",
  nonprofit: "Nonprofit",
};

// User Management + Permissions Panel — admin only
// List all users; promote/demote admin role; view subscription info.
export default function UserManagementPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const load = async () => {
    const [me, all] = await Promise.all([
      base44.auth.me(),
      base44.entities.User.list("-created_date", 200),
    ]);
    setCurrentUser(me);
    setUsers(all || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const msg = (ok, text) => {
    if (ok) { setSuccess(text); setError(""); }
    else { setError(text); setSuccess(""); }
  };

  const toggleRole = async (u) => {
    if (u.id === currentUser?.id) { msg(false, "You cannot change your own role."); return; }
    const newRole = u.role === "admin" ? "user" : "admin";
    try {
      const { data } = await base44.functions.invoke("adminUpdateUserRole", { user_id: u.id, role: newRole });
      if (data?.ok !== true || data?.role !== newRole) throw new Error("role update not confirmed");
      msg(true, `${u.full_name || u.email} is now ${newRole}.`);
      load();
    } catch (e) { console.error("User role update failed:", e?.name || "UnknownError"); msg(false, "User role update failed safely; no change was confirmed."); }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const admins = users.filter((u) => u.role === "admin");
  const regularUsers = users.filter((u) => u.role !== "admin");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="font-display text-xl text-stone-900">User Management</h2>
        <span className="ml-auto text-xs text-stone-400">{users.length} total users</span>
      </div>

      {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">{success}</p>}

      {/* Admin Users */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-cyan-600" />
          <h3 className="font-medium text-stone-800">Admins ({admins.length})</h3>
        </div>
        <div className="space-y-2">
          {admins.map((u) => (
            <UserRow key={u.id} u={u} isSelf={u.id === currentUser?.id} onToggle={() => toggleRole(u)} />
          ))}
        </div>
      </section>

      {/* Regular Users */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-stone-400" />
          <h3 className="font-medium text-stone-800">Users ({regularUsers.length})</h3>
        </div>
        {regularUsers.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-6">No regular users yet.</p>
        ) : (
          <div className="space-y-2">
            {regularUsers.map((u) => (
              <UserRow key={u.id} u={u} isSelf={false} onToggle={() => toggleRole(u)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function UserRow({ u, isSelf, onToggle }) {
  const isAdmin = u.role === "admin";
  const subscription = effectiveSubscription(u);
  const tier = subscription.adminGranted ? subscription.plan.name : (TIER_LABELS[u.subscription_tier] || u.subscription_tier || "Free");
  const subActive = subscription.active;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-stone-900 text-sm truncate">{u.full_name || "(no name)"}</p>
          {isAdmin && <Badge variant="outline" className="text-[10px] bg-cyan-50 text-cyan-700 border-cyan-200">Admin</Badge>}
          {isSelf && <Badge variant="outline" className="text-[10px] bg-stone-100 text-stone-500 border-stone-200">You</Badge>}
        </div>
        <p className="text-xs text-stone-400 truncate mt-0.5">{u.email}</p>
        <p className="text-[10px] text-stone-400 mt-0.5">
          {tier} {subActive ? <span className="text-emerald-600">· Active</span> : ""}
          {!subscription.adminGranted && u.subscription_status === "past_due" ? <span className="text-amber-600"> · Past Due</span> : ""}
          {subscription.adminGranted ? <span className="text-cyan-600"> · Permanent admin access</span> : ""}
        </p>
      </div>
      {!isSelf && (
        <Button
          size="sm"
          variant="ghost"
          className={isAdmin
            ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-xs"
            : "bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 text-xs"
          }
          onClick={onToggle}
        >
          {isAdmin ? <><UserX className="w-3 h-3 mr-1" /> Demote</> : <><UserCheck className="w-3 h-3 mr-1" /> Make Admin</>}
        </Button>
      )}
    </div>
  );
}
