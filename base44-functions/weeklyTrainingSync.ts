import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // STEP 1: Run protocol audit on mirror entity (credit-free)
    const campaigns = await base44.asServiceRole.entities.MonitoredCampaign.list();
    
    const results = [];
    let compliantCount = 0;
    let nonCompliantCount = 0;
    const allViolations = [];
    
    for (const campaign of campaigns) {
      const violations = [];
      
      // P-1: Outreach
      if (!campaign.outreach_enabled) {
        violations.push({ standard: 'P-1', issue: 'Outreach disabled' });
      }
      
      // P-2: AI Profile
      const missingAi = ['ai_tone', 'ai_ideal_donors', 'ai_interested_orgs', 'ai_platforms']
        .filter(f => !campaign[f] || campaign[f] === '');
      if (missingAi.length > 0) {
        violations.push({ standard: 'P-2', missing: missingAi });
      }
      
      // P-3: Story
      if (!campaign.story_present) violations.push({ standard: 'P-3', issue: 'No story' });
      if (!campaign.summary) violations.push({ standard: 'P-3', issue: 'No summary' });
      
      // P-4: Payment
      if (campaign.status === 'active' && !campaign.payment_active) {
        violations.push({ standard: 'P-4', issue: 'No payment path', severity: 'critical' });
      }
      
      // P-5: Required fields
      if (!campaign.end_date && campaign.status === 'active') violations.push({ standard: 'P-5', issue: 'Missing end_date' });
      
      if (violations.length === 0) compliantCount++; else nonCompliantCount++;
      allViolations.push(...violations);
      
      results.push({
        title: campaign.title,
        status: campaign.status,
        compliance_score: Math.max(0, 6 - violations.length),
        violations: violations.length,
        violation_details: violations
      });
    }
    
    const totalRaised = campaigns.reduce((s, c) => s + (c.raised_amount || 0), 0);
    const totalGoal = campaigns.reduce((s, c) => s + (c.goal_amount || 0), 0);
    const totalDonors = campaigns.reduce((s, c) => s + (c.donor_count || 0), 0);
    const criticalViolations = allViolations.filter(v => v.severity === 'critical');
    
    // STEP 2: Update agent training records (credit-free)
    const agents = await base44.asServiceRole.entities.Agent.list();
    const trainingUpdate = `Week of ${new Date().toISOString().split('T')[0]}: ${compliantCount}/${campaigns.length} campaigns compliant. Critical violations: ${criticalViolations.length}. Revenue: $${totalRaised}/$${totalGoal}. Donors: ${totalDonors}.`;
    
    for (const agent of agents) {
      const memory = agent.long_term_memory || [];
      // Keep last 10 memories, add new one
      const updatedMemory = [...memory.slice(-9), trainingUpdate];
      await base44.asServiceRole.entities.Agent.update(agent.id, {
        long_term_memory: updatedMemory,
        working_memory: [`Latest audit: ${compliantCount} compliant, ${nonCompliantCount} non-compliant. Critical: ${criticalViolations.length}.`]
      });
    }
    
    // STEP 3: Create protocol report record (credit-free, persistent)
    const report = await base44.asServiceRole.entities.ProtocolReport.create({
      report_type: 'weekly_training',
      audit_date: new Date().toISOString(),
      total_campaigns: campaigns.length,
      compliant_campaigns: compliantCount,
      non_compliant_campaigns: nonCompliantCount,
      total_raised: totalRaised,
      total_goal: totalGoal,
      funding_gap: totalGoal - totalRaised,
      total_donors: totalDonors,
      critical_violations: criticalViolations,
      results: results.map(r => ({ title: r.title, compliance_score: r.compliance_score, violations: r.violations })),
      sync_performed: false
    });
    
    // STEP 4: Return full report
    return new Response(JSON.stringify({
      status: 'success',
      message: 'Weekly training completed — credit-free',
      report_id: report.id,
      audit: {
        total_campaigns: campaigns.length,
        compliant: compliantCount,
        non_compliant: nonCompliantCount,
        revenue: { total_raised: totalRaised, total_goal: totalGoal, funding_gap: totalGoal - totalRaised, total_donors: totalDonors },
        critical_violations: criticalViolations,
        results
      },
      agents_updated: agents.length,
      note: 'No LLM credits consumed. Report stored in ProtocolReport entity. Mirror sync and cross-app fixes require manual session with Michelle.'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
