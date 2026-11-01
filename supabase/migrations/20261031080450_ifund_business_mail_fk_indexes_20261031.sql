create index if not exists addresses_mailbox_id_idx on business_mail.addresses(mailbox_id);
create index if not exists delivery_events_message_id_idx on business_mail.delivery_events(message_id);