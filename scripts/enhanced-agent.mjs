#!/usr/bin/env node
/**
 * Interplanetary Fund — Enhanced Autonomous Agent Script
 *
 * Credit-free observability cycle for GitHub Actions.
 *
 * IMPORTANT PRODUCTION BOUNDARY:
 * - This script performs build/read-only health checks only.
 * - It MUST NOT deploy Convex.
 * - It MUST NOT mutate production data.
 * - It MUST NOT commit or push files back to main.
 * - Production Convex deployment is handled exclusively by the serialized
 *   .github/workflows/convex-deploy.yml workflow.
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
  log('  IF AUTONOMOUS AGENT — OBSERVABILITY CYCLE');
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
    log('❌ Build FAILED');
    report.alerts.push('BUILD_FAILED');
  } else {
    log('✅ Build passing');
  }

  // === 2. PROTOCOL AUDIT (READ-ONLY QUERY) ===
  log('2. Running protocol audit (read-only)...');
  const protocol = run('npx convex run protocol/enforceProtocol --env-name prod', { env: { ...process.env } });
  if (protocol.ok) {
    try {
      const audit = JSON.parse(protocol.out);
      report.checks.protocol = `${audit.compliant}/${audit.totalCampaigns} compliant`;
      log(`✅ Protocol: ${audit.compliant} compliant, ${audit.nonCompliant} non-compliant`);
      if (audit.criticalViolations?.length > 0) {
        report.alerts.push(`${audit.criticalViolations.length} PROTOCOL_VIOLATIONS`);
      }
      report.sync.totalRaised = audit.revenueSummary?.totalRaised || 0;
      report.sync.totalGoal = audit.revenueSummary?.totalGoal || 0;
      report.sync.totalDonors = audit.revenueSummary?.totalDonors || 0;
      report.sync.fundingGap = audit.revenueSummary?.fundingGap || 0;
    } catch {
      report.checks.protocol = 'COMPLETED (unparsed)';
    }
  } else {
    report.checks.protocol = 'SKIPPED';
    log('⚠️ Protocol audit skipped');
  }

  // === 3. TREASURY AUDIT (READ-ONLY QUERY) ===
  log('3. Reading treasury balances...');
  const treasury = run('npx convex run treasury/aggregateBalances --env-name prod', { env: { ...process.env } });
  report.checks.treasury = treasury.ok ? 'READ_OK' : 'SKIPPED';
  log(treasury.ok ? '✅ Treasury read succeeded' : '⚠️ Treasury read skipped');

  // === 4. CAMPAIGN DATA AUDIT (READ-ONLY QUERY) ===
  log('4. Reading active campaign data...');
  const campaigns = run('npx convex run userCampaigns/getActiveCampaigns --env-name prod', { env: { ...process.env } });
  if (campaigns.ok) {
    try {
      const allCampaigns = JSON.parse(campaigns.out);
      report.sync.activeCampaigns = allCampaigns.length;
      log(`✅ ${allCampaigns.length} active campaigns found`);

      const nowMs = Date.now();
      const stale = allCampaigns.filter(c => {
        if (!c.timeline || c.timeline.length === 0) return false;
        const lastUpdate = new Date(c.timeline[c.timeline.length - 1]?.date || c.updated_date).getTime();
        return Number.isFinite(lastUpdate) && (nowMs - lastUpdate) > 30 * 24 * 60 * 60 * 1000;
      });
      if (stale.length > 0) {
        report.alerts.push(`${stale.length} STALE_CAMPAIGNS`);
      }
    } catch {
      log('Campaign audit completed (unparsed)');
    }
  } else {
    log('⚠️ Campaign read skipped');
  }

  // === 5. DONATION AUDIT (READ-ONLY QUERY) ===
  log('5. Reading donation data...');
  const donations = run('npx convex run campaigns/getDonations --env-name prod', { env: { ...process.env } });
  if (donations.ok) {
    try {
      const allDonations = JSON.parse(donations.out);
      report.sync.totalDonations = allDonations.length;
      const recent = allDonations.filter(d => {
        const dt = new Date(d.created_date || d._creationTime || 0).getTime();
        return (Date.now() - dt) < 24 * 60 * 60 * 1000;
      });
      if (recent.length > 0) log(`💰 ${recent.length} donations in last 24 hours`);
    } catch {
      log('Donation audit completed (unparsed)');
    }
  } else {
    log('⚠️ Donation read skipped');
  }

  // === 6. SITE HEALTH CHECK ===
  log('6. Checking site health...');
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

  // === 7. GITHUB ACTIONS STATUS ===
  log('7. Checking GitHub Actions...');
  const ghStatus = run('curl -s "https://api.github.com/repos/interplanetarysister/InterplanetaryFund/actions/runs?per_page=5" -H "Accept: application/vnd.github.v3+json"');
  if (ghStatus.ok) {
    try {
      const data = JSON.parse(ghStatus.out);
      const runs = data.workflow_runs || [];
      const failed = runs.filter(r => r.conclusion === 'failure');
      report.checks.githubActions = `${runs.length} recent runs, ${failed.length} failed`;
      if (failed.length > 0) report.alerts.push(`${failed.length} FAILED_GH_ACTIONS`);
    } catch {
      log('GitHub Actions check completed');
    }
  }

  // === FINAL REPORT ===
  log('═══════════════════════════════════════════');
  log('  OBSERVABILITY CYCLE COMPLETE');
  log('═══════════════════════════════════════════');
  log(`Timestamp: ${report.timestamp}`);
  log(`Alerts: ${report.alerts.length}`);
  log(`Sync: ${JSON.stringify(report.sync)}`);
  log(`Checks: ${JSON.stringify(report.checks)}`);

  // Runtime artifact only. The workflow uploads it; it is never committed.
  fs.writeFileSync('agent-report.json', JSON.stringify(report, null, 2));

  // Alerts are reported in the artifact/logs, but do not turn a monitoring
  // failure into a deployment or source-control mutation.
  process.exit(0);
}

main().catch(e => {
  log(`Fatal error: ${e.message}`);
  process.exit(1);
});
