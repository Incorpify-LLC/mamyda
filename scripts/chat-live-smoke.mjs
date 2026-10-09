// Non-mutating public smoke: no authentication bypass, uploads, or provider calls.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const origin = "https://mamyda.incorpify.in";
const expected = process.env.EXPECTED_RELEASE ?? "board-ux-20261009-17";
assert.equal((await (await fetch(`${origin}/api/health`)).json()).status, "ok");
assert.equal((await (await fetch(`${origin}/release.json`)).json()).release, expected);
const denied = await fetch(`${origin}/api/media/uploads/00000000-0000-4000-8000-000000000000`, {
  method: "PUT",
  headers: { "content-type": "application/octet-stream", "x-media-chunk": "0", Origin: origin },
  body: new Uint8Array(),
});
assert.equal(denied.status, 401, "Anonymous recording uploads must fail closed");
assert.equal(await denied.text(), "Unauthorized");
const captcha = await fetch(`${origin}/api/auth/email-otp/send-verification-otp`, {
  method: "POST",
  headers: { "content-type": "application/json", Origin: origin },
  body: JSON.stringify({ email: "security-probe@example.invalid", type: "sign-in" }),
});
assert.ok([400, 403].includes(captcha.status), "Missing CAPTCHA must reject before sending OTP");
const rejection = await captcha.json();
assert.match(JSON.stringify(rejection), /captcha/i);

await mkdir("screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [],
      failed = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().startsWith(`${origin}/assets/`) && response.status() >= 400)
        failed.push(response.status());
    });
    for (const route of ["/chat", "/minutes", "/settings"]) {
      await page.goto(origin + route);
      await page.getByRole("button", { name: "Email me a code", exact: true }).waitFor();
      await page.waitForTimeout(700);
      assert.equal(
        await page.getByRole("button", { name: "Email me a code", exact: true }).isDisabled(),
        true,
      );
      assert.equal(await page.locator('[data-action="turnstile-spin-v2"]').count(), 1);
      // Managed Turnstile uses a closed shadow root; inspect browser frames instead.
      for (
        let attempt = 0;
        attempt < 20 &&
        !page
          .frames()
          .some((frame) => frame.url().startsWith("https://challenges.cloudflare.com/"));
        attempt++
      )
        await page.waitForTimeout(250);
      assert.equal(
        page
          .frames()
          .filter((frame) => frame.url().startsWith("https://challenges.cloudflare.com/")).length,
        1,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      if (route === "/chat")
        await page.screenshot({
          path: `screenshots/chat-live-signin-${width}.png`,
          fullPage: true,
        });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    await page.close();
  }
  console.log(
    "Live smoke passed: expected release, health, anonymous upload rejected, missing CAPTCHA rejected, protected routes/sign-in, one real widget, desktop/mobile and app assets. Signed-in workflows require OTP.",
  );
} finally {
  await browser.close();
}
