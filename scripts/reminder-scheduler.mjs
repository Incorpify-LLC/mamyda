import { createHmac } from "node:crypto";

const url = process.env.ALERT_CRON_URL || "http://app:3000/api/internal/alerts";
const secret = process.env.ALERT_CRON_SECRET?.trim();
const intervalMs = Number(process.env.ALERT_CRON_INTERVAL_MS || 60_000);
if (!secret || secret.length < 32) {
  console.error(
    "[reminders] ALERT_CRON_SECRET must be set to a random value of at least 32 characters.",
  );
  process.exit(1);
}
let running = false;
async function tick() {
  if (running) return;
  running = true;
  const body = "{}";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mamyda-timestamp": timestamp,
        "x-mamyda-signature": signature,
      },
      body,
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok)
      console.error(
        `[reminders] Scheduler returned HTTP ${response.status}; next attempt in ${intervalMs / 1000}s.`,
      );
    else {
      const summary = await response.json();
      console.info(
        `[reminders] Checked ${summary.created ?? 0} new reminder(s); ${summary.deliveries ?? 0} delivery attempt(s).`,
      );
    }
  } catch (error) {
    console.error(
      `[reminders] Scheduler request failed; next attempt in ${intervalMs / 1000}s.`,
      error instanceof Error ? error.message : "network error",
    );
  } finally {
    running = false;
  }
}
void tick();
const timer = setInterval(() => void tick(), intervalMs);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    clearInterval(timer);
    process.exit(0);
  });
