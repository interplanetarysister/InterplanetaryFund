#!/usr/bin/env node
// Read-only release evidence validator. Never changes deployment or agent state.
// Usage: node docs/architecture/tools/verify-agent-release-evidence.mjs evidence.json
import fs from 'node:fs';
const file=process.argv[2];
if(!file){console.error('Usage: node verify-agent-release-evidence.mjs evidence.json');process.exit(2)}
let e;try{e=JSON.parse(fs.readFileSync(file,'utf8'))}catch(err){console.error('Invalid evidence JSON:',err.message);process.exit(2)}
const failures=[];
const requireField=(key)=>{if(e[key]!==true)failures.push(key+' must be explicitly true')};
const sha=(key)=>{if(!/^[a-f0-9]{40}$/i.test(e[key]||''))failures.push(key+' must be a 40-character commit SHA')};
sha('canonical_source_sha');sha('implementation_sha');
for(const key of ['original_ui_preview_verified','original_assets_verified','original_routes_verified','mobile_guest_drafting_verified','base44_preview_connection_verified','auth_recovery_verified','supabase_rls_owner_isolation_verified','payments_verified_only','withdrawal_owner_only_verified','withdrawal_seven_percent_fee_verified','rollback_tested','user_production_approval'])requireField(key);
if(!Array.isArray(e.preview_urls)||e.preview_urls.length===0||!e.preview_urls.every(x=>typeof x==='string'&&x.startsWith('https://')))failures.push('preview_urls must contain real HTTPS URLs');
if(!Array.isArray(e.test_receipts)||e.test_receipts.length===0||!e.test_receipts.every(x=>typeof x==='string'&&x.trim()))failures.push('test_receipts must be nonempty');
if(e.base44_dependencies_removed===true&&e.user_authorized_dependency_unit!==true)failures.push('Base44 removal requires separately authorized whole dependency unit');
if(e.production_promotion_requested===true&&e.user_production_approval!==true)failures.push('production promotion requires explicit approval');
if(failures.length){console.error('RELEASE BLOCKED:\n'+failures.map(x=>' - '+x).join('\n'));process.exit(1)}
console.log('Evidence schema complete. Independently verify the linked receipts before deployment; this check does not deploy or authenticate.');
