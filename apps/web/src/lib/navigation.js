// The five main mobile destinations prioritize discovering and creating campaigns.
// The full drawer retains AI, forums, finances and account-specific destinations.
export const AUTH_TABS = Object.freeze(['/','/discover','/create','/social','/profile']);
export const PUBLIC_TABS = AUTH_TABS;
const PREFIXES=Object.freeze({
  '/':['/','/dashboard'],
  '/discover':['/discover','/campaign','/globe','/shorts','/institutions','/events','/fundraising-tips','/planetary-impact'],
  '/create':['/create','/campaigns','/fundraising-partners'],
  '/social':['/social','/community','/blogs','/news'],
  '/profile':['/profile','/u','/my-blog','/devices','/giving','/following','/subscriptions','/plans','/withdrawals','/ledger','/agents','/mission'],
});
export function owningNavigationTab(pathname,isAuthenticated=false) {
  const tabs=isAuthenticated?AUTH_TABS:PUBLIC_TABS;
  for(const tab of tabs) {
    if((PREFIXES[tab]||[tab]).some(prefix=>pathname===prefix||(prefix!=="/"&&pathname.startsWith(prefix+'/'))))
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
