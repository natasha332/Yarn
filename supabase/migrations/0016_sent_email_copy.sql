-- Yarn: "send me a copy" of emails Yarn sends to clients, and keep what was sent.
-- Only ADDS two columns; nothing you've entered is changed. Safe to run once.
--
--   businesses.email_copy_to_me  true = also send each client email to your reply-to address (a hidden copy)
--   sent_emails.body             the full text of what was sent, so the Sent emails list can show it

alter table public.businesses
  add column email_copy_to_me boolean not null default true;

alter table public.sent_emails
  add column body text;
