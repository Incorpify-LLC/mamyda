import { test } from "node:test";
import assert from "node:assert/strict";
import { exitCodeFor } from "./browser-smoke-verdict.mjs";
const good = {
  desktop: {
    status: 200,
    bodyTextLen: 100,
    consoleErrors: [],
    pageErrors: [],
    horizontalOverflow: false,
  },
};
test("a blank or overflowing page fails browser verification", () => {
  assert.notEqual(exitCodeFor({ desktop: { ...good.desktop, bodyTextLen: 0 } }), 0);
  assert.notEqual(exitCodeFor({ desktop: { ...good.desktop, horizontalOverflow: true } }), 0);
});
test("production baseline divergence fails browser verification", () => {
  assert.notEqual(exitCodeFor(good, { divergesFromBaseline: true }), 0);
  assert.equal(exitCodeFor(good, { divergesFromBaseline: false }), 0);
});
