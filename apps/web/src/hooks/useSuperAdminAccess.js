import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

/** Server-verified super-admin access; client metadata is never authority. */
export function useSuperAdminAccess(user) {
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setStatus("signed-out");
      return () => { active = false; };
    }
    setStatus("loading");
    let client;
    try {
      client = authClient();
    } catch {
      setStatus("unavailable");
      return () => { active = false; };
    }
    client.rpc("ifund_current_user_is_verified_super_admin")
      .then(({ data, error }) => {
        if (!active) return;
        setStatus(error ? "unavailable" : data === true ? "super-admin" : "denied");
      })
      .catch(() => { if (active) setStatus("unavailable"); });
    return () => { active = false; };
  }, [user?.id]);
  return status;
}
