import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { getTransaction, IFUND_PAYPAL_ACCOUNT_REF } from '../../shared/paypal.ts';

const validCurrency = (v) => /^[A-Z]{3}$/.test(String(v || '').trim().toUpperCase());

// Admin-only reconciliation boundary for money that originated on an exterior
// platform and has actually arrived in the designated Interplanetary business
// PayPal holding account. This does NOT create a second Donation: the exterior
// transaction already represents the fundraising event. It records custody and
// links that custody to the campaign/user who beneficially owns the funds.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const sr = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      campaign_id,
      external_connection_id,
      external_observation_id,
      paypal_transaction_id,
      amount,
      currency,
    } = body;

    if (!campaign_id || !external_connection_id || !external_observation_id || !paypal_transaction_id) {
      return Response.json({ error: 'Campaign, connection, external observation, and PayPal transaction are required.' }, { status: 400 });
    }
    const value = Number(amount);
    const iso = String(currency || '').trim().toUpperCase();
    if (!(value > 0) || !validCurrency(iso)) {
      return Response.json({ error: 'A positive amount and valid ISO currency are required.' }, { status: 400 });
    }

    // Never trust an admin-entered transaction id/amount as settlement proof.
    // PayPal reporting is the receiving-account source of truth.
    const paypalTx = await getTransaction(paypal_transaction_id).catch(() => null);
    if (!paypalTx) {
      return Response.json({ error: 'PayPal could not verify this transaction in the designated holding account.' }, { status: 409 });
    }
    // PayPal transaction status "S" means successfully completed in the
    // Transaction Search API. Other states remain pending/failed and cannot
    // create held value.
    if (paypalTx.status !== 'S') {
      return Response.json({ error: 'PayPal transaction is not settled.', paypal_status: paypalTx.status || 'unknown' }, { status: 409 });
    }
    if (Math.abs(Number(paypalTx.amount) - value) > 0.01 || paypalTx.currency !== iso) {
      return Response.json({ error: 'PayPal settlement amount or currency does not match the requested reconciliation.' }, { status: 409 });
    }

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign?.created_by_id) return Response.json({ error: 'Campaign not found or has no owner.' }, { status: 404 });

    const connection = await sr.entities.PlatformConnection.get(external_connection_id).catch(() => null);
    if (!connection || connection.campaign_id !== campaign_id || connection.created_by_id !== campaign.created_by_id) {
      return Response.json({ error: 'External connection does not belong to this campaign.' }, { status: 409 });
    }
    if (connection.verification_status !== 'verified' || connection.external_data_source !== 'provider_verified') {
      return Response.json({ error: 'Exterior source is not provider verified.' }, { status: 409 });
    }

    // Provider transaction id is the receiving-account dedupe boundary. A single
    // PayPal receipt can never be allocated to two campaigns.
    const operationKey = `holding:external:paypal:${String(paypal_transaction_id)}`;
    const byOperation = await sr.entities.HoldingLedgerEntry.filter({ operation_key: operationKey }).catch(() => []);
    const byPayPal = await sr.entities.HoldingLedgerEntry.filter({ provider_transaction_id: String(paypal_transaction_id) }).catch(() => []);
    const existing = [...(byOperation || []), ...(byPayPal || [])][0];
    if (existing) {
      const sameAllocation =
        existing.campaign_id === campaign_id &&
        existing.external_connection_id === external_connection_id &&
        existing.external_observation_id === external_observation_id &&
        Number(existing.amount) === value &&
        String(existing.currency || '').toUpperCase() === iso;
      if (!sameAllocation) {
        return Response.json({ error: 'This PayPal settlement is already allocated differently. Reconciliation review required.' }, { status: 409 });
      }
      return Response.json({ ok: true, duplicate: true, holding_ledger_entry_id: existing.id });
    }

    const entry = await sr.entities.HoldingLedgerEntry.create({
      operation_key: operationKey,
      direction: 'in',
      state: 'settled',
      source_type: 'external_platform',
      source_provider: String(connection.platform || 'external'),
      source_account_ref: IFUND_PAYPAL_ACCOUNT_REF,
      provider_transaction_id: paypalTx.id,
      campaign_id,
      beneficiary_user_id: campaign.created_by_id,
      amount: value,
      currency: iso,
      platform_contribution: 0,
      processing_fee: 0,
      external_connection_id,
      external_observation_id,
      settled_at: new Date().toISOString(),
      reconciliation_note: `Verified exterior ${connection.platform || 'platform'} funds reconciled to receipt in the Interplanetary business PayPal holding account.`,
    });
    // Converge: concurrent admin reconciliation calls for the same PayPal
    // transaction may each pass the duplicate check and create a holding entry.
    // Keep the earliest as canonical, delete the rest. Use the ACTUAL canonical
    // ID for audit and response — never reference a deleted duplicate.
    const allEntries = await sr.entities.HoldingLedgerEntry.filter({ operation_key: operationKey }, 'created_date', 10).catch(() => []);
    let canonicalEntry = entry;
    if (allEntries.length > 1) {
      const ordered = [...allEntries].sort((a, b) => {
        const at = new Date(a.created_date || 0).getTime();
        const bt = new Date(b.created_date || 0).getTime();
        if (at !== bt) return at - bt;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
      canonicalEntry = ordered[0];
      // Only delete duplicates if they represent the same settlement (same
      // amount/currency/campaign). Conflicting allocations were already
      // rejected above; duplicates here are safe convergence candidates.
      for (const dup of ordered.slice(1)) {
        if (dup.id === canonicalEntry.id) continue;
        const sameAllocation =
          dup.campaign_id === canonicalEntry.campaign_id &&
          Math.abs(Number(dup.amount) - Number(canonicalEntry.amount)) < 0.01 &&
          String(dup.currency || '').toUpperCase() === String(canonicalEntry.currency || '').toUpperCase();
        if (sameAllocation) await sr.entities.HoldingLedgerEntry.delete(dup.id).catch(() => {});
      }
    }
    const canonicalId = canonicalEntry.id;

    await logAudit(base44, {
      action: 'external_funds_settled_to_holding',
      actor_user_id: user.id,
      target_type: 'HoldingLedgerEntry',
      target_id: canonicalId,
      detail: `${iso} ${value.toFixed(2)} from ${connection.platform || 'external'} reconciled to business PayPal holding account`,
      status: 'success',
      metadata: {
        campaign_id,
        beneficiary_user_id: campaign.created_by_id,
        external_connection_id,
        external_observation_id,
        paypal_transaction_id: paypalTx.id,
      },
    });

    return Response.json({ ok: true, duplicate: false, holding_ledger_entry_id: canonicalId, state: 'settled' });
  } catch (error) {
    console.error('reconcileExternalPayPalSettlement error:', error instanceof Error ? error.message : String(error));
    return Response.json({ error: 'Settlement reconciliation could not be completed safely.' }, { status: 500 });
  }
}