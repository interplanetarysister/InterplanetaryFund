import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

/** Fail closed across account switches; UI state never grants server privileges. */
export function useSuperAdminAccess(user) {
  const ownerId = user?.id || null;
  const [verification, setVerification] = useState({ ownerId: null, status: "loading" });
  useEffect(() => {
    let active = true;
    if (!ownerId) {
      setVerification({ ownerId: null, status: "signed-out" });
      return () => { active = false; };
    }
    setVerification({ ownerId, status: "loading" });
    let client;
    try {
      client = authClient();
    } catch {
      setVerification({ ownerId, status: "unavailable" });
      return () => { active = false; };
    }
    async function verify() {
      try {
        const before = await client.auth.getUser();
        if (!active) return;
        if (before.error || before.data?.user?.id !== ownerId) {
          setVerification({ ownerId, status: "unavailable" });
          return;
        }
        const result = await client.rpc("ifund_current_user_is_verified_super_admin");
        if (!active) return;
        const after = await client.auth.getUser();
        if (!active) return;
        const status = after.error || after.data?.user?.id !== ownerId || result.error
          ? "unavailable"
          : result.data === true ? "super-admin" : "denied";
        setVerification({ ownerId, status });
      } catch {
        if (active) setVerification({ ownerId, status: "unavailable" });
      }
    }
    void verify();
    return () => { active = false; };
  }, [ownerId]);
  // The old account's privileged state cannot render during the first B frame.
  return verification.ownerId === ownerId ? verification.status : ownerId ? "loading" : "signed-out";
}
