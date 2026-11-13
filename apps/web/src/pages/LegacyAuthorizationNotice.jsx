import { Link } from "react-router-dom";
import BrandLogo from "@/components/brand/BrandLogo";

/**
 * The old Base44 MCP-app consent URL is not an authorization protocol on
 * the independent Cloudflare/Supabase application. It has no validated
 * server-initiated authorization transaction and MUST NOT accept an opaque
 * client_id, scope or redirect_uri from browser query parameters.
 * Users start a new provider-approved connection instead.
 */
export default function LegacyAuthorizationNotice() {
  return <main className="ifund-public ifund-auth min-h-dvh flex items-center justify-center px-5 py-12 text-white">
    <div className="w-full max-w-xl">
      <Link to="/" className="inline-flex items-center rounded-xl" aria-label="Interplanetary Fund home">
        <BrandLogo size="sm" nameClassName="text-slate-100" />
      </Link>
      <section className="ifund-auth-card mt-7 space-y-4 rounded-3xl p-7 sm:p-10">
        <h1 className="text-2xl font-semibold">This authorization link has expired</h1>
        <p className="text-sm leading-relaxed text-slate-200">
          This address belongs to a retired legacy connection flow. No account
          access or permissions have been granted. Begin a new secure connection
          from your Connections page to review the provider's current permissions.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/connections" className="inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950">
            Manage connections
          </Link>
          <Link to="/help" className="inline-flex min-h-11 items-center rounded-xl border border-slate-500 px-4 font-semibold">
            Get help
          </Link>
        </div>
        <p className="text-xs text-slate-300">Unrecognized authorization links are never approved, forwarded, or exchanged for tokens.</p>
      </section>
    </div>
  </main>;
}
