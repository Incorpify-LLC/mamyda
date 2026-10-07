import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import { formatDay, formatTime } from "@/lib/time";
import { mapProfile } from "./map";
import {
  addTestNotification,
  dispatchPendingDeliveries,
  enqueueDeliveries,
} from "./alert-delivery.server";

async function evaluateUserAlerts(userId: string) {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`select * from profiles where user_id=${userId}`;
  const row = rows[0];
  if (!row) return { created: 0 };
  const profile = mapProfile(row);
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60_000);
  const in30m = new Date(now.getTime() + 30 * 60_000);
  let created = 0;

  const addAlert = async (input: {
    kind: string;
    title: string;
    body: string;
    entityType: string;
    entityId: string;
    scheduledFor: string;
  }) => {
    const inserted = await sql<{ id: string }>`
      insert into alerts (id,user_id,kind,title,body,entity_type,entity_id,scheduled_for,status)
      values (${nid()},${userId},${input.kind},${input.title},${input.body},${input.entityType},${input.entityId},${input.scheduledFor},'pending')
      on conflict (user_id,kind,entity_id,scheduled_for) do nothing returning id
    `;
    if (inserted[0]) {
      created++;
      await enqueueDeliveries(sql, {
        userId,
        alertId: inserted[0].id,
        email: profile.alertEmail,
        telegramChatId: row.telegram_chat_id ? String(row.telegram_chat_id) : null,
        emailEnabled: profile.alertsEmailEnabled,
        telegramEnabled: profile.alertsTelegramEnabled,
      });
    }
  };

  if (profile.alertsOverdue) {
    const overdue = await sql<{ id: string; title: string; due_at: string }>`
      select id,title,due_at from tasks where user_id=${userId} and due_at is not null
      and due_at < ${now.toISOString()} and column_id <> 'done'
    `;
    for (const task of overdue)
      await addAlert({
        kind: "overdue",
        title: `Overdue: ${task.title}`,
        body: `${task.title} was due ${formatDay(task.due_at)}.`,
        entityType: "task",
        entityId: task.id,
        scheduledFor: task.due_at,
      });
  }
  if (profile.alertsDueSoon) {
    const due = await sql<{ id: string; title: string; due_at: string }>`
      select id,title,due_at from tasks where user_id=${userId} and due_at >= ${now.toISOString()}
      and due_at <= ${in24h.toISOString()} and column_id <> 'done'
    `;
    for (const task of due)
      await addAlert({
        kind: "due_soon",
        title: `Due soon: ${task.title}`,
        body: `${task.title} is due ${formatDay(task.due_at)} ${formatTime(task.due_at)}.`,
        entityType: "task",
        entityId: task.id,
        scheduledFor: task.due_at,
      });
  }
  if (profile.alertsMeeting) {
    const meetings = await sql<{ id: string; title: string; starts_at: string }>`
      select id,title,starts_at from calendar_events where user_id=${userId} and removed_at is null
      and starts_at >= ${now.toISOString()} and starts_at <= ${in30m.toISOString()}
    `;
    for (const meeting of meetings)
      await addAlert({
        kind: "meeting",
        title: `Starting soon: ${meeting.title}`,
        body: `${meeting.title} starts at ${formatTime(meeting.starts_at)}.`,
        entityType: "event",
        entityId: meeting.id,
        scheduledFor: meeting.starts_at,
      });
  }
  return { created };
}

export async function runScheduledAlerts() {
  const sql = await getSql();
  const users = await sql<{ user_id: string }>`select user_id from profiles order by user_id`;
  let created = 0;
  for (const user of users) created += (await evaluateUserAlerts(user.user_id)).created;
  const deliveries = await dispatchPendingDeliveries(sql);
  return { created, deliveries: deliveries.length };
}

export async function evaluateUserAlertsAndDispatch(userId: string) {
  const result = await evaluateUserAlerts(userId);
  const deliveries = await dispatchPendingDeliveries(await getSql(), userId);
  return { ...result, deliveries: deliveries.length };
}

export async function sendTestNotificationForUser(userId: string) {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`select * from profiles where user_id=${userId}`;
  const row = rows[0];
  if (!row) throw new Error("Set up your workspace before sending a test notification.");
  const profile = mapProfile(row);
  const ids = await addTestNotification(sql, {
    userId,
    to: profile.alertEmail,
    chatId: row.telegram_chat_id ? String(row.telegram_chat_id) : null,
    emailEnabled: profile.alertsEmailEnabled,
    telegramEnabled: profile.alertsTelegramEnabled,
  });
  await dispatchPendingDeliveries(sql, userId);
  const status = await sql<Record<string, unknown>>`
    select channel,status,attempts,last_error from notification_deliveries
    where alert_id=${ids} order by channel
  `;
  return {
    deliveries: status.map((delivery) => ({
      channel: String(delivery.channel),
      status: String(delivery.status),
      attempts: Number(delivery.attempts),
      error: delivery.last_error == null ? null : String(delivery.last_error),
    })),
  };
}

export { evaluateUserAlerts };
