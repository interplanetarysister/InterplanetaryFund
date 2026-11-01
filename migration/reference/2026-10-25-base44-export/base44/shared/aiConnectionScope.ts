// V1 account-specific AI capability choices. These are desired operations,
// NOT actual provider-authorized scopes. Financial custody/movement excluded.
export const AI_CONNECTION_SCOPE_VERSION = '2026-10-16-account-obo-v1';
export const IFUND_STANDARD_AI_SCOPE = [
 'read_account','read_resources','read_campaign','manage_campaign',
 'create_post','edit_post','delete_own_post','upload_media',
 'read_interactions','comment','reply_comment','read_messages','reply_message',
 'discover','follow','join','manage_groups','invite_group_members',
 'manage_pages','share_content','publish_video','publish_image','livestream',
 'manage_auction','read_analytics','read_donations','read_transactions',
 'subscribe_events','reconcile_external_funds','settlement_status',
 'create_event','manage_event','account_maintenance'
] as const;
export function restrictedAgentScope(requested: unknown, provider: unknown): string[] {
 const allowed = new Set(IFUND_STANDARD_AI_SCOPE as readonly string[]);
 const selected = new Set(Array.isArray(requested) ? requested.filter(v => typeof v === 'string' && allowed.has(v)) : []);
 const verified = Array.isArray(provider) ? provider.filter(v => typeof v === 'string') : [];
 return [...new Set(verified.filter(v => selected.has(v)))];
}

export type AccountScopeChoice = 'full' | 'posting' | 'read_only';
export function requestedAgentScope(choice: string): string[] {
  if (choice === 'full') return [...IFUND_STANDARD_AI_SCOPE];
  if (choice === 'posting') return IFUND_STANDARD_AI_SCOPE.filter(item =>
    !['read_donations','read_transactions','reconcile_external_funds','settlement_status',
      'manage_auction','manage_groups','invite_group_members','manage_pages',
      'read_messages','reply_message','livestream'].includes(item));
  if (choice === 'read_only') return IFUND_STANDARD_AI_SCOPE.filter(item =>
    ['read_account','read_resources','read_campaign','read_interactions','discover',
      'read_analytics','read_donations','subscribe_events','settlement_status'].includes(item));
  throw new Error('invalid_scope_choice');
}
