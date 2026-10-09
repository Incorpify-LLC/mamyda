// Isolated fixture: no customer data, actual decryption, uploads or paid models.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (error) => errors.push(error.message));
  const base = "http://127.0.0.1:8082/tests/browser/chat-fixture.html?recording";
  await page.goto(base);
  const disclosure = page.getByRole("button", { name: /Transcribe a recording/ });
  await disclosure.waitFor({ timeout: 5000 });
  assert.equal(await disclosure.getAttribute("aria-expanded"), "false");
  assert.equal(
    await page.getByRole("button", { name: "Select recording", exact: true }).isVisible(),
    false,
  );
  await disclosure.focus();
  await page.keyboard.press("Enter");
  assert.equal(await disclosure.getAttribute("aria-expanded"), "true");
  await page.getByRole("button", { name: "Select recording", exact: true }).waitFor();
  await page.getByText("No temporary recordings yet.", { exact: true }).waitFor();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "meeting.wav", mimeType: "audio/wav", buffer: Buffer.alloc(1024) });
  await page.getByText(/Recording selected/).waitFor();
  await disclosure.click();
  assert.equal(await disclosure.getAttribute("aria-expanded"), "false");
  assert.equal(await page.locator('[data-action="turnstile-spin-v2"]').count(), 0);
  await disclosure.click();
  await page.getByText(/meeting.wav ·/).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Upload and transcribe", exact: true }).isDisabled(),
    true,
  );
  for (const state of ["processing", "ready", "error", "loading"]) {
    await page.goto(base + "&state=" + state);
    const toggle = page.getByRole("button", { name: /Transcribe a recording/ });
    await toggle.click();
    if (state === "processing") await page.getByText(/converted segments 42%/).waitFor();
    if (state === "ready") {
      await page.getByText("Review transcript", { exact: true }).waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Reviewed OK — delete recording" }).isDisabled(),
        true,
      );
      await toggle.click();
      await page.getByText("1 transcript ready", { exact: true }).waitFor();
    }
    if (state === "error") {
      await page
        .getByRole("alert")
        .filter({ hasText: "Could not load recording status" })
        .waitFor();
      await page.getByRole("button", { name: "Retry recording status" }).waitFor();
    }
    if (state === "loading")
      await page.getByRole("status").filter({ hasText: "Loading recording status" }).waitFor();
  }
  await page.goto("http://127.0.0.1:8082/tests/browser/chat-fixture.html?editor");
  await page.getByText("What Vault protects today", { exact: true }).click();
  await page.getByText(/Files and Minutes: not Vault-encrypted/).waitFor();
  await page.getByRole("heading", { name: "Keep your passphrase and key backup safe" }).waitFor();
  await page.getByText(/Without them, access can be permanently lost/).waitFor();
  await page.getByRole("button", { name: "Unlock content" }).click();
  await page.getByRole("dialog", { name: "Unlock note content" }).waitFor();
  assert.equal(await page.getByLabel("Vault passphrase").inputValue(), "");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Editor disclosures passed: keyboard/collapse, retained selection, fresh consent, empty/loading/error/progress, ready status, recovery warning, explicit unlock and mobile.",
  );
} finally {
  await browser.close();
}
