import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Megaphone, Heart, Bell, Compass, User, X } from 'lucide-react';

const actions = [
  { to: '/create', label: 'New Campaign', icon: Megaphone },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/donations', label: 'My Donations', icon: Heart },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'My Profile', icon: User },
];

export default function QuickActions() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 z-[90] flex flex-col items-start gap-2">
      {open && (
        <div className="flex flex-col items-start gap-2 mb-1">
          {actions.map((a) => (
            <Link key={a.to} to={a.to} onClick={() => setOpen(false)} className="flex items-center gap-2">
              <span className="text-xs font-medium text-stone-100 bg-[#0E1311] border border-white/10 rounded-lg px-2.5 py-1.5 shadow-md whitespace-nowrap">{a.label}</span>
              <span className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-stone-100 shadow-md backdrop-blur"><a.icon className="w-4 h-4" /></span>
            </Link>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[#0B0F0E] shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Quick actions"
        aria-expanded={open}
      >
        {open ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
      </button>
    </div>
  );
}