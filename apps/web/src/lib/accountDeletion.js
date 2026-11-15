// Direct account-deletion initiation. Unlike a generic support request this
// writes to the dedicated, restricted canonical deletion queue and returns a
// server-issued reference. Completion requires audited erasure processing.
import { authClient } from "@/api/auth";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function requestAccountDeletion(client=authClient()){
  const {data:auth,error:identityError}=await client.auth.getUser();
  if(identityError||!auth?.user?.id||
    (!auth.user.is_anonymous && !auth.user.email_confirmed_at))
    throw new Error("Sign in with your IFund account or authenticated guest session to request deletion.");
  const {data,error}=await client.rpc("ifund_request_account_deletion");
  const row=Array.isArray(data)?data[0]:null;
  if(error||!row||!UUID.test(row.request_id||"")||
      !["requested","reviewing","requires_legal_retention"].includes(row.request_status))
    throw new Error(error?.message||"The account deletion request could not be confirmed.");
  return {id:row.request_id,status:row.request_status,requestedAt:row.submitted_at};
}
export async function getMyAccountDeletionRequests(client=authClient()){
  const {data:auth,error:identityError}=await client.auth.getUser();
  if(identityError||!auth?.user?.id||auth.user.is_anonymous ||
     !auth.user.email_confirmed_at)
    throw new Error("An authenticated account or guest session is required to view deletion requests.");
  const {data,error}=await client.rpc("ifund_my_account_deletion_requests");
  if(error||!Array.isArray(data))
    throw new Error(error?.message||"The deletion request history cannot be verified.");
  return data.filter(row=>UUID.test(row?.request_id||""))
    .map(row=>({id:row.request_id,status:row.request_status,
       requestedAt:row.submitted_at,updatedAt:row.updated_at}));
}
