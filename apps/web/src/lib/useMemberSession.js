import { useEffect, useState } from 'react';
import { authClient } from '@/api/auth';

// Presentation only. API handlers and database RLS authorize every operation.
export function useMemberSession() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    let alive = true, generation = 0, subscription;
    try {
      const client = authClient();
      const refresh = async () => {
        const current = ++generation;
        try {
          const { data, error } = await client.auth.getUser();
          if (alive && current === generation) setUser(error ? null : data?.user || null);
        } catch { if (alive && current === generation) setUser(null); }
      };
      void refresh();
      subscription = client.auth.onAuthStateChange(() => queueMicrotask(() => { if (alive) void refresh(); })).data.subscription;
    } catch { setUser(null); }
    return () => { alive = false; generation++; subscription?.unsubscribe(); };
  }, []);
  return { user };
}
