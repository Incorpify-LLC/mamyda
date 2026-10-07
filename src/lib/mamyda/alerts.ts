import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
export const runAlerts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { evaluateUserAlertsAndDispatch } = await import("./alerts-service.server");
    return evaluateUserAlertsAndDispatch(context.userId);
  });

export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireTurnstile } = await import("./turnstile.server");
    await requireTurnstile("alerts-test");
    const { sendTestNotificationForUser } = await import("./alerts-service.server");
    return sendTestNotificationForUser(context.userId);
  });

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const { mapAlert, mapEmail } = await import("./map");
    const sql = await getSql();
    const alerts = await sql<Record<string, unknown>>`
      select a.*, coalesce(json_agg(json_build_object(
        'channel',d.channel,'status',d.status,'attempts',d.attempts,
        'lastError',d.last_error,'sentAt',d.sent_at
      )) filter (where d.id is not null),'[]'::json) as deliveries
      from alerts a left join notification_deliveries d on d.alert_id=a.id
      where a.user_id=${context.userId} group by a.id order by a.created_at desc limit 40
    `;
    const emails = await sql<Record<string, unknown>>`
      select * from email_log where user_id=${context.userId} order by created_at desc limit 20
    `;
    return { alerts: alerts.map(mapAlert), emails: emails.map(mapEmail) };
  });
