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

No commit, push or deployment performed for this increment. Before closing #18: deploy with approval, manually test a real human challenge and cancellation on desktop/mobile, and confirm signed-in saves end-to-end. CI dependency remediation remains tracked in #22.
