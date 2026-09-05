/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Permissions Manager — Super Admin only.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const PERMISSION_LABELS: Record<string, string> = {
  finance: "Finance — Treasury, payouts, fees",
  campaigns: "Campaigns — Create, update, sync",
  platforms: "Platforms — External connections",
  content: "Content — Posts and outreach",
  settings: "Settings — Platform config",
  reports: "Reports — Analytics and data",
};

const ALL_PERMISSIONS = ["finance", "campaigns", "platforms", "content", "settings", "reports"];

export default function PermissionsManager({ sessionId }: { sessionId: string }) {
  const adminUsers = useQuery(api.adminUsers.getAdminUsers, { sessionId: sessionId as any });
  const createAdmin = useMutation(api.adminUsers.createAdminUser);
  const updatePerms = useMutation(api.adminUsers.updateAdminPermissions);
  const deleteAdmin = useMutation(api.adminUsers.deleteAdminUser);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPerms, setNewPerms] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const togglePerm = (perm: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(perm) ? list.filter((p) => p !== perm) : [...list, perm]);
  };

  const handleCreate = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!newName.trim() || !newEmail.trim() || newPin.length < 4) {
      setErrorMsg("All fields are required. PIN must be at least 4 digits.");
      return;
    }
    try {
      const result = await createAdmin({
        sessionId: sessionId as any,
        name: newName.trim(),
        email: newEmail.trim(),
        pin: newPin,
        permissions: newPerms,
      });
      if (!result.success) {
        setErrorMsg(result.error || "Failed to create admin user.");
        return;
      }
      setSuccessMsg(`Admin user "${newName.trim()}" created successfully.`);
      setNewName("");
      setNewEmail("");
      setNewPin("");
      setNewPerms([]);
      setShowCreateForm(false);
    } catch (e: any) {
      setErrorMsg(e.message || "Error creating admin user.");
    }
  };

  const handleToggleActive = async (user: any) => {
    setErrorMsg("");
    try {
      await updatePerms({
        sessionId: sessionId as any,
        userId: user._id,
        // Preserve the existing permission set when changing active status.
        permissions: user.permissions || [],
        active: !user.active,
      });
      setSuccessMsg(`Admin ${!user.active ? "activated" : "deactivated"}.`);
    } catch (e: any) {
      setErrorMsg(e.message || "Unable to update admin status.");
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`Remove admin access for "${name}"? This cannot be undone.`)) return;
    setErrorMsg("");
    try {
      await deleteAdmin({ sessionId: sessionId as any, userId: userId as any });
      setSuccessMsg(`Admin "${name}" removed.`);
    } catch (e: any) {
      setErrorMsg(e.message || "Unable to remove admin.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="card border-ifaccent/30">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-ifaccent">Super Admin Panel</span>
        </div>
        <p className="text-[10px] text-ifmuted">
          This panel uses the active server-verified admin session. Finance access remains super-admin only.
        </p>
      </div>

      {errorMsg && <div className="bg-ifred/10 border border-ifred/30 rounded-xl p-3"><p className="text-xs text-ifred">{errorMsg}</p></div>}
      {successMsg && <div className="bg-ifgreen/10 border border-ifgreen/30 rounded-xl p-3"><p className="text-xs text-ifgreen">{successMsg}</p></div>}

      {!showCreateForm && (
        <button onClick={() => setShowCreateForm(true)} className="w-full py-3 rounded-xl bg-ifaccent text-white text-sm font-semibold">
          + Add Admin User
        </button>
      )}

      {showCreateForm && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-iftext">New Admin User</h3>
          <input type="text" placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} className="input-field" />
          <input type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="input-field" />
          <input type="password" inputMode="numeric" maxLength={8} placeholder="PIN (4-8 digits)" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} className="input-field" />

          <div>
            <p className="text-xs text-ifmuted mb-2">Permissions:</p>
            <div className="space-y-2">
              {ALL_PERMISSIONS.map((perm) => (
                <label key={perm} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${newPerms.includes(perm) ? "bg-ifaccent/10 border-ifaccent/30" : "bg-ifdark border-ifborder"}`}>
                  <input type="checkbox" checked={newPerms.includes(perm)} onChange={() => togglePerm(perm, newPerms, setNewPerms)} className="w-4 h-4 accent-ifaccent" />
                  <span className="text-xs text-iftext">{PERMISSION_LABELS[perm]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleCreate} className="flex-1 btn-primary py-2.5 text-sm">Create</button>
            <button onClick={() => setShowCreateForm(false)} className="px-4 py-2.5 rounded-xl border border-ifborder text-ifmuted text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Admin Users</h3>
        {!adminUsers && <div className="flex items-center justify-center py-4"><div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" /></div>}
        {adminUsers?.length === 0 && <p className="text-xs text-ifmuted text-center py-4">No delegated admin users are configured.</p>}

        {adminUsers?.map((u: any) => (
          <div key={u._id} className="bg-ifdark rounded-xl p-3 mb-2 border border-ifborder">
            <div className="flex items-center justify-between mb-2">
              <div><p className="text-sm font-medium text-iftext">{u.name}</p><p className="text-[10px] text-ifmuted">{u.email}</p></div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${u.role === "super_admin" ? "bg-ifaccent/20 text-ifaccent" : u.active ? "bg-ifgreen/20 text-ifgreen" : "bg-ifred/20 text-ifred"}`}>
                {u.role === "super_admin" ? "SUPER ADMIN" : u.active ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {u.role === "super_admin" ? <span className="text-[10px] text-ifaccent">Full access (all permissions)</span> : (u.permissions || []).map((p: string) => <span key={p} className="px-1.5 py-0.5 rounded bg-ifborder text-[10px] text-ifmuted">{p}</span>)}
            </div>
            {u.role !== "super_admin" && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => handleToggleActive(u)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium ${u.active ? "bg-ifred/10 text-ifred border border-ifred/30" : "bg-ifgreen/10 text-ifgreen border border-ifgreen/30"}`}>
                  {u.active ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => handleDelete(u._id, u.name)} className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-ifred/10 text-ifred border border-ifred/30">Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
