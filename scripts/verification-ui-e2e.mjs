// Exercise real client/project dialogs against local stub services, never production.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.__verificationQA = { calls: [], failNext: false };
  });
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
      window.__checks={active:0,peak:0,renders:0,appearances:[]};
      const widgets=new Map();
      window.turnstile={render(holder,options){
        const id=String(++window.__checks.renders);
        window.__checks.active++; window.__checks.peak=Math.max(window.__checks.peak,window.__checks.active);
        window.__checks.appearances.push(options.appearance);
        const button=document.createElement('button');button.type='button';button.textContent='Verify fixture';
        const verify=()=>options.callback(options.action+'-token-'+id);
        button.onclick=()=>{verify();verify();};holder.append(button);
        window.__late=verify;
        window.__expire=()=>options['expired-callback']();
        window.__checkError=()=>options['error-callback']('600010');
        widgets.set(id,holder);return id;
      },remove(id){if(widgets.has(id)){widgets.get(id).replaceChildren();widgets.delete(id);window.__checks.active--; }},reset(){}};
    `,
    }),
  );
  await page.goto("http://127.0.0.1:8082/tests/browser/chat-fixture.html?verification");
  await page.getByRole("button", { name: "New client", exact: true }).click();
  assert.equal(await page.locator('[data-action="turnstile-spin-v2"]').count(), 0);
  await page.getByLabel("Name", { exact: true }).fill("Retained client draft");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.invalid");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture", exact: true }).waitFor();
  assert.equal(await page.locator('[data-action="turnstile-spin-v2"]').count(), 1);
  assert.equal(await page.evaluate(() => window.__verificationQA.calls.length), 0);
  await page.getByRole("button", { name: "Cancel security check" }).click();
  await page.evaluate(() => window.__late());
  assert.equal(await page.evaluate(() => window.__verificationQA.calls.length), 0);
  assert.equal(
    await page.getByLabel("Name", { exact: true }).inputValue(),
    "Retained client draft",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture" }).waitFor();
  await page.evaluate(() => window.__expire());
  await page.getByText("Security check expired. Complete it again to continue.").waitFor();
  assert.equal(await page.evaluate(() => window.__verificationQA.calls.length), 0);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture" }).click();
  await page.getByRole("status").filter({ hasText: "Saved 1" }).waitFor();
  assert.equal(await page.evaluate(() => window.__verificationQA.calls.length), 1);
  assert.equal(await page.locator('[data-action="turnstile-spin-v2"]').count(), 0);
  const first = await page.evaluate(() => window.__verificationQA.calls[0]);
  assert.equal(first.data.name, "Retained client draft");
  assert.match(first.headers["x-turnstile-response"], /^client-manage-token-/);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  assert.equal(await page.locator('[data-action="turnstile-spin-v2"]').count(), 0);
  await page.getByLabel("Name", { exact: true }).fill("Retained project draft");
  await page.evaluate(() => {
    window.__verificationQA.failNext = true;
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture" }).click();
  await page
    .getByText("Fixture save failure. Your draft is unchanged.", { exact: true })
    .first()
    .waitFor();
  assert.equal(
    await page.getByLabel("Name", { exact: true }).inputValue(),
    "Retained project draft",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture" }).waitFor();
  await page.evaluate(() => window.__checkError());
  await page.getByText("Security check failed to load. Retry the check.").waitFor();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("button", { name: "Verify fixture" }).click();
  await page.getByRole("status").filter({ hasText: "Saved 2" }).waitFor();
  const calls = await page.evaluate(() => window.__verificationQA.calls);
  assert.equal(calls.length, 3);
  assert.notEqual(
    calls[1].headers["x-turnstile-response"],
    calls[2].headers["x-turnstile-response"],
  );
  assert.equal(await page.evaluate(() => window.__checks.peak), 1);
  assert.equal(
    await page.evaluate(() =>
      window.__checks.appearances.every((value) => value === "interaction-only"),
    ),
    true,
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log(
    "Verification UI passed: no idle widgets, one active check, automatic single save, cancellation/stale callbacks, expiry/error retry, retained drafts and fresh retry tokens.",
  );
} finally {
  await browser.close();
}
