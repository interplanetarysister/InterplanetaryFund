#!/usr/bin/env node
/** Offline evidence gate only. NEVER activates IFund cutover or calls a provider. */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_PROOFS = Object.freeze([
  'source_95_entity_export_and_checksums',
  'private_media_and_storage_parity',
  'owner_dual_provider_session_proof',
  'owner_consent_audit_receipts',
  'cross_owner_denial_and_tenant_rls',
  'all_95_entity_access_policy_parity',
  'campaign_crud_and_user_login_e2e',
  'agent_delegation_consent_redaction_and_revocation',
  'provider_verified_paypal_settlement_and_webhook_idempotency',
  'all_function_connector_workflow_parity_or_retirement',
  'cloudflare_independent_deployment_no_base44_proxy',
  'rollback_rehearsal_and_dns_mail_preservation',
  'explicit_owner_activation_approval',
]);

const LIVE_PROOFS = new Set([
  'owner_dual_provider_session_proof',
  'owner_consent_audit_receipts',
  'cross_owner_denial_and_tenant_rls',
  'all_95_entity_access_policy_parity',
  'campaign_crud_and_user_login_e2e',
  'agent_delegation_consent_redaction_and_revocation',
  'provider_verified_paypal_settlement_and_webhook_idempotency',
  'all_function_connector_workflow_parity_or_retirement',
  'cloudflare_independent_deployment_no_base44_proxy',
]);
const validTimestamp = (s) => typeof s === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(s) && Number.isFinite(Date.parse(s));
export function assessCutover(evidence) {
  const reasons = [];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence))
    return { ready: false, reasons: ['Invalid evidence document'] };
  if (evidence.project !== 'ifund2' || evidence.destination !== 'tzehxfikoslihnclhxuz')
    reasons.push('Project identity mismatch');
  if (evidence.cutoverActivated !== false) reasons.push('Cutover must remain inactive during preflight');
  for (const key of REQUIRED_PROOFS) {
    const p = evidence.proofs?.[key];
    if (!p || p.status !== 'verified' || typeof p.reference !== 'string' || !p.reference.trim() ||
        !validTimestamp(p.checkedAt) || !['staged','live'].includes(p.environment) ||
        (LIVE_PROOFS.has(key) && p.environment !== 'live')) {
      reasons.push(`Missing verified, referenced evidence: ${key}`);
    }
  }
  return { ready: reasons.length === 0, reasons };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = assessCutover(JSON.parse(readFileSync(process.argv[2], 'utf8')));
    console.log(JSON.stringify({ decision: report.ready ? 'REVIEW_READY_NOT_ACTIVATED' : 'BLOCKED', ...report }, null, 2));
    if (!report.ready) process.exitCode = 2;
  } catch {
    console.error('BLOCKED: missing or invalid local evidence JSON');
    process.exitCode = 2;
  }
}
