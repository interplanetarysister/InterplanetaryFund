export function safeReturnTo(value) {
  if (typeof value !== "string" || !value.startsWith("/") ||
      value.startsWith("//") || value.length > 768 ||
      /[\\\u0000-\u001f\u007f]/.test(value)) return "/dashboard";
  try {
    const decoded=decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//") ||
        decoded.includes("\\") || /[\u0000-\u001f\u007f]/.test(decoded))return "/dashboard";
    const path=decoded.split(/[?#]/)[0].replace(/\/$/,"") || "/";
    if (["/login","/register","/forgot-password","/reset-password","/auth/callback"].includes(path))
      return "/dashboard";
    if (path.startsWith("/auth/")) return "/dashboard";
  } catch { return "/dashboard"; }
  return value;
}
