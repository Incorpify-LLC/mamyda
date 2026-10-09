create table llm_settings (
  user_id text primary key,
  provider text not null check(provider in ('xai','openai','openrouter')),
  model text not null,
  enabled boolean not null default false,
  api_key_cipher text,
  max_tokens integer not null default 2048 check(max_tokens between 256 and 4096),
  updated_at timestamptz not null default now()
);
create table llm_usage_windows (
  user_id text not null,
  window_start timestamptz not null,
  attempts integer not null,
  primary key(user_id,window_start)
);
