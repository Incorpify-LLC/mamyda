// Real route components; isolated providers and data. Never dispatch real alerts.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (error) => errors.push(error.message));
  const base = "http://127.0.0.1:8082/tests/browser/integration-fixture.html";
  await page.goto(base);
  await page.getByText("alice@example.test", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Connect Google Calendar" }).isVisible(),
    false,
  );
  assert.equal(await page.locator("iframe").count(), 0);
  await page.getByText("Connect or reconnect a calendar", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "Feed name" }).waitFor();
  await page.getByRole("textbox", { name: "iCalendar subscription URL" }).waitFor();
  await page.getByRole("tab", { name: "Calendars", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("heading", { name: "Email alerts", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__integrationQA.reads), 0);
  const history = page.getByText("Delivery history and logs", { exact: true });
  await history.click();
  await page.getByText("No channel deliveries yet.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Refresh history", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__integrationQA.reads), 2);
  assert.deepEqual(await page.evaluate(() => window.__integrationQA.mutations), []);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
  }
  for (const state of ["logs-error", "logs-loading"]) {
    await page.goto(base + "?state=" + state);
    await page.getByRole("tab", { name: "Email alerts", exact: true }).click();
    await page.getByText("Delivery history and logs", { exact: true }).click();
    if (state === "logs-error") await page.getByRole("button", { name: "Retry history" }).waitFor();
    else await page.getByText("Loading delivery history…", { exact: true }).waitFor();
    assert.equal(await page.getByText("No channel deliveries yet.", { exact: true }).count(), 0);
  }
  for (const state of [
    "",
    "sync-error",
    "network-error",
    "disconnected",
    "disabled",
    "empty",
    "error",
    "loading",
  ]) {
    await page.goto(base + "?calendar&state=" + state);
    if (state === "error") {
      await page.getByText("Could not load calendars.", { exact: false }).waitFor();
      continue;
    }
    if (state === "loading") {
      await page.getByText("Loading your week…", { exact: true }).waitFor();
      continue;
    }
    await page.getByRole("button", { name: "Sync all calendars", exact: true }).waitFor();
    if (state === "empty") {
      assert.equal(
        await page.getByRole("button", { name: "Sync all calendars", exact: true }).isDisabled(),
        true,
      );
      await page
        .getByText("No calendars connected. Add a calendar in Settings.", { exact: true })
        .waitFor();
    } else {
      await page.getByText("Sync options for Google Calendar", { exact: true }).click();
      if (state === "disabled" || state === "disconnected") {
        assert.equal(
          await page
            .getByRole("button", { name: "Sync Google Calendar", exact: true })
            .isDisabled(),
          true,
        );
      } else {
        await page.getByRole("button", { name: "Sync all calendars", exact: true }).click();
        await page
          .getByRole("status")
          .filter({
            hasText:
              state === "sync-error" || state === "network-error"
                ? "1 failed"
                : "0 events in the import window",
          })
          .waitFor();
        assert.deepEqual(await page.evaluate(() => window.__integrationQA.syncs), ["g", "o"]);
        if (state === "sync-error" || state === "network-error") {
          await page.getByRole("alert").filter({ hasText: "Previous events are kept" }).waitFor();
          await page.getByRole("button", { name: "Retry sync Google Calendar" }).click();
          await page
            .getByRole("status")
            .filter({ hasText: "0 calendars synced; 1 failed" })
            .waitFor();
        }
      }
    }
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      if (state !== "empty")
        assert.ok(
          (await page.getByRole("group", { name: "Google Calendar connection" }).boundingBox())
            .width >= 220,
          "Connection identity must not be squeezed by secondary sync controls",
        );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
    }
    assert.equal(await page.locator("iframe").count(), 0);
    assert.deepEqual(await page.evaluate(() => window.__integrationQA.mutations), []);
  }
  assert.deepEqual(errors, []);
  console.log(
    "Integration UI passed: identity/status, sync empty/partial failure/retry, passive collapsed logs, keyboard tabs, labeled ICS, no idle widgets and 320/390px.",
  );
} finally {
  await browser.close();
}
