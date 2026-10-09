// Run only with isolated dev DB, mocked provider fetch, and in-memory S3 fixture.
import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
const testTitle = `QA daily ${Date.now()}`;
const originalGoto = page.goto.bind(page);
page.goto = async (...args) => {
  const response = await originalGoto(...args);
  await page.waitForTimeout(1000);
  return response;
};
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => void dialog.accept());
await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) =>
  route.fulfill({
    contentType: "application/javascript",
    body: 'window.turnstile={render:function(container,options){setTimeout(function(){options.callback("isolated-test-token");},50);return "fixture-widget";},remove:function(){},reset:function(){}};',
  }),
);
try {
  await page.goto(base + "/settings?section=llm");
  await page.getByLabel("API provider").selectOption("openai");
  await page.getByLabel("API model ID").fill("fixture-model");
  await page.getByLabel("API key", { exact: true }).fill("fixture-key");
  await page.getByLabel("Enable LLM writing assistance").check();
  await page.getByRole("button", { name: "Save LLM settings", exact: true }).click();
  await page
    .getByText("LLM settings saved; model access has not been tested", { exact: true })
    .waitFor();
  assert.equal(await page.getByLabel("API key", { exact: true }).inputValue(), "");
  await page.getByLabel("Enable recording transcription").check();
  await page.getByLabel("Speech-to-text model").selectOption("gpt-4o-mini-transcribe");
  await page.getByLabel("OpenAI transcription API key").fill("fixture-transcription-key");
  await page.getByRole("button", { name: "Save transcription settings", exact: true }).click();
  await page
    .getByText("Transcription settings saved; provider access is not tested", { exact: true })
    .waitFor();
  assert.equal(await page.getByLabel("OpenAI transcription API key").inputValue(), "");
  await page.goto(base + "/vault");
  await page.getByLabel("Passphrase", { exact: true }).fill("fixture vault passphrase");
  if (await page.getByRole("button", { name: "Generate key", exact: true }).count())
    await page.getByRole("button", { name: "Generate key", exact: true }).click();
  else await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await page.getByRole("button", { name: "Lock", exact: true }).waitFor();
  await page.goto(base + "/chat");
  await page.getByLabel("Question", { exact: true }).fill("How should we proceed?");
  await page.getByRole("button", { name: "Ask model", exact: true }).click();
  await page.getByLabel(/I agree to send this question, chat history/).check();
  await page.getByRole("button", { name: "Ask Model now", exact: true }).click();
  await page.getByText("Mocked context answer.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Save chat", exact: true }).click();
  await page.getByLabel("Chat title", { exact: true }).fill(testTitle);
  await page
    .getByLabel("Archive date", { exact: true })
    .fill(
      new Date(Date.now() - Math.floor(Math.random() * 10000 + 1) * 86400000)
        .toISOString()
        .slice(0, 10),
    );
  await page.getByLabel("Tags (comma separated)").fill("qa-release");
  await page.getByRole("button", { name: "Save chat now", exact: true }).click();
  await page.getByText("Daily chat saved", { exact: true }).waitFor();
  await page.reload();
  assert.equal(await page.getByText("Mocked context answer.", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Saved chats", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(testTitle) }).click();
  await page.getByText("Mocked context answer.", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() =>
      Object.values(sessionStorage).some((value) => value.includes("Mocked context answer")),
    ),
    false,
  );
  await page.goto(base + "/minutes");
  await page.getByLabel("Notes", { exact: true }).fill("Teh text");
  await page.getByRole("button", { name: "Correct spelling with LLM", exact: true }).click();
  await page.getByLabel(/I agree to send this content to the displayed provider/).check();
  await page.getByRole("button", { name: "Send for editing", exact: true }).click();
  await page.getByText("Edited — review the draft, then save", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Notes", { exact: true }).inputValue(),
    "Corrected body only.",
  );
  await page.getByLabel("Title", { exact: true }).fill("QA recording minutes");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Minutes saved", { exact: true }).waitFor();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "fixture.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.alloc(4 * 1024 * 1024 + 10),
  });
  await page.getByLabel(/Send extracted audio to OpenAI/).check();
  await page.getByRole("button", { name: "Upload and transcribe", exact: true }).click();
  await page.getByText("Upload complete — transcription is queued", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("progressbar", { name: "Recording upload progress" }).count(),
    0,
  ); // completed upload removes the file draft
  await page
    .getByRole("button", { name: "Discard temporary recording", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Confirm permanent deletion", exact: true }).click();
  await page
    .getByText("Temporary recording and audio removed; deletion is permanent", { exact: true })
    .waitFor();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(base + "/chat");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: settings, on-demand verified chat/archive, body-only editing, chunk upload, mobile layout. No real provider calls.",
  );
} catch (error) {
  console.error((await page.locator("body").innerText()).slice(-4500));
  throw error;
} finally {
  await browser.close();
}
