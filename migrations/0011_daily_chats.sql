create table llm_chats (
  id text primary key, user_id text not null, chat_date date not null,
  title text not null, tags text[] not null default '{}', body text not null default '',
  content_object_key text, content_key_fingerprint text,
  revision integer not null default 1, updated_at timestamptz not null default now(),
  unique(user_id,chat_date),
  check ((content_object_key is null and content_key_fingerprint is null) or
         (content_object_key is not null and content_key_fingerprint is not null and body=''))
);
create index llm_chats_owner_date on llm_chats(user_id,chat_date desc);
