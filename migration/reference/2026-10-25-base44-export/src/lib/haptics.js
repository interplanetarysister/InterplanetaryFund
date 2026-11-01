// Lightweight haptic feedback via the Vibration API. No-ops on devices/browsers
// without support, so callers can use it freely.
export function haptic(pattern = 10) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* unsupported */ }
}

export const hapticTap = () => haptic(8);
export const hapticSelect = () => haptic(12);
export const hapticSuccess = () => haptic([10, 24, 10]);
export const hapticWarn = () => haptic([20, 40, 20]);