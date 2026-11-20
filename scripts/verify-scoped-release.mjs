#!/usr/bin/env node
/**
 * iFund scoped release eligibility gate. Run after real executable tests,
 * authenticated role QA and a successful Cloudflare preview. Does not deploy.
 * Unknown or security-sensitive changes always require the full-site gate.
 */
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const SENSITIVE_PATH = /^(?:supabase\/|workers\/|worker\/|functions\/|\.github\/|apps\/mobile\/|apps\/web\/ci\/|apps\/web\/src\/(?:lib\/(?:auth|payment|donation|withdraw|ledger|oauth|consent|agent|subscription|campaignDocument)|contexts\/|hooks\/useAuth|integrations\/)|package(?:-lock)?\.json$|apps\/web\/package(?:-lock)?\.json$)/i;
export const SENSITIVE_NAMES = /(?:auth|login|register|session|secret|admin|finance|payment|donat|withdraw|refund|ledger|document|privacy|delet|oauth|permission|consent|subscript|webhook|payout|checkout|rbac|security|policy|route|campaign|create|edit|profile|account|settings|member|billing|store|merchant|app\.jsx|layout\.jsx)/i;
const SAFE_PATH = /^(?:docs\/(?!security\/|architecture\/)[\w./-]+\.md|apps\/web\/src\/(?:components|pages|styles|assets)\/[\w./-]+\.(?:jsx?|css|svg)|apps\/web\/public\/[\w./-]+\.(?:png|jpe?g|webp|svg)|apps\/web\/tests\/[\w./-]+\.test\.(?:m?js))$/i;

export function assess(input) {
  const issues=[];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {eligible:false,issues:['Missing evidence object']};
  const has=(v)=>typeof v==='string'&&v.trim().length>0;
  const sha=(v)=>typeof v==='string'&&/^[a-f0-9]{40}$/i.test(v);
  if (!sha(input.commit_sha)) issues.push('Missing exact 40-character release commit SHA');
  if (!Array.isArray(input.changed_files)||!input.changed_files.length||input.changed_files.length>50) issues.push('Expected 1–50 exact changed file paths');
  else {
    const files=new Set();
    for (const file of input.changed_files) {
      if (!has(file)||file.startsWith('/')||file.includes('..')||file.includes('\\')||files.has(file)) {issues.push('Invalid/duplicate changed path');continue;}
      files.add(file);
      if (SENSITIVE_PATH.test(file)||SENSITIVE_NAMES.test(file)||!SAFE_PATH.test(file)) issues.push('Full release/security gate required for: '+file);
    }
  }
  const gate=input.evidence;
  if (!gate || typeof gate!=='object'||Array.isArray(gate)) issues.push('Missing independent acceptance evidence');
  else {
    for (const key of ['local_tests','security_regressions','role_browser_qa','preview_qa']) {
      const value=gate[key];
      if (!value || value.passed!==true || !has(value.reference) || !sha(value.commit_sha) || value.commit_sha!==input.commit_sha) issues.push('Missing passing exact-SHA '+key+' evidence');
    }
    if (!gate.preview_deployment || !has(gate.preview_deployment.id) || gate.preview_deployment.status!=='success' || gate.preview_deployment.commit_sha!==input.commit_sha || !sha(gate.preview_deployment.commit_sha)) issues.push('Missing verified successful preview deployment for exact SHA');
    if (!gate.independent_reviewer || !has(gate.independent_reviewer.identity) || gate.independent_reviewer.approved!==true || !has(gate.independent_reviewer.reference)) issues.push('Missing independent release approval');
    if (gate.outstanding_critical_defects!==0) issues.push('Outstanding critical defects must be zero');
  }
  return {eligible:issues.length===0,mode:'SCOPED_PRODUCTION_ELIGIBILITY_ONLY',issues};
}

/**
 * CLI safeguard: the declared scope must be exactly the committed diff.
 * Never approve a self-reported file list without independently reading Git.
 */
export function verifyGitScope(input, {cwd=process.cwd()}={}) {
  const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value);
  if (!sha(input?.base_sha)||!sha(input?.commit_sha)) return ['Missing exact base/head Git SHAs'];
  const git=(...args)=>spawnSync('git',args,{cwd,encoding:'utf8'});
  const head=git('rev-parse','HEAD');
  if (head.status!==0||head.stdout.trim()!==input.commit_sha) return ['Git checkout HEAD differs from release SHA'];
  const ancestor=git('merge-base','--is-ancestor',input.base_sha,input.commit_sha);
  if (ancestor.status!==0) return ['Git base is not an ancestor of release SHA'];
  const dirty=git('status','--porcelain');
  if (dirty.status!==0||dirty.stdout.trim()) return ['Git checkout is dirty or unreadable'];
  const diff=git('diff','--name-only','--no-renames',input.base_sha,input.commit_sha);
  if(diff.status!==0) return ['Cannot independently read Git changed-file diff'];
  const actual=diff.stdout.trim()?diff.stdout.trim().split('\n').sort():[];
  const claimed=Array.isArray(input.changed_files)?[...input.changed_files].sort():[];
  if (actual.length!==claimed.length||actual.some((file,i)=>file!==claimed[i])) return ['Claimed changed files disagree with committed Git diff'];
  return [];
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length!==3) throw Error('Usage: node scripts/verify-scoped-release.mjs evidence.json');
    const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
    const result=assess(input);
    const gitIssues=verifyGitScope(input);
    result.issues.push(...gitIssues);
    result.eligible=result.eligible&&gitIssues.length===0;
    console.log(JSON.stringify(result,null,2));
    if(!result.eligible) process.exitCode=1;
  } catch(error) { console.error('Scoped release FAIL CLOSED: '+error.message);process.exitCode=1; }
}
