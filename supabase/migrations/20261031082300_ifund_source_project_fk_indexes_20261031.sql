
create index if not exists owner_identity_map_destination_auth_uid_idx
  on ifund_transfer.owner_identity_map(destination_auth_uid);
create index if not exists owner_identity_map_candidate_auth_uid_idx
  on ifund_transfer.owner_identity_map(candidate_auth_uid);
create index if not exists source_auth_accounts_destination_auth_uid_idx
  on ifund_transfer.source_auth_accounts(destination_auth_uid);
create index if not exists workflow_execution_log_job_id_idx
  on ifund_ops.workflow_execution_log(job_id);
create index if not exists outreach_actions_campaign_id_idx
  on outreach_mail.actions(campaign_id);
create index if not exists outreach_actions_contact_id_idx
  on outreach_mail.actions(contact_id);
create index if not exists outreach_campaigns_connection_id_idx
  on outreach_mail.campaigns(connection_id);
create index if not exists outreach_contacts_source_connection_id_idx
  on outreach_mail.contacts(source_connection_id);
create index if not exists outreach_recipients_contact_id_idx
  on outreach_mail.recipients(contact_id);
