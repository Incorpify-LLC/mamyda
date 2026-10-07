import { expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  run: vi.fn(async () => ({ created: 1, failedProfiles: 0, deliveries: 1 })),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/lib/mamyda/alerts-service.server", () => ({ runScheduledAlerts: state.run }));
import { Route } from "@/routes/api/internal/alerts";

const handler = (Route as unknown as { options: any }).options.server.handlers.POST;
const secret = "unit-test-cron-secret-is-long-enough-32";
async function signedRequest(timestamp: string, body = "{}", key = secret) {
  const { createHmac } = await import("node:crypto");
  const signature = createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
  return new Request("http://app/api/internal/alerts", {
    method: "POST",
    headers: { "x-mamyda-timestamp": timestamp, "x-mamyda-signature": signature },
    body,
  });
}
const now = () => String(Math.floor(Date.now() / 1000));

test("the schedule endpoint fails closed without a sufficiently long secret", async () => {
  vi.stubEnv("ALERT_CRON_SECRET", "short");
  expect((await handler({ request: await signedRequest(now()) })).status).toBe(503);
});
test("the schedule endpoint rejects invalid, stale and modified signatures", async () => {
  vi.stubEnv("ALERT_CRON_SECRET", secret);
  expect(
    (
      await handler({
        request: new Request("http://app/api/internal/alerts", { method: "POST", body: "{}" }),
      })
    ).status,
  ).toBe(401);
  expect(
    (await handler({ request: await signedRequest(String(Number(now()) - 301)) })).status,
  ).toBe(401);
  const valid = await signedRequest(now());
  expect(
    (
      await handler({
        request: new Request(valid.url, {
          method: "POST",
          headers: {
            "x-mamyda-timestamp": valid.headers.get("x-mamyda-timestamp")!,
            "x-mamyda-signature": "00".repeat(32),
          },
          body: "{}",
        }),
      })
    ).status,
  ).toBe(401);
  expect(state.run).not.toHaveBeenCalled();
});
test("a valid internal signature runs a scheduled pass", async () => {
  vi.stubEnv("ALERT_CRON_SECRET", secret);
  state.run.mockClear();
  const response = await handler({ request: await signedRequest(now()) });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ created: 1, deliveries: 1 });
  expect(state.run).toHaveBeenCalledTimes(1);
});
test("the endpoint accepts only the small scheduler payload", async () => {
  vi.stubEnv("ALERT_CRON_SECRET", secret);
  const response = await handler({
    request: await signedRequest(now(), JSON.stringify({ allUsers: true })),
  });
  expect(response.status).toBe(400);
  expect(state.run).toHaveBeenCalledTimes(1);
});
test("scheduler database failures return retryable status without details", async () => {
  vi.stubEnv("ALERT_CRON_SECRET", secret);
  state.run.mockRejectedValueOnce(new Error("private database detail"));
  const response = await handler({ request: await signedRequest(now()) });
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private database detail");
});
