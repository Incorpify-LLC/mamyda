import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentErrors } from "./check-deploy-env.mjs";
const valid = {
  APP_ENV: "staging",
  DATABASE_URL: "postgresql://user:pass@db.example/app",
  BETTER_AUTH_URL: "https://staging.example.com",
  BETTER_AUTH_SECRET: "x".repeat(32),
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  RESEND_API_KEY: "re_test",
};
test("local development remains available without deployment secrets", () =>
  assert.deepEqual(deploymentErrors({}), []));
test("staging and production require database, secure auth and a stable origin", () => {
  for (const APP_ENV of ["staging", "production"]) {
    assert.deepEqual(deploymentErrors({ ...valid, APP_ENV }), []);
    for (const key of ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "TURNSTILE_SECRET_KEY", "RESEND_API_KEY"])
      assert.ok(deploymentErrors({ ...valid, APP_ENV, [key]: "" }).length);
    assert.ok(deploymentErrors({ ...valid, APP_ENV, OTP_SINK: "1" }).length);
  }
  assert.ok(deploymentErrors({ ...valid, VITE_AUTH_ENABLED: "false" }).length);
  assert.ok(deploymentErrors({ ...valid, BETTER_AUTH_URL: "http://example.com" }).length);
  assert.ok(deploymentErrors({ ...valid, DATABASE_URL: "https://example.com" }).length);
});
test("Vercel cannot silently skip deployment validation", () =>
  assert.ok(deploymentErrors({ VERCEL: "1" }).length));
