export function safeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || decoded.includes('\\')) return '/dashboard';
    if (['/login', '/register', '/forgot-password', '/reset-password'].includes(decoded.split('?')[0])) return '/dashboard';
  } catch { return '/dashboard'; }
  return value;
}
