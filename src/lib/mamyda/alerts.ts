import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import { formatDay, formatTime } from "@/lib/time";
import { mapAlert, mapEmail, mapProfile } from "./map";

const FROM = "alerts@mamyda.saneax.in";

async function queueEmail(
  userId: string,
  to: string,
  subject: string,
  body: string,
) {
  const sql = await getSql();
  await sql`
    insert into email_log (id, user_id, to_address, from_address, subject, body, status)
    values (${nid()}, ${userId}, ${to}, ${FROM}, ${subject}, ${body}, ${"logged"})
  `;
}

export const runAlerts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const profiles = await sql<Record<string, unknown>>`
      select * from profiles where user_id = ${context.userId}
    `;
    const profile = profiles[0] ? mapProfile(profiles[0]) : null;
    if (!profile) return { created: 0 };
    const to = profile.alertEmail;
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600_000);
    const in30 = new Date(now.getTime() + 30 * 60_000);
    let created = 0;

    async function insertAlert(opts: {
      kind: string;
      title: string;
      body: string;
      entityType: string;
      entityId: string;
      scheduledFor: string;
    }) {
      const existing = await sql<{ id: string }>`
        select id from alerts
        where user_id = ${context.userId}
          and kind = ${opts.kind}
          and entity_id = ${opts.entityId}
          and scheduled_for = ${opts.scheduledFor}
      `;
      if (existing[0]) return;
      const id = nid();
      await sql`
        insert into alerts (
          id, user_id, kind, title, body, entity_type, entity_id, scheduled_for, sent_at, status
        ) values (
          ${id}, ${context.userId}, ${opts.kind}, ${opts.title}, ${opts.body},
          ${opts.entityType}, ${opts.entityId}, ${opts.scheduledFor}, now(), ${"logged"}
        )
      `;
      if (to) await queueEmail(context.userId, to, opts.title, opts.body);
      created += 1;
    }

    if (profile.alertsOverdue) {
      const overdue = await sql<{ id: string; title: string; due_at: string }>`
        select id, title, due_at from tasks
        where user_id = ${context.userId}
          and due_at is not null
          and due_at < ${now.toISOString()}
          and column_id <> 'done'
      `;
      for (const t of overdue) {
        await insertAlert({
          kind: "overdue",
          title: `Overdue: ${t.title}`,
          body: `${t.title} was due ${formatDay(t.due_at)}.`,
          entityType: "task",
          entityId: t.id,
          scheduledFor: t.due_at,
        });
      }
    }

    if (profile.alertsDueSoon) {
      const soon = await sql<{ id: string; title: string; due_at: string }>`
        select id, title, due_at from tasks
        where user_id = ${context.userId}
          and due_at is not null
          and due_at >= ${now.toISOString()}
          and due_at <= ${in24h.toISOString()}
          and column_id <> 'done'
      `;
      for (const t of soon) {
        await insertAlert({
          kind: "due_soon",
          title: `Due soon: ${t.title}`,
          body: `${t.title} is due ${formatDay(t.due_at)} ${formatTime(t.due_at)}.`,
          entityType: "task",
          entityId: t.id,
          scheduledFor: t.due_at,
        });
      }
    }

    if (profile.alertsMeeting) {
      const meetings = await sql<{ id: string; title: string; starts_at: string }>`
        select id, title, starts_at from calendar_events
        where user_id = ${context.userId}
          and starts_at >= ${now.toISOString()}
          and starts_at <= ${in30.toISOString()}
      `;
      for (const m of meetings) {
        await insertAlert({
          kind: "meeting",
          title: `Starting soon: ${m.title}`,
          body: `${m.title} starts at ${formatTime(m.starts_at)}.`,
          entityType: "event",
          entityId: m.id,
          scheduledFor: m.starts_at,
        });
      }
    }

    return { created };
  });

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const alerts = await sql<Record<string, unknown>>`
      select * from alerts where user_id = ${context.userId}
      order by created_at desc limit 40
    `;
    const emails = await sql<Record<string, unknown>>`
      select * from email_log where user_id = ${context.userId}
      order by created_at desc limit 20
    `;
    return { alerts: alerts.map(mapAlert), emails: emails.map(mapEmail) };
  });
