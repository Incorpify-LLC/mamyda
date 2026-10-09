# Submission-only verification (#18)

## User experience

Ordinary saves start a single on-demand security check and continue automatically when a fresh token arrives. Opening or editing these forms does not mount a widget:

- Tasks, Notes and Minutes.
- Client/project create and edit dialogs.
- Calendar event saves, provider connections and ICS feed addition.
- Alert preferences and Telegram link-code generation.
- LLM/transcription settings and daily chat saves.

The check uses Cloudflare's [interaction-only appearance](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/): the interactive widget appears only when required. A compact widget fits narrow screens. Cancellation keeps the draft; failures show retry guidance. Save controls prevent competing submissions.

AI requests, model tests, paid transcription and notifications retain their explicit consent/confirmation flows. Task deletion and client/project archiving also require confirmation. Authentication and existing upload/delete confirmation dialogs are unchanged.

## Security contract

`SubmissionVerificationProvider` owns one pending ordinary submission. Its request ID and owner prevent stale callbacks from submitting after cancellation/navigation. The token is delivered directly to the original handler, not cached in form state or browser storage. A retry creates a fresh check.

Existing backend authentication, action and hostname checks remain. Siteverify stays server-side, as required by [Cloudflare's validation contract](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). Minutes saves now also require the `minute-save` action before database access. Widget configuration, keys and secrets are unchanged.

## Verification

Tests began with a failing missing-module check, then passed after implementing the request controller. All 170 application tests and type checking pass. Scoped lint has no errors (a fast-refresh warning remains for the shared hook/component module). The production build passes with the existing browser externalization warnings.

Run the local isolated fixture server and:

- `node scripts/verification-ui-e2e.mjs`
- `node scripts/chat-ui-e2e.mjs`
- `node scripts/board-ui-e2e.mjs`

Real client/project dialogs verify no idle widgets, one active widget, automatic single save, cancelled/stale callbacks, expiration/error retry, preserved drafts and fresh tokens after server failure. Chat checks verify automatic saves while preserving explicit model consent. Server contract tests reject missing/failed/mismatched tokens. Connected Chrome also inspected the clean, widget-free client dialog.

A non-mutating direct Siteverify dummy-token probe returned the expected `invalid-input-response` for the existing server secret. The Spin helper was not used because its `jq '.success // "missing"'` expression incorrectly treats a legitimate false result as missing. The direct probe does not prove human challenge completion or widget hostname metadata.

## Deployment

Released with user approval as `submission-verification-20261009-18`, source commit `087bdac`, ARM64 image `1705b29c4415`. Candidate and public live health/release checks passed. Public smoke confirmed protected routes/assets and rejection of anonymous uploads and missing-CAPTCHA OTP requests. Only the pi03 app container was replaced; no migrations were required, and the database, secrets, worker and tunnel were preserved.

In authenticated Chrome, opening a new task mounted no widget. Offline submission failed visibly; cancelling returned to the intact title, body and priority with no widget left mounted. Retrying online mounted the real Cloudflare human checkbox. After the user completed it, the task saved automatically without another Save click; a read-only database check confirmed exactly one temporary record. At 390px, the grouped list and task editor fit without page overflow, and opening the editor mounted no widget. Mobile submission displayed one compact verification dialog and, after human completion, automatically updated the same task exactly once. Cleanup passed the explicit Delete confirmation and a fresh human check. The UI and a read-only database count confirmed no temporary QA tasks remain; existing customer tasks were untouched. Signed-in live checks exercised task creation, editing, cancellation and deletion; other ordinary-save flows were covered by isolated browser fixtures, not production writes. #18 is complete.

Rollback image: `mamyda-feedback-rollback:submission-verification-20261009-18-app`. Private source/database snapshots are on pi03 under `/home/sanjayu/mamyda-rollbacks/submission-verification-20261009-18/`. Roll back code without restoring the database unless separately authorized.

GitHub CI run 37947020645 stopped at the unchanged dependency audit. The 170 local app tests, type checking, browser regression checks and production build passed; this is not green CI. Dependency remediation remains tracked in #22.
