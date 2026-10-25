import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
// '/connect' was retired to a redirect into /admin/integrations; it is no
// longer a lazy page and must not return as an eager import either.
const expectedPages = [
  'Home','Login','Register','ForgotPassword','ResetPassword','Dashboard','Discover',
  'CreateCampaign','CampaignDetail','MyGiving','Communications','MissionControlPage',
  'Community','CommunityDetail','Institutions','InstitutionDetail','Analytics','Platform',
  'Onboarding','Profile','Connections','Inbox','FollowedCampaigns','Notifications',
  'Subscriptions','Withdrawals','GlobalGlobe','EmbedCampaign','Agents','OpsCenter',
  'OAuthConsent','ExternalAccounts','IntegrationsAdmin','Help','About','Contact','Social',
];

assert.match(app, /import \{ lazy, Suspense, useEffect, useRef \} from ["']react["']/);
assert.match(app, /const Layout = lazy\(\(\) => import\(['"]\.\/components\/Layout['"]\)\)/);
for (const page of expectedPages) {
  assert.match(
    app,
    new RegExp(`const ${page} = lazy\\(\\(\\) => import\\(['"]\\.\\/pages\\/${page}['"]\\)\\)`),
    `${page} must remain route-lazy to protect the initial bundle`,
  );
}
assert.doesNotMatch(
  app,
  /import\s+[A-Za-z0-9_$]+\s+from\s+['"]\.\/pages\//,
  'page modules must not be restored to eager static imports',
);
assert.match(app, /<Suspense\s+fallback=/);

console.log('Route code-splitting contract verified for all page modules and shared Layout.');
