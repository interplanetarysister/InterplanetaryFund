/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * Platform Accounts Sheet — downloadable CSV tracker for social media credentials
 */
import { useState } from "react";

type PlatformAccount = {
  platform: string;
  handle: string;
  url: string;
  email: string;
  status: "active" | "inactive" | "pending";
  twoFactor: boolean;
  notes: string;
};

const DEFAULT_ACCOUNTS: PlatformAccount[] = [
  { platform: "Facebook", handle: "@InterplanetaryFund", url: "https://facebook.com/interplanetaryfund", email: "cuddlemeplatonically@gmail.com", status: "active", twoFactor: true, notes: "Main page for campaign outreach" },
  { platform: "Twitter/X", handle: "@InterplanetaryFnd", url: "https://twitter.com/interplanetaryfnd", email: "cuddlemeplatonically@gmail.com", status: "active", twoFactor: true, notes: "Story agent cross-posts here" },
  { platform: "Instagram", handle: "@interplanetaryfund", url: "https://instagram.com/interplanetaryfund", email: "cuddlemeplatonically@gmail.com", status: "pending", twoFactor: false, notes: "Not yet linked" },
  { platform: "WhatsApp", handle: "Interplanetary Fund Group", url: "", email: "cuddlemeplatonically@gmail.com", status: "active", twoFactor: false, notes: "Agent group chat" },
  { platform: "GitHub", handle: "interplanetarysister", url: "https://github.com/interplanetarysister", email: "cuddlemeplatonically@gmail.com", status: "active", twoFactor: true, notes: "Primary repo account" },
  { platform: "PayPal", handle: "interplanetarysister@gmail.com", url: "https://www.paypal.com/donate/?cmd=_donations&business=interplanetarysister@gmail.com&currency_code=USD", email: "cuddlemeplatonically@gmail.com", status: "active", twoFactor: true, notes: "Donation processing" },
  { platform: "CashApp", handle: "$unrewound", url: "https://cash.app/$unrewound", email: "cuddlemeplatonically@gmail.com", status: "active", twoFactor: false, notes: "Alt donation method" },
  { platform: "Convex", handle: "rosy-butterfly-2", url: "https://rosy-butterfly-2.convex.cloud", email: "cuddlemeplatonically@gmail.com", status: "active", twoFactor: false, notes: "Backend deployment" },
  { platform: "Vercel", handle: "interplanetary-fund", url: "https://interplanetary-fund.vercel.app", email: "cuddlemeplatonically@gmail.com", status: "active", twoFactor: true, notes: "Frontend hosting (repo: interplanetarysister/InterplanetaryFund)" },
];

export default function PlatformAccountsSheet() {
  const [accounts, setAccounts] = useState<PlatformAccount[]>(DEFAULT_ACCOUNTS);
  const [showAdd, setShowAdd] = useState(false);
  const [newAccount, setNewAccount] = useState<Partial<PlatformAccount>>({});

  const handleDownloadCSV = () => {
    const headers = ["Platform", "Handle", "URL", "Email", "Status", "2FA Enabled", "Notes"];
    const rows = accounts.map(a => [
      a.platform, a.handle, a.url, a.email, a.status, a.twoFactor ? "Yes" : "No", a.notes
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "interplanetary-fund-platforms.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAdd = () => {
    if (!newAccount.platform) return;
    setAccounts([...accounts, {
      platform: newAccount.platform || "",
      handle: newAccount.handle || "",
      url: newAccount.url || "",
      email: newAccount.email || "",
      status: (newAccount.status as any) || "pending",
      twoFactor: newAccount.twoFactor || false,
      notes: newAccount.notes || "",
    }]);
    setNewAccount({});
    setShowAdd(false);
  };

  const statusColors: Record<string, string> = {
    active: "text-green-400 bg-green-400/10",
    inactive: "text-red-400 bg-red-400/10",
    pending: "text-yellow-400 bg-yellow-400/10",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">Platform Accounts</h2>
          <p className="text-ifmuted text-xs">Track all social media and service credentials</p>
        </div>
        <button
          onClick={handleDownloadCSV}
          className="bg-ifaccent text-white rounded-lg px-3 py-2 text-xs font-medium"
        >
          ↓ Download CSV
        </button>
      </div>

      <div className="space-y-2">
        {accounts.map((a, i) => (
          <div key={i} className="bg-ifbg2 rounded-xl p-3 border border-ifborder">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white text-sm font-medium">{a.platform}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[a.status]}`}>
                {a.status}
              </span>
            </div>
            <p className="text-ifmuted text-xs">{a.handle}</p>
            {a.url && <p className="text-ifcyan text-[10px] truncate">{a.url}</p>}
            <div className="flex items-center gap-2 mt-1">
              {a.twoFactor && <span className="text-[10px] text-green-400">🔒 2FA</span>}
              <span className="text-ifmuted text-[10px]">{a.email}</span>
            </div>
            {a.notes && <p className="text-ifmuted text-[10px] mt-1 italic">{a.notes}</p>}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="bg-ifbg2 rounded-xl p-3 border border-ifborder space-y-2">
          <input type="text" placeholder="Platform name" value={newAccount.platform || ""} onChange={e => setNewAccount({...newAccount, platform: e.target.value})} className="w-full bg-ifbg border border-ifborder rounded-lg px-3 py-2 text-white text-xs" />
          <input type="text" placeholder="Handle" value={newAccount.handle || ""} onChange={e => setNewAccount({...newAccount, handle: e.target.value})} className="w-full bg-ifbg border border-ifborder rounded-lg px-3 py-2 text-white text-xs" />
          <input type="text" placeholder="URL" value={newAccount.url || ""} onChange={e => setNewAccount({...newAccount, url: e.target.value})} className="w-full bg-ifbg border border-ifborder rounded-lg px-3 py-2 text-white text-xs" />
          <input type="email" placeholder="Email" value={newAccount.email || ""} onChange={e => setNewAccount({...newAccount, email: e.target.value})} className="w-full bg-ifbg border border-ifborder rounded-lg px-3 py-2 text-white text-xs" />
          <select value={newAccount.status || "pending"} onChange={e => setNewAccount({...newAccount, status: e.target.value as any})} className="w-full bg-ifbg border border-ifborder rounded-lg px-3 py-2 text-white text-xs">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="flex-1 bg-ifaccent text-white rounded-lg py-2 text-xs font-medium">Add</button>
            <button onClick={() => setShowAdd(false)} className="px-4 bg-ifbg border border-ifborder text-ifmuted rounded-lg py-2 text-xs">Cancel</button>
          </div>
        </div>
      )}

      <button onClick={() => setShowAdd(true)} className="w-full bg-ifbg2 border border-ifborder rounded-xl py-3 text-sm text-ifmuted hover:text-ifcyan transition">
        + Add Platform Account
      </button>
    </div>
  );
}
