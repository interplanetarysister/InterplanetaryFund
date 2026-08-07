import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Read all monitored campaigns from our mirror entity (local app, no credits)
    const campaigns = await base44.asServiceRole.entities.MonitoredCampaign.list();
    
    const results = [];
    let compliantCount = 0;
    let nonCompliantCount = 0;
    const allViolations = [];
    const allAutoFixes = [];
    
    for (const campaign of campaigns) {
      const violations = [];
      const autoFixes = [];
      
      // P-1: Outreach must be enabled
      if (!campaign.outreach_enabled) {
        autoFixes.push({ 
          standard: 'P-1', 
          field: 'outreach_enabled', 
          fix: true, 
          if_campaign_id: campaign.if_campaign_id,
          message: 'Outreach disabled — should be auto-fixed to true'
        });
      }
      
      // P-2: AI profile completeness
      const aiFields = {
        'ai_tone': campaign.ai_tone,
        'ai_ideal_donors': campaign.ai_ideal_donors,
        'ai_interested_orgs': campaign.ai_interested_orgs,
        'ai_platforms': campaign.ai_platforms
      };
      const missingAi = Object.entries(aiFields)
        .filter(([_, value]) => !value || value === '' || value === '[]')
        .map(([field]) => field);
      if (missingAi.length > 0) {
        violations.push({ standard: 'P-2', missing_fields: missingAi });
      }
      
      // P-3: Story and summary present
      if (!campaign.story_present) {
        violations.push({ standard: 'P-3', issue: 'No story present' });
      }
      if (!campaign.summary || campaign.summary === '') {
        violations.push({ standard: 'P-3', issue: 'No summary' });
      }
      
      // P-4: Payment path on active campaigns
      if (campaign.status === 'active' && !campaign.payment_active) {
        violations.push({ standard: 'P-4', issue: 'No payment path on active campaign', severity: 'critical' });
      }
      
      // P-5: Required fields
      if (!campaign.title) violations.push({ standard: 'P-5', missing: 'title' });
      if (!campaign.category) violations.push({ standard: 'P-5', missing: 'category' });
      if (!campaign.goal_amount || campaign.goal_amount <= 0) violations.push({ standard: 'P-5', missing: 'goal_amount' });
      if (!campaign.cover_image_present) violations.push({ standard: 'P-5', missing: 'cover_image_url' });
      if (campaign.status === 'active' && !campaign.end_date) violations.push({ standard: 'P-5', missing: 'end_date on active campaign' });
      
      const isCompliant = violations.length === 0 && autoFixes.length === 0;
      if (isCompliant) {
        compliantCount++;
      } else {
        nonCompliantCount++;
      }
      
      allViolations.push(...violations);
      allAutoFixes.push(...autoFixes);
      
      results.push({
        campaign_id: campaign.if_campaign_id,
        title: campaign.title,
        status: campaign.status,
        goal_amount: campaign.goal_amount,
        raised_amount: campaign.raised_amount,
        donor_count: campaign.donor_count,
        outreach_enabled: campaign.outreach_enabled,
        compliance_score: Math.max(0, 6 - violations.length - autoFixes.length),
        violations,
        autoFixes
      });
    }
    
    // Calculate revenue summary
    const totalRaised = results.reduce((sum, c) => sum + (c.raised_amount || 0), 0);
    const totalGoal = results.reduce((sum, c) => sum + (c.goal_amount || 0), 0);
    const totalDonors = results.reduce((sum, c) => sum + (c.donor_count || 0), 0);
    
    return new Response(JSON.stringify({
      audit_date: new Date().toISOString(),
      total_campaigns: results.length,
      compliant: compliantCount,
      non_compliant: nonCompliantCount,
      revenue_summary: {
        total_raised: totalRaised,
        total_goal: totalGoal,
        funding_gap: totalGoal - totalRaised,
        total_donors: totalDonors
      },
      critical_violations: allViolations.filter(v => v.severity === 'critical'),
      auto_fixes_needed: allAutoFixes,
      results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
