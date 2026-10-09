// Isolated fixtures only: no customer records, credentials or live CAPTCHA.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (error) => errors.push(error.message));
  const base = "http://127.0.0.1:8082/tests/browser/context-fixture.html";
  const context = page.getByRole("status", { name: "Resolved context" });
  await page.goto(base);
  await context.filter({ hasText: "/board · a / p" }).waitFor();
  await page.getByRole("combobox", { name: "Select client", exact: true }).selectOption("b");
  await context.filter({ hasText: "/board · b / q" }).waitFor();
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Calendar", exact: true })
    .click();
  await context.filter({ hasText: "/calendar" }).waitFor();
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Board", exact: true })
    .click();
  await context.filter({ hasText: "/board · b / q" }).waitFor();
  for (const [name, path] of [
    ["Notes", "notes"],
    ["Minutes", "minutes"],
    ["Files", "files"],
    ["Vault", "vault"],
    ["Tasks", "board"],
  ]) {
    await page
      .getByRole("navigation", { name: "Board sections" })
      .getByRole("link", { name, exact: true })
      .click();
    await context.filter({ hasText: `/${path} · b / q` }).waitFor();
  }
  await page.getByRole("combobox", { name: "Select client", exact: true }).selectOption("a");
  await context.filter({ hasText: "/board · a / p" }).waitFor();
  await page.getByRole("button", { name: "Go back" }).click();
  await context.filter({ hasText: "/board · b / q" }).waitFor();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    const bottom = page.getByRole("navigation", { name: "Primary navigation" });
    assert.equal(await bottom.getByRole("link").count(), 3);
    await bottom.getByRole("button", { name: "More navigation" }).click();
    const menu = page.getByRole("dialog", { name: "Navigate Mamyda" });
    await menu.getByRole("link", { name: "Clients/Projects", exact: true }).waitFor();
    await menu.getByRole("link", { name: "Preferences", exact: true }).click();
    await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("dark");
    assert.equal(
      await page.evaluate(() => document.documentElement.classList.contains("dark")),
      true,
    );
    await page.getByRole("combobox", { name: "Task spacing", exact: true }).selectOption("compact");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.density), "compact");
    await page
      .getByRole("combobox", { name: "Default task view", exact: true })
      .selectOption("list");
    assert.equal(await page.evaluate(() => localStorage.getItem("mamyda-task-view")), "list");
    await page
      .getByRole("combobox", { name: "Default task view", exact: true })
      .selectOption("auto");
    assert.equal(await page.evaluate(() => localStorage.getItem("mamyda-task-view")), null);
    assert.equal(await page.locator("iframe").count(), 0);
    await page.goto(base + "?entry=" + encodeURIComponent("/board?projectId=q"));
    await context.filter({ hasText: "/board · b / q" }).waitFor();
  }
  for (const entry of [
    "/files?projectId=x",
    "/board?projectId=missing",
    "/notes?clientId=a&projectId=q",
  ]) {
    await page.goto(base + "?entry=" + encodeURIComponent(entry));
    await page.getByRole("alert").filter({ hasText: "unavailable or archived" }).waitFor();
    assert.match(await context.innerText(), /all \/ all/);
    await page.getByRole("combobox", { name: "Select client", exact: true }).selectOption("b");
    await context.filter({ hasText: "b / q" }).waitFor();
    assert.equal(await page.getByRole("alert").count(), 0);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base);
  await context.filter({ hasText: "/board · a / p" }).waitFor();
  const selector = page.getByRole("combobox", { name: "Select client", exact: true });
  await selector.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await context.filter({ hasText: "/board · b / q" }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Context/navigation/preferences checks passed (direct links, Back, recovery, keyboard, 320/390px).",
  );
} finally {
  await browser.close();
}
