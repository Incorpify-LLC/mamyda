alter table calendar_events add column if not exists removed_at timestamptz;
alter table calendar_sources add column if not exists last_imported_count integer;

-- Consolidate legacy duplicates without losing minutes attached to any copy.
with duplicates as (
  select id, first_value(id) over (
    partition by user_id, source_id, external_id order by created_at, id
  ) as keeper
  from calendar_events where source_id is not null and external_id is not null
)
update minutes m set event_id = d.keeper
from duplicates d where m.event_id = d.id and d.id <> d.keeper;
with duplicates as (
  select id, row_number() over (
    partition by user_id, source_id, external_id order by created_at, id
  ) as position
  from calendar_events where source_id is not null and external_id is not null
)
delete from calendar_events where id in (select id from duplicates where position > 1);
create unique index if not exists events_source_external_unique
  on calendar_events (user_id, source_id, external_id);
