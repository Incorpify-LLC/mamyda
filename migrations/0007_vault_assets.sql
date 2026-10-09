-- Expand only: legacy writing/file tables stay readable until verified migration.
create table vault_assets (
  id text primary key,
  user_id text not null,
  kind text not null check (kind in ('file', 'note', 'minutes', 'vault')),
  current_revision integer not null default 0 check (current_revision >= 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);
create index vault_assets_owner_idx on vault_assets(user_id, created_at);

create table vault_asset_uploads (
  id text primary key,
  asset_id text not null,
  user_id text not null,
  base_revision integer not null check (base_revision >= 0),
  state text not null default 'pending' check (state in ('pending','uploading','uploaded','ready','retired','deleted')),
  bucket text not null check (bucket = 'mamyda'),
  object_key text not null unique,
  encryption_format text not null check (encryption_format = 'openpgp-binary-v1'),
  key_fingerprint text not null,
  original_size integer not null check (original_size between 1 and 25165824),
  cipher_size integer not null check (cipher_size between 1 and 26214400),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  title text not null,
  content_type text not null,
  client_id text,
  project_id text,
  event_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (asset_id, user_id) references vault_assets(id, user_id)
);
create unique index vault_asset_pending_idx on vault_asset_uploads(asset_id)
  where state in ('pending','uploading','uploaded');
create unique index vault_asset_ready_revision_idx on vault_asset_uploads(asset_id, base_revision)
  where state = 'ready';
create index vault_asset_cleanup_idx on vault_asset_uploads(state, expires_at);
