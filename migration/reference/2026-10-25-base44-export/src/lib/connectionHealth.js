// Connections never expire based on time. A connection stays "connected" until
// the user manually disconnects or a real provider error occurs. There is no
// staleness check — if the platform verified the connection, it stays working.
export function connectionHealth(connection) {
  if (!connection || connection.status === "disconnected") {
    return { key: "disconnected", label: "Connect", usable: false, needsAttention: false };
  }

  const hasError = connection.status === "error" || !!connection.last_error;
  const verified = connection.status === "connected" && connection.verification_status === "verified";

  if (hasError || !verified) {
    return {
      key: "needs_attention",
      label: "Needs attention",
      usable: false,
      needsAttention: true,
      reason: connection.last_error || "Connection is not verified.",
    };
  }

  return { key: "connected", label: "Connected", usable: true, needsAttention: false };
}

// Canonical lifecycle labels returned by resolveConnectionStatus. A SHARED
// connector and a per-user connection share the same vocabulary, so the card
// and the page summary never disagree on what "working" means.
export const LIFECYCLE_LABELS = {
  CONNECTED: "Connected",
  DEGRADED: "Needs attention",
  RECONNECT_REQUIRED: "Reconnect",
  AUTHORIZATION_REQUIRED: "Authorize",
  CONNECTING: "Connecting",
  NOT_CONNECTED: "Connect",
  DISCONNECTED: "Connect",
  BLOCKED: "Blocked",
};

export function lifecycleHealth(resolved) {
  if (!resolved) return null;
  const lifecycle = resolved.lifecycle;
  const usable = lifecycle === "CONNECTED";
  const needsAttention = [
    "DEGRADED",
    "RECONNECT_REQUIRED",
    "AUTHORIZATION_REQUIRED",
    "CONNECTING",
    "BLOCKED",
  ].includes(lifecycle);
  return {
    key: String(lifecycle || "unknown").toLowerCase(),
    label: LIFECYCLE_LABELS[lifecycle] || lifecycle || "Unknown",
    usable,
    needsAttention,
    reason: resolved.recovery_hint || resolved.last_error || null,
    transport: resolved.transport || null,
    ownership_mode: resolved.ownership_mode || null,
  };
}

export function isUsableConnection(connection) {
  return connectionHealth(connection).usable;
}