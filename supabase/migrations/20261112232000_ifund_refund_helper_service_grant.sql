-- Service-only privilege required by the public signed-ledger refund wrapper.
revoke all on function private.ifund_apply_verified_paypal_reversal(text,text,text,bigint)
  from public,anon,authenticated;
grant execute on function private.ifund_apply_verified_paypal_reversal(text,text,text,bigint)
  to service_role;
