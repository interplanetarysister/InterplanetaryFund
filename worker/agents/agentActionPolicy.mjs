// Server-side action tiering: a model's suggestions NEVER confer capability.
// Caller must attest verified identity, owner scope and the actual provider grant.
const SAFE=new Set(["analyze","research_synthesis","create_private_draft","team_consult","practice_skill"]);
const SCOPED=new Set(["save_owner_draft","update_owner_task","schedule_owner_reminder"]);
const EXTERNAL=new Set(["publish_connected_social","send_approved_message","apply_authorized_opportunity"]);
const CONTROLLED=new Set(["deploy_preview","deploy_production"]);
const PROHIBITED=new Set(["withdraw_funds","issue_refund","change_billing","delete_private_documents","change_roles","alter_consent","deploy_database","run_live_payment"]);
export const AUTONOMY_POLICY_VERSION="2026-11-20-v1";
export function assessAgentAction(action,proof={}){
 const deny=reason=>Object.freeze({allowed:false,decision:"deny",reason,version:AUTONOMY_POLICY_VERSION});
 const allow=(decision,reason)=>Object.freeze({allowed:true,decision,reason,version:AUTONOMY_POLICY_VERSION});
 if(typeof action!=="string"||!/^[-_a-z]{3,64}$/.test(action))return deny("unknown_action");
 if(PROHIBITED.has(action))return deny("high_risk_requires_separate_provider_or_owner_workflow");
 if(SAFE.has(action))return proof.identityVerified===true&&proof.ownerScoped===true
   ?allow("autonomous","read_only_or_unsent_owner_draft"):deny("authenticated_owner_scope_required");
 if(SCOPED.has(action)){
  if(proof.identityVerified!==true||proof.ownerScoped!==true||proof.serverAuthorized!==true||proof.auditReady!==true||proof.idempotent!==true)
   return deny("owner_scoped_audited_storage_required");
  return allow("autonomous","only_verified_same_owner_records");
 }
 if(EXTERNAL.has(action)){
  if(proof.identityVerified!==true||proof.ownerScoped!==true||proof.standingConsentVerified!==true||
     proof.providerScopesVerified!==true||proof.providerConnected!==true||
     proof.destinationVerified!==true||proof.revocationChecked!==true||
     proof.auditReady!==true||proof.idempotent!==true)
    return deny("per_destination_consent_provider_and_audit_required");
  return allow("authorized_standing_permission","scoped_reversible_authorization_only");
 }
 if(CONTROLLED.has(action)){
  if(proof.releaseEvidenceVerified!==true||proof.independentQA!==true||proof.ownerDeploymentAuthorization!==true||
     proof.exactSHA!==true||proof.rollbackReady!==true||proof.secretsValidated!==true)
   return deny("deployment_release_gates_required");
  return allow("controlled_deployment","audited_release_only_not_model_direct");
 }
 return deny("unknown_action");
}
