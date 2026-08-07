import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, DollarSign, TrendingUp, MessageCircle, UserPlus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNotifPrefs } from '@/utils/notifications';
import SEO from '@/components/seo/SEO';

const iconFor = (t) => ({ donation: DollarSign, milestone: TrendingUp, comment: MessageCircle, follow: UserPlus, update: Bell, ending: Clock, payout: DollarSign }[t] || Bell);

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async (user) => {
    try {
      const all = await base44.entities.Notification.filter({ recipient_id: user.id }, '-created_date', 100);
      const prefs = getNotifPrefs();
      setItems(all.filter((n) => prefs[n.type] !== false));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        if (me) await load(me);
        else setLoading(false);
      } catch {
        setLoading(false);
      }
    })();
  }, []);

  const markAllRead = async () => {
    try {
      const me = await base44.auth.me();
      await base44.entities.Notification.updateMany({ recipient_id: me.id, read: false }, { $set: { read: true } });
      await load(me);
    } catch (e) {}
  };

  const open = async (n) => {
    if (!n.read) {
      try { await base44.entities.Notification.update(n.id, { read: true }); } catch {}
    }
    if (n.link) navigate(n.link);
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto pb-20 md:pb-10">
      <SEO title="Notifications · Kindred" description="Your Kindred notifications." />
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2">Inbox</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Notifications</h1>
        </div>
        {unread > 0 && <Button onClick={markAllRead} variant="outline" className="border-white/10 bg-white/[0.03] gap-2 rounded-xl"><CheckCheck className="w-4 h-4" /> Mark all read</Button>}
      </div>
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-white/[0.02] animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-stone-500">You're all caught up.</div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <button key={n.id} onClick={() => open(n)} className={cn('w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-colors', n.read ? 'border-white/5 bg-white/[0.02]' : 'border-emerald-400/20 bg-emerald-400/[0.03]')}>
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-emerald-400" /></div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', n.read ? 'text-stone-300' : 'text-stone-100 font-medium')}>{n.message}</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">{new Date(n.created_date).toLocaleString()}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}