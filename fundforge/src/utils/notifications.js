const KEY = 'kindred_notif_prefs';
const DEFAULT = { donation: true, milestone: true, comment: true, follow: true, update: true, ending: true, payout: true };

export function getNotifPrefs() {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULT;
  }
}

export function setNotifPref(type, on) {
  const p = getNotifPrefs();
  p[type] = on;
  localStorage.setItem(KEY, JSON.stringify(p));
}

export const NOTIF_TYPES = [
  { key: 'donation', label: 'New donations' },
  { key: 'milestone', label: 'Milestones reached' },
  { key: 'comment', label: 'Comments on your campaigns' },
  { key: 'follow', label: 'New followers' },
  { key: 'update', label: 'Updates from followed campaigns' },
  { key: 'ending', label: 'Campaigns ending soon' },
  { key: 'payout', label: 'Payouts processed' },
];