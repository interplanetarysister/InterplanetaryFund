import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Parse request body
    const body = await req.json();
    const { action, data } = body;
    
    // ACTION 1: Calculate payout (show gross vs net)
    if (action === 'calculate_payout') {
      const { amount, platform_fee_percent, processing_fee_percent } = data;
      
      const gross = Number(amount);
      const platformFee = gross * (Number(platform_fee_percent) / 100);
      const processingFee = gross * (Number(processing_fee_percent || 0) / 100);
      const totalFees = platformFee + processingFee;
      const net = gross - totalFees;
      
      return new Response(JSON.stringify({
        action: 'calculate_payout',
        gross_amount: gross,
        fee_breakdown: {
          platform_fee: { rate: platform_fee_percent + '%', amount: platformFee },
          processing_fee: { rate: (processing_fee_percent || 0) + '%', amount: processingFee },
          total_fees: totalFees
        },
        net_amount: net,
        display: {
          available_balance: `$${gross.toFixed(2)}`,
          you_receive: `$${net.toFixed(2)}`,
          our_fee: `$${totalFees.toFixed(2)}`
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    // ACTION 2: Calculate batch payout (multiple campaigns)
    if (action === 'batch_payout') {
      const { campaigns, platform_fee_percent, processing_fee_percent } = data;
      
      const results = campaigns.map(c => {
        const gross = Number(c.amount);
        const platformFee = gross * (Number(platform_fee_percent) / 100);
        const processingFee = gross * (Number(processing_fee_percent || 0) / 100);
        const net = gross - platformFee - processingFee;
        return {
          campaign_id: c.campaign_id,
          title: c.title,
          source_platform: c.source_platform,
          gross: gross,
          fees: platformFee + processingFee,
          net: net
        };
      });
      
      const totalGross = results.reduce((s, r) => s + r.gross, 0);
      const totalFees = results.reduce((s, r) => s + r.fees, 0);
      const totalNet = results.reduce((s, r) => s + r.net, 0);
      
      return new Response(JSON.stringify({
        action: 'batch_payout',
        per_campaign: results,
        totals: {
          gross: totalGross,
          fees: totalFees,
          net: totalNet,
          fee_percentage: ((totalFees / totalGross) * 100).toFixed(2) + '%'
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    // ACTION 3: Aggregate external platform balances
    if (action === 'aggregate_balances') {
      // Read from MonitoredCampaign mirror for local campaigns
      const campaigns = await base44.asServiceRole.entities.MonitoredCampaign.list();
      
      const totalRaised = campaigns.reduce((s, c) => s + (c.raised_amount || 0), 0);
      const totalGoal = campaigns.reduce((s, c) => s + (c.goal_amount || 0), 0);
      const totalDonors = campaigns.reduce((s, c) => s + (c.donor_count || 0), 0);
      
      // Group by status
      const active = campaigns.filter(c => c.status === 'active');
      const draft = campaigns.filter(c => c.status === 'draft');
      
      return new Response(JSON.stringify({
        action: 'aggregate_balances',
        local_campaigns: {
          count: campaigns.length,
          total_raised: totalRaised,
          total_goal: totalGoal,
          total_donors: totalDonors,
          funding_gap: totalGoal - totalRaised,
          active: active.length,
          draft: draft.length
        },
        per_campaign: campaigns.map(c => ({
          id: c.if_campaign_id,
          title: c.title,
          status: c.status,
          raised: c.raised_amount,
          goal: c.goal_amount,
          donors: c.donor_count,
          progress: c.goal_amount > 0 ? ((c.raised_amount / c.goal_amount) * 100).toFixed(1) + '%' : '0%'
        })),
        note: 'External platform balances (GoFundMe, etc.) require Builder AI to implement API connections. This function aggregates local campaign data only.'
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    return new Response(JSON.stringify({ error: 'Unknown action. Use: calculate_payout, batch_payout, or aggregate_balances' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
