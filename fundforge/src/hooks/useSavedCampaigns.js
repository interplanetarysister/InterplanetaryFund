import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

let cache = null;
let listeners = [];
let loadingPromise = null;

export function useSavedCampaigns() {
  const [saved, setSaved] = useState(cache || new Set());
  const [count, setCount] = useState(cache ? cache.size : 0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const me = await base44.auth.me();
        if (!me) return;
        const items = await base44.entities.SavedCampaign.filter({ user_id: me.id }, '-created_date', 500);
        const set = new Set(items.map((i) => i.campaign_id));
        cache = set;
        if (active) {
          setSaved(set);
          setCount(set.size);
          listeners.forEach((l) => l(set));
        }
      } catch {}
    };
    if (cache) {
      setSaved(cache);
      setCount(cache.size);
    } else {
      if (!loadingPromise) loadingPromise = load();
      loadingPromise.then(() => {
        if (active) {
          setSaved(cache || new Set());
          setCount(cache ? cache.size : 0);
        }
      });
    }
    const listener = (set) => {
      setSaved(set);
      setCount(set.size);
    };
    listeners.push(listener);
    return () => {
      active = false;
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const toggle = async (campaignId, campaignTitle) => {
    const me = await base44.auth.me();
    if (!me) return false;
    const isSaved = (cache || new Set()).has(campaignId);
    if (isSaved) {
      const items = await base44.entities.SavedCampaign.filter({ user_id: me.id, campaign_id: campaignId });
      if (items[0]) await base44.entities.SavedCampaign.delete(items[0].id);
    } else {
      await base44.entities.SavedCampaign.create({ user_id: me.id, campaign_id: campaignId, campaign_title: campaignTitle || '' });
    }
    const newSet = new Set(cache || []);
    if (isSaved) newSet.delete(campaignId);
    else newSet.add(campaignId);
    cache = newSet;
    listeners.forEach((l) => l(newSet));
    return !isSaved;
  };

  return { saved, count, toggle, isSaved: (id) => (cache || new Set()).has(id) };
}