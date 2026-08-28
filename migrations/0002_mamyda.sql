-- Mamyda workspace: clients → projects → tasks, calendars, minutes, notes, vault, alerts.

create table if not exists profiles (
  user_id text primary key,
  timezone text not null default 'Asia/Kolkata',
  display_name text,
  seeded_at timestamptz,
  vault_public_key text,
  vault_private_key_armored text,
  vault_key_created_at timestamptz,
  alert_email text,
  alerts_due_soon boolean not null default true,
  alerts_overdue boolean not null default true,
  alerts_meeting boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id text primary key,
  user_id text not null,
  name text not null,
  color text not null default 'sage',
  email text,
  notes text,
  archived boolean not null default false,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_user_idx on clients (user_id);

create table if not exists projects (
  id text primary key,
  user_id text not null,
  client_id text not null,
  name text not null,
  slug text not null,
  description text,
  archived boolean not null default false,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_idx on projects (user_id);
create index if not exists projects_client_idx on projects (client_id);
create unique index if not exists projects_user_slug_idx on projects (user_id, slug);

create table if not exists tasks (
  id text primary key,
  user_id text not null,
  project_id text not null,
  title text not null,
  notes text,
  column_id text not null default 'backlog',
  priority text not null default 'normal',
  due_at timestamptz,
  labels text not null default '[]',
  position double precision not null default 0,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_idx on tasks (user_id);
create index if not exists tasks_project_idx on tasks (project_id);
create index if not exists tasks_due_idx on tasks (user_id, due_at);

create table if not exists calendar_sources (
  id text primary key,
  user_id text not null,
  provider text not null,
  name text not null,
  ics_url text,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists calendar_sources_user_idx on calendar_sources (user_id);

create table if not exists calendar_events (
  id text primary key,
  user_id text not null,
  source_id text,
  source_provider text not null,
  external_id text,
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  attendees text not null default '[]',
  project_id text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists events_user_time_idx on calendar_events (user_id, starts_at);

create table if not exists minutes (
  id text primary key,
  user_id text not null,
  event_id text,
  project_id text,
  title text not null,
  attendees text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists minutes_user_idx on minutes (user_id);

create table if not exists notes (
  id text primary key,
  user_id text not null,
  project_id text,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_idx on notes (user_id);

create table if not exists note_tags (
  note_id text not null,
  user_id text not null,
  tag text not null,
  project_id text,
  primary key (note_id, tag)
);
create index if not exists note_tags_user_tag_idx on note_tags (user_id, tag);

create table if not exists vault_notes (
  id text primary key,
  user_id text not null,
  title text not null,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vault_notes_user_idx on vault_notes (user_id);

create table if not exists alerts (
  id text primary key,
  user_id text not null,
  kind text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id text,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'queued',
  created_at timestamptz not null default now()
);
create unique index if not exists alerts_dedupe_idx on alerts (user_id, kind, entity_id, scheduled_for);

create table if not exists email_log (
  id text primary key,
  user_id text not null,
  to_address text not null,
  from_address text not null default 'alerts@mamyda.saneax.in',
  subject text not null,
  body text not null,
  status text not null default 'logged',
  created_at timestamptz not null default now()
);
create index if not exists email_log_user_idx on email_log (user_id);
