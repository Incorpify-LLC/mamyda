create table transcription_settings (
  user_id text primary key,
  model text not null,
  api_key_cipher text,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table media_jobs (
  id text primary key, user_id text not null, name text not null,
  byte_size integer not null check(byte_size>0 and byte_size<=314572800),
  uploaded_bytes integer not null default 0, next_chunk integer not null default 0,
  upload_lock text, upload_lock_at timestamptz,
  status text not null default 'uploading' check(status in ('uploading','queued','processing','ready','error','deleting','accepted','expired')),
  model text not null, api_key_cipher text,
  transcript text not null default '', error text,
  progress integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '15 days',
  started_at timestamptz, updated_at timestamptz not null default now(),
  check(uploaded_bytes<=byte_size), check(progress between 0 and 100)
);
create index media_jobs_queue on media_jobs(status,created_at);
create index media_jobs_owner on media_jobs(user_id,created_at desc);
