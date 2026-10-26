// Disposable fixture only: real browser crypto, no live credentials or customer records.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const url = "http://127.0.0.1:8082/tests/browser/writing-fixture.html";
  await page.goto(url);
  await page.getByText("Key ready", { exact: true }).waitFor();
  await page.getByLabel("Body", { exact: true }).fill("# Opening sentence\n\n- First\n- Second");
  await page.getByRole("status").filter({ hasText: "Draft saved on this device" }).waitFor();
  await page.getByLabel("Draft name", { exact: true }).fill("Named after writing");
  await page.waitForFunction(
    () =>
      JSON.parse(
        Object.entries(localStorage).find(([key]) => key.startsWith("mamyda.editor-draft."))[1],
      ).title === "Named after writing",
  );
  await page.getByLabel("Draft name", { exact: true }).fill("");
  await page.waitForFunction(() =>
    JSON.parse(
      Object.entries(localStorage).find(([key]) => key.startsWith("mamyda.editor-draft."))[1],
    ).title.includes("Opening sentence"),
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByRole("heading", { name: "Opening sentence" }).waitFor();
  assert.equal(await page.locator(".markdown-content li").count(), 2);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  assert.equal(
    await page.getByLabel("Body", { exact: true }).inputValue(),
    "# Opening sentence\n\n- First\n- Second",
  );
  await page.reload();
  await page.getByRole("button", { name: "Restore draft", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Body", { exact: true }).getAttribute("readonly"), "");
  await page.getByRole("button", { name: "Load saved record", exact: true }).click();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(
          Object.entries(localStorage).find(([key]) => key.startsWith("mamyda.editor-draft."))[1],
        ).body,
    ),
    "# Opening sentence\n\n- First\n- Second",
  );
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  assert.match(await page.getByLabel("Body", { exact: true }).inputValue(), /Opening sentence/);
  await page.getByRole("checkbox", { name: "Encrypt draft" }).check();
  await page.getByRole("status").filter({ hasText: "Encrypted draft saved" }).waitFor();
  const stored = await page.evaluate(() =>
    Object.entries(localStorage).filter(([key]) => key.startsWith("mamyda.editor-draft.")),
  );
  assert.equal(stored.length, 1);
  assert.equal(stored[0][1].includes("Opening sentence"), false);
  assert.match(JSON.parse(stored[0][1]).body, /BEGIN PGP MESSAGE/);
  await page.reload();
  await page.getByText("Key ready", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Body", { exact: true }).inputValue(), "");
  await page.getByLabel("Draft passphrase").fill("wrong");
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Could not restore draft" }).waitFor();
  assert.equal(await page.getByLabel("Body", { exact: true }).inputValue(), "");
  await page.getByLabel("Draft passphrase").fill("fixture-only-passphrase");
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector("textarea").value.includes("Opening sentence"),
  );
  assert.equal(await page.getByRole("checkbox", { name: "Encrypt draft" }).isChecked(), true);
  await page.getByRole("status").filter({ hasText: "Encrypted draft saved" }).waitFor();
  await page.getByRole("button", { name: "Simulate successful save" }).click();
  await page.waitForFunction(
    () => !Object.keys(localStorage).some((key) => key.startsWith("mamyda.editor-draft.")),
  );
  await page.getByLabel("Body", { exact: true }).fill("   ");
  await page.reload();
  assert.equal(await page.getByRole("button", { name: "Restore draft", exact: true }).count(), 0);
  // Verify Markdown toolbar, 2-space list tabbing, and monospace font in the editor
  const editor = page.getByLabel("Body", { exact: true });
  const fontFamily = await editor.evaluate((el) => getComputedStyle(el).fontFamily);
  assert.match(fontFamily, /monospace|Mono|Consolas|Courier/i);
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await editor.pressSequentially("Parent item");
  await editor.press("Enter");
  await editor.press("Tab");
  await editor.pressSequentially("Nested item");
  assert.equal(await editor.inputValue(), "- Parent item\n  - Nested item");
  await page.getByRole("button", { name: "Simulate successful save" }).click();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Writing UX passed: Markdown round-trip, reload recovery, encrypted storage, explicit passphrase, wrong-password rejection, empty draft guard, save cleanup and responsive layout.",
  );
} finally {
  await browser.close();
}
