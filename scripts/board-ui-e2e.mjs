// Local in-memory fixture only; no customer tasks, credentials or real CAPTCHA.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  await mkdir("screenshots", { recursive: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (error) => errors.push(error.message));
  const url = "http://127.0.0.1:8082/tests/browser/chat-fixture.html?board";
  await page.goto(url);
  const board = page.getByRole("region", { name: "Project tasks", exact: true });
  await page.waitForFunction(
    () => document.querySelector("[data-task-view]")?.dataset.taskView === "list",
  );
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Create backlog" }).waitFor();
  await page.getByRole("button", { name: "Add task to Waiting", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Create waiting" }).waitFor();
  const open = page.getByRole("button", { name: /^Open task/ });
  await open.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("status").filter({ hasText: "Opened one" }).waitFor();
  await page.getByRole("combobox", { name: /^Move .* to status$/ }).selectOption("waiting");
  await page
    .getByRole("region", { name: "Waiting tasks", exact: true })
    .getByRole("button", { name: /^Open task/ })
    .waitFor();
  await page.getByRole("button", { name: "Toggle move failure" }).click();
  await page.getByRole("combobox", { name: /^Move .* to status$/ }).selectOption("done");
  await page.getByRole("alert").filter({ hasText: "Could not move" }).waitFor();
  assert.equal(
    await page.getByRole("combobox", { name: /^Move .* to status$/ }).inputValue(),
    "waiting",
  );
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.screenshot({ path: `screenshots/board-list-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Kanban", exact: true }).click();
  assert.equal(await board.getAttribute("data-task-view"), "kanban");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("[data-task-view]")?.dataset.taskView === "kanban",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "screenshots/board-kanban-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await page.screenshot({ path: "screenshots/board-kanban-dark.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector("h1")).fontFamily.includes("serif") &&
        !getComputedStyle(document.querySelector("h1")).fontFamily.includes("sans-serif"),
    ),
    false,
  );
  await page.getByRole("button", { name: "Grouped list", exact: true }).click();
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("[data-task-view]")?.dataset.taskView === "list",
  );
  await page.getByRole("button", { name: "Empty project" }).click();
  assert.equal(await board.getByText("No tasks yet.", { exact: true }).count(), 5);
  await page.evaluate(() => localStorage.removeItem("mamyda-task-view"));
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("[data-task-view]")?.dataset.taskView === "kanban",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Board UI passed: responsive defaults, persistence, creation, keyboard opening, status/error recovery, empty groups, light/dark, 320/390px overflow.",
  );
} finally {
  await browser.close();
}
