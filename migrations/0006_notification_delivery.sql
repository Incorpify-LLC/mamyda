alter table profiles add column if not exists alerts_email_enabled boolean not null default true;
alter table profiles add column if not exists alerts_telegram_enabled boolean not null default true;
alter table profiles add column if not exists alerts_tested_at timestamptz;

alter table email_log add column if not exists delivery_id text;
alter table email_log add column if not exists last_error text;
create unique index if not exists email_log_delivery_unique on email_log (delivery_id) where delivery_id is not null;

-- Replace delivery status in the map backfilling channel outcome from legacy
-- email logs while keeping old reminders out of the new delivery queue.

create table if not exists notification_deliveries (
  id text primary key,
  user_id text not null,
  alert_id text not null references alerts(id) on delete cascade,
  channel text not null check (channel in ('email', 'telegram')),
  target text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'retry', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alert_id, channel)
);
create index if not exists notification_deliveries_due_idx
  on notification_deliveries (status, next_attempt_at, created_at);

-- Alert rows created before the outbox still appear in the in-app history; they
-- are deliberately not resent during the rollout.
