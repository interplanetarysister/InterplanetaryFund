import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";
import { memberIdentity } from "@/lib/guestAccess";

// Session state for the app shell. Client-side state only drives navigation
// and labels; Supabase row level security stays authoritative for every read
// and write. When Supabase is not configured this reports signed-out so the
// public site still renders.
export function useAuthSession() {
  const [state, setState] = useState({ status: "loading", user: null });

  useEffect(() => {
    let alive = true;
    let subscription;
    let client;
    let revision = 0;
    try {
      client = authClient();
    } catch {
      setState({ status: "signed-out", user: null });
      return () => {
        alive = false;
      };
    }
    client.auth
      .getUser()
      .then(({ data, error }) => {
        if (!alive || revision !== 0) return;
        setState(
          error || !memberIdentity(data?.user)
            ? { status: "signed-out", user: null }
            : { status: "signed-in", user: data.user },
        );
      })
      .catch(() => {
        if (alive && revision === 0)
          setState({ status: "signed-out", user: null });
      });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      revision++;
      setState(
        memberIdentity(session?.user)
          ? { status: "signed-in", user: session.user }
          : { status: "signed-out", user: null },
      );
    });
    subscription = data?.subscription;

    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, []);

  return state;
}
