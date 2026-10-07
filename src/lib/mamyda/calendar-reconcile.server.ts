import type { Sql } from "@/lib/db";
import { nid } from "@/lib/utils";

export type ImportedEvent = {
  externalId: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  attendees: string[];
};

/** One statement: a failed import cannot erase the previous snapshot. */
export async function reconcileEvents(
  sql: Sql,
  userId: string,
  sourceId: string,
  provider: string,
  events: ImportedEvent[],
) {
  const unique = [...new Map(events.map((event) => [event.externalId, event])).values()];
  const payload = unique.map((event) => ({ ...event, id: nid() }));
  await sql`
    with incoming as (
      select * from jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) as e(
        id text, "externalId" text, title text, description text, location text,
        "startsAt" timestamptz, "endsAt" timestamptz, "allDay" boolean, attendees jsonb
      )
    ), imported as (
      insert into calendar_events (id,user_id,source_id,source_provider,external_id,title,
        description,location,starts_at,ends_at,all_day,attendees,is_sample)
      select id,${userId},${sourceId},${provider},"externalId",title,description,location,
        "startsAt","endsAt","allDay",attendees::text,false from incoming
      on conflict (user_id,source_id,external_id) do update set
        title=excluded.title, description=excluded.description, location=excluded.location,
        starts_at=excluded.starts_at, ends_at=excluded.ends_at, all_day=excluded.all_day,
        attendees=excluded.attendees, removed_at=null
      returning id
    ), retired as (
      update calendar_events set removed_at=now()
      where user_id=${userId} and source_id=${sourceId} and is_sample=false
        and removed_at is null
        and external_id not in (select "externalId" from incoming)
      returning id
    )
    update calendar_sources set last_synced_at=now(), last_error=null,
      last_imported_count=${unique.length}
    where id=${sourceId} and user_id=${userId}
  `;
  return unique.length;
}
