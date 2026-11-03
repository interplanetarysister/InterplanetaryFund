// Resolve the initial Supabase identity without leaving the public app in an
// indefinite loading state when the network or auth endpoint fails. A failed
// lookup remains signed out in the UI; protected data access is still enforced
// by the server-side session and RLS.
export async function resolveInitialUser(getUser) {
  try {
    const result = await getUser();
    if (result?.error) return null;
    return result?.data?.user ?? null;
  } catch {
    return null;
  }
}
