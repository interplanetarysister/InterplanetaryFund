import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

const MAX_ROWS = 5000;
const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole;
    const [operations, holdings, campaigns] = await Promise.all([
      sr.entities.FinancialOperation.filter({ campaign_owner_user_id: user.id }, '-created_date', MAX_ROWS).catch(() => []),
      sr.entities.HoldingLedgerEntry.filter({ beneficiary_user_id: user.id }, '-created_date', MAX_ROWS).catch(() => []),
      base44.entities.Campaign.filter({ created_by_id: user.id }, '-created_date', 1000).catch(() => []),
    ]);
    if (![operations, holdings, campaigns].every(Array.isArray)) {
      return Response.json({ error: 'Could not load financial history.' }, { status: 500 });
    }
    if (operations.length >= MAX_ROWS || holdings.length >= MAX_ROWS) {
      return Response.json({ error: 'Financial history is too large for a safe single request.' }, { status: 409 });
    }

    const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign.title || 'Campaign']));
    const entries = [];

    for (const op of operations) {
      entries.push({
        ledger_ref: `operation-${op.id}`,
        entry_type: 'operation',
        occurred_at: op.completed_at || op.cancelled_at || op.created_date || '',
        campaign_id: op.campaign_id || '',
        campaign_title: campaignMap.get(op.campaign_id) || 'Campaign',
        kind: op.operation_type || 'operation',
        state: op.state || 'unknown',
        provider: op.provider || '',
        gross_amount: round2(op.gross_amount),
        platform_contribution: round2(op.platform_contribution),
        processing_fee: round2(op.processing_fee),
        platform_fee: round2(op.platform_fee),
        net_amount: round2(op.net_amount),
      });
    }

    for (const entry of holdings) {
      entries.push({
        ledger_ref: `holding-${entry.id}`,
        entry_type: 'custody',
        occurred_at: entry.settled_at || entry.created_date || '',
        campaign_id: entry.campaign_id || '',
        campaign_title: campaignMap.get(entry.campaign_id) || 'Campaign',
        kind: entry.direction || 'custody',
        state: entry.state || 'unknown',
        provider: entry.source_provider || '',
        source_type: entry.source_type || '',
        amount: round2(entry.amount),
        currency: String(entry.currency || 'USD').toUpperCase(),
      });
    }

    entries.sort((a, b) => String(b.occurred_at || '').localeCompare(String(a.occurred_at || '')));

    const settledHeld = holdings
      .filter((entry) => entry.direction === 'in' && entry.state === 'settled' && !entry.withdrawal_id)
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

    return Response.json({
      ok: true,
      entries,
      summary: {
        financial_operations: operations.length,
        custody_entries: holdings.length,
        settled_held_available: round2(settledHeld),
      },
    });
  } catch (error) {
    console.error('getOwnerFinancialLedger failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not load your financial ledger.' }, { status: 500 });
  }
}
