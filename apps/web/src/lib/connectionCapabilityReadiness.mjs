/**
 * LINK + former DISCOVER: connection state is distinct from publishing authority.
 * Never infer external posting permission from an OAuth identity record alone.
 */
export function connectionCapabilityReadiness({record,authorizationEnabled,publishScopeVerified=false,providerGrantVerified=false}={}) {
  const verified=record?.status==="connected"&&Boolean(record.verified_at);
  if(!verified)return {connected:false,publishReady:false,reason:"A verified provider connection is required."};
  if(authorizationEnabled!==true)return {connected:true,publishReady:false,reason:"Provider authorization status is not available for new requests."};
  if(publishScopeVerified!==true||providerGrantVerified!==true)return {
    connected:true,publishReady:false,
    reason:"Connected identity confirmed; provider publishing permission has not been independently verified."
  };
  return {connected:true,publishReady:true,reason:"Provider publishing scope and grant were independently verified."};
}
