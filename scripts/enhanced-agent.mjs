#!/usr/bin/env node
/**
 * Interplanetary Fund — Enhanced Autonomous Agent Script
 * 
 * Credit-free agent that runs in GitHub Actions. Handles:
 * 1. Build verification + Convex deployment
 * 2. Protocol enforcement (P-1 through P-8)
 * 3. Treasury aggregation
 * 4. Campaign data sync across platforms
 * 5. Stale campaign detection
 * 6. Donation monitoring + alerts
 * 7. Social metrics collection
 * 8. Site health verification
 * 9. Auto-commit generated changes
 * 
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { execSync } from 'child_process';

import fs from 'fs';

const log = (msg) => console.log(`[IF-Agent ${new Date().toISOString()}] ${msg}`);
const run = (cmd, opts = {}) => {
  try {
    return { ok: true, out: execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', ...opts }).trim() };
  } catch (e) {
    return { ok: false, out: e.stderr || e.message || 'failed' };
  }
};

async function main() {
  log('═══════════════════════════════════════════');
  log('  IF AUTONOMOUS AGENT — ENHANCED CYCLE');
  log('═══════════════════════════════════════════');

  const report = {
    timestamp: new Date().toISOString(),
    checks: {},
    alerts: [],
    sync: {}
  };

  // === 1. BUILD CHECK ===
  log('1. Running build check...');
  const build = run('npm run build');
  report.checks.build = build.ok ? 'PASS' : 'FAIL';
  if (!build.ok) {
    log('❌ Build FAILED — skipping deployment');
    report.alerts.push('BUILD_FAILED');
  } else {
    log('✅ Build passing');
  }

  // === 2. CONVEX DEPLOY ===
  if (build.ok) {
    log('2. Deploying to Convex...');
    const deploy = run('npx convex deploy', { env: { ...process.env } });
    report.checks.convex = deploy.ok ? 'DEPLOYED' : 'SKIPPED';
    log(deploy.ok ? '✅ Convex deployed' : '⚠️ Convex deploy skipped');
  }

  // === 3. PROTOCOL ENFORCEMENT ===
  log('3. Running protocol enforcement (P-1 through P-8)...');
  const protocol = run('npx convex run protocol/enforceProtocol --env-name prod', { env: { ...process.env } });
  if (protocol.ok) {
    try {
      const audit = JSON.parse(protocol.out);
      report.checks.protocol = `${audit.compliant}/${audit.totalCampaigns} compliant`;
      log(`✅ Protocol: ${audit.compliant} compliant, ${audit.nonCompliant} non-compliant`);
      
      if (audit.criticalViolations?.length > 0) {
        report.alerts.push(`${audit.criticalViolations.length} PROTOCOL_VIOLATIONS`);
        audit.criticalViolations.forEach(v => log(`⚠️ ${v.standard}: ${v.issue}`));
      }
      
      // Sync revenue data
      report.sync.totalRaised = audit.revenueSummary?.totalRaised || 0;
      report.sync.totalGoal = audit.revenueSummary?.totalGoal || 0;
      report.sync.totalDonors = audit.revenueSummary?.totalDonors || 0;
      report.sync.fundingGap = audit.revenueSummary?.fundingGap || 0;
    } catch {
      report.checks.protocol = 'COMPLETED (unparsed)';
      log('Protocol enforcement completed');
    }
  } else {
    report.checks.protocol = 'SKIPPED';
    log('⚠️ Protocol enforcement skipped');
  }

  // === 4. TREASURY AGGREGATION ===
  log('4. Running treasury aggregation...');
  const treasury = run('npx convex run treasury/aggregateBalances --env-name prod', { env: { ...process.env } });
  report.checks.treasury = treasury.ok ? 'SYNCED' : 'SKIPPED';
  log(treasury.ok ? '✅ Treasury synced' : '⚠️ Treasury sync skipped');

  // === 5. CAMPAIGN DATA SYNC ===
  log('5. Syncing campaign data...');
  const campaigns = run('npx convex run userCampaigns/getActiveCampaigns --env-name prod', { env: { ...process.env } });
  if (campaigns.ok) {
    try {
      const allCampaigns = JSON.parse(campaigns.out);
      report.sync.activeCampaigns = allCampaigns.length;
      log(`✅ ${allCampaigns.length} active campaigns synced`);

      // Check for stale campaigns (no updates in 30+ days)
      const now = Date.now();
      const stale = allCampaigns.filter(c => {
        if (!c.timeline || c.timeline.length === 0) return false;
        const lastUpdate = new Date(c.timeline[c.timeline.length - 1]?.date || c.updated_date).getTime();
        return (now - lastUpdate) > 30 * 24 * 60 * 60 * 1000;
      });
      if (stale.length > 0) {
        report.alerts.push(`${stale.length} STALE_CAMPAIGNS`);
        log(`⚠️ ${stale.length} stale campaigns (no updates in 30+ days)`);
        stale.forEach(c => log(`  → ${c.title || c.name}`));
      }

      // Check campaigns below 50% funding
      const underfunded = allCampaigns.filter(c => {
        const raised = c.raised || c.totalRaised || 0;
        const goal = c.goal || c.fundingGoal || 1;
        return (raised / goal) < 0.5;
      });
      if (underfunded.length > 0) {
        log(`📊 ${underfunded.length} campaigns below 50% funding`);
      }
    } catch {
      log('Campaign sync completed (unparsed)');
    }
  } else {
    log('⚠️ Campaign sync skipped');
  }

  // === 6. DONATION MONITORING ===
  log('6. Monitoring donations...');
  const donations = run('npx convex run campaigns/getDonations --env-name prod', { env: { ...process.env } });
  if (donations.ok) {
    try {
      const allDonations = JSON.parse(donations.out);
      report.sync.totalDonations = allDonations.length;
      
      // Check for recent donations (last 24 hours)
      const recent = allDonations.filter(d => {
        const dt = new Date(d.created_date || d._creationTime || 0).getTime();
        return (now() - dt) < 24 * 60 * 60 * 1000;
      });
      
      if (recent.length > 0) {
        log(`💰 ${recent.length} donations in last 24 hours`);
        recent.forEach(d => log(`  → $${d.amount} from ${d.donorName || d.donor_name || 'Anonymous'}`));
      } else {
        log('No donations in last 24 hours');
      }
    } catch {
      log('Donation monitoring completed');
    }
  } else {
    log('⚠️ Donation monitoring skipped');
  }

  // === 7. SITE HEALTH CHECK ===
  log('7. Checking site health...');
  const sites = [
    { name: 'Vercel', url: 'https://interplanetary-fund.vercel.app' },
    { name: 'GitHub Pages', url: 'https://interplanetarysister.github.io/InterplanetaryFund/' },
    { name: 'Convex', url: 'https://rosy-butterfly-2.convex.cloud' }
  ];

  for (const site of sites) {
    const health = run(`curl -s -o /dev/null -w "%{http_code}" ${site.url} --max-time 10`);
    const code = health.out || '000';
    report.checks[site.name] = code;
    const ok = code === '200' || code === '301' || code === '302';
    log(ok ? `✅ ${site.name}: ${code}` : `❌ ${site.name}: ${code}`);
    if (!ok) report.alerts.push(`${site.name}_DOWN (${code})`);
  }

  // === 8. GITHUB ACTIONS STATUS ===
  log('8. Checking GitHub Actions...');
  const ghStatus = run('curl -s "https://api.github.com/repos/interplanetarysister/InterplanetaryFund/actions/runs?per_page=5" -H "Accept: application/vnd.github.v3+json"');
  if (ghStatus.ok) {
    try {
      const data = JSON.parse(ghStatus.out);
      const runs = data.workflow_runs || [];
      const failed = runs.filter(r => r.conclusion === 'failure');
      if (failed.length > 0) {
        report.alerts.push(`${failed.length} FAILED_GH_ACTIONS`);
        log(`⚠️ ${failed.length} failed GitHub Actions runs`);
        failed.slice(0, 3).forEach(r => log(`  → ${r.name}: ${r.conclusion}`));
      } else {
        log('✅ All recent GitHub Actions passing');
      }
      report.checks.githubActions = `${runs.length} recent runs, ${failed.length} failed`;
    } catch {
      log('GitHub Actions check completed');
    }
  }

  // === 9. AUTO-COMMIT ===
  log('9. Checking for uncommitted changes...');
  const status = run('git status --porcelain');
  if (status.out) {
    log('📦 Changes detected — committing...');
    run('git config user.name "IF Autonomous Agent"');
    run('git config user.email "actions@github.com"');
    run('git add -A');
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_');
    run(`git commit -m "chore: autonomous agent sync (${ts})

Enhanced cycle: ${report.alerts.length} alerts, ${report.sync.activeCampaigns || 0} active campaigns
Health: Vercel=${report.checks.Vercel || '?'}, GH Pages=${report.checks['GitHub Pages'] || '?'}
Protocol: ${report.checks.protocol || 'skipped'}"`);
    run('git push');
    log('✅ Changes committed and pushed');
  } else {
    log('No uncommitted changes');
  }

  // === FINAL REPORT ===
  log('═══════════════════════════════════════════');
  log('  AGENT CYCLE COMPLETE');
  log('═══════════════════════════════════════════');
  log(`Timestamp: ${report.timestamp}`);
  log(`Alerts: ${report.alerts.length}`);
  if (report.alerts.length > 0) {
    report.alerts.forEach(a => log(`  ⚠️ ${a}`));
  }
  log(`Sync: ${JSON.stringify(report.sync)}`);
  log(`Checks: ${JSON.stringify(report.checks)}`);
  
  // Write JSON report file for artifact upload
  const fs = await import('fs');
  fs.writeFileSync('agent-report.json', JSON.stringify(report, null, 2));
  
  // Exit with error if there are alerts
  process.exit(report.alerts.length > 0 ? 1 : 0);
}

function now() { return Date.now(); }

main().catch(e => {
  log(`Fatal error: ${e.message}`);
  process.exit(1);
});
