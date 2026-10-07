-- Home staging: OTP rate limits, Telegram link, and client file metadata.
-- Object bytes live in S3 (MinIO on pi06, or AWS S3 later), not in this table.

create table if not exists rate_limits (
  bucket text primary key,
  hits integer not null,
  window_start timestamptz not null
);

alter table profiles add column if not exists telegram_chat_id text;
alter table profiles add column if not exists telegram_link_code text;
alter table profiles add column if not exists telegram_link_expires_at timestamptz;

create table if not exists client_files (
  id text primary key,
  user_id text not null,
  client_id text not null,
  name text not null,
  content_type text not null,
  byte_size integer not null,
  object_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists client_files_client_idx on client_files (user_id, client_id);
