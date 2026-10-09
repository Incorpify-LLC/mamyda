alter table client_files add column project_id text;
create index client_files_project_idx on client_files(user_id,project_id);
create table file_upload_requests (
  id text primary key,
  user_id text not null,
  client_id text not null,
  project_id text not null,
  name text not null,
  content_type text not null,
  byte_size integer not null check(byte_size between 1 and 25165824),
  object_key text not null unique,
  state text not null default 'pending' check(state in ('pending','uploading','ready')),
  expires_at timestamptz not null default now()+interval '15 minutes'
);
create index file_upload_expiry_idx on file_upload_requests(user_id,expires_at);
