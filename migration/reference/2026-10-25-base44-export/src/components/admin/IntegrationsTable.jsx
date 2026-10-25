import React from "react";
import { STATUS_BADGE, UNKNOWN_STATUS_BADGE, ENV_LABEL } from "@/lib/integrationRegistryUi";
import { ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";

const FLAG_LABEL = {
  hardcoded_endpoint: "Hardcoded endpoint",
  decentralized_credentials: "Decentralized credentials",
  dev_creds_in_prod: "Dev credentials in production",
  bypasses_central_access: "Bypasses central access",
  duplicate: "Duplicate",
  unused: "Unused",
};

export default function IntegrationsTable({ entries, onRowClick }) {
  return (
    <>
      <div className="lg:hidden space-y-3">
        {entries.map((e) => {
          const badge = STATUS_BADGE[e.status] || UNKNOWN_STATUS_BADGE;
          const verified = e.last_verified ? new Date(e.last_verified).toLocaleString() : "never";
          return (
            <button key={e.id} type="button" onClick={() => onRowClick(e)}
              className="ifund-mobile-card w-full min-w-0 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-stone-900 break-words">{e.platform}</div>
                  <div className="mt-1 text-sm leading-5 text-stone-600 break-words">{e.purpose || "Connected platform"}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-stone-500">
                <div><span className="block font-medium text-stone-700">Environment</span>{ENV_LABEL[e.environment] || e.environment || "—"}</div>
                <div><span className="block font-medium text-stone-700">Last verified</span>{verified}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="hidden lg:block overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-3 py-2.5">Platform</th>
            <th className="px-3 py-2.5">Purpose</th>
            <th className="px-3 py-2.5">Environment</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Last verified</th>
            <th className="px-3 py-2.5">Authorized agents</th>
            <th className="px-3 py-2.5">Dependencies</th>
            <th className="px-3 py-2.5">Failures</th>
            <th className="px-3 py-2.5">Flags</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const badge = STATUS_BADGE[e.status] || UNKNOWN_STATUS_BADGE;
            const verified = e.last_verified ? new Date(e.last_verified).toLocaleString() : "never";
            return (
              <tr key={e.id} onClick={() => onRowClick(e)} className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer align-top">
                <td className="px-3 py-3 font-medium text-stone-900 whitespace-nowrap">{e.platform}</td>
                <td className="px-3 py-3 text-stone-600 max-w-[200px]">{e.purpose}</td>
                <td className="px-3 py-3 text-stone-600">{ENV_LABEL[e.environment] || e.environment}</td>
                <td className="px-3 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span></td>
                <td className="px-3 py-3 text-stone-500 whitespace-nowrap">{verified}</td>
                <td className="px-3 py-3">
                  {(e.authorized_agents || []).length ? (
                    <div className="flex flex-wrap gap-1">
                      {e.authorized_agents.map((a) => (
                        <span key={a} className="rounded-full bg-cyan-50 text-cyan-700 px-2 py-0.5 text-xs">{a}</span>
                      ))}
                    </div>
                  ) : <span className="text-stone-400 text-xs">service-only</span>}
                </td>
                <td className="px-3 py-3 text-stone-500 text-xs">{(e.dependencies || []).join(", ") || "—"}</td>
                <td className="px-3 py-3">
                  {e.auth_failures > 0 ? (
                    <span className="inline-flex items-center gap-1 text-red-600 text-xs"><AlertTriangle className="w-3 h-3" />{e.auth_failures}</span>
                  ) : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                </td>
                <td className="px-3 py-3">
                  {(e.cleanup_flags || []).length ? (
                    <div className="flex flex-wrap gap-1">
                      {e.cleanup_flags.map((f) => (
                        <span key={f} className="rounded bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[11px]">{FLAG_LABEL[f] || f}</span>
                      ))}
                    </div>
                  ) : <span className="text-stone-400 text-xs">—</span>}
                </td>
              </tr>
            );
          })}
          {!entries.length && (
            <tr><td colSpan={9} className="px-3 py-10 text-center text-stone-400"><ShieldAlert className="w-6 h-6 mx-auto mb-2 text-stone-300" />No integrations registered yet.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}
