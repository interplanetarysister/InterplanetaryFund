// A saved connection row or old verified_at timestamp is not a current provider
// receipt. Display the backend's conservative state until verified adapters exist.
export function connectionStatusLabel(record) {
  return record?.status === "disconnected" ? "Disconnected" : "Verification required";
}
