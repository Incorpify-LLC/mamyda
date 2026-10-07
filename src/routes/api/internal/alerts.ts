import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { createHmac, timingSafeEqual } = await import("node:crypto");
        const secret = process.env.ALERT_CRON_SECRET?.trim();
        if (!secret || secret.length < 32)
          return Response.json({ error: "Scheduler is not configured" }, { status: 503 });
        const timestamp = request.headers.get("x-mamyda-timestamp") ?? "";
        const signature = request.headers.get("x-mamyda-signature") ?? "";
        const seconds = Number(timestamp);
        if (
          !/^\d{10}$/.test(timestamp) ||
          !Number.isFinite(seconds) ||
          Math.abs(Date.now() / 1000 - seconds) > 300
        )
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const body = await request.text();
        if (body.length > 1024 || !/^\{\s*\}$/.test(body))
          return Response.json({ error: "Invalid request" }, { status: 400 });
        const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
        const actualBytes = Buffer.from(signature, "hex");
        const expectedBytes = Buffer.from(expected, "hex");
        if (
          actualBytes.length !== expectedBytes.length ||
          !timingSafeEqual(actualBytes, expectedBytes)
        )
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        try {
          const { runScheduledAlerts } = await import("@/lib/mamyda/alerts-service.server");
          const result = await runScheduledAlerts();
          return Response.json(result, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json(
            { error: "Reminder delivery failed; it will retry on the next schedule." },
            { status: 503 },
          );
        }
      },
    },
  },
});
