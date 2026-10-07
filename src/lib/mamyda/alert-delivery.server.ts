import type { Sql } from "@/lib/db";
import { nid } from "@/lib/utils";

export async function enqueueDeliveries(
  sql: Sql,
  input: {
    userId: string;
    alertId: string;
    email: string | null;
    telegramChatId: string | null;
    emailEnabled: boolean;
    telegramEnabled: boolean;
  },
) {
  const destinations: Array<{ channel: "email" | "telegram"; target: string }> = [];
  if (input.emailEnabled && input.email)
    destinations.push({ channel: "email", target: input.email });
  if (input.telegramEnabled && input.telegramChatId)
    destinations.push({ channel: "telegram", target: input.telegramChatId });
  for (const delivery of destinations) {
    await sql`
      insert into notification_deliveries (id,user_id,alert_id,channel,target)
      values (${nid()},${input.userId},${input.alertId},${delivery.channel},${delivery.target})
      on conflict (alert_id,channel) do nothing
    `;
  }
  return destinations.map(({ channel }) => channel);
}

type ClaimedDelivery = {
  id: string;
  user_id: string;
  alert_id: string;
  channel: "email" | "telegram";
  target: string;
  attempts: number;
  title: string;
  body: string;
  created_at: string;
};

function safeError(channel: string, error: unknown) {
  if (
    error instanceof Error &&
    (error.message.includes("isn't configured") || error.message.includes("destination is missing"))
  )
    return error.message;
  const status = error instanceof Error ? error.message.match(/\b([45]\d\d)\b/)?.[1] : null;
  const provider = channel === "email" ? "Email provider" : "Telegram";
  return `${provider}${status ? ` returned HTTP ${status}` : " request failed"}. Automatic retry is scheduled.`;
}

/** Claim rows atomically so two app instances cannot dispatch the same channel together. */
export async function dispatchPendingDeliveries(sql: Sql, userId?: string, limit = 20) {
  await sql`
    with timed_out as (
      update notification_deliveries set status='failed',last_error='Automatic retry limit reached after delivery timed out.',locked_until=null,updated_at=now()
      where status='sending' and attempts>=5 and locked_until<=now() returning id
    ), email_state as (
      update email_log set status='failed',last_error='Automatic retry limit reached after delivery timed out.'
      where delivery_id in (select id from timed_out) returning delivery_id
    ) update alerts a set status='failed'
      where a.id in (select alert_id from notification_deliveries where id in (select id from timed_out))
  `;
  const claimed = await sql<ClaimedDelivery>`
    with candidates as (
      select id from notification_deliveries
      where attempts < 5 and (
        (status in ('pending','retry') and next_attempt_at <= now())
        or (status = 'sending' and locked_until <= now())
      )
      and (${userId ?? null}::text is null or user_id = ${userId ?? null})
      and exists(select 1 from profiles p where p.user_id=notification_deliveries.user_id)
      order by next_attempt_at, created_at
      for update skip locked limit ${limit}
    ), claimed as (
      update notification_deliveries d set
        status='sending', attempts=d.attempts+1,
        locked_until=now()+interval '2 minutes', updated_at=now()
      from candidates c where d.id=c.id
      returning d.id,d.user_id,d.alert_id,d.channel,d.target,d.attempts,d.created_at
    )
    select c.*,a.title,a.body from claimed c join alerts a on a.id=c.alert_id
  `;
  const outcomes: Array<{ deliveryId: string; channel: string; status: string }> = [];
  for (const delivery of claimed) {
    try {
      if (delivery.channel === "email") {
        if (!process.env.RESEND_API_KEY?.trim())
          throw new Error("Email delivery isn't configured. Set RESEND_API_KEY.");
        const { sendResendEmail } = await import("./resend");
        await sendResendEmail(delivery.target, delivery.title, delivery.body, delivery.id);
      } else {
        const { sendTelegram } = await import("./telegram.server");
        await sendTelegram(delivery.target, `${delivery.title}\n${delivery.body}`);
      }
      await recordDelivery(sql, delivery, "sent", null);
      outcomes.push({ deliveryId: delivery.id, channel: delivery.channel, status: "sent" });
    } catch (error) {
      const message = safeError(delivery.channel, error);
      const terminal = delivery.attempts >= 5;
      await recordDelivery(sql, delivery, terminal ? "failed" : "retry", message);
      outcomes.push({
        deliveryId: delivery.id,
        channel: delivery.channel,
        status: terminal ? "failed" : "retry",
      });
    }
  }
  return outcomes;
}

async function recordDelivery(
  sql: Sql,
  delivery: ClaimedDelivery,
  status: "sent" | "retry" | "failed",
  error: string | null,
) {
  const delay = Math.min(15, [1, 2, 5, 15][Math.min(delivery.attempts - 1, 3)]);
  const from = delivery.channel === "email" ? (await import("./resend")).MAIL_FROM() : "";
  await sql`
    with changed as (
      update notification_deliveries set status=${status}, last_error=${error},
        sent_at=case when ${status}='sent' then now() else sent_at end,
        next_attempt_at=case when ${status}='retry' then now()+(${delay}::text || ' minutes')::interval else next_attempt_at end,
        locked_until=null, updated_at=now()
      where id=${delivery.id} returning *
    ), email_record as (
      insert into email_log (id,user_id,to_address,from_address,subject,body,status,delivery_id,last_error)
      select ${nid()},${delivery.user_id},${delivery.target},${from},${delivery.title},${delivery.body},${status},${delivery.id},${error}
      from changed where ${delivery.channel}='email'
      on conflict (delivery_id) where delivery_id is not null do update set
        status=excluded.status,last_error=excluded.last_error,created_at=now()
      returning id
    ), alert_state as (
      update alerts a set status=case
        when exists(select 1 from notification_deliveries d where d.alert_id=a.id and d.status in ('pending','retry','sending')) then 'pending'
        when exists(select 1 from notification_deliveries d where d.alert_id=a.id and d.status='failed') then 'failed'
        when exists(select 1 from notification_deliveries d where d.alert_id=a.id and d.status='sent') then 'sent'
        else 'logged' end,
        sent_at=(select max(d.sent_at) from notification_deliveries d where d.alert_id=a.id)
      where a.id=${delivery.alert_id} returning id
    ) select id from changed
  `;
}

export async function addTestNotification(
  sql: Sql,
  input: {
    userId: string;
    to: string | null;
    chatId: string | null;
    emailEnabled: boolean;
    telegramEnabled: boolean;
  },
) {
  const channels: string[] = input.emailEnabled && input.to ? ["email"] : [];
  if (input.telegramEnabled && input.chatId) channels.push("telegram");
  if (!channels.length)
    throw new Error("Enable a delivery channel and add its destination before sending a test.");
  const profile = await sql<{ user_id: string }>`
    update profiles set alerts_tested_at=now()
    where user_id=${input.userId} and (alerts_tested_at is null or alerts_tested_at < now()-interval '5 minutes')
    returning user_id
  `;
  if (!profile[0])
    throw new Error("A test notification was sent recently. Try again in five minutes.");
  const alertId = nid();
  await sql`
    insert into alerts (id,user_id,kind,title,body,entity_type,entity_id,scheduled_for,status)
    values (${alertId},${input.userId},'test','Mamyda test notification','Your Mamyda reminder delivery is working.','test',${alertId},now(),'pending')
  `;
  await enqueueDeliveries(sql, {
    userId: input.userId,
    alertId,
    email: input.to,
    telegramChatId: input.chatId,
    emailEnabled: input.emailEnabled,
    telegramEnabled: input.telegramEnabled,
  });
  return alertId;
}
