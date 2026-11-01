// Interplanetary Fund capabilities derived from an actual successful provider
// check plus current runtime adapters, never from requested permission strings.
// These grant eligibility to ATTEMPT an action; the write itself must return a
// provider acknowledgement before IFund reports it as published.
export function verifiedConnectionCapabilities(connection: any): string[] {
  const scopes = new Set((connection?.obo_consent?.provider_capabilities || [])
    .filter((value: unknown) => typeof value === 'string' && !!value));
  const platform = String(connection?.platform || '').toLowerCase();
  if (platform === 'bluesky') {
    // A successful createSession call confirms the credential transport used
    // by IFund's real Bluesky posting adapter.
    scopes.add('create_post');
    scopes.add('read_account');
  }
  if (platform === 'linkedin' && scopes.has('w_member_social')) {
    // A separately provider-reported member publishing scope, not an inferred
    // grant from user identity or token presence.
    scopes.add('create_post');
  }
  return [...scopes];
}
