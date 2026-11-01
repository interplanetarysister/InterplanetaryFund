// Server-side authorization gate for accounts that are pending deletion,
// disabled, or no longer present. Apply at the top of every authenticated
// sensitive function AFTER createClientFromRequest. Re-reads the authoritative
// User record via the service role so a flag set by the deletion state machine
// (or an admin) is seen immediately — the caller's auth token may still resolve
// to an account that is no longer fully active.
//
// This complements (does not replace) the frontend logout guard in
// AuthContext: the frontend blocks UI access, but a revoked account must also
// be rejected server-side so a direct API call cannot bypass the block.
//
// Account states covered:
//  - pending deletion: account_deletion_pending === true (set by deleteAccount
//    stage 2; kept true after the anonymization fallback).
//  - deleted: the User record is gone (User.get returns null).
//  - disabled / anonymized: account_status !== 'active'.
//
// Returns { ok, user?, donor?, error?, status }.

export async function assertActiveAccount(base44) {
  try {
    const user = await base44.auth.me();
    if (!user) return { ok: false, status: 401, error: 'Sign in to continue.' };
    const sr = base44.asServiceRole;
    const fresh = await sr.entities.User.get(user.id).catch(() => null);
    if (!fresh) return { ok: false, status: 401, error: 'This account is no longer available.' };
    if (fresh.account_deletion_pending) {
      return { ok: false, status: 403, error: 'This account is scheduled for deletion and can no longer be used.' };
    }
    if (fresh.account_status && fresh.account_status !== 'active') {
      return { ok: false, status: 403, error: 'This account is no longer available.' };
    }
    return { ok: true, user: { ...user, ...fresh } };
  } catch (e) {
    return { ok: false, status: 401, error: 'Sign in to continue.' };
  }
}

// For functions where the caller MAY be signed out (e.g. public donations via
// PayPal/Cash App/Stripe redirect) but, if signed in, must not be a revoked
// account. Returns { ok: true, donor: user|null } when the caller is absent or
// active; returns { ok: false, error, status } only when a signed-in caller is
// revoked.
export async function assertActiveAccountIfSignedIn(base44) {
  try {
    const donor = await base44.auth.me();
    if (!donor) return { ok: true, donor: null };
    const sr = base44.asServiceRole;
    const fresh = await sr.entities.User.get(donor.id).catch(() => null);
    if (!fresh) return { ok: false, status: 401, error: 'This account is no longer available.' };
    if (fresh.account_deletion_pending) {
      return { ok: false, status: 403, error: 'This account is scheduled for deletion and can no longer be used.' };
    }
    if (fresh.account_status && fresh.account_status !== 'active') {
      return { ok: false, status: 403, error: 'This account is no longer available.' };
    }
    return { ok: true, donor: { ...donor, ...fresh } };
  } catch (e) {
    // Not signed in — allowed for public donation paths.
    return { ok: true, donor: null };
  }
}