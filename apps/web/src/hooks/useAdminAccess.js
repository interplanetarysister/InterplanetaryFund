import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

/** Server-verified admin access. Client metadata is never treated as authority. */
export function useAdminAccess(user) {
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
    client.rpc("ifund_current_user_is_verified_admin")
      .then(({ data, error }) => {
        if (!active) return;
        setStatus(error ? "unavailable" : data === true ? "admin" : "denied");
      })
      .catch(() => { if (active) setStatus("unavailable"); });
    return () => { active = false; };
  }, [user?.id]);
  return status;
}
