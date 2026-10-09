-- Content-only encryption: searchable metadata remains in its original tables.
alter table tasks add column content_object_key text;
alter table tasks add column content_key_fingerprint text;
alter table notes add column content_object_key text;
alter table notes add column content_key_fingerprint text;
alter table tasks add constraint tasks_private_content_check check
  ((content_object_key is null and content_key_fingerprint is null) or
   (content_object_key is not null and content_key_fingerprint is not null and notes is null));
alter table notes add constraint notes_private_content_check check
  ((content_object_key is null and content_key_fingerprint is null) or
   (content_object_key is not null and content_key_fingerprint is not null and body = ''));
