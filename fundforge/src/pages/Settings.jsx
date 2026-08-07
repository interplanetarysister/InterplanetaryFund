import { useState } from 'react';
import { CURRENCIES, currencySymbol, getGlobalCurrency, setGlobalCurrency } from '@/utils/currency';
import { getNotifPrefs, setNotifPref, NOTIF_TYPES } from '@/utils/notifications';
import SEO from '@/components/seo/SEO';

export default function Settings() {
  const [currency, setCurrency] = useState(getGlobalCurrency());
  const [prefs, setPrefs] = useState(getNotifPrefs());

  const changeCurrency = (c) => { setCurrency(c); setGlobalCurrency(c); };
  const togglePref = (key) => { const v = !prefs[key]; setNotifPref(key, v); setPrefs({ ...prefs, [key]: v }); };

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto pb-20 md:pb-10">
      <SEO title="Settings · Kindred" description="Manage your Kindred preferences." />
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2">Preferences</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Settings</h1>
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 mb-6">
        <h2 className="font-semibold mb-1">Display Currency</h2>
        <p className="text-xs text-stone-500 mb-4">Amounts across the app convert to your preferred currency.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CURRENCIES.map((c) => (
            <button key={c} onClick={() => changeCurrency(c)} className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${currency === c ? 'bg-emerald-400 text-[#0B0F0E] border-emerald-400' : 'bg-white/[0.03] border-white/10 text-stone-300 hover:bg-white/[0.06]'}`}>
              {c} {currencySymbol(c)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <h2 className="font-semibold mb-1">Notification Preferences</h2>
        <p className="text-xs text-stone-500 mb-4">Choose which updates you want to see.</p>
        <div className="space-y-2">
          {NOTIF_TYPES.map((t) => (
            <button key={t.key} onClick={() => togglePref(t.key)} className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/10">
              <span className="text-sm text-stone-300">{t.label}</span>
              <span className={`w-9 h-5 rounded-full transition-colors relative ${prefs[t.key] ? 'bg-emerald-400' : 'bg-white/10'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${prefs[t.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}