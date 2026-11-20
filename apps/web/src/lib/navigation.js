// The four stable bottom destinations are shared by the responsive web app
// and installed mobile PWA. Restricted destinations show login or plan access.
export const AUTH_TABS = Object.freeze(['/agents','/profile','/social','/community','/events']);
export const PUBLIC_TABS = Object.freeze(['/agents','/profile','/social','/community','/events']);
const PREFIXES=Object.freeze({
  '/agents':['/agents','/mission','/messaging'],
  '/profile':['/profile','/u','/my-blog','/devices','/giving','/following','/subscriptions','/plans','/withdrawals','/ledger'],
  '/social':['/social'],
  '/community':['/community','/blogs'],
  '/events':['/events'],
});
export function owningNavigationTab(pathname,isAuthenticated=false) {
  const tabs=isAuthenticated?AUTH_TABS:PUBLIC_TABS;
  for(const tab of tabs) {
    if((PREFIXES[tab]||[tab]).some(prefix=>pathname===prefix||pathname.startsWith(prefix+'/')))
      return tab;
  }
  return null;
}
export function navigationBackFallback(pathname,isAuthenticated=false){
  return owningNavigationTab(pathname,isAuthenticated)||(isAuthenticated?'/dashboard':'/');
}
export function canReturnWithinApp(historyState){
  return Number.isInteger(historyState?.idx)&&historyState.idx>0;
}
