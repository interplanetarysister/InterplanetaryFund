# Frontend non-UI components 1–17
Static callsite scan for direct base44.* operations. Shared wrappers and dynamic property access may be missed.

## [src/components/AdminRoute.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/AdminRoute.jsx) — 0 matches
- No direct match detected.

## [src/components/AuthLayout.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/AuthLayout.jsx) — 0 matches
- No direct match detected.

## [src/components/BackToTop.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/BackToTop.jsx) — 0 matches
- No direct match detected.

## [src/components/ErrorBoundary.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/ErrorBoundary.jsx) — 0 matches
- No direct match detected.

## [src/components/GoogleIcon.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/GoogleIcon.jsx) — 0 matches
- No direct match detected.

## [src/components/Layout.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/Layout.jsx) — 0 matches
- No direct match detected.

## [src/components/LegalFooter.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/LegalFooter.jsx) — 0 matches
- No direct match detected.

## [src/components/MobileBottomNav.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/MobileBottomNav.jsx) — 0 matches
- No direct match detected.

## [src/components/NotificationBell.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/NotificationBell.jsx) — 3 matches
- L11: `const items = await base44.entities.Notification.filter({ user_id: uid }, "-created_date", 20);`
- L16: `base44.auth.me().then((me) => {`
- L24: `const unsubscribe = base44.entities.Notification.subscribe((event) => {`

## [src/components/PageError.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/PageError.jsx) — 0 matches
- No direct match detected.

## [src/components/ProtectedRoute.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/ProtectedRoute.jsx) — 0 matches
- No direct match detected.

## [src/components/QuickActions.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/QuickActions.jsx) — 1 matches
- L20: `try{if(isAndroidApp)await disableAndroidPush().catch(()=>{});await base44.auth.logout("/login");}`

## [src/components/ScrollToTop.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/ScrollToTop.jsx) — 0 matches
- No direct match detected.

## [src/components/TermsAcceptance.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/TermsAcceptance.jsx) — 2 matches
- L28: `const response = await base44.functions.invoke("recordLegalAcceptance", { mode: "status" });`
- L51: `const response = await base44.functions.invoke("recordLegalAcceptance", {`

## [src/components/UserNotRegisteredError.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/UserNotRegisteredError.jsx) — 0 matches
- No direct match detected.

## [src/components/account/AccountManagement.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/account/AccountManagement.jsx) — 10 matches
- L29: `await base44.auth.updateMe({ comm_prefs: next });`
- L43: `const me = await base44.auth.me();`
- L45: `base44.entities.Campaign.filter({ created_by_id: me.id }),`
- L46: `base44.entities.FollowedCampaign.filter({ user_id: me.id }),`
- L47: `base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 200),`
- L48: `base44.functions.invoke("listConnections", {}),`
- L49: `base44.entities.InboxItem.filter({ user_id: me.id }, "-created_date", 200),`
- L50: `base44.entities.Donation.filter({ donor_user_id: me.id }, "-created_date", 200),`
- L77: `const res = await base44.functions.invoke("deleteAccount", {});`
- L80: `await base44.auth.logout("/login");`

## [src/components/account/CountMyMoney.jsx](https://github.com/interplanetarysister/interplanetary-fund2/blob/main/src/components/account/CountMyMoney.jsx) — 1 matches
- L38: `const { data } = await base44.functions.invoke("syncExternalFunds", { scope: "user", initiator_type: "user", request_id: crypto.randomUUID() });`
