import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { runtimeContract } from '@/lib/runtimeContract';

const { token, functionsVersion } = appParams;
const appId = runtimeContract.appId || appParams.appId;
const appBaseUrl = runtimeContract.appBaseUrl || appParams.appBaseUrl;

// Base44's own hosted app should use the SDK's native endpoint selection.
// Alternate hosts (Cloudflare/custom domains) may route to the canonical Base44
// data plane explicitly. Do not force Base44-hosted authentication through an
// environment override: that can break otherwise-valid login sessions.
const isNativeBase44Host =
  typeof window !== 'undefined' &&
  /(?:^|\.)base44\.app$/i.test(window.location.hostname);

const clientConfig = {
  appId,
  token,
  functionsVersion,
  requiresAuth: false,
  ...(appBaseUrl ? { appBaseUrl } : {})
};

if (!isNativeBase44Host && appBaseUrl) {
  clientConfig.serverUrl = appBaseUrl;
}

export const base44 = createClient(clientConfig);
