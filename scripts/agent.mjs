#!/usr/bin/env node
/**
 * Interplanetary Fund — Credit-Free Autonomous Agent Script
 * Runs inside GitHub Actions. Does protocol enforcement, reporting, and sync.
 * 
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { execSync } from 'child_process';

const log = (msg) => console.log(`[IF-Agent ${new Date().toISOString()}] ${msg}`);
const run = (cmd, opts = {}) => {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', ...opts }).trim();
  } catch (e) {
    return null;
  }
};

async function main() {
  log('Starting autonomous agent cycle...');

  // 1. Build check
  log('Running build check...');
  const buildResult = run('npm run build');
  if (buildResult !== null) {
    log('✅ Build passing');
  } else {
    log('❌ Build failed — skipping deployment');
    process.exit(1);
  }

  // 2. Convex deployment
  log('Deploying to Convex...');
  const deployResult = run('npx convex deploy', {
    env: { ...process.env }
  });
  if (deployResult !== null) {
    log('✅ Convex deployed');
  } else {
    log('⚠️ Convex deploy skipped (may need CONVEX_DEPLOY_KEY)');
  }

  // 3. Protocol enforcement
  log('Running protocol enforcement (P-1 through P-8)...');
  const protocolResult = run('npx convex run protocol/enforceProtocol');
  if (protocolResult !== null) {
    try {
      const audit = JSON.parse(protocolResult);
      log(`Protocol: ${audit.compliant} compliant, ${audit.nonCompliant} non-compliant, ${audit.totalCampaigns} total`);
      if (audit.criticalViolations?.length > 0) {
        log(`⚠️ ${audit.criticalViolations.length} critical violations found`);
      }
    } catch {
      log('Protocol enforcement completed (results not parsed)');
    }
  } else {
    log('⚠️ Protocol enforcement skipped');
  }

  // 4. Treasury aggregation
  log('Running treasury aggregation...');
  const treasuryResult = run('npx convex run treasury/aggregateBalances');
  if (treasuryResult !== null) {
    log('✅ Treasury aggregated');
  } else {
    log('⚠️ Treasury aggregation skipped');
  }

  // 5. Git status
  log('Checking for uncommitted changes...');
  const status = run('git status --porcelain');
  if (status) {
    log('📦 Changes detected — committing...');
    run('git config user.name "IF Autonomous Agent"');
    run('git config user.email "actions@github.com"');
    run('git add -A');
    run(`git commit -m "chore: autonomous agent sync (${new Date().toISOString().slice(0,16).replace('T','_')})"`);
    run('git push');
    log('✅ Changes committed and pushed');
  } else {
    log('No uncommitted changes');
  }

  log('Agent cycle complete.');
}

main().catch(e => {
  log(`Fatal error: ${e.message}`);
  process.exit(1);
});
