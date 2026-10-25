import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { getTransaction, IFUND_PAYPAL_ACCOUNT_REF } from '../../shared/paypal.ts';
import { logAudit } from '../../shared/auditLog.ts';

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

// Admin-only conservative matcher. It verifies the receiving PayPal transaction,
// then auto-settles only when exactly one outstanding provider-verified exterior
// observation has the same amount/currency. Zero or multiple matches fail closed.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const sr = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });

    const { paypal_transaction_id } = await req.json().catch(() => ({}));
    if (!paypal_transaction_id) return Response.json({ error: 'PayPal transaction id is required.' }, { status: 400 });

    const tx = await getTransaction(paypal_transaction_id).catch(() => null);
    if (!tx || tx.status !== 'S' || !(tx.amount > 0) || !tx.currency) {
      return Response.json({ error: 'A settled PayPal receiving transaction could not be verified.' }, { status: 409 });
    }

    const existing = await sr.entities.HoldingLedgerEntry.filter({ provider_transaction_id: tx.id }).catch(() => []);
    if (existing?.length) return Response.json({ ok: true, duplicate: true, holding_ledger_entry_id: existing[0].id });

    const observations = await sr.entities.ExternalFundObservation.filter({ settlement_state: 'external', currency: tx.currency }).catch(() => []);
    const matches = (observations || []).filter((o) => round2(o.amount) === round2(tx.amount));

    if (matches.length !== 1) {
      for (const candidate of matches) {
        await sr.entities.ExternalFundObservation.update(candidate.id, { settlement_state: 'ambiguous' }).catch(() => {});
      }
      await logAudit(base44, {
        action: 'external_settlement_match_review',
        actor_user_id: user.id,
        target_type: 'paypal_transaction',
        target_id: tx.id,
        detail: matches.length ? `Ambiguous PayPal settlement: ${matches.length} exterior observations match amount/currency.` : 'No exterior observation matched the verified PayPal settlement.',
        status: 'failure',
        metadata: { amount: tx.amount, currency: tx.currency, candidate_count: matches.length },
      });
      return Response.json({ ok: false, state: matches.length ? 'ambiguous' : 'unmatched', candidate_count: matches.length }, { status: 409 });
    }

    const observation = matches[0];
    const campaign = await sr.entities.Campaign.get(observation.campaign_id).catch(() => null);
    if (!campaign || campaign.created_by_id !== observation.beneficiary_user_id) {
      return Response.json({ error: 'Observation ownership no longer matches its campaign.' }, { status: 409 });
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
      settled_at: new Date().toISOString(),
      reconciliation_note: 'Automatically matched one provider-verified exterior observation to one verified PayPal holding-account receipt.',
    });

    await sr.entities.ExternalFundObservation.update(observation.id, {
      settlement_state: 'settled',
      holding_ledger_entry_id: entry.id,
      receiving_paypal_transaction_id: tx.id,
    });

    await logAudit(base44, {
      action: 'external_settlement_auto_matched',
      actor_user_id: user.id,
      target_type: 'HoldingLedgerEntry',
      target_id: entry.id,
      detail: `${tx.currency} ${round2(tx.amount).toFixed(2)} automatically reconciled to campaign ${observation.campaign_id}.`,
      status: 'success',
      metadata: { external_observation_id: observation.id, paypal_transaction_id: tx.id },
    });
    return Response.json({ ok: true, state: 'settled', holding_ledger_entry_id: entry.id, external_observation_id: observation.id });
  } catch (error) {
    console.error('matchExternalPayPalSettlement error:', error instanceof Error ? error.message : String(error));
    return Response.json({ error: 'Automatic settlement matching could not complete safely.' }, { status: 500 });
  }
}
