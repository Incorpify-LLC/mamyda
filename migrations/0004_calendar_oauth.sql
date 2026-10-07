-- Per-user OAuth grants for direct calendar providers. Tokens are encrypted by
-- the application before reaching this table; plaintext tokens are never stored.
create table if not exists calendar_oauth_connections (
  user_id text not null,
  provider text not null check (provider in ('google', 'outlook')),
  access_token_cipher text not null,
  refresh_token_cipher text not null,
  expires_at timestamptz not null,
  account_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

-- Authorization attempts are one-time, short-lived, and tied to the user who
-- started them. Only a SHA-256 digest of the browser-visible state is retained.
create table if not exists calendar_oauth_states (
  id text primary key,
  user_id text not null,
  provider text not null check (provider in ('google', 'outlook')),
  state_hash text not null unique,
  code_verifier text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists calendar_oauth_states_expiry_idx on calendar_oauth_states (expires_at);
