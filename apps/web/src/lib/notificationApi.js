// Same-origin production notification transport. Never falls back to direct
// database writes after a Worker failure: that could acknowledge twice.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function call(client, path, method='GET', body, fetcher=fetch) {
  const sessionResult=await client.auth.getSession();
  const session=sessionResult.data?.session;
  if(sessionResult.error || !session?.access_token || !UUID.test(session.user?.id || '')) throw new Error('Sign in to view your notifications.');
  const userResult=await client.auth.getUser(session.access_token);
  if(userResult.error || userResult.data?.user?.id!==session.user.id || !userResult.data?.user?.email_confirmed_at) throw new Error('Sign in to view your notifications.');
  const res=await fetcher(path,{method,redirect:'error',credentials:'omit',cache:'no-store',
    headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
  if(!res.ok || !/^application\/json(?:;|$)/i.test(res.headers.get('content-type')||'')) throw new Error('Notification request could not be confirmed.');
  const result=await res.json();
  const current=await client.auth.getSession();
  if(current.error || current.data?.session?.user?.id!==session.user.id) throw new Error('Your account changed. Reload notifications.');
  return result;
}

export async function loadWorkerNotifications(client,fetcher=fetch){
  const rows=await call(client,'/api/notifications','GET',undefined,fetcher);
  if(!Array.isArray(rows)||rows.length>50||rows.some(r=>!UUID.test(r?.id||'')||typeof r.title!=='string'||typeof r.read!=='boolean')) throw new Error('Notifications could not be loaded.');
  return rows;
}
export async function acknowledgeWorkerNotification(client,id,fetcher=fetch){
  if(!UUID.test(id||''))throw new Error('Invalid notification.');
  const result=await call(client,'/api/notifications/'+id.toLowerCase(),'PATCH',undefined,fetcher);
  if(!Array.isArray(result?.acknowledged)||result.acknowledged.length!==1||result.acknowledged[0]!==id.toLowerCase()) throw new Error('Notification acknowledgement not confirmed.');
  return id;
}
export async function acknowledgeWorkerNotifications(client,ids,fetcher=fetch){
  if(!Array.isArray(ids)||ids.length>50||ids.some(id=>!UUID.test(id||'')))throw new Error('Invalid notifications.');
  const expected=[...new Set(ids.map(id=>id.toLowerCase()))];
  const result=await call(client,'/api/notifications/acknowledge','POST',{ids:expected},fetcher);
  const actual=result?.acknowledged;
  if(!Array.isArray(actual)||actual.length!==expected.length||new Set(actual).size!==expected.length||actual.some(id=>!expected.includes(id)))throw new Error('Notification acknowledgements not confirmed.');
  return actual.length;
}
