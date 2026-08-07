import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, Home as HomeIcon } from 'lucide-react';

export default function PageNotFound() {
  const [query, setQuery] = useState('');
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    base44.entities.Campaign.filter({ status: 'active' }, '-raised', 3).then(setCampaigns).catch(() => {});
  }, []);

  const submit = (e) => {
    e.preventDefault();
    window.location.href = '/discover';
  };

  return (
    <div className="min-h-screen bg-[#0B0F0E] text-stone-100 flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        <p className="text-7xl font-light text-stone-700 mb-2">404</p>
        <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
        <p className="text-sm text-stone-500 mb-6">The page you're looking for doesn't exist or has moved.</p>
        <form onSubmit={submit} className="relative max-w-sm mx-auto mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search campaigns…" className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm placeholder:text-stone-600 focus:outline-none focus:border-emerald-400/40" />
        </form>
        {campaigns.length > 0 && (
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wider text-emerald-400 mb-3">Popular Campaigns</p>
            <div className="space-y-2">
              {campaigns.map((c) => (
                <Link key={c.id} to={`/campaign/${c.id}`} className="block text-sm text-stone-300 hover:text-emerald-300 truncate">{c.title}</Link>
              ))}
            </div>
          </div>
        )}
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] font-medium text-sm"><HomeIcon className="w-4 h-4" /> Back to Dashboard</Link>
      </div>
    </div>
  );
}