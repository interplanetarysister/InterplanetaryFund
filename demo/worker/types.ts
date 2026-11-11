/** Type contracts for the isolated PayPal AI Hackathon demo.
 * Secrets are runtime-only Cloudflare bindings; no credential values belong here.
 * This file reconstructs the declarations not emitted by the deployed JS source map.
 */
export type SecretBinding = string | { get(): Promise<string> };
export type DemoRole = "donor" | "organizer" | "admin";
export interface DemoEnv {
  DEMO_ORIGIN: string;
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY?: string;
  DB_SIGNER?: SecretBinding;
  DEMO_ENABLED?: string;
  SETUP_ENABLED?: string;
  AI_ENABLED?: string;
  RELEASE_SHA?: string;
  PAYPAL_CLIENT_ID?: SecretBinding;
  PAYPAL_CLIENT_SECRET?: SecretBinding;
  PAYPAL_WEBHOOK_ID?: string;
  PAYPAL_MERCHANT_ID?: string;
  MEDIA?: {
    put(key: string, body: Uint8Array, opts?: {httpMetadata?: {contentType?: string}}): Promise<unknown>;
    get(key: string): Promise<null | { body: ReadableStream; httpMetadata?: {contentType?: string}; writeHttpMetadata?(headers: Headers): void }>;
    delete?(key: string): Promise<void>;
  };
  AI?: { run(model: string, options: Record<string, unknown>): Promise<any> };
  ASSETS?: { fetch(request: Request): Promise<Response> };
  [key: string]: unknown;
}
export interface User {
  id: string;
  handle: string;
  role: DemoRole;
  [key: string]: any;
}
export interface Campaign {
  id: string;
  owner_id: string;
  title: string;
  summary: string;
  story: any[];
  category: string;
  goal_cents: number;
  status: "draft" | "published" | "paused" | string;
  organizer: string;
  location: string;
  latitude: number;
  longitude: number;
  image_path: string | null;
  fictional: boolean;
  version: number;
  ai_request_ids?: string[];
  raised_cents?: number;
  donor_count?: number;
  [key: string]: any;
}
export interface Order {
  id: string;
  user_id: string;
  campaign_id: string | null;
  purpose: "campaign" | "platform_support";
  amount_cents: number;
  currency: string;
  paypal_order_id: string;
  paypal_capture_id: string | null;
  merchant_id: string | null;
  status: string;
  reconciliation?: string;
  checkout_method?: string;
  approval_url?: string;
  [key: string]: any;
}
export interface ProviderOrder {
  id: string;
  status: string;
  purchase_units: any[];
  links?: Array<{rel: string; href: string}>;
  [key: string]: any;
}
