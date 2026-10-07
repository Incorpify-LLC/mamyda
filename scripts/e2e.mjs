import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("screenshots", { recursive: true });
async function signInWithCode(email, name) {
  if (name) await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  const sink = await fetch(`${base}/api/otp-sink?email=${encodeURIComponent(email)}`);
  if (!sink.ok) throw new Error("OTP sink missing. Start the server with OTP_SINK=1 and without Turnstile keys.");
  const { otp } = await sink.json();
  await page.getByLabel("Code", { exact: true }).fill(otp);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
try {
  await page.goto(base);
  await signInWithCode(`qa-${Date.now()}@example.test`, "QA User");
  await page.getByRole("heading", { name: "Today", exact: true }).waitFor();
  for (const route of ["/", "/board", "/calendar", "/notes", "/minutes", "/vault", "/settings"]) {
    await page.goto(base + route);
    await page.locator("h1").waitFor();
    assert.ok((await page.locator("body").innerText()).includes("Mamyda"));
    await page.screenshot({ path: `screenshots/e2e-${route.slice(1) || "today"}.png` });
  }
  await page.goto(base + "/board");
  await page.getByRole("button", { name: "Client", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("QA Client");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "QA Client", exact: true }).waitFor();
  await page.getByRole("button", { name: "Project", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("QA Project");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  await page.getByLabel("Title", { exact: true }).fill("QA Task");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("QA Task", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("QA Task", { exact: true }).waitFor();
  await page.goto(base + "/notes");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByPlaceholder("Write. Use #tags.").fill("QA private note #qa-project");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Note saved", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: /QA private note/ }).waitFor();
  await page.goto(base + "/minutes");
  await page.getByLabel("Title", { exact: true }).fill("QA Minutes");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Minutes saved", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: /QA Minutes/ }).waitFor();
  await page.goto(base + "/settings");
  await page.getByLabel("Your inbox").fill("test@example.test");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Alert preferences saved", { exact: true }).waitFor();
  await page.getByLabel("Your inbox").fill("");
  await Promise.all([
    page.waitForResponse(response => response.request().method() === "POST" && response.ok()),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  await page.reload();
  assert.equal(await page.getByLabel("Your inbox").inputValue(), "");
  await page.goto(base + "/vault");
  await page.getByLabel("Passphrase").fill("QA vault passphrase 42");
  await page.getByRole("button", { name: "Generate key", exact: true }).click();
  await page.getByRole("button", { name: "Lock", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem("mamyda.vault.priv")), null);
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await page.getByRole("button", { name: "Unlock", exact: true }).waitFor();
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(base + "/board");
    await page.getByText("QA Task", { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    await page.screenshot({ path: `screenshots/e2e-board-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Email me a code" }).waitFor();
  await signInWithCode(`qa-second-${Date.now()}@example.test`, "Second User");
  await page.getByRole("heading", { name: "Today", exact: true }).waitFor();
  await page.goto(base + "/board");
  await page.getByText("Add a client, then a project, then the work.").waitFor();
  assert.equal(await page.getByText("QA Task", { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: signup, seven routes, persisted client/project/task/note/minutes, settings, vault lock, mobile layout, signout and account isolation",
  );
} finally {
  await browser.close();
}
