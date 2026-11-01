import { createContext, useContext, useEffect, useState } from "react";
import { authClient } from "@/api/auth";
import { resolveVerifiedEmailUser } from "@/lib/verifiedEmailUser";
import { verifyAccountLifecycle } from "@/lib/accountLifecycle";

const VerifiedUserContext = createContext(null);

// Mount once above the router. Every page, layout and route guard consumes the
// same verified identity and the same Supabase Auth subscription.
export function VerifiedUserProvider({ children }) {
  const [state, setState] = useState({ phase: "loading", user: null });

  useEffect(() => {
    let mounted = true;
    let generation = 0;
    let subscription;
    let blockedMessage = null;

    const verify = async () => {
      const attempt = ++generation;
      try {
        const client = authClient();
        const user = await resolveVerifiedEmailUser(client.auth);
        if (!mounted || attempt !== generation) return;
        if (!user) {
          setState({ phase: "ready", user: null });
          return;
        }

        const lifecycle = await verifyAccountLifecycle(client, user);
        if (!mounted || attempt !== generation) return;
        if (!lifecycle.ok) {
          if (lifecycle.status === 401 || lifecycle.status === 403) {
            blockedMessage = lifecycle.message || "This account is not active.";
            setState({ phase: "blocked", user: null, message: blockedMessage });
            await client.auth.signOut().catch(() => {});
            return;
          }
          throw new Error(lifecycle.message || "Account status could not be verified.");
        }

        blockedMessage = null;
        setState({ phase: "ready", user });
      } catch {
        if (mounted && attempt === generation) setState({ phase: "error", user: null });
      }
    };

    try {
      const client = authClient();
      const { data } = client.auth.onAuthStateChange((event) => {
        if (!mounted) return;
        if (event === "SIGNED_OUT") {
          generation += 1;
          setState(blockedMessage
            ? { phase: "blocked", user: null, message: blockedMessage }
            : { phase: "ready", user: null });
          return;
        }
        if (["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "INITIAL_SESSION"].includes(event)) {
          blockedMessage = null;
          void verify();
        }
      });
      subscription = data?.subscription;
      void verify();
    } catch {
      if (mounted) setState({ phase: "error", user: null });
    }

    return () => {
      mounted = false;
      generation += 1;
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <VerifiedUserContext.Provider value={state}>
      {children}
    </VerifiedUserContext.Provider>
  );
}

export default function useVerifiedUser() {
  const state = useContext(VerifiedUserContext);
  if (!state) throw new Error("useVerifiedUser must be used within VerifiedUserProvider.");
  return state;
}
