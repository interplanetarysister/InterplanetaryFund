import { Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Sparkles, LayoutDashboard, Megaphone, Heart, Users, BarChart3, LayoutGrid, ShieldCheck, Bell, Settings as SettingsIcon, Mail, Bookmark, LifeBuoy, Gift, GitCompare, Trophy, User } from 'lucide-react';
import BackToTop from '@/components/BackToTop';
import WhatsNewModal from '@/components/WhatsNewModal';
import ChatWidget from '@/components/ChatWidget';
import QuickActions from '@/components/QuickActions';
import { useComparison } from '@/hooks/useComparison';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { useSavedCampaigns } from '@/hooks/useSavedCampaigns';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/discover', label: 'Campaigns', icon: Megaphone },
  { to: '/categories', label: 'Categories', icon: LayoutGrid },
  { to: '/donations', label: 'Donations', icon: Heart },
  { to: '/donors', label: 'Donors', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function Layout() {
  const location = useLocation();
  const [campaignCount, setCampaignCount] = useState(0);
  const [user, setUser] = useState(null);
  const [unread, setUnread] = useState(0);
  const { count: savedCount } = useSavedCampaigns();
  const { count: compareCount } = useComparison();
  const contactUrl = 'https://mail.google.com/mail/?view=cm&fs=1&to=cuddlemeplatonically@gmail.com&su=Kindred%20Developer%20Contact';

  useEffect(() => {
    base44.entities.Campaign.list('-created_date', 500).then((c) => setCampaignCount(c.length)).catch(() => {});
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    base44.entities.Notification.filter({ recipient_id: user.id, read: false }).then((n) => setUnread(n.length)).catch(() => {});
  }, [user]);

  useEffect(() => {
    let gPressed = false;
    let gTimer;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.key === 'g') {
        gPressed = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPressed = false; }, 800);
        return;
      }
      if (gPressed && e.key === 'h') { window.location.href = '/'; gPressed = false; return; }
      if (e.key === '/') { e.preventDefault(); window.location.href = '/discover'; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0F0E] text-stone-100 flex">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[200] focus:bg-emerald-400 focus:text-[#0B0F0E] focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium">Skip to main content</a>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-[#0E1311] px-5 py-7 fixed inset-y-0">
        <Link to="/" className="flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Sparkles className="w-5 h-5 text-[#0B0F0E]" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-semibold tracking-tight">Kindred</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Fundraising OS</p>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className={cn('flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all', active ? 'bg-white/[0.06] text-white' : 'text-stone-400 hover:text-stone-100 hover:bg-white/[0.03]')}>
                <item.icon className="w-[18px] h-[18px]" />
                <span className="flex-1">{item.label}</span>
                {item.label === 'Campaigns' && campaignCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300">{campaignCount}</span>
                )}
              </Link>
            );
          })}
        </nav>
        {user?.role === 'admin' && (
          <Link to="/admin" className={cn('flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all mt-2', location.pathname === '/admin' ? 'bg-white/[0.06] text-white' : 'text-amber-300/80 hover:text-amber-200 hover:bg-white/[0.03]')}>
            <ShieldCheck className="w-[18px] h-[18px]" /> Admin
          </Link>
        )}
        <div className="mt-auto rounded-xl border border-white/5 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
          <p className="text-xs font-medium text-emerald-300 mb-1">AI Campaign Agent</p>
          <p className="text-[11px] text-stone-400 leading-relaxed mb-3">Let AI interview you and craft a compelling fundraiser in minutes.</p>
          <Link to="/create" className="text-xs font-medium text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1">Start interview <Sparkles className="w-3 h-3" /></Link>
        </div>
        <div className="mt-4 pt-4 border-t border-white/5 space-y-1">
          <Link to="/notifications" className="relative flex items-center gap-2 text-xs text-stone-500 hover:text-stone-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
            <Bell className="w-3.5 h-3.5" /> Notifications
            {unread > 0 && <span className="ml-auto text-[9px] px-1.5 rounded-full bg-rose-500 text-white">{unread}</span>}
          </Link>
          <Link to="/profile" className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
            <User className="w-3.5 h-3.5" /> Profile
          </Link>
          <Link to="/settings" className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
            <SettingsIcon className="w-3.5 h-3.5" /> Settings
          </Link>
          <Link to="/saved" className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
            <Bookmark className="w-3.5 h-3.5" /> Saved
            {savedCount > 0 && <span className="ml-auto text-[9px] px-1.5 rounded-full bg-emerald-400/20 text-emerald-300">{savedCount}</span>}
          </Link>
          <Link to="/help" className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
            <LifeBuoy className="w-3.5 h-3.5" /> Help Center
          </Link>
          <Link to="/compare" className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
            <GitCompare className="w-3.5 h-3.5" /> Compare
            {compareCount > 0 && <span className="ml-auto text-[9px] px-1.5 rounded-full bg-emerald-400/20 text-emerald-300">{compareCount}</span>}
          </Link>
          <Link to="/leaderboard" className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
            <Trophy className="w-3.5 h-3.5" /> Leaderboard
          </Link>
          <button onClick={() => window.dispatchEvent(new CustomEvent('kindred:whatsnew'))} className="w-full flex items-center gap-2 text-xs text-stone-500 hover:text-stone-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
            <Gift className="w-3.5 h-3.5" /> What's New
          </button>
          <button onClick={() => window.open(contactUrl, '_blank')} className="w-full flex items-center gap-2 text-xs text-stone-500 hover:text-stone-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
            <Mail className="w-3.5 h-3.5" /> Contact Developer
          </button>
          <p className="text-[10px] text-stone-600 mt-2 px-2">© 2026 Kindred</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 bg-[#0E1311]/90 backdrop-blur border-b border-white/5">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#0B0F0E]" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-sm">Kindred</span>
        </Link>
        <Link to="/notifications" className="relative w-9 h-9 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-100">
          <Bell className="w-5 h-5" />
          {unread > 0 && <span className="absolute top-1 right-1 text-[8px] px-1 rounded-full bg-rose-500 text-white">{unread}</span>}
        </Link>
      </div>

      <main id="main-content" className="flex-1 md:ml-64 pt-14 md:pt-0 pb-16 md:pb-0 focus:outline-none">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0E1311]/95 backdrop-blur border-t border-white/5 flex">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link key={item.to} to={item.to} className={cn('flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors relative', active ? 'text-emerald-400' : 'text-stone-500')}>
              <item.icon className="w-5 h-5" />
              {item.label}
              {item.label === 'Campaigns' && campaignCount > 0 && (
                <span className="absolute top-1.5 right-[26%] text-[8px] px-1 rounded-full bg-emerald-400/20 text-emerald-300">{campaignCount}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <BackToTop />
      <WhatsNewModal />
      <QuickActions />
      <ChatWidget />
    </div>
  );
}