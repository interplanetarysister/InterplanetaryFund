import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Search, LifeBuoy, ThumbsUp, ThumbsDown, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import SEO from '@/components/seo/SEO';

const categories = ['Getting Started', 'Creating Campaigns', 'Donating', 'Payouts', 'Account & Security'];

export default function Help() {
  const { toast } = useToast();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    base44.entities.HelpArticle.list('-created_date', 100).then(setArticles).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return articles;
    const q = query.toLowerCase();
    return articles.filter((a) => (a.question || '').toLowerCase().includes(q) || (a.answer || '').toLowerCase().includes(q));
  }, [articles, query]);

  const grouped = useMemo(() => {
    const m = {};
    categories.forEach((c) => (m[c] = []));
    filtered.forEach((a) => { if (!m[a.category]) m[a.category] = []; m[a.category].push(a); });
    return m;
  }, [filtered]);

  const popular = useMemo(() => [...articles].sort((a, b) => (b.helpful_yes || 0) - (a.helpful_yes || 0)).slice(0, 3), [articles]);

  const vote = async (a, up) => {
    try {
      const upd = up ? { helpful_yes: (a.helpful_yes || 0) + 1 } : { helpful_no: (a.helpful_no || 0) + 1 };
      await base44.entities.HelpArticle.update(a.id, upd);
      setArticles(articles.map((x) => (x.id === a.id ? { ...x, ...upd } : x)));
      toast({ title: 'Thanks for your feedback', variant: 'success' });
    } catch {}
  };

  const submit = async () => {
    if (!form.name || !form.email || !form.message) {
      toast({ title: 'Please fill all fields', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await base44.entities.SupportTicket.create({ ...form, status: 'open' });
      toast({ title: 'Support ticket created', description: 'We will get back to you soon.', variant: 'success' });
      setForm({ name: '', email: '', subject: '', message: '' });
      setShowForm(false);
    } catch (e) {
      toast({ title: 'Failed to submit', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto pb-20 md:pb-10">
      <SEO title="Help Center · Kindred" description="Find answers and get support on Kindred." />
      <div className="text-center mb-8">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4"><LifeBuoy className="w-6 h-6 text-emerald-400" /></div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Help Center</h1>
        <p className="text-sm text-stone-500 mt-2">How can we help?</p>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search articles…" className="pl-10 bg-white/[0.03] border-white/10 rounded-xl" />
      </div>

      {!query && popular.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-emerald-400 mb-3">Popular Articles</h2>
          <div className="space-y-2">
            {popular.map((a) => (
              <button key={a.id} onClick={() => setOpenId(a.id)} className="w-full text-left rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] p-4 text-sm font-medium">{a.question}</button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-stone-500 animate-spin" /></div>
      ) : (
        Object.entries(grouped).map(([cat, arts]) => arts.length > 0 && (
          <div key={cat} className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-emerald-400 mb-3">{cat}</h2>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] divide-y divide-white/5 overflow-hidden">
              {arts.map((a) => (
                <div key={a.id}>
                  <button onClick={() => setOpenId(openId === a.id ? null : a.id)} className="w-full flex items-center justify-between p-4 text-left text-sm font-medium">
                    {a.question}
                    <ChevronDown className={cn('w-4 h-4 text-stone-500 transition-transform shrink-0 ml-2', openId === a.id && 'rotate-180')} />
                  </button>
                  {openId === a.id && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-stone-400 leading-relaxed whitespace-pre-wrap mb-3">{a.answer}</p>
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span>Was this helpful?</span>
                        <button onClick={() => vote(a, true)} className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center"><ThumbsUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => vote(a, false)} className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center"><ThumbsDown className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <div className="mt-10 text-center">
        <Button onClick={() => setShowForm(!showForm)} variant="outline" className="border-white/10 bg-white/[0.03] gap-2 rounded-xl">Contact Support</Button>
      </div>
      {showForm && (
        <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-6 space-y-3">
          <Input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/[0.03] border-white/10 rounded-xl" />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-white/[0.03] border-white/10 rounded-xl" />
          <Input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="bg-white/[0.03] border-white/10 rounded-xl" />
          <Textarea placeholder="How can we help?" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="bg-white/[0.03] border-white/10 rounded-xl resize-none" />
          <Button onClick={submit} disabled={submitting} className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] rounded-xl gap-2">{submitting && <Loader2 className="w-4 h-4 animate-spin" />} Submit Ticket</Button>
        </div>
      )}
    </div>
  );
}