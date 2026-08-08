/*
 * Interplanetary Fund — Universal Payment Provider Abstraction
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Modular provider system so additional providers can be added
 * without rewriting the campaign financial system. Uses a common
 * internal model for:
 *  - provider
 *  - external account
 *  - authorization
 *  - transaction
 *  - campaign
 *  - synchronization
 *  - reconciliation
 *  - transfer
 *  - payout
 *  - error state
 *
 * Provider-specific capabilities remain provider-specific.
 * Do NOT pretend a provider supports a capability when it does not.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

// =====================================================
// PROVIDER CAPABILITY REGISTRY
// Each provider declares what it can and cannot do.
// This is the source of truth for provider capabilities.
// Never claim a provider supports something it doesn't.
// =====================================================

export interface ProviderCapabilities {
  provider: string;
  displayName: string;
  supportsOAuth: boolean;
  supportsAPIKey: boolean;
  supportsManualConnection: boolean;
  supportsWebhooks: boolean;
  supportsReadTransactions: boolean;
  supportsSyncFunds: boolean;
  supportsInitiatePayout: boolean;
  supportsRefunds: boolean;
  supportsChargebacks: boolean;
  supportsRecurringDonations: boolean;
  supportsPartialRefunds: boolean;
  supportedCurrencies: string[];
  supportedScopes: string[];
  notes: string;
}

const PROVIDER_REGISTRY: ProviderCapabilities[] = [
  {
    provider: "paypal",
    displayName: "PayPal",
    supportsOAuth: true,
    supportsAPIKey: false,
    supportsManualConnection: true,
    supportsWebhooks: true,
    supportsReadTransactions: true,
    supportsSyncFunds: true,
    supportsInitiatePayout: true,
    supportsRefunds: true,
    supportsChargebacks: true,
    supportsRecurringDonations: true,
    supportsPartialRefunds: true,
    supportedCurrencies: ["USD", "EUR", "GBP", "CAD", "AUD"],
    supportedScopes: ["read_transactions", "sync_funds", "initiate_payout"],
    notes: "PayPal supports IPN/webhooks, PayPal Checkout, and Payouts API. Full refund support.",
  },
  {
    provider: "stripe",
    displayName: "Stripe",
    supportsOAuth: true,
    supportsAPIKey: true,
    supportsManualConnection: false,
    supportsWebhooks: true,
    supportsReadTransactions: true,
    supportsSyncFunds: true,
    supportsInitiatePayout: true,
    supportsRefunds: true,
    supportsChargebacks: true,
    supportsRecurringDonations: true,
    supportsPartialRefunds: true,
    supportedCurrencies: ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"],
    supportedScopes: ["read_transactions", "sync_funds", "initiate_payout", "process_refunds"],
    notes: "Stripe Connect for marketplace, full API, webhook signature verification.",
  },
  {
    provider: "cashapp",
    displayName: "Cash App",
    supportsOAuth: false,
    supportsAPIKey: false,
    supportsManualConnection: true,
    supportsWebhooks: false,
    supportsReadTransactions: false,
    supportsSyncFunds: false,
    supportsInitiatePayout: false,
    supportsRefunds: false,
    supportsChargebacks: false,
    supportsRecurringDonations: false,
    supportsPartialRefunds: false,
    supportedCurrencies: ["USD"],
    supportedScopes: ["manual_entry"],
    notes: "Cash App does not offer a public API for transaction reading or payouts. Manual tracking only.",
  },
  {
    provider: "gofundme",
    displayName: "GoFundMe",
    supportsOAuth: false,
    supportsAPIKey: false,
    supportsManualConnection: true,
    supportsWebhooks: false,
    supportsReadTransactions: false,
    supportsSyncFunds: false,
    supportsInitiatePayout: false,
    supportsRefunds: false,
    supportsChargebacks: false,
    supportsRecurringDonations: false,
    supportsPartialRefunds: false,
    supportedCurrencies: ["USD"],
    supportedScopes: ["manual_entry"],
    notes: "GoFundMe uses its own payout system. Funds go directly to organizer's bank. No public API.",
  },
  {
    provider: "kickstarter",
    displayName: "Kickstarter",
    supportsOAuth: false,
    supportsAPIKey: false,
    supportsManualConnection: true,
    supportsWebhooks: false,
    supportsReadTransactions: false,
    supportsSyncFunds: false,
    supportsInitiatePayout: false,
    supportsRefunds: false,
    supportsChargebacks: false,
    supportsRecurringDonations: false,
    supportsPartialRefunds: false,
    supportedCurrencies: ["USD"],
    supportedScopes: ["manual_entry"],
    notes: "Kickstarter handles its own Stripe internally. Funds land in organizer's bank. No public API.",
  },
  {
    provider: "buymeacoffee",
    displayName: "Buy Me a Coffee",
    supportsOAuth: false,
    supportsAPIKey: false,
    supportsManualConnection: true,
    supportsWebhooks: false,
    supportsReadTransactions: false,
    supportsSyncFunds: false,
    supportsInitiatePayout: false,
    supportsRefunds: false,
    supportsChargebacks: false,
    supportsRecurringDonations: true,
    supportsPartialRefunds: false,
    supportedCurrencies: ["USD"],
    supportedScopes: ["manual_entry"],
    notes: "Buy Me a Coffee handles payouts internally. No public API for transaction reading.",
  },
  {
    provider: "kofi",
    displayName: "Ko-fi",
    supportsOAuth: false,
    supportsAPIKey: false,
    supportsManualConnection: true,
    supportsWebhooks: true,
    supportsReadTransactions: false,
    supportsSyncFunds: false,
    supportsInitiatePayout: false,
    supportsRefunds: false,
    supportsChargebacks: false,
    supportsRecurringDonations: true,
    supportsPartialRefunds: false,
    supportedCurrencies: ["USD"],
    supportedScopes: ["manual_entry"],
    notes: "Ko-fi has webhook support for donation notifications. Payouts handled internally.",
  },
  {
    provider: "patreon",
    displayName: "Patreon",
    supportsOAuth: true,
    supportsAPIKey: false,
    supportsManualConnection: true,
    supportsWebhooks: true,
    supportsReadTransactions: true,
    supportsSyncFunds: false,
    supportsInitiatePayout: false,
    supportsRefunds: false,
    supportsChargebacks: false,
    supportsRecurringDonations: true,
    supportsPartialRefunds: false,
    supportedCurrencies: ["USD"],
    supportedScopes: ["read_transactions"],
    notes: "Patreon has OAuth2 API for reading patron data. Payouts handled internally by Patreon.",
  },
  {
    provider: "indiegogo",
    displayName: "Indiegogo",
    supportsOAuth: false,
    supportsAPIKey: false,
    supportsManualConnection: true,
    supportsWebhooks: false,
    supportsReadTransactions: false,
    supportsSyncFunds: false,
    supportsInitiatePayout: false,
    supportsRefunds: false,
    supportsChargebacks: false,
    supportsRecurringDonations: false,
    supportsPartialRefunds: false,
    supportedCurrencies: ["USD"],
    supportedScopes: ["manual_entry"],
    notes: "Indiegogo handles its own payout system. No public API for transactions.",
  },
  {
    provider: "spotfund",
    displayName: "Spotfund",
    supportsOAuth: false,
    supportsAPIKey: false,
    supportsManualConnection: true,
    supportsWebhooks: false,
    supportsReadTransactions: false,
    supportsSyncFunds: false,
    supportsInitiatePayout: false,
    supportsRefunds: false,
    supportsChargebacks: false,
    supportsRecurringDonations: false,
    supportsPartialRefunds: false,
    supportedCurrencies: ["USD"],
    supportedScopes: ["manual_entry"],
    notes: "Spotfund has no public API. Manual tracking only.",
  },
  {
    provider: "fundrazr",
    displayName: "FundRazr",
    supportsOAuth: false,
    supportsAPIKey: false,
    supportsManualConnection: true,
    supportsWebhooks: false,
    supportsReadTransactions: false,
    supportsSyncFunds: false,
    supportsInitiatePayout: false,
    supportsRefunds: false,
    supportsChargebacks: false,
    supportsRecurringDonations: false,
    supportsPartialRefunds: false,
    supportedCurrencies: ["USD", "CAD"],
    supportedScopes: ["manual_entry"],
    notes: "FundRazr supports PayPal payouts natively. No public API.",
  },
  {
    provider: "givesendgo",
    displayName: "GiveSendGo",
    supportsOAuth: false,
    supportsAPIKey: false,
    supportsManualConnection: true,
    supportsWebhooks: false,
    supportsReadTransactions: false,
    supportsSyncFunds: false,
    supportsInitiatePayout: false,
    supportsRefunds: false,
    supportsChargebacks: false,
    supportsRecurringDonations: false,
    supportsPartialRefunds: false,
    supportedCurrencies: ["USD"],
    supportedScopes: ["manual_entry"],
    notes: "GiveSendGo supports bank transfer, PayPal, and check payouts. No public API.",
  },
  {
    provider: "manual",
    displayName: "Manual Entry",
    supportsOAuth: false,
    supportsAPIKey: false,
    supportsManualConnection: true,
    supportsWebhooks: false,
    supportsReadTransactions: false,
    supportsSyncFunds: false,
    supportsInitiatePayout: false,
    supportsRefunds: false,
    supportsChargebacks: false,
    supportsRecurringDonations: false,
    supportsPartialRefunds: false,
    supportedCurrencies: ["USD"],
    supportedScopes: ["manual_entry"],
    notes: "For tracking offline donations or cash/check payments.",
  },
];

// =====================================================
// QUERIES
// =====================================================

// Get all supported providers and their capabilities
export const getSupportedProviders = query({
  args: {},
  handler: async () => {
    return PROVIDER_REGISTRY.map((p) => ({
      provider: p.provider,
      displayName: p.displayName,
      supportsOAuth: p.supportsOAuth,
      supportsManualConnection: p.supportsManualConnection,
      supportsReadTransactions: p.supportsReadTransactions,
      supportsSyncFunds: p.supportsSyncFunds,
      supportsInitiatePayout: p.supportsInitiatePayout,
      supportsRefunds: p.supportsRefunds,
      supportsWebhooks: p.supportsWebhooks,
      supportedCurrencies: p.supportedCurrencies,
      supportedScopes: p.supportedScopes,
      notes: p.notes,
    }));
  },
});

// Get capabilities for a specific provider
export const getProviderCapabilities = query({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const provider = PROVIDER_REGISTRY.find((p) => p.provider === args.provider);
    if (!provider) {
      return {
        found: false,
        message: `Unknown provider: ${args.provider}`,
        supportedProviders: PROVIDER_REGISTRY.map((p) => p.provider),
      };
    }
    return { found: true, ...provider };
  },
});

// Check if a provider supports a specific capability
export const checkProviderCapability = query({
  args: {
    provider: v.string(),
    capability: v.string(),
  },
  handler: async (ctx, args) => {
    const provider = PROVIDER_REGISTRY.find((p) => p.provider === args.provider);
    if (!provider) {
      return { supported: false, reason: "Unknown provider" };
    }

    const capabilityMap: Record<string, boolean> = {
      oauth: provider.supportsOAuth,
      api_key: provider.supportsAPIKey,
      manual: provider.supportsManualConnection,
      webhooks: provider.supportsWebhooks,
      read_transactions: provider.supportsReadTransactions,
      sync_funds: provider.supportsSyncFunds,
      initiate_payout: provider.supportsInitiatePayout,
      refunds: provider.supportsRefunds,
      chargebacks: provider.supportsChargebacks,
      recurring: provider.supportsRecurringDonations,
      partial_refunds: provider.supportsPartialRefunds,
    };

    const supported = capabilityMap[args.capability] ?? false;
    return {
      supported,
      reason: supported ? undefined : `${provider.displayName} does not support ${args.capability}`,
    };
  },
});
