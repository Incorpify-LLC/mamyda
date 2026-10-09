// Run against the isolated, auth-disabled, in-memory dev server only.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => void dialog.accept());
await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) =>
  route.fulfill({
    contentType: "application/javascript",
    body: `
  window.__widgets={active:0,peak:0,renders:0,actions:[],tokens:[]};
  const holders=new Map();
  window.turnstile={render(container,options){
    const id=String(++window.__widgets.renders);
    window.__widgets.active++; window.__widgets.peak=Math.max(window.__widgets.peak,window.__widgets.active);
    window.__widgets.actions.push(options.action);
    const button=document.createElement('button'); button.type='button'; button.textContent='Verify security fixture';
    button.onclick=()=>{const token=options.action+'-token-'+id;window.__widgets.tokens.push(token);options.callback(token);};
    container.append(button); holders.set(id,container);
    window.__expireSecurity=()=>options['expired-callback']();
    return id;
  }, remove(id){if(holders.has(id)){holders.get(id).replaceChildren();holders.delete(id);window.__widgets.active--; }}, reset(){}};
`,
  }),
);
try {
  await mkdir("screenshots", { recursive: true });
  await page.goto("http://127.0.0.1:8082/tests/browser/chat-fixture.html");
  await page.getByRole("heading", { name: "What would you like to work on?" }).waitFor();
  assert.equal(await page.locator('[data-action="turnstile-spin-v2"]').count(), 0);
  assert.equal(await page.getByLabel("Encrypt content with my Vault key").count(), 0);
  await page.screenshot({ path: "screenshots/chat-redesign-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "fixture-model", exact: true }).click();
  await page.getByLabel("Context item", { exact: true }).selectOption("task:task");
  await page.getByRole("button", { name: "Attach selected item", exact: true }).click();
  await page.getByLabel("Reasoning effort").selectOption("high");
  await page.getByRole("button", { name: "fixture-model", exact: true }).click();
  await page.getByLabel("Question", { exact: true }).fill("What are the next steps?");
  await page.getByRole("button", { name: "Ask model", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.locator('[data-action="turnstile-spin-v2"]').count(), 1);
  assert.equal(await page.evaluate(() => window.__chatQA.asks.length), 0);
  const confirm = page.getByRole("button", { name: "Ask Model now", exact: true });
  assert.equal(await confirm.isDisabled(), true);
  await page.getByRole("button", { name: "Verify security fixture" }).click();
  assert.equal(await page.evaluate(() => window.__chatQA.asks.length), 0);
  assert.equal(await confirm.isDisabled(), true);
  await page.getByLabel(/I agree to send this question/).check();
  await page.evaluate(() => window.__expireSecurity());
  assert.equal(await confirm.isDisabled(), true);
  await page.getByRole("button", { name: "Verify security fixture" }).click();
  await confirm.click();
  await page.getByText("A clear answer using the attached context.", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-action="turnstile-spin-v2"]').count(), 0);
  const asked = await page.evaluate(() => window.__chatQA.asks);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].data.context[0].body, "A readable project excerpt.");
  assert.equal(asked[0].data.selection.effort, "high");
  await page.getByRole("button", { name: "Save chat", exact: true }).click();
  await page.getByLabel("Chat title", { exact: true }).fill("Reviewed daily chat");
  await page.getByLabel("Tags (comma separated)").fill("project, review");
  await page.getByRole("button", { name: "Verify security fixture" }).click();
  await page.getByRole("button", { name: "Save chat now", exact: true }).click();
  await page.getByText("Daily chat saved", { exact: true }).waitFor();
  const saved = await page.evaluate(() => window.__chatQA.saves);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].data.encryption, undefined);
  assert.equal(saved[0].token.startsWith("chat-save-token-"), true);
  assert.notEqual(saved[0].token, asked[0].token);
  assert.equal(await page.evaluate(() => window.__widgets.peak), 1);
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await page.screenshot({ path: "screenshots/chat-redesign-dark.png", fullPage: true });
  await page.getByRole("button", { name: "Use light theme" }).click();

  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await page.getByLabel("Question", { exact: true }).fill("Keep this question if the model fails.");
  await page.evaluate(() => {
    window.__chatQA.failNext = true;
  });
  await page.getByRole("button", { name: "Ask model", exact: true }).click();
  await page.getByRole("button", { name: "Verify security fixture" }).click();
  await page.getByLabel(/I agree to send this question/).check();
  await page.getByRole("button", { name: "Ask Model now", exact: true }).click();
  await page.getByText(/Fixture provider failure.*Your draft is kept/).waitFor();
  assert.equal(
    await page.getByLabel("Question", { exact: true }).inputValue(),
    "Keep this question if the model fails.",
  );
  assert.equal(await page.locator('[data-action="turnstile-spin-v2"]').count(), 0);
  assert.equal(await page.evaluate(() => window.__chatQA.asks.length), 2);
  await page.getByRole("button", { name: "Ask model", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__chatQA.asks.length), 2);

  await page.getByRole("button", { name: "Saved chats", exact: true }).click();
  await page.getByRole("button", { name: /Protected earlier chat/ }).click();
  assert.equal(await page.getByText("Previously encrypted reply.", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Open saved chat", exact: true }).click();
  await page.getByLabel("Original Vault passphrase").fill("wrong");
  await page.getByRole("button", { name: "Open read-only", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#legacy-chat-passphrase")?.value === "");
  assert.equal(await page.getByText("Previously encrypted reply.", { exact: true }).count(), 0);
  await page.getByLabel("Original Vault passphrase").fill("fixture-passphrase");
  await page.getByRole("button", { name: "Open read-only", exact: true }).click();
  await page.getByText("Previously encrypted reply.", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Save chat", exact: true }).isDisabled(),
    true,
  );
  assert.equal(await page.getByLabel("Question", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Close saved content", exact: true }).click();
  assert.equal(await page.getByText("Previously encrypted reply.", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "New chat", exact: true }).click();

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    await page.getByLabel("Question", { exact: true }).fill("Mobile question");
    await page.getByRole("button", { name: "Ask model", exact: true }).click();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    await page.screenshot({ path: `screenshots/chat-redesign-check-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await page.getByLabel("Question", { exact: true }).fill("");
  await page.screenshot({ path: "screenshots/chat-redesign-mobile.png", fullPage: true });

  await page.goto("http://127.0.0.1:8082/tests/browser/chat-fixture.html?recording");
  await page.getByRole("button", { name: "Select recording", exact: true }).waitFor();
  const input = page.locator('input[type="file"]');
  assert.match(await input.getAttribute("accept"), /\.wav/);
  await input.setInputFiles({
    name: "unsupported.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("bad"),
  });
  await page
    .getByText(/File type not supported/)
    .first()
    .waitFor();
  await input.setInputFiles({
    name: "meeting.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("fixture wav"),
  });
  await page.getByText("Recording selected.", { exact: false }).waitFor();
  await page.getByText(/meeting.wav ·/).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Upload and transcribe", exact: true }).isDisabled(),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Chat UI checks passed: one on-demand widget, explicit confirmation, fresh save token, expiry/cancel/failure, legacy read-only, context/effort, dark/mobile, recording selection errors. No paid provider calls.",
  );
} finally {
  await browser.close();
}
