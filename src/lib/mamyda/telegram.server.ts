import { randomBytes } from "node:crypto";
import pg from "pg";
import { ensureDbReady, getSql } from "@/lib/db";

const LOCK = 674923109;
let started = false;

async function telegram(token: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  return response.json() as Promise<{
    result?: Array<{ update_id: number; message?: { text?: string; chat?: { id?: number } } }>;
  }>;
}

export async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !chatId) return;
  await telegram(token, "sendMessage", { chat_id: chatId, text });
}

async function consumeStart(token: string, text: string, chatId: number) {
  const code = text.split(/\s+/)[1]?.trim();
  if (!code) {
    await sendTelegram(String(chatId), "In Mamyda, open Settings and copy the /start line. Send that whole line here.");
    return;
  }
  const sql = await getSql();
  const rows = await sql<{ user_id: string }>`
    select user_id from profiles
    where telegram_link_code = ${code} and telegram_link_expires_at > now()
  `;
  if (!rows[0]) {
    await sendTelegram(String(chatId), "That code is unknown or expired. Generate a new one in Mamyda settings.");
    return;
  }
  await sql`
    update profiles
    set telegram_chat_id = ${String(chatId)}, telegram_link_code = null, telegram_link_expires_at = null
    where user_id = ${rows[0].user_id}
  `;
  await sendTelegram(String(chatId), "Telegram is linked. Mamyda can send alerts here as well as by email.");
}

/** One replica holds a session lock and long-polls Telegram. Others skip. */
export function startTelegramPoller(): void {
  if (started) return;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!token || !databaseUrl) return;
  started = true;
  void (async () => {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
    const client = await pool.connect();
    try {
      const locked = await client.query<{ ok: boolean }>("select pg_try_advisory_lock($1) as ok", [LOCK]);
      if (!locked.rows[0]?.ok) return;
      let offset = 0;
      for (;;) {
        try {
          const update = await telegram(token, "getUpdates", { timeout: 25, offset });
          for (const item of update.result ?? []) {
            offset = item.update_id + 1;
            const text = item.message?.text ?? "";
            const chatId = item.message?.chat?.id;
            if (!text.startsWith("/start") || chatId == null) continue;
            await consumeStart(token, text, chatId);
          }
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 5_000));
        }
      }
    } finally {
      client.release();
      await pool.end();
    }
  })().catch(() => {
    started = false;
  });
}

export async function createTelegramLink(userId: string) {
  await ensureDbReady();
  startTelegramPoller();
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("Telegram alerts are not configured yet.");
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
    signal: AbortSignal.timeout(10_000),
  });
  const bot = (await response.json()) as { ok?: boolean; result?: { username?: string } };
  const username = bot.ok ? bot.result?.username?.replace(/^@/, "") : undefined;
  if (!username) throw new Error("Telegram bot verification failed. Try again shortly.");
  const code = randomBytes(4).toString("hex");
  const sql = await getSql();
  await sql`insert into profiles (user_id) values (${userId}) on conflict (user_id) do nothing`;
  await sql`
    update profiles
    set telegram_link_code = ${code}, telegram_link_expires_at = now() + interval '15 minutes'
    where user_id = ${userId}
  `;
  return { code, username, command: `/start ${code}`, link: `https://t.me/${username}?start=${code}` };
}
