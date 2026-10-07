import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:8082";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname))
  throw new Error(
    "Writing QA creates disposable accounts and must run only on a local test server.",
  );
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
const button = (name) => page.getByRole("button", { name, exact: true });
const modal = () => page.getByRole("dialog");
async function waitFor(check) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await page.waitForTimeout(100);
  }
  throw new Error("Assertion timed out");
}
async function navigate(name) {
  await page.getByRole("link", { name, exact: true }).first().click();
}
try {
  await mkdir("screenshots", { recursive: true });
  await page.goto(base);
  const email = `writing-qa-${Date.now()}@example.test`;
  await page.getByLabel("Name", { exact: true }).fill("Writing QA");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await button("Email me a code").click();
  let otp;
  await waitFor(async () => {
    const response = await fetch(`${base}/api/otp-sink?email=${email}`);
    if (!response.ok) return false;
    otp = (await response.json()).otp;
    return !!otp;
  });
  await page.getByLabel("Code", { exact: true }).fill(otp);
  await button("Sign in").click();
  await page.getByRole("heading", { name: "Today", exact: true }).waitFor();
  await navigate("Notes");
  await button("New").click();
  const body = () => page.getByLabel("Note body");
  await body().fill("Original note");
  let saveEndpoint;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("_serverFn"))
      saveEndpoint = request.url();
  });
  await button("Save").click();
  await page.getByRole("button", { name: /Original note/ }).waitFor();
  await body().fill("Keep this unsaved note");
  await button("New").click();
  await modal().waitFor();
  await modal().getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await body().inputValue(), "Keep this unsaved note");
  await navigate("Minutes");
  await modal().waitFor();
  await modal().getByRole("button", { name: "Cancel", exact: true }).click();
  assert.ok(page.url().endsWith("/notes"));
  await body().fill("Recovered note body");
  await page.reload();
  await button("Restore draft").click();
  assert.equal(await body().inputValue(), "Recovered note body");
  // A failed request keeps the same draft and allows a retry.
  assert.ok(saveEndpoint, "Captured server-function save endpoint");
  await page.route(saveEndpoint, (route) =>
    route.fulfill({ status: 503, contentType: "text/plain", body: "Temporary save failure" }),
  );
  await button("Save").click();
  await page.getByRole("alert").filter({ hasText: "Save failed" }).waitFor();
  assert.equal(await body().inputValue(), "Recovered note body");
  await page.unroute(saveEndpoint);
  await navigate("Minutes");
  await modal().getByRole("button", { name: "Save and continue", exact: true }).click();
  await page.getByRole("heading", { name: "Minutes", exact: true }).waitFor();
  await page.getByLabel("Title", { exact: true }).fill("Draft minutes");
  await page.getByLabel("Attendees").fill("Alice, Bob");
  await page.getByLabel("Notes", { exact: true }).fill("Decisions and actions");
  await button("Save").click();
  await page.getByRole("button", { name: /Draft minutes/ }).waitFor();
  await page.getByLabel("Notes", { exact: true }).fill("Unsaved decisions");
  await button("New").click();
  await modal().waitFor();
  await modal().getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await button("Restore draft").click();
  assert.equal(await page.getByLabel("Notes", { exact: true }).inputValue(), "Unsaved decisions");
  assert.equal(await page.getByLabel("Attendees").inputValue(), "Alice, Bob");
  await page.screenshot({ path: "screenshots/writing-minutes-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await button("New").click();
  await modal().waitFor();
  await page.screenshot({ path: "screenshots/writing-guard-mobile.png" });
  await modal().getByRole("button", { name: "Discard", exact: true }).click();
  assert.equal(await page.getByLabel("Title", { exact: true }).inputValue(), "");
  assert.equal(await page.getByLabel("Notes", { exact: true }).inputValue(), "");
  await page.setViewportSize({ width: 1280, height: 900 });
  await navigate("Notes");
  await page.getByRole("button", { name: /Recovered note body/ }).click();
  assert.equal(await body().inputValue(), "Recovered note body");
  await body().fill("Switch must not lose me");
  await button("New").click();
  await modal().getByRole("button", { name: "Save and continue", exact: true }).click();
  await waitFor(async () => (await body().inputValue()) === "");
  assert.equal(await body().inputValue(), "");
  await body().fill("New draft to discard");
  await page.getByRole("button", { name: /Switch must not lose me/ }).click();
  await modal().getByRole("button", { name: "Discard", exact: true }).click();
  assert.equal(await body().inputValue(), "Switch must not lose me");
  await navigate("Calendar");
  await page.getByText("Connected calendars", { exact: true }).waitFor();
  await button("Sync").click();
  await page.getByRole("status").filter({ hasText: "No calendars connected" }).waitFor();
  await page.screenshot({ path: "screenshots/calendar-sync-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "screenshots/calendar-sync-mobile.png" });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "No horizontal overflow",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await navigate("Settings");
  await page.getByPlaceholder("Name", { exact: true }).fill("Broken QA feed");
  await page
    .getByPlaceholder("https://…/calendar.ics", { exact: true })
    .fill("https://example.com/");
  await button("Add feed").click();
  await page.getByText(/^Broken QA feed/).waitFor();
  await navigate("Calendar");
  await page.getByText("Broken QA feed", { exact: true }).waitFor();
  await page.getByRole("alert").first().waitFor();
  await button("Retry").click();
  await page.getByRole("status").filter({ hasText: "1 failed" }).waitFor();
  await page.screenshot({ path: "screenshots/calendar-sync-failure.png" });
  await navigate("Notes");
  await button("New").click();
  await body().fill("Sign-out draft");
  await button("Sign out").click();
  await modal().waitFor();
  await modal().getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await body().inputValue(), "Sign-out draft");
  await button("Sign out").click();
  await modal().getByRole("button", { name: "Discard", exact: true }).click();
  await button("Email me a code").waitFor();
  assert.equal(
    await page.evaluate(
      () => Object.keys(sessionStorage).filter((k) => k.startsWith("mamyda.writing-draft.")).length,
    ),
    0,
  );
  assert.deepEqual(errors, [], "No uncaught browser errors");
  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          "Notes and Minutes save, cancel, discard, navigation, refresh recovery",
          "failed save and retry",
          "sign-out guard and cleanup",
          "desktop/mobile rendering",
          "calendar empty-state sync",
          "clean browser errors",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
