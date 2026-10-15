import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:8080";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname))
  throw new Error("E2E writes require an isolated loopback test server, never production.");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
// Only the documented dummy key is supported. This fixture cannot solve a
// real challenge and refuses production widget keys. Backend CAPTCHA guards
// are tested independently; this test server has no Turnstile secret.
await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) =>
  route.fulfill({
    contentType: "application/javascript",
    body: `let next=0; window.turnstile={render(container, options) {
    if(options.sitekey!=='1x00000000000000000000AA') throw new Error('E2E refuses real widget keys');
    const id=String(++next); queueMicrotask(()=>options.callback('fixture-token-'+id)); return id;
  }, remove(){}, reset(){}};`,
  }),
);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("screenshots", { recursive: true });
async function signInWithCode(email, name) {
  if (name) await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  let otp;
  for (let attempt = 0; attempt < 100 && !otp; attempt++) {
    const sink = await fetch(`${base}/api/otp-sink?email=${encodeURIComponent(email)}`);
    if (sink.ok) otp = (await sink.json()).otp;
    if (!otp) await page.waitForTimeout(100);
  }
  assert.ok(otp, "OTP sink missing. Use OTP_SINK=1 on an isolated server without Turnstile keys.");
  await page.getByLabel("Code", { exact: true }).fill(otp);
  const resend = page.getByRole("button", { name: /Resend code in/ });
  await resend.waitFor();
  assert.equal(await resend.isDisabled(), true);
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
  await page.goto(base + "/clients");
  await page.getByRole("button", { name: "New client", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("QA Client");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("QA Project");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("link", { name: "QA Project", exact: true }).click();
  await page
    .getByLabel("Select project")
    .filter({ has: page.locator("option:checked", { hasText: "QA Project" }) })
    .waitFor();
  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  await page.getByLabel("Title", { exact: true }).fill("QA Task");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("QA Task", { exact: true }).waitFor();
  const taskTrigger = page.getByRole("button", { name: "Open task QA Task", exact: true });
  await taskTrigger.focus();
  await taskTrigger.press("Enter");
  await page.getByRole("heading", { name: "Task", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByLabel("Move QA Task to status").selectOption("doing");
  await page.getByText("QA Task", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("QA Task", { exact: true }).waitFor();
  await page.goto(base + "/notes");
  await page.getByRole("button", { name: "New note", exact: true }).click();
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
  await page.goto(base + "/settings?section=alerts");
  await page.getByLabel("Your inbox").fill("test@example.test");
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await page.getByText("Alert preferences saved", { exact: true }).waitFor();
  await page.getByLabel("Your inbox").fill("");
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST" && response.ok()),
    page.getByRole("button", { name: "Save preferences", exact: true }).click(),
  ]);
  await page.reload();
  assert.equal(await page.getByLabel("Your inbox").inputValue(), "");
  await page.goto(base + "/vault");
  await page.getByLabel("Passphrase").fill("QA vault passphrase 42");
  await page.getByRole("button", { name: "Generate key", exact: true }).click();
  await page.getByRole("button", { name: "Lock Vault", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem("mamyda.vault.priv")), null);
  await page.getByRole("button", { name: "Lock Vault", exact: true }).click();
  await page.getByRole("button", { name: "Unlock Vault", exact: true }).waitFor();
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 320, height: 800 },
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
} catch (error) {
  await page.screenshot({ path: "screenshots/e2e-failure.png", fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
