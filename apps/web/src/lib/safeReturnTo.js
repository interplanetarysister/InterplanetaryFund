export function safeReturnTo(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\s\\]/.test(value)
  )
    return "/dashboard";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\u0000-\u0020\\]/.test(decoded))
      return "/dashboard";
    if (
      [
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/auth/callback",
        "/activate",
      ].includes(decoded.split(/[?#]/)[0])
    )
      return "/dashboard";
  } catch {
    return "/dashboard";
  }
  return value;
}
