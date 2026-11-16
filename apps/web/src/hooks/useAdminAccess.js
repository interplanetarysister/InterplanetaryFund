import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

/** Server-verified admin access. Client metadata is never treated as authority. */
export function useAdminAccess(user) {
  const ownerId = user?.id || null;
  const [verification, setVerification] = useState({ ownerId: null, status: "loading" });
  useEffect(() => {
    let active = true;
    const publish = status => { if (active) setVerification({ ownerId, status }); };
    if (!ownerId) {
      publish("signed-out");
      return () => { active = false; };
    }
    publish("loading");
    let client;
    try {
      client = authClient();
    } catch {
      publish("unavailable");
      return () => { active = false; };
    }
    (async () => {
      const before = await client.auth.getUser();
      if (!active) return;
      if (before.error || before.data?.user?.id !== ownerId) { publish("unavailable"); return; }
      const { data, error } = await client.rpc("ifund_current_user_is_verified_admin");
      if (!active) return;
      const after = await client.auth.getUser();
      publish(error || after.error || after.data?.user?.id !== ownerId
        ? "unavailable" : data === true ? "admin" : "denied");
    })().catch(() => publish("unavailable"));
    return () => { active = false; };
  }, [ownerId]);
  // Effects run after render: never show A's privileged result in B's first frame.
  return verification.ownerId === ownerId ? verification.status : ownerId ? "loading" : "signed-out";
}
