import { useState, useEffect } from 'react';

const KEY = 'kindred_compare';
let cache = null;
let listeners = [];

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};
const persist = (arr) => {
  localStorage.setItem(KEY, JSON.stringify(arr));
  cache = arr;
  listeners.forEach((l) => l(arr));
};

export function useComparison() {
  const [ids, setIds] = useState(cache || load());

  useEffect(() => {
    const l = (arr) => setIds(arr);
    listeners.push(l);
    if (!cache) cache = load();
    setIds(cache);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  const toggle = (id) => {
    const cur = cache || load();
    if (cur.includes(id)) { persist(cur.filter((x) => x !== id)); return false; }
    if (cur.length >= 3) return false;
    persist([...cur, id]);
    return true;
  };
  const remove = (id) => persist((cache || load()).filter((x) => x !== id));
  const clear = () => persist([]);

  return { ids, count: ids.length, toggle, remove, clear, has: (id) => (cache || load()).includes(id) };
}