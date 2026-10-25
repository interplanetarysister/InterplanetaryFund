import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { listTransactions, IFUND_PAYPAL_ACCOUNT_REF } from '../../shared/paypal.ts';
import { logAudit } from '../../shared/auditLog.ts';

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

// Scheduled/admin discovery of receipts in the Interplanetary business PayPal
// holding account. Auto-allocation is deliberately conservative: only one exact
// outstanding observation may match. Anything ambiguous remains unallocated.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const sr = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Trusted admin invocation required.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const hours = Math.max(1, Math.min(31 * 24, Number(body.lookback_hours) || 24));
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    const transactions = await listTransactions({ startDate: start, endDate: end, pageSize: 500 });

    const settledReceipts = transactions.filter((tx) => tx.status === 'S' && tx.amount > 0 && tx.currency);
    const observations = await sr.entities.ExternalFundObservation.filter({ settlement_state: 'external' }).catch(() => []);
    const results = [];

    for (const tx of settledReceipts) {
      const existing = await sr.entities.HoldingLedgerEntry.filter({ provider_transaction_id: tx.id }).catch(() => []);
      if (existing?.length) {
        results.push({ transaction_id: tx.id, state: 'already_ledgered' });
        continue;
      }

      const matches = (observations || []).filter((o) =>
        o.settlement_state === 'external' &&
        String(o.currency || '').toUpperCase() === tx.currency &&
        round2(o.amount) === round2(tx.amount)
      );

      if (matches.length !== 1) {
        if (matches.length > 1) {
          for (const candidate of matches) {
            await sr.entities.ExternalFundObservation.update(candidate.id, { settlement_state: 'ambiguous' }).catch(() => {});
          }
        }
        results.push({ transaction_id: tx.id, state: matches.length ? 'ambiguous' : 'unmatched', candidate_count: matches.length });
        continue;
      }

      const observation = matches[0];
      const campaign = await sr.entities.Campaign.get(observation.campaign_id).catch(() => null);
      if (!campaign || campaign.created_by_id !== observation.beneficiary_user_id) {
        results.push({ transaction_id: tx.id, state: 'ownership_conflict' });
        continue;
      }

      const entry = await sr.entities.HoldingLedgerEntry.create({
        operation_key: `holding:external:paypal:${tx.id}`,
        direction: 'in',
        state: 'settled',
        source_type: 'external_platform',
        source_provider: observation.provider,
        source_account_ref: IFUND_PAYPAL_ACCOUNT_REF,
        provider_transaction_id: tx.id,
        campaign_id: observation.campaign_id,
        beneficiary_user_id: observation.beneficiary_user_id,
        amount: round2(tx.amount),
        currency: tx.currency,
        platform_contribution: 0,
        processing_fee: 0,
        external_connection_id: observation.external_connection_id,
        external_observation_id: observation.id,
        settled_at: tx.transactionUpdatedDate || tx.transactionInitiationDate || new Date().toISOString(),
        reconciliation_note: 'Scheduled PayPal discovery uniquely matched this receipt to one provider-verified exterior observation.',
      });
      await sr.entities.ExternalFundObservation.update(observation.id, {
        settlement_state: 'settled',
        holding_ledger_entry_id: entry.id,
        receiving_paypal_transaction_id: tx.id,
      });
      observation.settlement_state = 'settled';
      results.push({ transaction_id: tx.id, state: 'settled', holding_ledger_entry_id: entry.id, external_observation_id: observation.id });
    }

    const counts = results.reduce((a, r) => { a[r.state] = (a[r.state] || 0) + 1; return a; }, {});
    await logAudit(base44, {
      action: 'paypal_holding_receipt_discovery',
      actor_user_id: user.id,
      target_type: 'holding_account',
      target_id: IFUND_PAYPAL_ACCOUNT_REF,
      detail: `Scanned ${settledReceipts.length} settled PayPal receipts; auto-settled ${counts.settled || 0}; ambiguous ${counts.ambiguous || 0}; unmatched ${counts.unmatched || 0}.`,
      status: 'success',
      metadata: { lookback_hours: hours, counts },
    });

    return Response.json({ ok: true, lookback_hours: hours, scanned: settledReceipts.length, counts, results });
  } catch (error) {
    console.error('discoverPayPalHoldingSettlements error:', error instanceof Error ? error.message : String(error));
    return Response.json({ error: 'PayPal holding-account discovery could not complete safely.' }, { status: 500 });
  }
}
