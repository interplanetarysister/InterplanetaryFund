/**
 * PayPal SDK v6 / Orders v2 3-D Secure capture gate.
 * A missing authentication result means 3DS was not required for this test order;
 * never infer positive authentication from a NO or UNKNOWN result.
 * PayPal permits NO only where the bank was not enrolled or bypassed verification.
 */
export function mayCaptureSandboxCard(
  shift: string | null | undefined,
  enrollment: string | null | undefined = null,
): boolean {
  if (shift == null || shift === "") return true;
  if (shift === "POSSIBLE") return true;
  if (shift === "NO" && (enrollment === "N" || enrollment === "B")) return true;
  return false;
}
