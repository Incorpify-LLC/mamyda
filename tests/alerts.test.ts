import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import type { Sql } from "@/lib/db";

const state = vi.hoisted(() => ({
  userId: "alice",
  sql: undefined as unknown as Sql,
  sendEmail: vi.fn(async () => {}),
  sendTelegram: vi.fn(async () => {}),
  requireTurnstile: vi.fn(async () => {}),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      middleware: () => chain,
      validator: () => chain,
      handler:
        (fn: any) =>
        (input: any = {}) =>
          fn({ context: { userId: state.userId }, data: input.data }),
    };
    return chain;
  },
}));
vi.mock("@/lib/auth/middleware", () => ({ authMiddleware: {} }));
vi.mock("@/lib/db", () => ({ getSql: async () => state.sql }));
vi.mock("@/lib/mamyda/turnstile.server", () => ({ requireTurnstile: state.requireTurnstile }));
vi.mock("@/lib/mamyda/resend", () => ({
  MAIL_FROM: () => "Mamyda <alerts@example.test>",
  sendResendEmail: state.sendEmail,
}));
vi.mock("@/lib/mamyda/telegram.server", () => ({ sendTelegram: state.sendTelegram }));
import {
  runAlerts,
  sendTestNotification,
  listAlerts,
} from "@/lib/mamyda/alerts";
import { runScheduledAlerts } from "@/lib/mamyda/alerts-service.server";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  for (const path of [
    "migrations/0002_mamyda.sql",
    "migrations/0003_home.sql",
    "migrations/0005_calendar_sync.sql",
    "migrations/0006_notification_delivery.sql",
  ])
    await db.exec(readFileSync(path, "utf8"));
  state.sql = (async (parts: TemplateStringsArray, ...args: unknown[]) =>
    (
      await db.query(
        parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, ""),
        args,
      )
    ).rows) as Sql;
  state.sql.query = async <T>(query: string, args: unknown[] = []) =>
    (await db.query<T>(query, args)).rows;
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await db.close();
});
beforeEach(async () => {
  state.userId = "alice";
  state.sendEmail.mockReset();
  state.sendEmail.mockResolvedValue(undefined);
  state.sendTelegram.mockReset();
  state.sendTelegram.mockResolvedValue(undefined);
  state.requireTurnstile.mockClear();
  vi.stubEnv("RESEND_API_KEY", "unit-test-key");
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "unit-test-token");
  await db.exec(`TRUNCATE notification_deliveries,email_log,alerts,tasks,calendar_events,profiles;
    INSERT INTO profiles(user_id,alert_email,alerts_due_soon,alerts_overdue,alerts_meeting) VALUES ('alice','alice@example.test',true,true,true),('bob','bob@example.test',false,false,false);
    INSERT INTO tasks(id,user_id,project_id,title,due_at) VALUES ('due-a','alice','p','Due soon',now()+interval '2 hours'),('due-b','bob','p','Private due',now()+interval '2 hours');`);
});

test("scheduled checks create and deliver reminders while no signed-in page is involved", async () => {
  const first = await runScheduledAlerts();
  expect(first.created).toBe(1);
  expect(first.deliveries).toBe(1);
  expect(state.sendEmail).toHaveBeenCalledTimes(1);
  const second = await runScheduledAlerts();
  expect(second.created).toBe(0);
  expect(state.sendEmail).toHaveBeenCalledTimes(1);
  expect((await db.query<any>("SELECT status FROM notification_deliveries")).rows).toEqual([
    { status: "sent" },
  ]);
});
test("repeated alert reads never create or dispatch pending reminders", async () => {
  expect(await listAlerts()).toEqual({ alerts: [], emails: [] });
  await listAlerts();
  expect(state.sendEmail).not.toHaveBeenCalled();
  expect(state.sendTelegram).not.toHaveBeenCalled();
  expect((await db.query("SELECT * FROM notification_deliveries")).rows).toEqual([]);
});

test("email and Telegram are independent and respect their per-channel preferences", async () => {
  await db.exec(
    "UPDATE profiles SET alert_email=null, alerts_email_enabled=false, alerts_telegram_enabled=true, telegram_chat_id='chat-1' WHERE user_id='alice'",
  );
  await runScheduledAlerts();
  expect(state.sendEmail).not.toHaveBeenCalled();
  expect(state.sendTelegram).toHaveBeenCalledTimes(1);
  expect((await db.query<any>("SELECT channel,status FROM notification_deliveries")).rows).toEqual([
    { channel: "telegram", status: "sent" },
  ]);
  await db.exec("UPDATE profiles SET alerts_due_soon=false WHERE user_id='alice'");
  state.userId = "bob";
  await runAlerts();
  expect(state.sendTelegram).toHaveBeenCalledTimes(1);
});

test("one channel failure is visible while the other succeeds", async () => {
  await db.exec("UPDATE profiles SET telegram_chat_id='chat-1' WHERE user_id='alice'");
  state.sendEmail.mockRejectedValueOnce(new Error("Resend rejected the message (503)"));
  await runAlerts();
  const rows = (
    await db.query<any>(
      "SELECT channel,status,last_error FROM notification_deliveries ORDER BY channel",
    )
  ).rows;
  expect(rows).toMatchObject([
    { channel: "email", status: "retry", last_error: expect.stringContaining("503") },
    { channel: "telegram", status: "sent", last_error: null },
  ]);
  expect((await listAlerts()).alerts[0].deliveries.map((item: any) => item.status).sort()).toEqual([
    "retry",
    "sent",
  ]);
});

test("retry backoff is bounded at five attempts and stores safe explanations", async () => {
  state.sendEmail.mockRejectedValue(new Error("provider leaked bearer very-secret-token (503)"));
  await runAlerts();
  for (let attempt = 2; attempt <= 5; attempt++) {
    await db.exec("UPDATE notification_deliveries SET next_attempt_at=now() WHERE user_id='alice'");
    await runScheduledAlerts();
  }
  await db.exec("UPDATE notification_deliveries SET next_attempt_at=now() WHERE user_id='alice'");
  await runScheduledAlerts();
  const row = (
    await db.query<any>(
      "SELECT attempts,status,last_error FROM notification_deliveries WHERE channel='email'",
    )
  ).rows[0];
  expect(row).toMatchObject({ attempts: 5, status: "failed" });
  expect(row.last_error).not.toContain("very-secret-token");
  expect(state.sendEmail).toHaveBeenCalledTimes(5);
});

test("concurrent schedule ticks deduplicate reminders and channel sends", async () => {
  await Promise.all([runScheduledAlerts(), runScheduledAlerts()]);
  expect(
    (await db.query<any>("SELECT count(*)::int as count FROM alerts WHERE user_id='alice'")).rows[0]
      .count,
  ).toBe(1);
  expect(
    (
      await db.query<any>(
        "SELECT count(*)::int as count FROM notification_deliveries WHERE user_id='alice'",
      )
    ).rows[0].count,
  ).toBe(1);
  expect(state.sendEmail).toHaveBeenCalledTimes(1);
});

test("test notifications verify Turnstile, report delivery and are rate limited", async () => {
  const result = await sendTestNotification();
  expect(state.requireTurnstile).toHaveBeenCalledWith("alerts-test");
  expect(result.deliveries).toEqual([
    { channel: "email", status: "sent", attempts: 1, error: null },
  ]);
  await expect(sendTestNotification()).rejects.toThrow("five minutes");
  expect(state.sendEmail).toHaveBeenCalledTimes(1);
});

test("test notification reports a disabled provider with a retryable status", async () => {
  vi.stubEnv("RESEND_API_KEY", "");
  const result = await sendTestNotification();
  expect(result.deliveries[0]).toMatchObject({ channel: "email", status: "retry", attempts: 1 });
  expect(result.deliveries[0].error).toContain("isn't configured");
});
